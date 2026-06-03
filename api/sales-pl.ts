/**
 * /api/sales-pl
 *
 * Profit & Loss view for Sales role.
 * Aggregates revenue from Freezit, WiFi Token, and Ice sales
 * along with associated costs for a consolidated P&L.
 *
 * GET /api/sales-pl?period=today|week|month
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

const json = (res: ApiResponse, status: number, body: unknown) =>
  res.status(status).json(body);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Sales', 'Director'])) return;

  try {
    return await handlePL(res);
  } catch (err) {
    console.error('[sales-pl]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

async function handlePL(res: ApiResponse) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // ── Freezit ──────────────────────────────────────────────────────────────

  const [fzToday] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS rev,
           COALESCE(SUM(s.qty_sold * st.unit_cost), 0) AS cogs
    FROM freezit_sales s LEFT JOIN freezit_stock st ON st.id = s.stock_id WHERE s.sale_date = ${today}
  `;
  const [fzWeek] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS rev,
           COALESCE(SUM(s.qty_sold * st.unit_cost), 0) AS cogs
    FROM freezit_sales s LEFT JOIN freezit_stock st ON st.id = s.stock_id WHERE s.sale_date >= ${weekStartStr}
  `;
  const [fzMonth] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS rev,
           COALESCE(SUM(s.qty_sold * st.unit_cost), 0) AS cogs
    FROM freezit_sales s LEFT JOIN freezit_stock st ON st.id = s.stock_id WHERE s.sale_date >= ${monthStart}
  `;

  // ── WiFi ─────────────────────────────────────────────────────────────────

  const [wifiToday] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS rev FROM wifi_token_sales WHERE sale_date = ${today}
  `;
  const [wifiWeek] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS rev FROM wifi_token_sales WHERE sale_date >= ${weekStartStr}
  `;
  const [wifiMonth] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS rev FROM wifi_token_sales WHERE sale_date >= ${monthStart}
  `;

  const [wifiCost] = await sql`
    SELECT COALESCE(SUM(amount_usd), 0) AS cost FROM wifi_monthly_costs WHERE year = EXTRACT(YEAR FROM NOW()) AND month = EXTRACT(MONTH FROM NOW())
  `;

  // ── Ice ──────────────────────────────────────────────────────────────────

  const [iceToday] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS rev FROM ice_sales WHERE sale_date = ${today}
  `;
  const [iceWeek] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS rev FROM ice_sales WHERE sale_date >= ${weekStartStr}
  `;
  const [iceMonth] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS rev FROM ice_sales WHERE sale_date >= ${monthStart}
  `;

  // ── Lodgers ──────────────────────────────────────────────────────────────

  const [lodgerMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS rev FROM lodger_payments WHERE payment_date >= ${monthStart}
  `;

  // ── Assemble ─────────────────────────────────────────────────────────────

  const todayRev = Number(fzToday.rev) + Number(wifiToday.rev) + Number(iceToday.rev);
  const weekRev  = Number(fzWeek.rev)  + Number(wifiWeek.rev)  + Number(iceWeek.rev);
  const monthRev = Number(fzMonth.rev) + Number(wifiMonth.rev) + Number(iceMonth.rev) + Number(lodgerMonth.rev);
  const monthCogs = Number(fzMonth.cogs);
  const monthCost = Number(wifiCost.cost);
  const monthGrossProfit = monthRev - monthCogs - monthCost;

  return res.status(200).json({
    periods: {
      today: {
        revenue: todayRev,
        breakdown: {
          freezit: Number(fzToday.rev),
          wifi: Number(wifiToday.rev),
          ice: Number(iceToday.rev),
        },
      },
      this_week: {
        revenue: weekRev,
        breakdown: {
          freezit: Number(fzWeek.rev),
          wifi: Number(wifiWeek.rev),
          ice: Number(iceWeek.rev),
        },
      },
      this_month: {
        revenue:        monthRev,
        cogs:           monthCogs,
        wifi_cost:      monthCost,
        gross_profit:   monthGrossProfit,
        gross_margin_pct: monthRev > 0 ? Math.round((monthGrossProfit / monthRev) * 100 * 10) / 10 : 0,
        breakdown: {
          freezit:  Number(fzMonth.rev),
          wifi:     Number(wifiMonth.rev),
          ice:      Number(iceMonth.rev),
          lodgers:  Number(lodgerMonth.rev),
        },
      },
    },
  });
}
