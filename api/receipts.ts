import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  apiError,
  json,
  handleCors,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { z } from 'zod';
import { ReceiptSchema, ReceiptUpdateSchema } from './_schemas.js';
import { withIdempotency } from './_idempotency.js';
import { getPagination, paginatedResponse } from './_pagination.js';

const isMissingTableError = (error: unknown, tableName: string): boolean =>
  error instanceof Error && error.message.includes(`relation "public.${tableName}" does not exist`);

const isMissingColumnError = (error: unknown, columnName: string, tableName: string): boolean =>
  error instanceof Error && error.message.includes(`column "${columnName}" of relation "${tableName}" does not exist`);

// NOTE: Run once in DB: CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
async function generateReceiptNumber(): Promise<string> {
  const result = await sql`SELECT nextval('receipt_number_seq') as n`;
  const n = String(result[0].n).padStart(6, '0');
  return `REC-${n}`;
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listReceipts(req, res);
      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await withIdempotency(authReq, res, 'POST /receipts', () =>
          createReceipt(authReq, res)
        );
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updateReceipt(req, res);
      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteReceipt(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listReceipts(req: ApiRequest, res: ApiResponse) {
  try {
    const pagination = getPagination(req);

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM public.receipts
    `;

    const rows = await sql`
      SELECT *
      FROM public.receipts
      ORDER BY payment_date DESC, created_at DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}
    `;
    return json(res, 200, paginatedResponse(rows, count, pagination));
  } catch (error) {
    if (isMissingTableError(error, 'receipts')) {
      return json(res, 200, paginatedResponse([], 0, getPagination(req)));
    }
    return apiError(res, 500, 'Failed to load receipts', error);
  }
}

async function createReceipt(req: AuthenticatedRequest, res: ApiResponse) {
  const user = req.user;
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
      await logAuditEvent({
        req,
        userId: user?.id,
        action: 'receipt:create',
        tableName: 'receipts',
        recordId: rows[0].id,
        newData: data,
      });
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
        await logAuditEvent({
          req,
          userId: user?.id,
          action: 'receipt:create',
          tableName: 'receipts',
          recordId: rows[0].id,
          newData: data,
        });

        return res.status(201).json({
          ...rows[0],
          ...(normalizedItems.length > 0 ? { items: normalizedItems } : {}),
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      console.error('[Receipts API] Validation error:', issues);
      return apiError(res, 400, `Invalid receipt data: ${issues}`, error);
    }
    console.error('[Receipts API] createReceipt error:', error);
    return apiError(res, 500, 'Failed to create receipt', error);
  }
}

async function deleteReceipt(req: AuthenticatedRequest, res: ApiResponse) {
  const user = req.user;
  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return apiError(res, 400, 'Missing receipt id');
    }

    const rows = await sql`
      DELETE FROM public.receipts
      WHERE id = ${id}::uuid
      RETURNING id
    `;

    if (rows.length === 0) {
      return apiError(res, 404, 'Receipt not found');
    }

    await logAuditEvent({
      req,
      userId: user?.id,
      action: 'receipt:delete',
      tableName: 'receipts',
      recordId: id,
      oldData: rows[0],
    });

    return res.status(204).end();
  } catch (error) {
    return apiError(res, 500, 'Failed to delete receipt', error);
  }
}

async function updateReceipt(req: AuthenticatedRequest, res: ApiResponse) {
  const user = req.user;
  try {
    const data = ReceiptUpdateSchema.parse(req.body);
    const normalizedItems = data.items
      ? normalizeReceiptItems(data.items as Array<Record<string, unknown>>)
      : null;

    // Build dynamic SET clause — only include fields present in body
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;
    const body = req.body as Record<string, unknown>;

    const fieldMap: Record<string, { value: unknown; cast?: string }> = {
      invoice_id: { value: data.invoice_id ?? null, cast: '::uuid' },
      payment_id: { value: data.payment_id ?? null, cast: '::uuid' },
      client_name: { value: data.client_name },
      client_email: { value: data.client_email },
      client_address: { value: data.client_address },
      amount_received: { value: data.amount_received },
      currency: { value: data.currency },
      payment_method: { value: data.payment_method },
      payment_date: { value: data.payment_date },
      reference_number: { value: data.reference_number },
      notes: { value: data.notes },
      batch: { value: data.batch },
    };

    for (const [field, meta] of Object.entries(fieldMap)) {
      if (field in body) {
        const cast = meta.cast ?? '';
        updates.push(`${field} = $${paramIdx}${cast}`);
        values.push(meta.value ?? null);
        paramIdx++;
      }
    }

    // Handle items column separately (may not exist in older schemas)
    if (normalizedItems && 'items' in body) {
      updates.push(`items = $${paramIdx}::jsonb`);
      values.push(JSON.stringify(normalizedItems));
      paramIdx++;
    }

    if (updates.length === 0) {
      return apiError(res, 400, 'No fields to update');
    }

    values.push(req.query.id);

    try {
      const rows = await sql.query(
        `UPDATE public.receipts SET ${updates.join(', ')} WHERE id = $${paramIdx}::uuid RETURNING *`,
        values,
      );
      if (rows.length === 0) return apiError(res, 404, 'Receipt not found');

      await logAuditEvent({
        req,
        userId: user?.id,
        action: 'receipt:update',
        tableName: 'receipts',
        recordId: req.query.id as string,
        newData: data,
      });

      return res.status(200).json({
        ...rows[0],
        ...(normalizedItems ? { items: normalizedItems } : {}),
      });
    } catch (error) {
      if (isMissingColumnError(error, 'items', 'receipts') && normalizedItems) {
        // Retry without items column
        // Rebuild without items param — simplest to just redo
        const ru: string[] = [];
        const rv: unknown[] = [];
        let rIdx = 1;
        for (const [field, meta] of Object.entries(fieldMap)) {
          if (field in body) {
            const cast = meta.cast ?? '';
            ru.push(`${field} = $${rIdx}${cast}`);
            rv.push(meta.value ?? null);
            rIdx++;
          }
        }
        if (ru.length === 0) return apiError(res, 400, 'No fields to update');
        rv.push(req.query.id);
        const rows = await sql.query(
          `UPDATE public.receipts SET ${ru.join(', ')} WHERE id = $${rIdx}::uuid RETURNING *`,
          rv,
        );
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
