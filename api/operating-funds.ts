import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { OperatingFundSchema, OperatingFundUpdateSchema } from './_schemas.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listFunds(req, res);
      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await createFund(authReq, res);
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await updateFund(authReq, res);
      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteFund(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listFunds(req: ApiRequest, res: ApiResponse) {
  const recipient = typeof req.query.recipient === 'string' ? req.query.recipient.trim() : '';
  const rows = recipient
    ? await sql`
        SELECT id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
        FROM operating_funds
        WHERE LOWER(TRIM(COALESCE(recipient, ''))) = LOWER(TRIM(${recipient}))
        ORDER BY date DESC, created_at DESC
      `
    : await sql`
        SELECT id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
        FROM operating_funds
        ORDER BY date DESC, created_at DESC
      `;

  return res.status(200).json(rows);
}

async function createFund(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = OperatingFundSchema.parse(req.body);
    const rows = await sql`
      INSERT INTO operating_funds (type, amount, currency, description, reference, recipient, approved_by, date)
      VALUES (
        ${data.type},
        ${data.amount},
        ${data.currency},
        ${data.description},
        ${data.reference || null},
        ${data.recipient || null},
        ${data.approved_by || null},
        ${data.date}
      )
      RETURNING id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'operating_fund.create',
      tableName: 'operating_funds',
      recordId: String(rows[0].id),
      newData: rows[0],
    });

    return res.status(201).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid operating fund data', error);
  }
}

async function updateFund(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = OperatingFundUpdateSchema.parse(req.body);
    const id = req.query.id;

    const existing = await sql`
      SELECT id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
      FROM operating_funds WHERE id = ${id}::uuid
    `;
    if (existing.length === 0) return apiError(res, 404, 'Operating fund not found');

    const rows = await sql`
      UPDATE operating_funds
      SET
        type = COALESCE(${data.type ?? null}, type),
        amount = COALESCE(${data.amount ?? null}, amount),
        currency = COALESCE(${data.currency ?? null}, currency),
        description = COALESCE(${data.description ?? null}, description),
        reference = COALESCE(${data.reference ?? null}, reference),
        recipient = COALESCE(${data.recipient ?? null}, recipient),
        approved_by = COALESCE(${data.approved_by ?? null}, approved_by),
        date = COALESCE(${data.date ?? null}, date)
      WHERE id = ${id}::uuid
      RETURNING id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
    `;

    if (rows.length === 0) return apiError(res, 404, 'Operating fund not found');

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'operating_fund.update',
      tableName: 'operating_funds',
      recordId: String(id),
      oldData: existing[0],
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid operating fund update', error);
  }
}

async function deleteFund(req: AuthenticatedRequest, res: ApiResponse) {
  const id = req.query.id;
  const existing = await sql`SELECT * FROM operating_funds WHERE id = ${id}::uuid`;
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  await sql`DELETE FROM operating_funds WHERE id = ${id}::uuid`;

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'operating_fund.delete',
    tableName: 'operating_funds',
    recordId: String(id),
    oldData: existing[0],
  });

  return res.status(204).end();
}
