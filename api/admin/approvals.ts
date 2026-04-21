import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  setSecurityHeaders,
  verifyToken,
} from '../_middleware.js';
import { sql } from '../_db.js';
import { logAuditEvent } from '../_audit.js';

function isMissingTableError(error: unknown, tableName: string): boolean {
  return error instanceof Error && error.message.includes(`relation "${tableName}" does not exist`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listApprovals(res);
      case 'POST':
      case 'PATCH':
        return await reviewUser(authReq, req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listApprovals(res: VercelResponse) {
  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.access_role,
      u.status,
      u.created_at
    FROM user_profiles u
    ORDER BY u.created_at DESC
  `;

  let registrationRequests: any[] = [];
  try {
    registrationRequests = await sql`
      SELECT id, name, email, role, status, requested_at, reviewed_at, reviewed_by
      FROM registration_requests
      ORDER BY requested_at DESC
    `;
  } catch (error) {
    if (!isMissingTableError(error, 'registration_requests')) {
      throw error;
    }
  }

  const pendingUsers = (users as any[]).filter((user) => String(user.status || '').toLowerCase() === 'pending');
  const pendingRequests = registrationRequests.filter((request) => String(request.status || '').toLowerCase() === 'pending');

  return res.status(200).json({
    pendingCount: pendingUsers.length + pendingRequests.length,
    pendingUsers,
    pendingRequests,
    users,
  });
}

async function reviewUser(authReq: AuthenticatedRequest, req: VercelRequest, res: VercelResponse) {
  const userId = typeof req.query.id === 'string' ? req.query.id : '';
  const action = typeof req.query.action === 'string' ? req.query.action : '';
  if (!userId) return apiError(res, 400, 'Missing user id');
  if (!['approve', 'reject'].includes(action)) return apiError(res, 400, 'Invalid action');

  const existingRows = await sql`
    SELECT id, email, access_role, status
    FROM user_profiles
    WHERE id = ${userId}::uuid
    LIMIT 1
  `;
  if (existingRows.length === 0) return apiError(res, 404, 'User not found');

  const existing = existingRows[0] as {
    id: string;
    email: string;
    access_role: string;
    status: string;
  };

  const nextStatus = action === 'approve' ? 'Active' : 'Inactive';
  const rows = await sql`
    UPDATE user_profiles
    SET status = ${nextStatus}, updated_at = NOW()
    WHERE id = ${userId}::uuid
    RETURNING id, name, email, role, access_role, status, created_at, updated_at
  `;

  if (rows.length === 0) return apiError(res, 404, 'User not found');

  try {
    await sql`
      UPDATE registration_requests
      SET
        status = ${action === 'approve' ? 'Approved' : 'Rejected'},
        reviewed_at = NOW(),
        reviewed_by = ${authReq.user?.id || null}::uuid
      WHERE LOWER(email) = ${existing.email.toLowerCase()} AND status = 'Pending'
    `;
  } catch (error) {
    if (!isMissingTableError(error, 'registration_requests')) {
      throw error;
    }
  }

  await logAuditEvent({
    req,
    userId: authReq.user?.id || null,
    action: action === 'approve' ? 'admin.approvals.approved' : 'admin.approvals.rejected',
    tableName: 'user_profiles',
    recordId: userId,
    oldData: existing,
    newData: rows[0],
  });

  return res.status(200).json(rows[0]);
}
