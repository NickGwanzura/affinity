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
import { checkConnection, sql } from '../_db.js';
import { ensureAuditSchema } from '../_audit.js';

type ErrorSignalRow = {
  id: string;
  action: string;
  table_name: string | null;
  created_at: string;
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
    const databaseHealthy = await checkConnection();
    const uptimeSeconds =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { process?: { uptime?: () => number } }).process?.uptime === 'function'
        ? Math.floor((globalThis as { process?: { uptime?: () => number } }).process?.uptime?.() || 0)
        : 0;

    let recentErrors: ErrorSignalRow[] = [];
    try {
      await ensureAuditSchema();
      const result = await sql.query(
        `
          SELECT
            al.id,
            al.action,
            al.table_name,
            al.created_at,
            up.email AS user_email
          FROM audit_logs al
          LEFT JOIN user_profiles up ON up.id = al.user_id
          WHERE
            LOWER(al.action) LIKE '%failed%'
            OR LOWER(al.action) LIKE '%error%'
            OR LOWER(al.action) LIKE '%rejected%'
          ORDER BY al.created_at DESC
          LIMIT 30
        `,
      );
      recentErrors = toRows<ErrorSignalRow>(result);
    } catch {
      recentErrors = [];
    }

    return res.status(200).json({
      status: databaseHealthy ? 'healthy' : 'degraded',
      checks: {
        api: true,
        database: databaseHealthy,
      },
      recentErrors,
      timestamp: new Date().toISOString(),
      uptimeSeconds,
    });
  } catch (error) {
    return apiError(res, 500, 'Failed to load system health', error);
  }
}
