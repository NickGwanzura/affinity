/**
 * /api/period-report
 *
 * GET ?period=daily|weekly|monthly[&date=YYYY-MM-DD]
 *   Returns aggregated income + expense data for the given period.
 *   Used by the client-side PDF generator.
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import {
  AuthenticatedRequest,
  verifyToken,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';

const json = (res: ApiResponse, status: number, body: unknown) =>
  res.status(status).json(body);

function dateRange(period: string, anchor: string): { from: string; to: string; label: string } {
  const base = anchor ? new Date(anchor) : new Date();
  base.setHours(12, 0, 0, 0); // avoid TZ edge cases

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (period === 'daily') {
    const d = fmt(base);
    return { from: d, to: d, label: `Daily · ${d}` };
  }

  if (period === 'weekly') {
    const day = base.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day); // back to Monday
    const mon = new Date(base);
    mon.setDate(base.getDate() + diff);
    return { from: fmt(mon), to: fmt(base), label: `Weekly · ${fmt(mon)} – ${fmt(base)}` };
  }

  // monthly
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  return {
    from: fmt(from),
    to:   fmt(base),
    label: `Monthly · ${from.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const period = typeof req.query.period === 'string' ? req.query.period : 'daily';
  const anchor = typeof req.query.date   === 'string' ? req.query.date   : '';

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return json(res, 400, { error: 'period must be daily, weekly, or monthly' });
  }

  const { from, to, label } = dateRange(period, anchor);

  try {
    // ── Income ────────────────────────────────────────────────────────────────
    const [freezit] = await sql`
      SELECT COALESCE(SUM(total_sales_value),0) AS total, COUNT(*)::int AS entries
      FROM freezit_sales WHERE sale_date BETWEEN ${from} AND ${to}
    `;
    const freezitRows = await sql`
      SELECT sale_date, qty_sold, unit_selling_price, total_sales_value, payment_method, notes
      FROM freezit_sales WHERE sale_date BETWEEN ${from} AND ${to}
      ORDER BY sale_date DESC
    `;

    const [ice] = await sql`
      SELECT COALESCE(SUM(total_sales),0) AS total, COUNT(*)::int AS entries
      FROM ice_sales WHERE sale_date BETWEEN ${from} AND ${to}
    `;
    const iceRows = await sql`
      SELECT sale_date, quantity_sold, unit_price, total_sales, payment_method, customer_name, notes
      FROM ice_sales WHERE sale_date BETWEEN ${from} AND ${to}
      ORDER BY sale_date DESC
    `;

    const [wifi] = await sql`
      SELECT COALESCE(SUM(total_sales),0) AS total, COUNT(*)::int AS entries
      FROM wifi_token_sales WHERE sale_date BETWEEN ${from} AND ${to}
    `;
    const wifiRows = await sql`
      SELECT sale_date, tokens_sold, package_type, selling_price, total_sales, payment_method, notes
      FROM wifi_token_sales WHERE sale_date BETWEEN ${from} AND ${to}
      ORDER BY sale_date DESC
    `;

    const [carHire] = await sql`
      SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*)::int AS entries
      FROM car_hire_bookings WHERE created_at::date BETWEEN ${from} AND ${to}
    `;
    const carHireRows = await sql`
      SELECT start_date, end_date, hirer_name, daily_rate, total_amount, amount_paid, currency, status, created_at
      FROM car_hire_bookings WHERE created_at::date BETWEEN ${from} AND ${to}
      ORDER BY created_at DESC
    `;

    const [lodgers] = await sql`
      SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS entries
      FROM lodger_payments WHERE payment_date BETWEEN ${from} AND ${to}
    `;
    const lodgerRows = await sql`
      SELECT lp.payment_date, lp.amount, lp.currency, lp.payment_method, lp.month_covered,
             l.full_name AS lodger_name, l.room_number
      FROM lodger_payments lp
      JOIN lodgers l ON l.id = lp.lodger_id
      WHERE lp.payment_date BETWEEN ${from} AND ${to}
      ORDER BY lp.payment_date DESC
    `;

    // ── Expenses ──────────────────────────────────────────────────────────────
    const [expenses] = await sql`
      SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS entries
      FROM fund_usage_logs WHERE usage_date BETWEEN ${from} AND ${to}
    `;
    const expenseRows = await sql`
      SELECT ul.usage_date, ul.amount, ul.currency, ul.description, ul.category, ul.source,
             up.name AS staff_name, up.role AS staff_role
      FROM fund_usage_logs ul
      JOIN user_profiles up ON up.id = ul.user_id
      WHERE ul.usage_date BETWEEN ${from} AND ${to}
      ORDER BY ul.usage_date DESC, ul.created_at DESC
    `;

    const coerce = (v: unknown) => Number(v) || 0;

    const incomeSources = [
      { source: 'Freezit Sales',    total: coerce(freezit.total),  entries: freezit.entries  },
      { source: 'Ice Sales',        total: coerce(ice.total),      entries: ice.entries      },
      { source: 'WiFi Tokens',      total: coerce(wifi.total),     entries: wifi.entries     },
      { source: 'Car Hire (booked)', total: coerce(carHire.total),  entries: carHire.entries  },
      { source: 'Lodger Payments',  total: coerce(lodgers.total),  entries: lodgers.entries  },
    ];

    const totalIncome   = incomeSources.reduce((s, r) => s + r.total, 0);
    const totalExpenses = coerce(expenses.total);

    return json(res, 200, {
      period,
      from,
      to,
      label,
      summary: {
        total_income:   totalIncome,
        total_expenses: totalExpenses,
        net:            totalIncome - totalExpenses,
      },
      income_sources: incomeSources,
      income_rows: {
        freezit:   freezitRows.map(r => ({ ...r, total_sales_value: coerce(r.total_sales_value) })),
        ice:       iceRows.map(r => ({ ...r, total_sales: coerce(r.total_sales) })),
        wifi:      wifiRows.map(r => ({ ...r, total_sales: coerce(r.total_sales) })),
        car_hire:  carHireRows.map(r => ({ ...r, amount_paid: coerce(r.amount_paid), total_amount: coerce(r.total_amount) })),
        lodgers:   lodgerRows.map(r => ({ ...r, amount: coerce(r.amount) })),
      },
      expense_rows: expenseRows.map(r => ({ ...r, amount: coerce(r.amount) })),
    });
  } catch (err) {
    return apiError(res, 500, 'Failed to generate report data', err);
  }
}
