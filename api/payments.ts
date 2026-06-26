import type { ApiRequest, ApiResponse } from './_types.js';
import type { PoolClient } from '@neondatabase/serverless';
import { z } from 'zod';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requireBusinessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { json } from './_middleware.js';
import { sql, withTransaction } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { PaymentAllocationSchema, PaymentSchema, PaymentUpdateSchema } from './_schemas.js';
import { withIdempotency } from './_idempotency.js';
import { getPagination, paginatedResponse } from './_pagination.js';

type PaymentRow = {
  id: string;
  reference_id: string;
  client_name?: string | null;
  client_id?: string | null;
  type: 'Inbound' | 'Outbound';
  amount_usd: number;
  currency?: 'USD' | 'GBP' | null;
  method: string;
  date: string;
  status?: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function attachAllocations(rows: PaymentRow[]) {
  if (!rows.length) {
    return rows.map((row) => ({ ...row, allocations: [] }));
  }

  const paymentIds = rows.map((payment) => payment.id);
  const allocationRows = await sql`
    SELECT id, payment_id, invoice_id, amount_allocated, currency, status, created_at
    FROM public.payment_allocations
    WHERE payment_id = ANY(${paymentIds}::uuid[])
    ORDER BY created_at ASC
  `;

  const allocationsByPaymentId = new Map<string, typeof allocationRows>();
  allocationRows.forEach((allocation) => {
    const current = allocationsByPaymentId.get(allocation.payment_id) || [];
    current.push(allocation);
    allocationsByPaymentId.set(allocation.payment_id, current);
  });

  return rows.map((payment) => ({
    ...payment,
    allocations: allocationsByPaymentId.get(payment.id) || [],
  }));
}

const parseAllocationsFromBody = (body: unknown) => {
  const allocations = (body as { allocations?: unknown[] } | undefined)?.allocations;
  if (!Array.isArray(allocations)) return [];
  
  try {
    return allocations.map((allocation) => PaymentAllocationSchema.parse(allocation));
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `allocations.${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Allocation validation error: ${issues}`);
    }
    throw error;
  }
};

async function getInvoiceCurrency(client: PoolClient, invoiceId: string): Promise<string | null> {
  const result = await client.query(
    'SELECT currency FROM public.invoices WHERE id = $1::uuid',
    [invoiceId]
  );
  return result.rows[0]?.currency || null;
}

async function findInvoiceIdByReference(client: PoolClient, reference: string): Promise<string | null> {
  if (!reference) return null;

  if (UUID_REGEX.test(reference)) {
    const rows = await client.query<{ id: string }>(
      'SELECT id FROM public.invoices WHERE invoice_number = $1 OR id = $1::uuid LIMIT 1',
      [reference],
    );
    return rows.rows[0]?.id || null;
  }

  const rows = await client.query<{ id: string }>(
    'SELECT id FROM public.invoices WHERE invoice_number = $1 LIMIT 1',
    [reference],
  );
  return rows.rows[0]?.id || null;
}

async function updateInvoicePaymentStatus(client: PoolClient, invoiceId: string) {
  // Get invoice details
  const invoiceResult = await client.query(
    'SELECT amount_usd, status, invoice_number FROM public.invoices WHERE id = $1::uuid',
    [invoiceId]
  );
  if (invoiceResult.rows.length === 0) return;

  const invoiceAmount = Number(invoiceResult.rows[0].amount_usd);
  const currentStatus = invoiceResult.rows[0].status;
  const invoiceNumber = invoiceResult.rows[0].invoice_number;

  // Only update if currently Draft, Sent, or Overdue
  if (currentStatus !== 'Draft' && currentStatus !== 'Sent' && currentStatus !== 'Overdue') {
    return;
  }

  // payment_allocations is the authoritative source; legacy reference_id matching removed
  const allocationResult = await client.query(
    `
      SELECT COALESCE(SUM(amount_allocated), 0) as total_paid
      FROM public.payment_allocations
      WHERE invoice_id = $1::uuid
    `,
    [invoiceId]
  );
  const totalPaid = Number(allocationResult.rows[0]?.total_paid || 0);

  // Determine new status
  let newStatus: string | null = null;
  if (totalPaid >= invoiceAmount - 0.0001) {
    newStatus = 'Paid';
  } else if (totalPaid > 0) {
    // Partial payment - update to Sent (or could add 'Partial' status in future)
    newStatus = 'Sent';
  }

  if (newStatus && newStatus !== currentStatus) {
    await client.query(
      `
        UPDATE public.invoices
        SET status = $1, updated_at = NOW()
        WHERE id = $2::uuid
      `,
      [newStatus, invoiceId]
    );
  }
}

async function replaceAllocationsForPayment(
  client: PoolClient,
  paymentId: string,
  paymentAmountUsd: number,
  allocations: Array<{ invoice_id?: string; amount_allocated: number; currency: 'USD' | 'GBP'; status?: string }>,
  clientName?: string,
) {
  const totalAllocated = allocations.reduce((sum, allocation) => sum + (allocation.amount_allocated || 0), 0);
  
  // Allow small overpayment (store as credit)
  if (totalAllocated > paymentAmountUsd + 0.01) {
    throw new Error(`Allocated amount ($${totalAllocated.toFixed(2)}) exceeds payment amount ($${paymentAmountUsd.toFixed(2)})`);
  }

  // Get all affected invoice IDs before deletion (for status recalculation)
  const existingAllocations = await client.query(
    'SELECT invoice_id FROM public.payment_allocations WHERE payment_id = $1::uuid',
    [paymentId]
  );
  const affectedInvoiceIds = new Set<string>(
    [...existingAllocations.rows.map(r => r.invoice_id).filter(Boolean), ...allocations.map(a => a.invoice_id).filter(Boolean)] as string[]
  );

  // Validate currency matching (only for allocated payments)
  for (const allocation of allocations) {
    if (allocation.invoice_id) {
      const invoiceCurrency = await getInvoiceCurrency(client, allocation.invoice_id);
      if (invoiceCurrency && invoiceCurrency !== allocation.currency) {
        throw new Error(
          `Currency mismatch: Invoice uses ${invoiceCurrency} but allocation is in ${allocation.currency}`
        );
      }
    }
  }

  await client.query('DELETE FROM public.payment_allocations WHERE payment_id = $1::uuid', [paymentId]);

  // Get client_id if clientName provided
  let clientId: string | null = null;
  if (clientName) {
    const clientResult = await client.query(
      'SELECT id FROM public.clients WHERE name = $1 LIMIT 1',
      [clientName]
    );
    clientId = clientResult.rows[0]?.id || null;
  }

  for (const allocation of allocations) {
    // Determine status based on whether invoice_id is present
    const status = allocation.invoice_id ? 'allocated' : 'unallocated';
    
    await client.query(
      `
        INSERT INTO public.payment_allocations (payment_id, invoice_id, amount_allocated, currency, status, client_id)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
      `,
      [paymentId, allocation.invoice_id || null, allocation.amount_allocated, allocation.currency, status, clientId],
    );
  }

  // Update invoice payment status for all affected invoices
  for (const invoiceId of affectedInvoiceIds) {
    if (invoiceId) {
      await updateInvoicePaymentStatus(client, invoiceId);
    }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Admin', 'Manager', 'Accountant'])) return;

  try {
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    if (action === 'allocations' && req.method === 'POST') {
      if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
      return await replaceAllocations(req, res);
    }

    switch (req.method) {
      case 'GET':
        return await listPayments(req, res);
      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await withIdempotency(authReq, res, 'POST /payments', () =>
          createPayment(authReq, res)
        );
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updatePayment(req, res);
      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deletePayment(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listPayments(req: ApiRequest, res: ApiResponse) {
  try {
    const pagination = getPagination(req);

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM public.payments
      WHERE deleted_at IS NULL
    `;

    const rows = await sql`
      SELECT id, reference_id, client_name, client_id, type, amount_usd, currency, method, date, status
      FROM public.payments
      WHERE deleted_at IS NULL
      ORDER BY date DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}
    `;
    return json(res, 200, paginatedResponse(await attachAllocations(rows as PaymentRow[]), count, pagination));
  } catch (error) {
    return apiError(res, 500, 'Failed to load payments', error);
  }
}

async function createPayment(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = PaymentSchema.parse(req.body);
    const allocations = parseAllocationsFromBody(req.body);

    // Determine payment status based on allocations
    const hasAllocations = allocations.length > 0;
    const hasInvoiceAllocations = hasAllocations && allocations.some(a => a.invoice_id);
    const paymentStatus = hasInvoiceAllocations ? 'allocated' : (hasAllocations ? 'unallocated' : 'unallocated');

    const payment = await withTransaction(async (client) => {
      // Get client_id if client_name provided
      let clientId: string | null = data.client_id || null;
      if (!clientId && data.client_name) {
        const clientResult = await client.query(
          'SELECT id FROM public.clients WHERE name = $1 LIMIT 1',
          [data.client_name]
        );
        clientId = clientResult.rows[0]?.id || null;
      }

      const result = await client.query(
        `
          INSERT INTO public.payments (reference_id, client_name, client_id, type, amount_usd, currency, method, date, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, reference_id, client_name, client_id, type, amount_usd, currency, method, date, status
        `,
        [
          data.reference_id || `PAY-${Date.now()}`,
          data.client_name,
          clientId,
          data.type,
          data.amount_usd,
          data.currency,
          data.method,
          data.date,
          paymentStatus,
        ],
      );

      const createdPayment = result.rows[0] as PaymentRow;
      
      // Handle allocations (including unallocated)
      if (allocations.length > 0) {
        await replaceAllocationsForPayment(client, createdPayment.id, createdPayment.amount_usd, allocations, data.client_name);
      } else if (!hasAllocations) {
        // Create an unallocated allocation entry for tracking
        await client.query(
          `
            INSERT INTO public.payment_allocations (payment_id, invoice_id, amount_allocated, currency, status, client_id)
            VALUES ($1::uuid, NULL, $2, $3, 'unallocated', $4)
          `,
          [createdPayment.id, createdPayment.amount_usd, data.currency || 'USD', clientId],
        );
      }

      // Also update invoice status for legacy payments (reference_id matches invoice)
      if (data.reference_id && data.type === 'Inbound') {
        const invoiceId = await findInvoiceIdByReference(client, data.reference_id);
        if (invoiceId) {
          await updateInvoicePaymentStatus(client, invoiceId);
        }
      }

      return createdPayment;
    });

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'payment:create',
      tableName: 'payments',
      recordId: payment.id,
      newData: { ...data, allocations },
    });

    const [hydrated] = await attachAllocations([payment]);
    return res.status(201).json(hydrated);
  } catch (error) {
    console.error('[Payments API] Create payment error:', error);
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return apiError(res, 400, `Validation error: ${issues}`, error);
    }
    if (error instanceof Error) {
      return apiError(res, 400, error.message, error);
    }
    return apiError(res, 400, 'Invalid payment data', error);
  }
}

async function updatePayment(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = PaymentUpdateSchema.parse(req.body);
    const paymentId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!paymentId) return apiError(res, 400, 'Missing payment id');

    const allocations = parseAllocationsFromBody(req.body);

    // Get old data for audit
    const oldPaymentRows = await sql`
      SELECT * FROM public.payments WHERE id = ${paymentId}::uuid
    `;
    const oldPayment = oldPaymentRows[0];

    const payment = await withTransaction(async (client) => {
      // Determine new payment status based on allocations
      const hasInvoiceAllocations = allocations.length > 0 && allocations.some(a => a.invoice_id);
      const newStatus = hasInvoiceAllocations ? 'allocated' : (allocations.length > 0 ? 'unallocated' : 'unallocated');

      // Get client_id if client_name provided
      let clientId: string | null = data.client_id ?? null;
      if (!clientId && data.client_name) {
        const clientResult = await client.query(
          'SELECT id FROM public.clients WHERE name = $1 LIMIT 1',
          [data.client_name]
        );
        clientId = clientResult.rows[0]?.id ?? null;
      }

      // Build dynamic SET clause — only include fields present in body
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIdx = 1;
      const bodyRecord = req.body as Record<string, unknown>;

      const fieldMap: Record<string, unknown> = {
        reference_id: data.reference_id,
        client_name: data.client_name,
        client_id: clientId,
        type: data.type,
        amount_usd: data.amount_usd,
        currency: data.currency,
        method: data.method,
        date: data.date,
      };

      for (const [field, value] of Object.entries(fieldMap)) {
        if (field in bodyRecord || (field === 'client_id' && clientId !== null)) {
          updates.push(`${field} = $${paramIdx}`);
          values.push(value ?? null);
          paramIdx++;
        }
      }

      // Always update status based on allocations
      updates.push(`status = $${paramIdx}`);
      values.push(newStatus);
      paramIdx++;

      values.push(paymentId);
      const result = await client.query(
        `UPDATE public.payments SET ${updates.join(', ')} WHERE id = $${paramIdx}::uuid RETURNING id, reference_id, client_name, client_id, type, amount_usd, currency, method, date, status`,
        values,
      );

      if (result.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const updatedPayment = result.rows[0] as PaymentRow;
      const clientName = data.client_name || updatedPayment.client_name;
      
      if (Array.isArray((req.body as { allocations?: unknown[] } | undefined)?.allocations)) {
        await replaceAllocationsForPayment(client, updatedPayment.id, updatedPayment.amount_usd, allocations, clientName);
      }

      // Also update invoice status for legacy payments (reference_id matches invoice)
      if (updatedPayment.reference_id && updatedPayment.type === 'Inbound') {
        const invoiceId = await findInvoiceIdByReference(client, updatedPayment.reference_id);
        if (invoiceId) {
          await updateInvoicePaymentStatus(client, invoiceId);
        }
      }

      return updatedPayment;
    });

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'payment:update',
      tableName: 'payments',
      recordId: paymentId,
      oldData: oldPayment,
      newData: { ...data, allocations },
    });

    const [hydrated] = await attachAllocations([payment]);
    return res.status(200).json(hydrated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Payment not found') {
      return apiError(res, 404, error.message);
    }
    return apiError(res, 400, 'Invalid payment update', error);
  }
}

async function replaceAllocations(req: ApiRequest, res: ApiResponse) {
  const paymentId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!paymentId) return apiError(res, 400, 'Missing payment id');

  try {
    const allocations = Array.isArray(req.body)
      ? req.body.map((allocation) => PaymentAllocationSchema.parse(allocation))
      : [];

    const paymentRows = await sql`
      SELECT amount_usd, client_name
      FROM public.payments
      WHERE id = ${paymentId}::uuid
    `;
    if (paymentRows.length === 0) return apiError(res, 404, 'Payment not found');

    await withTransaction(async (client) => {
      await replaceAllocationsForPayment(client, paymentId, Number(paymentRows[0].amount_usd), allocations, paymentRows[0].client_name);
      
      // Update payment status based on allocations
      const hasInvoiceAllocations = allocations.some(a => a.invoice_id);
      const newStatus = hasInvoiceAllocations ? 'allocated' : (allocations.length > 0 ? 'unallocated' : 'unallocated');
      
      await client.query(
        'UPDATE public.payments SET status = $1 WHERE id = $2::uuid',
        [newStatus, paymentId]
      );
      
      return null;
    });

    const rows = await sql`
      SELECT id, payment_id, invoice_id, amount_allocated, currency, status, created_at
      FROM public.payment_allocations
      WHERE payment_id = ${paymentId}::uuid
      ORDER BY created_at ASC
    `;
    return res.status(200).json(rows);
  } catch (error) {
    return apiError(res, 400, 'Invalid payment allocations', error);
  }
}

async function deletePayment(req: AuthenticatedRequest, res: ApiResponse) {
  const paymentId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!paymentId) return apiError(res, 400, 'Missing payment id');

  // Get old data for audit before deletion
  const oldPaymentRows = await sql`
    SELECT * FROM public.payments WHERE id = ${paymentId}::uuid
  `;
  const oldPayment = oldPaymentRows[0];
  if (!oldPayment) return apiError(res, 404, 'Payment not found');

  await withTransaction(async (client) => {
    // Collect affected invoice IDs before removing allocations
    const affectedInvoices = await client.query(
      'SELECT DISTINCT invoice_id FROM public.payment_allocations WHERE payment_id = $1::uuid AND invoice_id IS NOT NULL',
      [paymentId]
    );

    // Remove allocations
    await client.query('DELETE FROM public.payment_allocations WHERE payment_id = $1::uuid', [paymentId]);

    // Soft-delete the payment
    const updateResult = await client.query(
      'UPDATE public.payments SET deleted_at = NOW() WHERE id = $1::uuid RETURNING id',
      [paymentId]
    );

    if (updateResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    // Recalculate invoice payment status for each affected invoice
    for (const row of affectedInvoices.rows) {
      await updateInvoicePaymentStatus(client, row.invoice_id);
    }
  });

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'payment:delete',
    tableName: 'payments',
    recordId: paymentId,
    oldData: oldPayment,
  });

  return res.status(204).end();
}
