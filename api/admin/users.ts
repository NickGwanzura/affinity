import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
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

const AccessRoleSchema = z.enum(['super_admin', 'admin', 'user']);
const UserStatusSchema = z.enum(['Active', 'Inactive', 'Pending']);

const UpdateUserSchema = z.object({
  role: z.string().min(1).optional(),
  accessRole: AccessRoleSchema.optional(),
  status: UserStatusSchema.optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listUsers(req, res);
      case 'PUT':
      case 'PATCH':
        return await updateUser(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listUsers(req: VercelRequest, res: VercelResponse) {
  const status = typeof req.query.status === 'string' ? req.query.status : '';

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    clauses.push(`LOWER(COALESCE(u.status, '')) = LOWER($${params.length})`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.access_role,
      u.status,
      u.created_at
    FROM user_profiles u
    ${whereClause}
    ORDER BY u.created_at DESC
  `;

  const result = await sql.query(query, params);
  return res.status(200).json(result.rows ?? result);
}

async function updateUser(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!userId) return apiError(res, 400, 'Missing user id');

    const payload = UpdateUserSchema.parse(req.body);
    if (!payload.role && !payload.accessRole && !payload.status) {
      return apiError(res, 400, 'No updates provided');
    }

    const existingRows = await sql`
      SELECT id, role, access_role, status
      FROM user_profiles
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;
    if (existingRows.length === 0) return apiError(res, 404, 'User not found');

    const rows = await sql`
      UPDATE user_profiles
      SET
        role = COALESCE(${payload.role || null}, role),
        access_role = COALESCE(${payload.accessRole || null}, access_role),
        status = COALESCE(${payload.status || null}, status),
        updated_at = NOW()
      WHERE id = ${userId}::uuid
      RETURNING id, name, email, role, access_role, status, created_at, updated_at
    `;
    if (rows.length === 0) return apiError(res, 404, 'User not found');

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'admin.users.updated',
      tableName: 'user_profiles',
      recordId: userId,
      oldData: existingRows[0],
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid user update payload', error);
  }
}
