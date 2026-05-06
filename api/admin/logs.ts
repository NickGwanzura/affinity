import type { ApiRequest, ApiResponse } from '../_types.js';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from '../_middleware.js';
import { sql } from '../_db.js';
import { ensureAuditSchema } from '../_audit.js';

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

const toRows = <T>(result: any): T[] => {
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result?.rows)) return result.rows as T[];
  return [];
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  if (req.method !== 'GET') {
    return apiError(res, 405, 'Method not allowed');
  }

  try {
    await ensureAuditSchema();

    const requestedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 250) : 100;
    const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim().toLowerCase() : '';

    const clauses: string[] = [];
    const params: any[] = [];

    if (actionFilter) {
      params.push(`%${actionFilter}%`);
      clauses.push(`LOWER(al.action) LIKE $${params.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit);

    const result = await sql.query(
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
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${params.length}
      `,
      params,
    );

    const rows = toRows<AuditLogRow>(result).map((row) => ({
      ...row,
      ip_address: row.ip_address || null,
    }));

    return res.status(200).json(rows);
  } catch (error) {
    return apiError(res, 500, 'Failed to load admin audit logs', error);
  }
}
