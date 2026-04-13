import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requireTenantContext,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { ensureAuditSchema } from './_audit.js';

type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requireTenantContext(authReq, res)) return;
  if (!requireAccessRole(authReq, res, ['tenant_admin'])) return;

  if (req.method !== 'GET') {
    return apiError(res, 405, 'Method not allowed');
  }

  try {
    await ensureAuditSchema();

    const requestedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 250) : 100;

    const rows = await sql.query(
      `
        SELECT
          al.id,
          al.user_id,
          al.action,
          al.table_name,
          al.record_id,
          al.old_data,
          al.new_data,
          al.ip_address::text AS ip_address,
          al.user_agent,
          al.created_at,
          up.name AS user_name,
          up.email AS user_email
        FROM audit_logs al
        LEFT JOIN user_profiles up ON up.id = al.user_id
        WHERE up.tenant_id = $2::uuid
        ORDER BY al.created_at DESC
        LIMIT $1
      `,
      [limit, authReq.user?.tenantId],
    );

    return res.status(200).json(
      (rows as AuditLogRow[]).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        action: row.action,
        table_name: row.table_name,
        record_id: row.record_id,
        old_data: row.old_data,
        new_data: row.new_data,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at,
        user_name: row.user_name,
        user_email: row.user_email,
      })),
    );
  } catch (error) {
    return apiError(res, 500, 'Failed to load forensic log', error);
  }
}
