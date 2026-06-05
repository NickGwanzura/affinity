/**
 * /api/ceo
 *
 * CEO Dashboard — daily income & expenses summary across all revenue streams.
 *
 * GET /api/ceo?resource=dashboard  → daily / monthly income & expenses
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
} from './_middleware.js';

const json = (res: ApiResponse, status: number, body: unknown) =>
  res.status(status).json(body);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  // CEO and higher (admin/super_admin) can access
  const isCeoOrAbove = authReq.user?.role === 'CEO' || authReq.user?.accessRole === 'super_admin' || authReq.user?.accessRole === 'admin';
  if (!isCeoOrAbove) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    return await handleDashboard(res);
  } catch (err) {
    console.error('[ceo]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

async function handleDashboard(res: ApiResponse) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  // ── Today's Income by Stream ──────────────────────────────────────────

  const [freezitToday] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS value FROM freezit_sales WHERE sale_date = ${today}
  `;
  const [wifiToday] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value FROM wifi_token_sales WHERE sale_date = ${today}
  `;
  const [iceToday] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value FROM ice_sales WHERE sale_date = ${today}
  `;
  const [lodgerToday] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM lodger_payments WHERE payment_date = ${today}
  `;
  const [directorReceivedToday] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM director_transactions WHERE type = 'Received' AND date = ${today}
  `;
  const [carHireToday] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS value FROM car_hire_bookings WHERE start_date = ${today} AND status != 'Cancelled'
  `;

  // ── Today's Expenses ──────────────────────────────────────────────────

  const [expensesToday] = await sql`
    SELECT COALESCE(SUM(amount * COALESCE(exchange_rate_to_usd, 1)), 0) AS value
    FROM expenses WHERE created_at::date = ${today} AND deleted_at IS NULL
  `;
  const [carHireExpensesToday] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM car_hire_expenses WHERE expense_date = ${today}
  `;
  const [directorDisbursedToday] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM director_transactions WHERE type = 'Disbursed' AND date = ${today}
  `;
  const [fundDisbursedToday] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM fund_disbursements WHERE disbursed_at = ${today}
  `;
  const [fundUsageToday] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM fund_usage_logs WHERE usage_date = ${today}
  `;

  // ── Monthly Income ────────────────────────────────────────────────────

  const [freezitMonth] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS value FROM freezit_sales WHERE sale_date >= ${monthStart}
  `;
  const [wifiMonth] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value FROM wifi_token_sales WHERE sale_date >= ${monthStart}
  `;
  const [iceMonth] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value FROM ice_sales WHERE sale_date >= ${monthStart}
  `;
  const [lodgerMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM lodger_payments WHERE payment_date >= ${monthStart}
  `;
  const [directorReceivedMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM director_transactions WHERE type = 'Received' AND date >= ${monthStart}
  `;
  const [carHireMonth] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS value FROM car_hire_bookings WHERE start_date >= ${monthStart} AND status != 'Cancelled'
  `;

  // ── Monthly Expenses ──────────────────────────────────────────────────

  const [expensesMonth] = await sql`
    SELECT COALESCE(SUM(amount * COALESCE(exchange_rate_to_usd, 1)), 0) AS value
    FROM expenses WHERE created_at::date >= ${monthStart} AND deleted_at IS NULL
  `;
  const [carHireExpensesMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM car_hire_expenses WHERE expense_date >= ${monthStart}
  `;
  const [directorDisbursedMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM director_transactions WHERE type = 'Disbursed' AND date >= ${monthStart}
  `;
  const [fundDisbursedMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM fund_disbursements WHERE disbursed_at >= ${monthStart}
  `;
  const [fundUsageMonth] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value FROM fund_usage_logs WHERE usage_date >= ${monthStart}
  `;

  const todayIncome =
    Number(freezitToday.value) + Number(wifiToday.value) + Number(iceToday.value) +
    Number(lodgerToday.value) + Number(directorReceivedToday.value) + Number(carHireToday.value);

  const todayExpenses =
    Number(expensesToday.value) + Number(carHireExpensesToday.value) + Number(directorDisbursedToday.value) +
    Number(fundDisbursedToday.value) + Number(fundUsageToday.value);

  const monthIncome =
    Number(freezitMonth.value) + Number(wifiMonth.value) + Number(iceMonth.value) +
    Number(lodgerMonth.value) + Number(directorReceivedMonth.value) + Number(carHireMonth.value);

  const monthExpenses =
    Number(expensesMonth.value) + Number(carHireExpensesMonth.value) + Number(directorDisbursedMonth.value) +
    Number(fundDisbursedMonth.value) + Number(fundUsageMonth.value);

  return res.status(200).json({
    today: {
      date: today,
      income: todayIncome,
      expenses: todayExpenses,
      net: todayIncome - todayExpenses,
      income_breakdown: {
        freezit:      Number(freezitToday.value),
        wifi:         Number(wifiToday.value),
        ice:          Number(iceToday.value),
        lodgers:      Number(lodgerToday.value),
        director:     Number(directorReceivedToday.value),
        car_hire:     Number(carHireToday.value),
      },
      expense_breakdown: {
        expenses:      Number(expensesToday.value),
        car_hire:      Number(carHireExpensesToday.value),
        director:      Number(directorDisbursedToday.value),
        disbursements: Number(fundDisbursedToday.value),
        fund_usage:    Number(fundUsageToday.value),
      },
    },
    this_month: {
      income:     monthIncome,
      expenses:   monthExpenses,
      net:        monthIncome - monthExpenses,
      income_breakdown: {
        freezit:      Number(freezitMonth.value),
        wifi:         Number(wifiMonth.value),
        ice:          Number(iceMonth.value),
        lodgers:      Number(lodgerMonth.value),
        director:     Number(directorReceivedMonth.value),
        car_hire:     Number(carHireMonth.value),
      },
      expense_breakdown: {
        expenses:      Number(expensesMonth.value),
        car_hire:      Number(carHireExpensesMonth.value),
        director:      Number(directorDisbursedMonth.value),
        disbursements: Number(fundDisbursedMonth.value),
        fund_usage:    Number(fundUsageMonth.value),
      },
    },
  });
}
