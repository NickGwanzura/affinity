/**
 * /api/fund-disbursements
 *
 * GET  ?resource=balance    → my received total, used total, net balance
 * GET  ?resource=received   → disbursements sent to me
 * GET  ?resource=sent       → disbursements I sent
 * GET  ?resource=usage      → my usage log entries
 * GET  ?resource=users      → list of active users (for recipient picker)
 * GET  ?resource=overview   → full view for Director / Manager
 * POST ?resource=disburse   → create a disbursement (Director or Manager)
 * POST ?resource=usage      → log usage of received funds (any role)
 * DELETE ?resource=disburse&id=X  → delete disbursement
 * DELETE ?resource=usage&id=X     → delete usage log entry
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
  json,
} from './_middleware.js';
import { z } from 'zod';



const DisburseSchema = z.object({
  to_user_id:   z.string().uuid(),
  amount:       z.number().positive(),
  currency:     z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
  note:         z.string().max(500).optional(),
  disbursed_at: z.string().optional(),
});

const UsageSchema = z.object({
  amount:      z.number().positive(),
  currency:    z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
  description: z.string().min(1).max(500),
  category:    z.string().max(100).default('General'),
  source:      z.string().max(100).default('General'),
  usage_date:  z.string().optional(),
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  const { method, query } = req;
  const resource = typeof query.resource === 'string' ? query.resource : '';
  const id       = typeof query.id === 'string' ? query.id : undefined;
  const userId   = authReq.user!.id;
  const access   = authReq.user!.accessRole;

  try {
    // ── GET ─────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (resource === 'balance') {
        const [recv] = await sql`
          SELECT COALESCE(SUM(amount),0) AS total
          FROM fund_disbursements WHERE to_user_id = ${userId}::uuid
        `;
        const [used] = await sql`
          SELECT COALESCE(SUM(amount),0) AS total
          FROM fund_usage_logs WHERE user_id = ${userId}::uuid
        `;
        return json(res, 200, {
          received: Number(recv.total),
          used:     Number(used.total),
          balance:  Number(recv.total) - Number(used.total),
        });
      }

      if (resource === 'received') {
        const rows = await sql`
          SELECT d.*, f.name AS from_name, f.role AS from_role
          FROM fund_disbursements d
          JOIN user_profiles f ON f.id = d.from_user_id
          WHERE d.to_user_id = ${userId}::uuid
          ORDER BY d.disbursed_at DESC, d.created_at DESC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'sent') {
        const rows = await sql`
          SELECT d.*, t.name AS to_name, t.role AS to_role
          FROM fund_disbursements d
          JOIN user_profiles t ON t.id = d.to_user_id
          WHERE d.from_user_id = ${userId}::uuid
          ORDER BY d.disbursed_at DESC, d.created_at DESC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'usage') {
        const rows = await sql`
          SELECT * FROM fund_usage_logs
          WHERE user_id = ${userId}::uuid
          ORDER BY usage_date DESC, created_at DESC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'users') {
        const rows = await sql`
          SELECT id, name, role FROM user_profiles
          WHERE status IN ('Active','active','Approved','approved')
            AND id != ${userId}::uuid
          ORDER BY name ASC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'overview') {

        const [myRecv] = await sql`
          SELECT COALESCE(SUM(amount),0) AS total FROM fund_disbursements
          WHERE to_user_id = ${userId}::uuid
        `;
        const [mySent] = await sql`
          SELECT COALESCE(SUM(amount),0) AS total FROM fund_disbursements
          WHERE from_user_id = ${userId}::uuid
        `;

        const recentSent = await sql`
          SELECT d.*, t.name AS to_name, t.role AS to_role
          FROM fund_disbursements d
          JOIN user_profiles t ON t.id = d.to_user_id
          WHERE d.from_user_id = ${userId}::uuid
          ORDER BY d.disbursed_at DESC, d.created_at DESC
          LIMIT 20
        `;

        const recentReceived = await sql`
          SELECT d.*, f.name AS from_name, f.role AS from_role
          FROM fund_disbursements d
          JOIN user_profiles f ON f.id = d.from_user_id
          WHERE d.to_user_id = ${userId}::uuid
          ORDER BY d.disbursed_at DESC, d.created_at DESC
          LIMIT 10
        `;

        // Per-recipient balances for disbursements I sent
        const recipientBalances = await sql`
          SELECT
            t.id, t.name, t.role,
            COALESCE(SUM(d.amount),0) AS total_disbursed,
            COALESCE((
              SELECT SUM(ul.amount) FROM fund_usage_logs ul WHERE ul.user_id = t.id
            ),0) AS total_used
          FROM fund_disbursements d
          JOIN user_profiles t ON t.id = d.to_user_id
          WHERE d.from_user_id = ${userId}::uuid
          GROUP BY t.id, t.name, t.role
          ORDER BY total_disbursed DESC
        `;

        return json(res, 200, {
          my_received:        Number(myRecv.total),
          my_sent:            Number(mySent.total),
          my_balance:         Number(myRecv.total) - Number(mySent.total),
          recent_sent:        recentSent,
          recent_received:    recentReceived,
          recipient_balances: recipientBalances,
        });
      }

      if (resource === 'today-spending') {
        const today = new Date().toISOString().slice(0, 10);
        const [totals] = await sql`
          SELECT
            COALESCE(SUM(amount), 0) AS total,
            COUNT(*)::int                AS entries,
            COUNT(DISTINCT user_id)::int AS users
          FROM fund_usage_logs
          WHERE usage_date = ${today}
        `;
        const topSpenders = await sql`
          SELECT u.name, SUM(l.amount) AS total, COUNT(*)::int AS entries
          FROM fund_usage_logs l
          JOIN user_profiles u ON u.id = l.user_id
          WHERE l.usage_date = ${today}
          GROUP BY u.name
          ORDER BY total DESC
          LIMIT 5
        `;
        return json(res, 200, {
          total:        Number(totals.total),
          entries:      Number(totals.entries),
          users:        Number(totals.users),
          top_spenders: topSpenders.map(s => ({ name: s.name, total: Number(s.total), entries: Number(s.entries) })),
          date:         today,
        });
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    // ── POST ────────────────────────────────────────────────────────────────
    if (method === 'POST') {
      if (resource === 'disburse') {
        const parsed = DisburseSchema.safeParse(req.body);
        if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
        const d = parsed.data;
        const date = d.disbursed_at || new Date().toISOString().slice(0, 10);

        const [row] = await sql`
          INSERT INTO fund_disbursements (from_user_id, to_user_id, amount, currency, note, disbursed_at)
          VALUES (${userId}::uuid, ${d.to_user_id}::uuid, ${d.amount}, ${d.currency}, ${d.note ?? null}, ${date})
          RETURNING *
        `;

        const [recipient] = await sql`SELECT name, role FROM user_profiles WHERE id = ${d.to_user_id}::uuid`;

        await logAuditEvent({
          req,
          userId,
          action:    'fund.disbursed',
          tableName: 'fund_disbursements',
          recordId:  row.id,
          newData:   { ...row, to_name: recipient?.name, to_role: recipient?.role },
        });

        return json(res, 201, row);
      }

      if (resource === 'usage') {
        const parsed = UsageSchema.safeParse(req.body);
        if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
        const d = parsed.data;
        const date = d.usage_date || new Date().toISOString().slice(0, 10);

        const [row] = await sql`
          INSERT INTO fund_usage_logs (user_id, amount, currency, description, category, source, usage_date)
          VALUES (${userId}::uuid, ${d.amount}, ${d.currency}, ${d.description}, ${d.category}, ${d.source}, ${date})
          RETURNING *
        `;

        await logAuditEvent({
          req,
          userId,
          action:    'fund.usage_logged',
          tableName: 'fund_usage_logs',
          recordId:  row.id,
          newData:   row,
        });

        return json(res, 201, row);
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return json(res, 400, { error: 'id required' });

      if (resource === 'disburse') {
        const [existing] = await sql`
          SELECT * FROM fund_disbursements WHERE id = ${id}::uuid
        `;
        if (!existing) return json(res, 404, { error: 'Not found' });
        if (existing.from_user_id !== userId && access !== 'super_admin' && access !== 'admin') {
          return json(res, 403, { error: 'Access denied' });
        }
        await sql`DELETE FROM fund_disbursements WHERE id = ${id}::uuid`;
        await logAuditEvent({
          req, userId, action: 'fund.disbursement_deleted',
          tableName: 'fund_disbursements', recordId: id, oldData: existing,
        });
        return json(res, 200, { success: true });
      }

      if (resource === 'usage') {
        const [existing] = await sql`SELECT * FROM fund_usage_logs WHERE id = ${id}::uuid`;
        if (!existing) return json(res, 404, { error: 'Not found' });
        if (existing.user_id !== userId && access !== 'super_admin' && access !== 'admin') {
          return json(res, 403, { error: 'Access denied' });
        }
        await sql`DELETE FROM fund_usage_logs WHERE id = ${id}::uuid`;
        await logAuditEvent({
          req, userId, action: 'fund.usage_deleted',
          tableName: 'fund_usage_logs', recordId: id, oldData: existing,
        });
        return json(res, 200, { success: true });
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return apiError(res, 500, 'Internal server error', err);
  }
}
