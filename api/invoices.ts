import type { ApiRequest, ApiResponse } from './_types.js';
import type { PoolClient } from '@neondatabase/serverless';
import { ZodError } from 'zod';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { sql, withTransaction, validateOrderColumn } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { InvoiceSchema, InvoiceUpdateSchema, PaginationSchema } from './_schemas.js';
import { sendDocumentEmail } from './_email.js';
import { withIdempotency } from './_idempotency.js';
import type { InvoiceItem } from '../types';

const formatUsd = (value: unknown): string | undefined => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDueDate = (iso: unknown): string | undefined => {
  if (typeof iso !== 'string' || !iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const sendInvoiceEmail = async (
  invoice: any,
  type: 'invoice' | 'statement' | 'quote',
): Promise<void> => {
  if (!invoice?.client_email) return;
  try {
    await sendDocumentEmail({
      to: invoice.client_email,
      kind: type === 'quote' ? 'quote' : type === 'statement' ? 'statement' : 'invoice',
      documentNumber:
        type === 'quote'
          ? invoice.quote_number || invoice.invoice_number
          : invoice.invoice_number,
      clientName: invoice.client_name,
      amountFormatted: formatUsd(invoice.amount_usd),
      description: invoice.description,
      dueDateFormatted: formatDueDate(invoice.due_date),
      validityNote: type === 'quote' ? '30 days' : undefined,
    });
  } catch (error) {
    console.error('Failed to send invoice email:', error);
  }
};

type InvoiceLineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  tax_rate?: number;
  notes?: string;
};

const computeInvoiceLineItemAmounts = (item: InvoiceLineItemInput) => {
  const subtotal = item.quantity * item.unit_price;
  const discountPercentage = item.discount_percentage ?? 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const amount = subtotal - discountAmount;
  const taxRate = item.tax_rate ?? 0;
  const taxAmount = amount * (taxRate / 100);

  return {
    discountPercentage,
    discountAmount,
    amount,
    taxRate,
    taxAmount,
    total: amount + taxAmount,
  };
};

const buildInvoiceItemsSnapshot = (items: InvoiceLineItemInput[]): InvoiceItem[] =>
  items.map((item, index) => {
    const amounts = computeInvoiceLineItemAmounts(item);
    return {
      line_number: index + 1,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: amounts.amount,
      discount_percentage: amounts.discountPercentage,
      discount_amount: amounts.discountAmount,
      tax_rate: amounts.taxRate,
      tax_amount: amounts.taxAmount,
      notes: item.notes,
    };
  });

const calculateInvoiceTotal = (items: InvoiceLineItemInput[]): number =>
  items.reduce((sum, item) => sum + computeInvoiceLineItemAmounts(item).total, 0);

const getInvoiceInputErrorMessage = (
  error: unknown,
  fallbackMessage: string
): { status: number; message: string } => {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      status: 400,
      message: firstIssue?.message || fallbackMessage,
    };
  }

  const databaseError = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };

  if (databaseError.code === '22P02') {
    return {
      status: 400,
      message: 'One of the selected client, vehicle, or invoice references is invalid.',
    };
  }

  if (databaseError.code === '23503') {
    return {
      status: 400,
      message: 'The selected client or vehicle no longer exists. Refresh and try again.',
    };
  }

  if (
    databaseError.code === '23505' &&
    databaseError.constraint === 'invoices_invoice_number_key'
  ) {
    return {
      status: 409,
      message: 'Invoice number collision detected. Please try again.',
    };
  }

  return {
    status: 500,
    message: fallbackMessage,
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;

  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        if (req.query.id) {
          return await getInvoice(authReq, res);
        }
        return await listInvoices(authReq, res);

      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await withIdempotency(authReq, res, 'POST /invoices', () =>
          createInvoice(authReq, res)
        );

      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updateInvoice(authReq, res);

      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteInvoice(authReq, res);

      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

async function listInvoices(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    let orderColumn = 'created_at';
    if (sortBy) {
      const validated = validateOrderColumn('invoices', sortBy);
      if (validated) orderColumn = validated;
    }
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM invoices`,
      sql`
        SELECT i.*,
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(ii) ORDER BY ii.line_number) FROM invoice_items ii WHERE ii.invoice_id = i.id),
            '[]'::jsonb
          ) as items
        FROM invoices i
        ORDER BY ${sql.unsafe(orderColumn)} ${sql.unsafe(orderDirection)}
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = parseInt(countResult[0].total);

    res.status(200).json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    apiError(res, 400, 'Invalid query parameters', error);
  }
}

async function getInvoice(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  const rows = await sql`
    SELECT i.*,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(ii) ORDER BY ii.line_number) FROM invoice_items ii WHERE ii.invoice_id = i.id),
        '[]'::jsonb
      ) as items
    FROM invoices i
    WHERE i.id = ${id}::uuid
  `;

  if (rows.length === 0) {
    return apiError(res, 404, 'Invoice not found');
  }

  res.status(200).json(rows[0]);
}

async function generateInvoiceNumber(client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const sequenceCheck = await client.query<{ sequence_name: string | null }>(
    "SELECT to_regclass('public.invoice_number_seq')::text AS sequence_name"
  );

  if (sequenceCheck.rows[0]?.sequence_name) {
    const result = await client.query<{ next_value: string }>(
      "SELECT nextval('public.invoice_number_seq')::text AS next_value"
    );
    const nextValue = parseInt(result.rows[0]?.next_value || '0', 10);
    return `INV-${year}-${String(nextValue).padStart(4, '0')}`;
  }

  // Fallback for environments where the sequence migration has not run yet.
  await client.query('SELECT pg_advisory_xact_lock($1)', [2026033001]);
  const fallbackResult = await client.query<{ max_value: string }>(
    `
      SELECT COALESCE(MAX((regexp_match(invoice_number, $1))[1]::BIGINT), 0)::text AS max_value
      FROM invoices
      WHERE invoice_number ~ $2
    `,
    [`^INV-${year}-(\\d+)$`, `^INV-${year}-\\d+$`]
  );
  const nextValue = parseInt(fallbackResult.rows[0]?.max_value || '0', 10) + 1;

  return `INV-${year}-${String(nextValue).padStart(4, '0')}`;
}

async function insertInvoiceItems(
  client: PoolClient,
  invoiceId: string,
  items: InvoiceLineItemInput[]
) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const amounts = computeInvoiceLineItemAmounts(item);

    await client.query(
      `
        INSERT INTO invoice_items (
          invoice_id, line_number, description, quantity, unit_price,
          amount, discount_percentage, discount_amount, tax_rate, tax_amount, notes
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        invoiceId,
        i + 1,
        item.description,
        item.quantity,
        item.unit_price,
        amounts.amount,
        amounts.discountPercentage,
        amounts.discountAmount,
        amounts.taxRate,
        amounts.taxAmount,
        item.notes || null,
      ]
    );
  }
}

async function createInvoice(req: AuthenticatedRequest, res: ApiResponse) {
  const user = req.user;
  try {
    const data = InvoiceSchema.parse(req.body);

    const totalAmount = calculateInvoiceTotal(data.items);
    const itemsSnapshot = buildInvoiceItemsSnapshot(data.items);

    const result = await withTransaction(async client => {
      const invoiceNumber = await generateInvoiceNumber(client);
      const invoiceResult = await client.query(
        `
          INSERT INTO invoices (
            invoice_number, invoice_kind, quote_id, vehicle_id, client_id, client_name, client_email, client_address,
            amount_usd, currency, status, description, notes, terms_and_conditions, due_date, items, batch
          )
          VALUES (
            $1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17
          )
          RETURNING *
        `,
        [
          invoiceNumber,
          data.invoice_kind,
          data.quote_id || null,
          data.vehicle_id || null,
          data.client_id || null,
          data.client_name,
          data.client_email || null,
          data.client_address || null,
          totalAmount,
          data.currency,
          data.status,
          data.description || null,
          data.notes || null,
          data.terms_and_conditions || null,
          data.due_date,
          JSON.stringify(itemsSnapshot),
          data.batch || null,
        ]
      );

      const invoice = invoiceResult.rows[0];
      await insertInvoiceItems(client, invoice.id, data.items);

      return invoice;
    });

    await logAuditEvent({
      req,
      userId: user?.id,
      action: 'invoice:create',
      tableName: 'invoices',
      recordId: result.id,
      newData: data,
    });

    // Send email notification to client if email provided and not a draft.
    // Fire-and-forget — wrapped so an unhandled rejection cannot crash the Node
    // process on Railway.
    if (result.client_email && result.status !== 'Draft' && result.invoice_kind) {
      const emailType = result.invoice_kind === 'Statement' ? 'statement' : 'invoice';
      void (async () => {
        try {
          await sendInvoiceEmail(result, emailType);
        } catch (err) {
          console.error('Failed to send invoice email:', err);
        }
      })();
    }

    res.status(201).json(result);
  } catch (error) {
    const { status, message } = getInvoiceInputErrorMessage(error, 'Failed to create invoice');
    apiError(res, status, message, error);
  }
}

async function updateInvoice(req: AuthenticatedRequest, res: ApiResponse) {
  const user = req.user;
  const { id } = req.query;

  try {
    const data = InvoiceUpdateSchema.parse(req.body);

    const result = await withTransaction(async client => {
      let totalAmount = undefined;
      let itemsSnapshot: InvoiceItem[] | undefined;
      if (Array.isArray(data.items)) {
        totalAmount = calculateInvoiceTotal(data.items);
        itemsSnapshot = buildInvoiceItemsSnapshot(data.items);

        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1::uuid', [id]);
        if (data.items.length > 0) {
          await insertInvoiceItems(client, String(id), data.items);
        }
      }

      // Build dynamic SET clause — only include fields present in body
      const updates: string[] = ['updated_at = NOW()'];
      const values: unknown[] = [];
      let paramIdx = 1;

      const bodyRecord = req.body as Record<string, unknown>;
      const fieldMap: Record<string, { value: unknown; cast?: string }> = {
        invoice_kind: { value: data.invoice_kind },
        quote_id: { value: data.quote_id ?? null, cast: '::uuid' },
        vehicle_id: { value: data.vehicle_id ?? null, cast: '::uuid' },
        client_id: { value: data.client_id ?? null, cast: '::uuid' },
        client_name: { value: data.client_name },
        client_email: { value: data.client_email },
        client_address: { value: data.client_address },
        currency: { value: data.currency },
        status: { value: data.status },
        description: { value: data.description },
        notes: { value: data.notes },
        terms_and_conditions: { value: data.terms_and_conditions },
        due_date: { value: data.due_date },
        batch: { value: data.batch },
      };

      for (const [field, meta] of Object.entries(fieldMap)) {
        if (field in bodyRecord) {
          const cast = meta.cast ?? '';
          updates.push(`${field} = $${paramIdx}${cast}`);
          values.push(meta.value ?? null);
          paramIdx++;
        }
      }

      // Always update amount_usd and items if items were provided
      if (totalAmount !== undefined) {
        updates.push(`amount_usd = $${paramIdx}`);
        values.push(totalAmount);
        paramIdx++;
      }
      if (itemsSnapshot) {
        updates.push(`items = $${paramIdx}::jsonb`);
        values.push(JSON.stringify(itemsSnapshot));
        paramIdx++;
      }

      values.push(id);
      const rows = await client.query(
        `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramIdx}::uuid RETURNING *`,
        values
      );

      if (rows.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      return rows.rows[0];
    });

    await logAuditEvent({
      req,
      userId: user?.id,
      action: 'invoice:update',
      tableName: 'invoices',
      recordId: String(id),
      newData: data,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invoice not found') {
      return apiError(res, 404, error.message);
    }
    const { status, message } = getInvoiceInputErrorMessage(error, 'Failed to update invoice');
    apiError(res, status, message, error);
  }
}

async function deleteInvoice(req: AuthenticatedRequest, res: ApiResponse) {
  const user = req.user;
  const { id } = req.query;

  const oldInvoice = await sql`SELECT * FROM invoices WHERE id = ${id}::uuid`;
  if (oldInvoice.length === 0) {
    return apiError(res, 404, 'Not found');
  }

  // Check for existing payment allocations
  const allocationCount =
    await sql`SELECT COUNT(*) as cnt FROM payment_allocations WHERE invoice_id = ${id}::uuid`;
  if (Number(allocationCount[0]?.cnt) > 0) {
    return res
      .status(409)
      .json({ error: 'Cannot delete invoice with existing payment allocations' });
  }

  await withTransaction(async client => {
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1::uuid', [id]);
    const result = await client.query('DELETE FROM invoices WHERE id = $1::uuid RETURNING id', [
      id,
    ]);
    if (result.rows.length === 0) {
      throw new Error('Not found');
    }
  });

  await logAuditEvent({
    req,
    userId: user?.id,
    action: 'invoice:delete',
    tableName: 'invoices',
    recordId: String(id),
    oldData: oldInvoice[0],
  });

  res.status(204).end();
}
