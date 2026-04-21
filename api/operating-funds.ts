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
import { OperatingFundSchema } from './_schemas.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listFunds(req, res);
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createFund(req, res);
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await deleteFund(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listFunds(req: VercelRequest, res: VercelResponse) {
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

async function createFund(req: VercelRequest, res: VercelResponse) {
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

    return res.status(201).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid operating fund data', error);
  }
}

async function deleteFund(req: VercelRequest, res: VercelResponse) {
  const rows = await sql`DELETE FROM operating_funds WHERE id = ${req.query.id}::uuid RETURNING id`;
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(204).end();
}
