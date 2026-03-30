import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PoolClient } from '@neondatabase/serverless';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireRole,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql, withTransaction } from './_db.js';
import { PaymentAllocationSchema, PaymentSchema, PaymentUpdateSchema } from './_schemas.js';

type PaymentRow = {
  id: string;
  reference_id: string;
  client_name?: string | null;
  type: 'Inbound' | 'Outbound';
  amount_usd: number;
  currency?: 'USD' | 'GBP' | null;
  method: string;
  date: string;
};

async function attachAllocations(rows: PaymentRow[]) {
  if (!rows.length) {
    return rows.map((row) => ({ ...row, allocations: [] }));
  }

  const paymentIds = rows.map((payment) => payment.id);
  const allocationRows = await sql`
    SELECT id, payment_id, invoice_id, amount_allocated, currency, created_at
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

const parseAllocationsFromBody = (body: unknown) =>
  Array.isArray((body as { allocations?: unknown[] } | undefined)?.allocations)
    ? ((body as { allocations: unknown[] }).allocations.map((allocation) => PaymentAllocationSchema.parse(allocation)))
    : [];

async function replaceAllocationsForPayment(
  client: PoolClient,
  paymentId: string,
  paymentAmountUsd: number,
  allocations: Array<{ invoice_id: string; amount_allocated: number; currency: 'USD' | 'GBP' }>,
) {
  const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount_allocated, 0);
  if (totalAllocated > paymentAmountUsd + 0.0001) {
    throw new Error('Allocated amount cannot exceed payment amount');
  }

  await client.query('DELETE FROM public.payment_allocations WHERE payment_id = $1::uuid', [paymentId]);

  for (const allocation of allocations) {
    await client.query(
      `
        INSERT INTO public.payment_allocations (payment_id, invoice_id, amount_allocated, currency)
        VALUES ($1::uuid, $2::uuid, $3, $4)
      `,
      [paymentId, allocation.invoice_id, allocation.amount_allocated, allocation.currency],
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!verifyToken(authReq, res)) return;

  try {
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    if (action === 'allocations' && req.method === 'POST') {
      if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
      return await replaceAllocations(req, res);
    }

    switch (req.method) {
      case 'GET':
        return await listPayments(res);
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createPayment(req, res);
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updatePayment(req, res);
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await deletePayment(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listPayments(res: VercelResponse) {
  try {
    const rows = await sql`
      SELECT id, reference_id, client_name, type, amount_usd, currency, method, date
      FROM public.payments
      ORDER BY date DESC
    `;
    return res.status(200).json(await attachAllocations(rows as PaymentRow[]));
  } catch (error) {
    return apiError(res, 500, 'Failed to load payments', error);
  }
}

async function createPayment(req: VercelRequest, res: VercelResponse) {
  try {
    const data = PaymentSchema.parse(req.body);
    const allocations = parseAllocationsFromBody(req.body);

    const payment = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO public.payments (reference_id, client_name, type, amount_usd, currency, method, date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, reference_id, client_name, type, amount_usd, currency, method, date
        `,
        [
          data.reference_id,
          data.client_name,
          data.type,
          data.amount_usd,
          data.currency,
          data.method,
          data.date,
        ],
      );

      const createdPayment = result.rows[0] as PaymentRow;
      if (allocations.length > 0) {
        await replaceAllocationsForPayment(client, createdPayment.id, createdPayment.amount_usd, allocations);
      }

      return createdPayment;
    });

    const [hydrated] = await attachAllocations([payment]);
    return res.status(201).json(hydrated);
  } catch (error) {
    return apiError(res, 400, 'Invalid payment data', error);
  }
}

async function updatePayment(req: VercelRequest, res: VercelResponse) {
  try {
    const data = PaymentUpdateSchema.parse(req.body);
    const paymentId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!paymentId) return apiError(res, 400, 'Missing payment id');

    const allocations = parseAllocationsFromBody(req.body);

    const payment = await withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE public.payments
          SET
            reference_id = COALESCE($1, reference_id),
            client_name = COALESCE($2, client_name),
            type = COALESCE($3, type),
            amount_usd = COALESCE($4, amount_usd),
            currency = COALESCE($5, currency),
            method = COALESCE($6, method),
            date = COALESCE($7, date)
          WHERE id = $8::uuid
          RETURNING id, reference_id, client_name, type, amount_usd, currency, method, date
        `,
        [
          data.reference_id || null,
          data.client_name || null,
          data.type || null,
          data.amount_usd || null,
          data.currency || null,
          data.method || null,
          data.date || null,
          paymentId,
        ],
      );

      if (result.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const updatedPayment = result.rows[0] as PaymentRow;
      if (Array.isArray((req.body as { allocations?: unknown[] } | undefined)?.allocations)) {
        await replaceAllocationsForPayment(client, updatedPayment.id, updatedPayment.amount_usd, allocations);
      }

      return updatedPayment;
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

async function replaceAllocations(req: VercelRequest, res: VercelResponse) {
  const paymentId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!paymentId) return apiError(res, 400, 'Missing payment id');

  try {
    const allocations = Array.isArray(req.body)
      ? req.body.map((allocation) => PaymentAllocationSchema.parse(allocation))
      : [];

    const paymentRows = await sql`
      SELECT amount_usd
      FROM public.payments
      WHERE id = ${paymentId}::uuid
    `;
    if (paymentRows.length === 0) return apiError(res, 404, 'Payment not found');

    await withTransaction(async (client) => {
      await replaceAllocationsForPayment(client, paymentId, Number(paymentRows[0].amount_usd), allocations);
      return null;
    });

    const rows = await sql`
      SELECT id, payment_id, invoice_id, amount_allocated, currency, created_at
      FROM public.payment_allocations
      WHERE payment_id = ${paymentId}::uuid
      ORDER BY created_at ASC
    `;
    return res.status(200).json(rows);
  } catch (error) {
    return apiError(res, 400, 'Invalid payment allocations', error);
  }
}

async function deletePayment(req: VercelRequest, res: VercelResponse) {
  await sql`DELETE FROM public.payments WHERE id = ${req.query.id}::uuid`;
  return res.status(204).end();
}
