import type { VercelRequest, VercelResponse } from '@vercel/node';
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

function isMissingTableError(error: unknown, tableName: string): boolean {
  return error instanceof Error && error.message.includes(`relation "${tableName}" does not exist`);
}

async function safeCount(query: Promise<any[]>, fallback = 0): Promise<number> {
  try {
    const rows = await query;
    return parseInt(String(rows[0]?.count || fallback), 10);
  } catch {
    return fallback;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  try {
    const [users, pendingUsers, pendingRequests] = await Promise.all([
      safeCount(sql`SELECT COUNT(*) AS count FROM user_profiles`),
      safeCount(sql`SELECT COUNT(*) AS count FROM user_profiles WHERE LOWER(COALESCE(status, '')) = 'pending'`),
      safeCount(sql`SELECT COUNT(*) AS count FROM registration_requests WHERE LOWER(COALESCE(status, '')) = 'pending'`),
    ]);

    let recentActions: any[] = [];
    try {
      recentActions = await sql`
        SELECT
          al.id,
          al.action,
          al.table_name,
          up.email AS user_email,
          al.created_at
        FROM audit_logs al
        LEFT JOIN user_profiles up ON up.id = al.user_id
        ORDER BY created_at DESC
        LIMIT 20
      `;
    } catch (error) {
      if (!isMissingTableError(error, 'audit_logs')) {
        throw error;
      }
    }

    return res.status(200).json({
      totals: {
        users,
        pendingApprovals: pendingUsers + pendingRequests,
      },
      activity: recentActions,
    });
  } catch (error) {
    return apiError(res, 500, 'Failed to load admin metrics', error);
  }
}
