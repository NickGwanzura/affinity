/**
 * /api/debtors-creditors
 *
 * GET  ?resource=stats
 *
 * GET/POST         ?resource=debtors
 * PUT/DELETE       ?resource=debtors&id=X
 *
 * GET/POST         ?resource=debtor-entries&debtor_id=X
 * PUT/DELETE       ?resource=debtor-entries&id=X
 * POST             ?resource=debtor-payment&id=X  { amount }
 *
 * GET/POST         ?resource=creditors
 * PUT/DELETE       ?resource=creditors&id=X
 *
 * GET/POST         ?resource=creditor-entries&creditor_id=X
 * PUT/DELETE       ?resource=creditor-entries&id=X
 * POST             ?resource=creditor-payment&id=X  { amount }
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requireBusinessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { logAuditEvent } from './_audit.js';
import { z } from 'zod';

const json = (res: ApiResponse, s: number, b: unknown) => res.status(s).json(b);
const coerce = (v: unknown) => Number(v) || 0;

const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;
const DEBTOR_TYPES = ['client', 'dealer', 'individual', 'supplier', 'other'] as const;

const DebtorSchema = z.object({
  name:         z.string().min(1).max(200),
  type:         z.enum(DEBTOR_TYPES).default('other'),
  contact_name: z.string().max(200).optional().nullable(),
  phone:        z.string().max(50).optional().nullable(),
  email:        z.string().max(200).optional().nullable(),
  address:      z.string().max(500).optional().nullable(),
  notes:        z.string().max(500).optional().nullable(),
});

const CreditorSchema = z.object({
  name:         z.string().min(1).max(200),
  contact_name: z.string().max(200).optional().nullable(),
  phone:        z.string().max(50).optional().nullable(),
  email:        z.string().max(200).optional().nullable(),
  address:      z.string().max(500).optional().nullable(),
  notes:        z.string().max(500).optional().nullable(),
});

const EntrySchema = z.object({
  description:          z.string().min(1).max(300),
  reference:            z.string().max(100).optional().nullable(),
  amount:               z.number().positive(),
  currency:             z.enum(CURRENCIES).default('USD'),
  due_date:             z.string().min(1).optional().nullable(),
  storage_fee_per_day:  z.number().nonnegative().optional().nullable(),
  storage_fee_start_date: z.string().min(1).optional().nullable(),
  notes:                z.string().max(500).optional().nullable(),
});

const PaymentSchema = z.object({
  amount: z.number().positive(),
});

function deriveStatus(amount: number, paid: number): string {
  if (paid <= 0) return 'unpaid';
  if (paid >= amount) return 'paid';
  return 'partial';
}


function coerceEntry(r: Record<string, unknown>) {
  return {
    ...r,
    amount:           coerce(r.amount),
    paid_amount:      coerce(r.paid_amount),
    storage_fee_per_day: r.storage_fee_per_day != null ? coerce(r.storage_fee_per_day) : null,
    accumulated_storage_fee: coerce(r.accumulated_storage_fee),
    total_owed: coerce(r.amount) - coerce(r.paid_amount) + coerce(r.accumulated_storage_fee),
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Admin', 'Manager', 'Accountant'])) return;

  const { method, query } = req;
  const resource   = typeof query.resource    === 'string' ? query.resource    : '';
  const id         = typeof query.id          === 'string' ? query.id          : undefined;
  const debtorId   = typeof query.debtor_id   === 'string' ? query.debtor_id   : undefined;
  const creditorId = typeof query.creditor_id === 'string' ? query.creditor_id : undefined;
  const userId     = authReq.user!.id;

  try {
    // ── STATS ────────────────────────────────────────────────────────────────
    if (resource === 'stats') {
      const today = new Date().toISOString().slice(0, 10);

      // debtor stats include storage fees in outstanding
      const [dStats] = await sql`
        SELECT
          COALESCE(SUM(
            (e.amount - e.paid_amount) +
            CASE
              WHEN e.storage_fee_per_day > 0 AND e.storage_fee_start_date IS NOT NULL
                   AND e.status != 'paid' AND e.status != 'written_off'
              THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - e.storage_fee_start_date::timestamptz)) / 86400)) * e.storage_fee_per_day
              ELSE 0
            END
          ) FILTER (WHERE e.status != 'paid' AND e.status != 'written_off'), 0) AS total_outstanding,
          COUNT(*) FILTER (WHERE e.status = 'unpaid' OR e.status = 'partial')::int AS open_entries,
          COUNT(*) FILTER (WHERE e.status != 'paid' AND e.status != 'written_off' AND e.due_date IS NOT NULL AND e.due_date < ${today})::int AS overdue_count,
          COALESCE(SUM(e.amount - e.paid_amount) FILTER (WHERE e.status != 'paid' AND e.status != 'written_off' AND e.due_date IS NOT NULL AND e.due_date < ${today}), 0) AS overdue_amount,
          COUNT(*) FILTER (WHERE e.storage_fee_per_day > 0 AND e.status != 'paid' AND e.status != 'written_off')::int AS storage_fee_entries
        FROM debtor_entries e
      `;

      const [cStats] = await sql`
        SELECT
          COALESCE(SUM(amount - paid_amount) FILTER (WHERE status != 'paid'), 0) AS total_outstanding,
          COUNT(*) FILTER (WHERE status = 'unpaid' OR status = 'partial')::int AS open_entries,
          COUNT(*) FILTER (WHERE status != 'paid' AND due_date IS NOT NULL AND due_date < ${today})::int AS overdue_count,
          COALESCE(SUM(amount - paid_amount) FILTER (WHERE status != 'paid' AND due_date IS NOT NULL AND due_date < ${today}), 0) AS overdue_amount
        FROM creditor_entries
      `;

      return json(res, 200, {
        debtors: {
          total_outstanding:   coerce(dStats.total_outstanding),
          open_entries:        Number(dStats.open_entries),
          overdue_count:       Number(dStats.overdue_count),
          overdue_amount:      coerce(dStats.overdue_amount),
          storage_fee_entries: Number(dStats.storage_fee_entries),
        },
        creditors: {
          total_outstanding: coerce(cStats.total_outstanding),
          open_entries:      Number(cStats.open_entries),
          overdue_count:     Number(cStats.overdue_count),
          overdue_amount:    coerce(cStats.overdue_amount),
        },
      });
    }

    // ── DEBTORS ──────────────────────────────────────────────────────────────
    if (resource === 'debtors') {
      if (method === 'GET') {
        const rows = await sql`
          SELECT d.*,
            COALESCE(SUM(
              (e.amount - e.paid_amount) +
              CASE
                WHEN e.storage_fee_per_day > 0 AND e.storage_fee_start_date IS NOT NULL
                     AND e.status != 'paid' AND e.status != 'written_off'
                THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - e.storage_fee_start_date::timestamptz)) / 86400)) * e.storage_fee_per_day
                ELSE 0
              END
            ) FILTER (WHERE e.status != 'paid' AND e.status != 'written_off'), 0) AS outstanding,
            COUNT(e.id) FILTER (WHERE e.status = 'unpaid' OR e.status = 'partial')::int AS open_entries
          FROM debtors d
          LEFT JOIN debtor_entries e ON e.debtor_id = d.id
          GROUP BY d.id ORDER BY d.name ASC
        `;
        return json(res, 200, rows.map(r => ({ ...r, outstanding: coerce(r.outstanding) })));
      }
      if (method === 'POST') {
        const p = DebtorSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO debtors (name, type, contact_name, phone, email, address, notes)
          VALUES (${d.name}, ${d.type}, ${d.contact_name ?? null}, ${d.phone ?? null}, ${d.email ?? null}, ${d.address ?? null}, ${d.notes ?? null})
          RETURNING *
        `;
        await logAuditEvent({ req, userId, action: 'debtor.created', tableName: 'debtors', recordId: row.id, newData: row });
        return json(res, 201, row);
      }
      if (method === 'PUT' && id) {
        const p = DebtorSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          UPDATE debtors SET name=${d.name}, type=${d.type}, contact_name=${d.contact_name ?? null},
            phone=${d.phone ?? null}, email=${d.email ?? null}, address=${d.address ?? null}, notes=${d.notes ?? null}
          WHERE id=${id}::uuid RETURNING *
        `;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'debtor.updated', tableName: 'debtors', recordId: id, newData: row });
        return json(res, 200, row);
      }
      if (method === 'DELETE' && id) {
        const [row] = await sql`DELETE FROM debtors WHERE id=${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'debtor.deleted', tableName: 'debtors', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }
    }

    // ── DEBTOR ENTRIES ────────────────────────────────────────────────────────
    if (resource === 'debtor-entries') {
      if (method === 'GET') {
        const rows = debtorId
          ? await sql`
              SELECT e.*,
                CASE
                  WHEN e.storage_fee_per_day IS NOT NULL AND e.storage_fee_per_day > 0
                       AND e.storage_fee_start_date IS NOT NULL
                       AND e.status != 'paid' AND e.status != 'written_off'
                  THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - e.storage_fee_start_date::timestamptz)) / 86400))
                       * e.storage_fee_per_day
                  ELSE 0
                END AS accumulated_storage_fee
              FROM debtor_entries e
              WHERE e.debtor_id=${debtorId}::uuid ORDER BY e.created_at DESC
            `
          : await sql`
              SELECT e.*, d.name AS debtor_name, d.type AS debtor_type,
                CASE
                  WHEN e.storage_fee_per_day IS NOT NULL AND e.storage_fee_per_day > 0
                       AND e.storage_fee_start_date IS NOT NULL
                       AND e.status != 'paid' AND e.status != 'written_off'
                  THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - e.storage_fee_start_date::timestamptz)) / 86400))
                       * e.storage_fee_per_day
                  ELSE 0
                END AS accumulated_storage_fee
              FROM debtor_entries e JOIN debtors d ON d.id = e.debtor_id
              ORDER BY e.created_at DESC
            `;
        return json(res, 200, rows.map(coerceEntry));
      }
      if (method === 'POST' && debtorId) {
        const p = EntrySchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO debtor_entries
            (debtor_id, description, reference, amount, currency, due_date,
             storage_fee_per_day, storage_fee_start_date, notes)
          VALUES
            (${debtorId}::uuid, ${d.description}, ${d.reference ?? null},
             ${d.amount}, ${d.currency}, ${d.due_date ?? null},
             ${d.storage_fee_per_day ?? null}, ${d.storage_fee_start_date ?? null},
             ${d.notes ?? null})
          RETURNING *
        `;
        await logAuditEvent({ req, userId, action: 'debtor_entry.created', tableName: 'debtor_entries', recordId: row.id, newData: row });
        return json(res, 201, coerceEntry({ ...row, accumulated_storage_fee: 0 }));
      }
      if (method === 'PUT' && id) {
        const p = EntrySchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          UPDATE debtor_entries SET
            description=${d.description}, reference=${d.reference ?? null},
            amount=${d.amount}, currency=${d.currency}, due_date=${d.due_date ?? null},
            storage_fee_per_day=${d.storage_fee_per_day ?? null},
            storage_fee_start_date=${d.storage_fee_start_date ?? null},
            notes=${d.notes ?? null}
          WHERE id=${id}::uuid RETURNING *
        `;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'debtor_entry.updated', tableName: 'debtor_entries', recordId: id, newData: row });
        return json(res, 200, coerceEntry({ ...row, accumulated_storage_fee: 0 }));
      }
      if (method === 'DELETE' && id) {
        const [row] = await sql`DELETE FROM debtor_entries WHERE id=${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'debtor_entry.deleted', tableName: 'debtor_entries', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }
    }

    // ── DEBTOR PAYMENT ────────────────────────────────────────────────────────
    if (resource === 'debtor-payment' && method === 'POST' && id) {
      const p = PaymentSchema.safeParse(req.body);
      if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
      const [entry] = await sql`SELECT * FROM debtor_entries WHERE id=${id}::uuid`;
      if (!entry) return json(res, 404, { error: 'Entry not found' });
      const newPaid   = Math.min(coerce(entry.amount), coerce(entry.paid_amount) + p.data.amount);
      const newStatus = deriveStatus(coerce(entry.amount), newPaid);
      const [row] = await sql`
        UPDATE debtor_entries SET paid_amount=${newPaid}, status=${newStatus} WHERE id=${id}::uuid RETURNING *
      `;
      await logAuditEvent({ req, userId, action: 'debtor_entry.payment', tableName: 'debtor_entries', recordId: id, newData: row });
      return json(res, 200, coerceEntry({ ...row, accumulated_storage_fee: 0 }));
    }

    // ── CREDITORS ────────────────────────────────────────────────────────────
    if (resource === 'creditors') {
      if (method === 'GET') {
        const rows = await sql`
          SELECT c.*,
            COALESCE(SUM(e.amount - e.paid_amount) FILTER (WHERE e.status != 'paid'), 0) AS outstanding,
            COUNT(e.id) FILTER (WHERE e.status = 'unpaid' OR e.status = 'partial')::int AS open_entries
          FROM creditors c
          LEFT JOIN creditor_entries e ON e.creditor_id = c.id
          GROUP BY c.id ORDER BY c.name ASC
        `;
        return json(res, 200, rows.map(r => ({ ...r, outstanding: coerce(r.outstanding) })));
      }
      if (method === 'POST') {
        const p = CreditorSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO creditors (name, contact_name, phone, email, address, notes)
          VALUES (${d.name}, ${d.contact_name ?? null}, ${d.phone ?? null}, ${d.email ?? null}, ${d.address ?? null}, ${d.notes ?? null})
          RETURNING *
        `;
        await logAuditEvent({ req, userId, action: 'creditor.created', tableName: 'creditors', recordId: row.id, newData: row });
        return json(res, 201, row);
      }
      if (method === 'PUT' && id) {
        const p = CreditorSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          UPDATE creditors SET name=${d.name}, contact_name=${d.contact_name ?? null}, phone=${d.phone ?? null},
            email=${d.email ?? null}, address=${d.address ?? null}, notes=${d.notes ?? null}
          WHERE id=${id}::uuid RETURNING *
        `;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'creditor.updated', tableName: 'creditors', recordId: id, newData: row });
        return json(res, 200, row);
      }
      if (method === 'DELETE' && id) {
        const [row] = await sql`DELETE FROM creditors WHERE id=${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'creditor.deleted', tableName: 'creditors', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }
    }

    // ── CREDITOR ENTRIES ──────────────────────────────────────────────────────
    if (resource === 'creditor-entries') {
      if (method === 'GET') {
        const rows = creditorId
          ? await sql`SELECT * FROM creditor_entries WHERE creditor_id=${creditorId}::uuid ORDER BY created_at DESC`
          : await sql`
              SELECT e.*, c.name AS creditor_name
              FROM creditor_entries e JOIN creditors c ON c.id = e.creditor_id
              ORDER BY e.created_at DESC
            `;
        return json(res, 200, rows.map(r => ({ ...r, amount: coerce(r.amount), paid_amount: coerce(r.paid_amount) })));
      }
      if (method === 'POST' && creditorId) {
        const p = EntrySchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO creditor_entries (creditor_id, description, reference, amount, currency, due_date, notes)
          VALUES (${creditorId}::uuid, ${d.description}, ${d.reference ?? null}, ${d.amount}, ${d.currency}, ${d.due_date ?? null}, ${d.notes ?? null})
          RETURNING *
        `;
        await logAuditEvent({ req, userId, action: 'creditor_entry.created', tableName: 'creditor_entries', recordId: row.id, newData: row });
        return json(res, 201, { ...row, amount: coerce(row.amount), paid_amount: coerce(row.paid_amount) });
      }
      if (method === 'PUT' && id) {
        const p = EntrySchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          UPDATE creditor_entries SET description=${d.description}, reference=${d.reference ?? null},
            amount=${d.amount}, currency=${d.currency}, due_date=${d.due_date ?? null}, notes=${d.notes ?? null}
          WHERE id=${id}::uuid RETURNING *
        `;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'creditor_entry.updated', tableName: 'creditor_entries', recordId: id, newData: row });
        return json(res, 200, { ...row, amount: coerce(row.amount), paid_amount: coerce(row.paid_amount) });
      }
      if (method === 'DELETE' && id) {
        const [row] = await sql`DELETE FROM creditor_entries WHERE id=${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'creditor_entry.deleted', tableName: 'creditor_entries', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }
    }

    // ── CREDITOR PAYMENT ──────────────────────────────────────────────────────
    if (resource === 'creditor-payment' && method === 'POST' && id) {
      const p = PaymentSchema.safeParse(req.body);
      if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
      const [entry] = await sql`SELECT * FROM creditor_entries WHERE id=${id}::uuid`;
      if (!entry) return json(res, 404, { error: 'Entry not found' });
      const newPaid   = Math.min(coerce(entry.amount), coerce(entry.paid_amount) + p.data.amount);
      const newStatus = deriveStatus(coerce(entry.amount), newPaid);
      const [row] = await sql`
        UPDATE creditor_entries SET paid_amount=${newPaid}, status=${newStatus} WHERE id=${id}::uuid RETURNING *
      `;
      await logAuditEvent({ req, userId, action: 'creditor_entry.payment', tableName: 'creditor_entries', recordId: id, newData: row });
      return json(res, 200, { ...row, amount: coerce(row.amount), paid_amount: coerce(row.paid_amount) });
    }

    return json(res, 400, { error: 'Unknown resource' });
  } catch (err) {
    return apiError(res, 500, 'Internal server error', err);
  }
}
