import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireRole,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { ReceiptSchema, ReceiptUpdateSchema } from './_schemas.js';

const isMissingTableError = (error: unknown, tableName: string): boolean =>
  error instanceof Error && error.message.includes(`relation "public.${tableName}" does not exist`);

const isMissingColumnError = (error: unknown, columnName: string, tableName: string): boolean =>
  error instanceof Error && error.message.includes(`column "${columnName}" of relation "${tableName}" does not exist`);

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const candidate = `RCPT-${year}-${suffix}`;
    const rows = await sql`SELECT id FROM public.receipts WHERE receipt_number = ${candidate} LIMIT 1`;
    if (rows.length === 0) return candidate;
  }
  throw new Error('Failed to generate unique receipt number');
}

function normalizeReceiptItems(items: Array<Record<string, unknown>> = []) {
  return items.map((item, index) => {
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unit_price ?? 0);
    const discountPercentage = Math.max(0, Math.min(100, Number(item.discount_percentage ?? 0)));
    const grossAmount = quantity * unitPrice;
    const discountAmount = (grossAmount * discountPercentage) / 100;
    const netAmount = Math.max(0, grossAmount - discountAmount);
    const taxRate = Number(item.tax_rate ?? 0);
    const taxAmount = (netAmount * taxRate) / 100;

    return {
      id: item.id,
      line_number: item.line_number ?? index + 1,
      description: item.description,
      quantity,
      unit_price: unitPrice,
      amount: netAmount,
      discount_percentage: discountPercentage,
      discount_amount: discountAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      notes: item.notes ?? '',
      invoice_id: item.invoice_id,
      invoice_number: item.invoice_number,
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!verifyToken(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listReceipts(res);
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createReceipt(req, res);
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updateReceipt(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listReceipts(res: VercelResponse) {
  try {
    const rows = await sql`
      SELECT *
      FROM public.receipts
      ORDER BY payment_date DESC, created_at DESC
    `;
    return res.status(200).json(rows);
  } catch (error) {
    if (isMissingTableError(error, 'receipts')) {
      return res.status(200).json([]);
    }
    return apiError(res, 500, 'Failed to load receipts', error);
  }
}

async function createReceipt(req: VercelRequest, res: VercelResponse) {
  try {
    const data = ReceiptSchema.parse(req.body);
    const receiptNumber = await generateReceiptNumber();
    const normalizedItems = normalizeReceiptItems(data.items as Array<Record<string, unknown>> | undefined);

    try {
      const rows = await sql`
        INSERT INTO public.receipts (
          receipt_number, invoice_id, payment_id, client_name, client_email, client_address,
          amount_received, currency, payment_method, payment_date, reference_number, notes, items, batch
        )
        VALUES (
          ${receiptNumber},
          ${data.invoice_id || null}::uuid,
          ${data.payment_id || null}::uuid,
          ${data.client_name},
          ${data.client_email || null},
          ${data.client_address || null},
          ${data.amount_received},
          ${data.currency},
          ${data.payment_method},
          ${data.payment_date},
          ${data.reference_number || null},
          ${data.notes || null},
          ${normalizedItems.length > 0 ? JSON.stringify(normalizedItems) : null}::jsonb,
          ${data.batch || null}
        )
        RETURNING *
      `;
      return res.status(201).json({
        ...rows[0],
        ...(normalizedItems.length > 0 ? { items: normalizedItems } : {}),
      });
    } catch (error) {
      if (isMissingColumnError(error, 'items', 'receipts')) {
        const rows = await sql`
          INSERT INTO public.receipts (
            receipt_number, invoice_id, payment_id, client_name, client_email, client_address,
            amount_received, currency, payment_method, payment_date, reference_number, notes, batch
          )
          VALUES (
            ${receiptNumber},
            ${data.invoice_id || null}::uuid,
            ${data.payment_id || null}::uuid,
            ${data.client_name},
            ${data.client_email || null},
            ${data.client_address || null},
            ${data.amount_received},
            ${data.currency},
            ${data.payment_method},
            ${data.payment_date},
            ${data.reference_number || null},
            ${data.notes || null},
            ${data.batch || null}
          )
          RETURNING *
        `;
        return res.status(201).json({
          ...rows[0],
          ...(normalizedItems.length > 0 ? { items: normalizedItems } : {}),
        });
      }
      throw error;
    }
  } catch (error) {
    return apiError(res, 400, 'Invalid receipt data', error);
  }
}

async function updateReceipt(req: VercelRequest, res: VercelResponse) {
  try {
    const data = ReceiptUpdateSchema.parse(req.body);
    const normalizedItems = data.items
      ? normalizeReceiptItems(data.items as Array<Record<string, unknown>>)
      : null;

    try {
      const rows = await sql`
        UPDATE public.receipts
        SET
          invoice_id = COALESCE(${data.invoice_id || null}::uuid, invoice_id),
          payment_id = COALESCE(${data.payment_id || null}::uuid, payment_id),
          client_name = COALESCE(${data.client_name || null}, client_name),
          client_email = COALESCE(${data.client_email || null}, client_email),
          client_address = COALESCE(${data.client_address || null}, client_address),
          amount_received = COALESCE(${data.amount_received || null}, amount_received),
          currency = COALESCE(${data.currency || null}, currency),
          payment_method = COALESCE(${data.payment_method || null}, payment_method),
          payment_date = COALESCE(${data.payment_date || null}, payment_date),
          reference_number = COALESCE(${data.reference_number || null}, reference_number),
          notes = COALESCE(${data.notes || null}, notes),
          items = COALESCE(${normalizedItems ? JSON.stringify(normalizedItems) : null}::jsonb, items),
          batch = COALESCE(${data.batch || null}, batch)
        WHERE id = ${req.query.id}::uuid
        RETURNING *
      `;
      if (rows.length === 0) return apiError(res, 404, 'Receipt not found');
      return res.status(200).json({
        ...rows[0],
        ...(normalizedItems ? { items: normalizedItems } : {}),
      });
    } catch (error) {
      if (isMissingColumnError(error, 'items', 'receipts')) {
        const rows = await sql`
          UPDATE public.receipts
          SET
            invoice_id = COALESCE(${data.invoice_id || null}::uuid, invoice_id),
            payment_id = COALESCE(${data.payment_id || null}::uuid, payment_id),
            client_name = COALESCE(${data.client_name || null}, client_name),
            client_email = COALESCE(${data.client_email || null}, client_email),
            client_address = COALESCE(${data.client_address || null}, client_address),
            amount_received = COALESCE(${data.amount_received || null}, amount_received),
            currency = COALESCE(${data.currency || null}, currency),
            payment_method = COALESCE(${data.payment_method || null}, payment_method),
            payment_date = COALESCE(${data.payment_date || null}, payment_date),
            reference_number = COALESCE(${data.reference_number || null}, reference_number),
            notes = COALESCE(${data.notes || null}, notes),
            batch = COALESCE(${data.batch || null}, batch)
          WHERE id = ${req.query.id}::uuid
          RETURNING *
        `;
        if (rows.length === 0) return apiError(res, 404, 'Receipt not found');
        return res.status(200).json({
          ...rows[0],
          ...(normalizedItems ? { items: normalizedItems } : {}),
        });
      }
      throw error;
    }
  } catch (error) {
    return apiError(res, 400, 'Invalid receipt update', error);
  }
}
