import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  getTenantId,
  handleCors,
  requireRole,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { ReceiptSchema, ReceiptUpdateSchema } from './_schemas.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    const tenantId = getTenantId(req);
    switch (req.method) {
      case 'GET':
        return await listReceipts(res, tenantId);
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createReceipt(req, res, tenantId);
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updateReceipt(req, res, tenantId);
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin'])) return;
        return await deleteReceipt(req, res, tenantId);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listReceipts(res: VercelResponse, tenantId: string) {
  try {
    const rows = await sql`
      SELECT *
      FROM public.receipts
      WHERE tenant_id = ${tenantId}::uuid
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

async function createReceipt(req: AuthenticatedRequest, res: VercelResponse, tenantId: string) {
  const user = req.user;
  try {
    const data = ReceiptSchema.parse(req.body);
    const receiptNumber = await generateReceiptNumber();
    const normalizedItems = normalizeReceiptItems(data.items as Array<Record<string, unknown>> | undefined);

    try {
      const rows = await sql`
        INSERT INTO public.receipts (
          receipt_number, invoice_id, payment_id, client_name, client_email, client_address,
          amount_received, currency, payment_method, payment_date, reference_number, notes, items, batch, tenant_id
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
          ${data.batch || null},
          ${tenantId}::uuid
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
            amount_received, currency, payment_method, payment_date, reference_number, notes, batch, tenant_id
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
            ${data.batch || null},
            ${tenantId}::uuid
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
    return apiError(res, 400, 'Invalid receipt data', error);
  }
}

async function deleteReceipt(req: AuthenticatedRequest, res: VercelResponse, tenantId: string) {
  const user = req.user;
  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return apiError(res, 400, 'Missing receipt id');
    }

    const rows = await sql`
      DELETE FROM public.receipts
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
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

async function updateReceipt(req: AuthenticatedRequest, res: VercelResponse, tenantId: string) {
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
    paramIdx++;
    values.push(tenantId);

    try {
      const rows = await sql.query(
        `UPDATE public.receipts SET ${updates.join(', ')} WHERE id = $${paramIdx - 1}::uuid AND tenant_id = $${paramIdx}::uuid RETURNING *`,
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
        const retryUpdates = updates.filter(u => !u.startsWith('items ='));
        const retryValues = [...values];
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
        rIdx++;
        rv.push(tenantId);
        const rows = await sql.query(
          `UPDATE public.receipts SET ${ru.join(', ')} WHERE id = $${rIdx - 1}::uuid AND tenant_id = $${rIdx}::uuid RETURNING *`,
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
