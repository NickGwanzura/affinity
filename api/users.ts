import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireRole,
  requireTenantContext,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { hashPassword } from './_auth.js';
import { AdminSetPasswordSchema, UserSchema, UserUpdateSchema } from './_schemas.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requireTenantContext(authReq, res)) return;
  if (!requireRole(authReq, res, ['Admin'])) return;

  try {
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    if (action === 'set-password' && req.method === 'POST') {
      return await adminSetPassword(req, res);
    }

    switch (req.method) {
      case 'GET':
        return await listUsers(authReq, res);
      case 'POST':
        return await createUser(authReq, res);
      case 'PUT':
        return await updateUser(authReq, res);
      case 'DELETE':
        return await deleteUser(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function countAdmins(tenantId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) AS count
    FROM user_profiles
    WHERE role = 'Admin' AND tenant_id = ${tenantId}::uuid
  `;
  return parseInt(String(rows[0]?.count || '0'), 10);
}

async function listUsers(req: AuthenticatedRequest, res: VercelResponse) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

  const rows = await sql`
    SELECT id, name, email, role, access_role, tenant_id, status, created_at
    FROM user_profiles
    WHERE tenant_id = ${tenantId}::uuid
    ORDER BY created_at DESC
  `;
  return res.status(200).json(rows);
}

async function createUser(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

    const data = UserSchema.parse(req.body);
    const existing = await sql`
      SELECT id
      FROM user_profiles
      WHERE LOWER(email) = ${data.email.toLowerCase()} AND tenant_id = ${tenantId}::uuid
    `;
    if (existing.length > 0) return apiError(res, 409, 'Email already registered');

    const passwordHash = await hashPassword(data.password);
    const accessRole = data.role === 'Admin' ? 'tenant_admin' : 'user';
    const rows = await sql`
      INSERT INTO user_profiles (name, email, role, access_role, tenant_id, status, password_hash)
      VALUES (
        ${data.name},
        ${data.email.toLowerCase()},
        ${data.role},
        ${accessRole},
        ${tenantId}::uuid,
        ${data.status},
        ${passwordHash}
      )
      RETURNING id, name, email, role, access_role, tenant_id, status, created_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'users.created',
      tableName: 'user_profiles',
      recordId: rows[0].id,
      newData: rows[0],
    });

    return res.status(201).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid user data', error);
  }
}

async function updateUser(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

    const data = UserUpdateSchema.parse(req.body);
    const userRows = await sql`
      SELECT id, name, email, role, access_role, tenant_id, status, created_at
      FROM user_profiles
      WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid
    `;
    if (userRows.length === 0) return apiError(res, 404, 'User not found');

    const currentUser = userRows[0];
    if (currentUser.role === 'Admin' && data.role && data.role !== 'Admin' && await countAdmins(tenantId) <= 1) {
      return apiError(res, 400, 'Cannot demote the last admin');
    }

    const nextAccessRole = data.role ? (data.role === 'Admin' ? 'tenant_admin' : 'user') : null;

    const rows = await sql`
      UPDATE user_profiles
      SET
        name = COALESCE(${data.name || null}, name),
        email = COALESCE(${data.email?.toLowerCase() || null}, email),
        role = COALESCE(${data.role || null}, role),
        access_role = COALESCE(${nextAccessRole}, access_role),
        status = COALESCE(${data.status || null}, status),
        updated_at = NOW()
      WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid
      RETURNING id, name, email, role, access_role, tenant_id, status, created_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'users.updated',
      tableName: 'user_profiles',
      recordId: rows[0].id,
      oldData: currentUser,
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid user update', error);
  }
}

async function deleteUser(req: AuthenticatedRequest, res: VercelResponse) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

  const userRows = await sql`
    SELECT id, role, tenant_id
    FROM user_profiles
    WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid
  `;
  if (userRows.length === 0) return apiError(res, 404, 'User not found');
  if (userRows[0].role === 'Admin' && await countAdmins(tenantId) <= 1) {
    return apiError(res, 400, 'Cannot delete the last admin');
  }

  await logAuditEvent({
    req,
    userId: req.user?.id || null,
    action: 'users.deleted',
    tableName: 'user_profiles',
    recordId: userRows[0].id,
    oldData: userRows[0],
  });
  await sql`DELETE FROM user_profiles WHERE id = ${req.query.id}::uuid`;
  return res.status(204).end();
}

async function adminSetPassword(req: VercelRequest, res: VercelResponse) {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

    const data = AdminSetPasswordSchema.parse(req.body);
    const passwordHash = await hashPassword(data.newPassword);
    const rows = await sql`
      UPDATE user_profiles
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${data.id}::uuid AND tenant_id = ${tenantId}::uuid
      RETURNING id
    `;
    if (rows.length === 0) return apiError(res, 404, 'User not found');

    await logAuditEvent({
      req,
      userId: authReq.user?.id || null,
      action: 'users.password_set',
      tableName: 'user_profiles',
      recordId: data.id,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return apiError(res, 400, 'Invalid password update', error);
  }
}
