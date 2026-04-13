import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireRole,
  requireTenantContext,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { authenticateUser, createUser } from './_auth.js';
import { logAuditEvent } from './_audit.js';
import { sql } from './_db.js';

const InviteCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['Admin', 'Manager', 'Accountant', 'Driver']),
  name: z.string().min(1),
  invitedBy: z.string().optional(),
});

const InviteAcceptSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const isMissingColumnError = (error: unknown, columnName: string): boolean =>
  error instanceof Error && error.message.includes(`column "${columnName}"`);

type InviteRecord = {
  id: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Accountant' | 'Driver';
  tenant_id?: string | null;
  name?: string;
  status: 'Pending' | 'Accepted' | 'Expired' | 'Cancelled' | 'Revoked';
  invited_by?: string | null;
  invite_token?: string;
  token?: string;
  expires_at: string;
  created_at: string;
};

const toInvite = (row: InviteRecord) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  name: row.name || row.email.split('@')[0],
  status: row.status === 'Revoked' ? 'Expired' : row.status,
  invitedBy: row.invited_by || 'Administrator',
  inviteToken: row.invite_token || row.token || '',
  tenantId: row.tenant_id ?? null,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

async function listInviteRows(tenantId: string) {
  try {
    return await sql`
      SELECT id, email, role, tenant_id, name, status, invited_by, invite_token, expires_at, created_at
      FROM invites
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
    `;
  } catch (error) {
    if (isMissingColumnError(error, 'name') || isMissingColumnError(error, 'invite_token')) {
      return sql`
        SELECT id, email, role, tenant_id, status, invited_by, token, expires_at, created_at
        FROM invites
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at DESC
      `;
    }
    throw error;
  }
}

async function findInviteByToken(token: string) {
  try {
    const rows = await sql`
      SELECT id, email, role, tenant_id, name, status, invited_by, invite_token, expires_at, created_at
      FROM invites
      WHERE invite_token = ${token} AND status = 'Pending' AND expires_at > NOW()
    `;
    return rows[0] as InviteRecord | undefined;
  } catch (error) {
    if (isMissingColumnError(error, 'name') || isMissingColumnError(error, 'invite_token')) {
      const rows = await sql`
        SELECT id, email, role, tenant_id, status, invited_by, token, expires_at, created_at
        FROM invites
        WHERE token = ${token} AND status = 'Pending' AND expires_at > NOW()
      `;
      return rows[0] as InviteRecord | undefined;
    }
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const inviteToken = typeof req.query.token === 'string' ? req.query.token : '';

  try {
    if (req.method === 'GET' && action === 'verify') {
      return await verifyInvite(inviteToken, res);
    }

    if (req.method === 'POST' && action === 'accept') {
      return await acceptInvite(req, res);
    }

    const authReq = req as AuthenticatedRequest;
    if (!(await verifyToken(authReq, res))) return;
    if (!requireTenantContext(authReq, res)) return;
    if (!requireRole(authReq, res, ['Admin'])) return;

    switch (req.method) {
      case 'GET':
        return await listInvitesForTenant(authReq.user!.tenantId!, res);
      case 'POST':
        if (action === 'resend') return await resendInvite(req, res);
        return await createInviteHandler(req, res);
      case 'DELETE':
        return await deleteInvite(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listInvitesForTenant(tenantId: string, res: VercelResponse) {
  const rows = await listInviteRows(tenantId);
  return res.status(200).json(rows.map((row) => toInvite(row as InviteRecord)));
}

async function createInviteHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

    const data = InviteCreateSchema.parse(req.body);
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      const rows = await sql`
        INSERT INTO invites (email, role, tenant_id, name, invited_by, invite_token, expires_at, status)
        VALUES (
          ${data.email.toLowerCase()},
          ${data.role},
          ${tenantId}::uuid,
          ${data.name},
          ${data.invitedBy || null},
          ${token},
          ${expiresAt.toISOString()},
          'Pending'
        )
        RETURNING id, email, role, tenant_id, name, status, invited_by, invite_token, expires_at, created_at
      `;
      await logAuditEvent({
        req,
        userId: authReq.user?.id || null,
        action: 'invites.created',
        tableName: 'invites',
        recordId: rows[0].id,
        newData: rows[0],
      });
      return res.status(201).json(toInvite(rows[0] as InviteRecord));
    } catch (error) {
      if (isMissingColumnError(error, 'name') || isMissingColumnError(error, 'invite_token')) {
        const rows = await sql`
          INSERT INTO invites (email, role, tenant_id, invited_by, token, expires_at, status)
          VALUES (
            ${data.email.toLowerCase()},
            ${data.role},
            ${tenantId}::uuid,
            ${data.invitedBy || null},
            ${token},
            ${expiresAt.toISOString()},
            'Pending'
          )
          RETURNING id, email, role, tenant_id, status, invited_by, token, expires_at, created_at
        `;
        await logAuditEvent({
          req,
          userId: authReq.user?.id || null,
          action: 'invites.created',
          tableName: 'invites',
          recordId: rows[0].id,
          newData: { ...(rows[0] as InviteRecord), name: data.name },
        });
        return res.status(201).json(toInvite({ ...(rows[0] as InviteRecord), name: data.name }));
      }
      throw error;
    }
  } catch (error) {
    return apiError(res, 400, 'Invalid invite data', error);
  }
}

async function resendInvite(req: VercelRequest, res: VercelResponse) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

  const inviteId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!inviteId) return apiError(res, 400, 'Missing invite id');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    const rows = await sql`
      UPDATE invites
      SET expires_at = ${expiresAt.toISOString()}, status = 'Pending'
      WHERE id = ${inviteId}::uuid AND tenant_id = ${tenantId}::uuid
      RETURNING id, email, role, tenant_id, name, status, invited_by, invite_token, expires_at, created_at
    `;
    if (rows.length === 0) return apiError(res, 404, 'Invite not found');
    await logAuditEvent({
      req,
      userId: authReq.user?.id || null,
      action: 'invites.resent',
      tableName: 'invites',
      recordId: rows[0].id,
      newData: rows[0],
    });
    return res.status(200).json(toInvite(rows[0] as InviteRecord));
  } catch (error) {
    if (isMissingColumnError(error, 'name') || isMissingColumnError(error, 'invite_token')) {
      const rows = await sql`
        UPDATE invites
        SET expires_at = ${expiresAt.toISOString()}, status = 'Pending'
        WHERE id = ${inviteId}::uuid AND tenant_id = ${tenantId}::uuid
        RETURNING id, email, role, tenant_id, status, invited_by, token, expires_at, created_at
      `;
      if (rows.length === 0) return apiError(res, 404, 'Invite not found');
      await logAuditEvent({
        req,
        userId: authReq.user?.id || null,
        action: 'invites.resent',
        tableName: 'invites',
        recordId: rows[0].id,
        newData: rows[0],
      });
      return res.status(200).json(toInvite(rows[0] as InviteRecord));
    }
    throw error;
  }
}

async function deleteInvite(req: VercelRequest, res: VercelResponse) {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  if (!tenantId) return apiError(res, 400, 'User not linked to tenant');

  const existing = await sql`
    SELECT id, email, role, tenant_id, status
    FROM invites
    WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid
  `;
  if (existing.length === 0) return apiError(res, 404, 'Invite not found');
  await logAuditEvent({
    req,
    userId: authReq.user?.id || null,
    action: 'invites.deleted',
    tableName: 'invites',
    recordId: existing[0].id,
    oldData: existing[0],
  });
  await sql`DELETE FROM invites WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid`;
  return res.status(204).end();
}

async function verifyInvite(token: string, res: VercelResponse) {
  if (!token) return apiError(res, 400, 'Missing invite token');
  const invite = await findInviteByToken(token);
  if (!invite) return res.status(200).json(null);
  return res.status(200).json(toInvite(invite));
}

async function acceptInvite(req: VercelRequest, res: VercelResponse) {
  try {
    const data = InviteAcceptSchema.parse(req.body);
    const invite = await findInviteByToken(data.token);
    if (!invite) return apiError(res, 400, 'Invalid or expired invite token');

    await createUser(
      invite.name || invite.email.split('@')[0],
      invite.email,
      data.password,
      invite.role,
      {
        accessRole: invite.role === 'Admin' ? 'tenant_admin' : 'user',
        tenantId: invite.tenant_id ?? null,
      },
    );
    await sql`
      UPDATE invites
      SET status = 'Accepted'
      WHERE id = ${invite.id}::uuid
    `;

    const session = await authenticateUser(invite.email, data.password);
    if (session.success === false) {
      return apiError(res, 500, `Failed to establish session: ${session.message}`);
    }

    await logAuditEvent({
      req,
      userId: session.user.id,
      action: 'invites.accepted',
      tableName: 'invites',
      recordId: invite.id,
      oldData: invite,
      newData: {
        status: 'Accepted',
        userId: session.user.id,
      },
    });
    return res.status(200).json(session);
  } catch (error) {
    return apiError(res, 400, 'Failed to accept invite', error);
  }
}
