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
import { logAuditEvent } from './_audit.js';
import { RegistrationRequestSchema } from './_schemas.js';
import { sql } from './_db.js';
import { sendInviteEmail } from './_email.js';

type RegistrationRequestRecord = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Accountant' | 'Driver';
  status: 'Pending' | 'Approved' | 'Rejected';
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
};

type InviteRecord = {
  id: string;
  email: string;
  role: string;
  name?: string;
  status: string;
  invited_by?: string | null;
  invite_token?: string;
  token?: string;
  expires_at: string;
  created_at: string;
};

let ensureSchemaPromise: Promise<void> | null = null;

const isMissingColumnError = (error: unknown, columnName: string): boolean =>
  error instanceof Error && error.message.includes(`column "${columnName}"`);

const ensureRegistrationRequestSchema = async (): Promise<void> => {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS registration_requests (
          id uuid PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL,
          role text NOT NULL,
          status text NOT NULL DEFAULT 'Pending',
          requested_at timestamptz NOT NULL DEFAULT NOW(),
          reviewed_at timestamptz NULL,
          reviewed_by uuid NULL REFERENCES user_profiles(id) ON DELETE SET NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_registration_requests_requested_at
        ON registration_requests (requested_at DESC)
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_requests_pending_email
        ON registration_requests (LOWER(email))
        WHERE status = 'Pending'
      `;
    })().catch(error => {
      ensureSchemaPromise = null;
      throw error;
    });
  }

  return ensureSchemaPromise;
};

const toRegistrationRequest = (row: RegistrationRequestRecord) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status,
  requested_at: row.requested_at,
  reviewed_at: row.reviewed_at,
  reviewed_by: row.reviewed_by,
});

async function findPendingInvite(email: string) {
  try {
    const rows = await sql`
      SELECT id, email, role, name, status, invited_by, invite_token, expires_at, created_at
      FROM invites
      WHERE LOWER(email) = ${email.toLowerCase()}
        AND status = 'Pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] as InviteRecord | undefined;
  } catch (error) {
    if (isMissingColumnError(error, 'name') || isMissingColumnError(error, 'invite_token')) {
      const rows = await sql`
        SELECT id, email, role, status, invited_by, token, expires_at, created_at
        FROM invites
        WHERE LOWER(email) = ${email.toLowerCase()}
          AND status = 'Pending'
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      return rows[0] as InviteRecord | undefined;
    }
    throw error;
  }
}

async function createInviteForRequest(request: RegistrationRequestRecord, reviewerId: string) {
  const existingInvite = await findPendingInvite(request.email);
  if (existingInvite) {
    return existingInvite;
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    const rows = await sql`
      INSERT INTO invites (email, role, name, invited_by, invite_token, expires_at, status)
      VALUES (
        ${request.email.toLowerCase()},
        ${request.role},
        ${request.name},
        ${reviewerId},
        ${token},
        ${expiresAt.toISOString()},
        'Pending'
      )
      RETURNING id, email, role, name, status, invited_by, invite_token, expires_at, created_at
    `;
    await sendInviteEmail({
      to: request.email.toLowerCase(),
      name: request.name,
      role: request.role,
      inviteToken: token,
      invitedBy: reviewerId,
    });
    return rows[0] as InviteRecord;
  } catch (error) {
    if (isMissingColumnError(error, 'name') || isMissingColumnError(error, 'invite_token')) {
      const rows = await sql`
        INSERT INTO invites (email, role, invited_by, token, expires_at, status)
        VALUES (
          ${request.email.toLowerCase()},
          ${request.role},
          ${reviewerId},
          ${token},
          ${expiresAt.toISOString()},
          'Pending'
        )
        RETURNING id, email, role, status, invited_by, token, expires_at, created_at
      `;
      await sendInviteEmail({
        to: request.email.toLowerCase(),
        name: request.name,
        role: request.role,
        inviteToken: token,
        invitedBy: reviewerId,
      });
      return rows[0] as InviteRecord;
    }
    throw error;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  try {
    await ensureRegistrationRequestSchema();

    const action = typeof req.query.action === 'string' ? req.query.action : '';

    if (req.method === 'POST' && !action) {
      return await createRegistrationRequestHandler(req, res);
    }

    const authReq = req as AuthenticatedRequest;
    if (!(await verifyToken(authReq, res))) return;
    if (!requirePasswordCurrent(authReq, res)) return;
    if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;

    switch (req.method) {
      case 'GET':
        return await listRegistrationRequests(res);
      case 'POST':
        if (action === 'approve') return await approveRegistrationRequest(authReq, res);
        if (action === 'reject') return await rejectRegistrationRequest(authReq, res);
        return apiError(res, 400, 'Invalid action');
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listRegistrationRequests(res: ApiResponse) {
  const rows = await sql`
    SELECT id, name, email, role, status, requested_at, reviewed_at, reviewed_by
    FROM registration_requests
    ORDER BY requested_at DESC
  `;
  return res.status(200).json((rows as RegistrationRequestRecord[]).map(toRegistrationRequest));
}

async function createRegistrationRequestHandler(req: ApiRequest, res: ApiResponse) {
  try {
    const data = RegistrationRequestSchema.parse(req.body);

    const existingUser = await sql`
      SELECT id FROM user_profiles WHERE LOWER(email) = ${data.email.toLowerCase()}
    `;
    if (existingUser.length > 0) {
      return apiError(res, 409, 'Email already registered');
    }

    const existingPendingRequest = await sql`
      SELECT id FROM registration_requests
      WHERE LOWER(email) = ${data.email.toLowerCase()} AND status = 'Pending'
      LIMIT 1
    `;
    if (existingPendingRequest.length > 0) {
      return apiError(res, 409, 'A pending registration request already exists for this email');
    }

    const rows = await sql`
      INSERT INTO registration_requests (id, name, email, role, status, requested_at)
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${data.name},
        ${data.email.toLowerCase()},
        ${data.role},
        'Pending',
        NOW()
      )
      RETURNING id, name, email, role, status, requested_at, reviewed_at, reviewed_by
    `;

    await logAuditEvent({
      req,
      action: 'registration_requests.created',
      tableName: 'registration_requests',
      recordId: rows[0].id,
      newData: rows[0],
    });

    return res.status(201).json(toRegistrationRequest(rows[0] as RegistrationRequestRecord));
  } catch (error) {
    return apiError(res, 400, 'Invalid registration request data', error);
  }
}

async function approveRegistrationRequest(req: AuthenticatedRequest, res: ApiResponse) {
  if (!req.user) return apiError(res, 401, 'Unauthorized');

  const requestId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!requestId) return apiError(res, 400, 'Missing registration request id');

  const rows = await sql`
    SELECT id, name, email, role, status, requested_at, reviewed_at, reviewed_by
    FROM registration_requests
    WHERE id = ${requestId}::uuid
  `;
  const request = rows[0] as RegistrationRequestRecord | undefined;

  if (!request) return apiError(res, 404, 'Registration request not found');
  if (request.status !== 'Pending') {
    return apiError(res, 409, `Registration request already ${request.status.toLowerCase()}`);
  }

  const existingUser = await sql`
    SELECT id FROM user_profiles WHERE LOWER(email) = ${request.email.toLowerCase()}
  `;
  if (existingUser.length > 0) {
    return apiError(res, 409, 'Email already registered');
  }

  const invite = await createInviteForRequest(request, req.user.id);

  const updatedRows = await sql`
    UPDATE registration_requests
    SET
      status = 'Approved',
      reviewed_at = NOW(),
      reviewed_by = ${req.user.id}::uuid
    WHERE id = ${request.id}::uuid
    RETURNING id, name, email, role, status, requested_at, reviewed_at, reviewed_by
  `;

  await logAuditEvent({
    req,
    userId: req.user.id,
    action: 'registration_requests.approved',
    tableName: 'registration_requests',
    recordId: request.id,
    oldData: request,
    newData: updatedRows[0],
  });

  return res.status(200).json({
    request: toRegistrationRequest(updatedRows[0] as RegistrationRequestRecord),
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      name: invite.name || request.name,
      status: invite.status,
      invitedBy: invite.invited_by || req.user.id,
      inviteToken: invite.invite_token || invite.token || '',
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
    },
  });
}

async function rejectRegistrationRequest(req: AuthenticatedRequest, res: ApiResponse) {
  if (!req.user) return apiError(res, 401, 'Unauthorized');

  const requestId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!requestId) return apiError(res, 400, 'Missing registration request id');

  const rows = await sql`
    UPDATE registration_requests
    SET
      status = 'Rejected',
      reviewed_at = NOW(),
      reviewed_by = ${req.user.id}::uuid
    WHERE id = ${requestId}::uuid AND status = 'Pending'
    RETURNING id, name, email, role, status, requested_at, reviewed_at, reviewed_by
  `;

  if (rows.length === 0) {
    return apiError(res, 404, 'Pending registration request not found');
  }

  await logAuditEvent({
    req,
    userId: req.user.id,
    action: 'registration_requests.rejected',
    tableName: 'registration_requests',
    recordId: rows[0].id,
    newData: rows[0],
  });

  return res.status(200).json(toRegistrationRequest(rows[0] as RegistrationRequestRecord));
}
