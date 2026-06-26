/**
 * /api/ceo
 *
 * CEO Dashboard — monthly sales breakdown by revenue stream.
 *
 * GET /api/ceo?resource=dashboard
 *   Returns aggregated figures for the current month across:
 *   - wifi_tokens, lodgers, freezits (income)
 *   - expenses, disbursements (outgoings)
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
  json,
} from './_middleware.js';
import { currentMonthRange } from './_date-utils.js';
import {
  getFreezitRevenue,
  getWifiRevenue,
  getLodgerRevenue,
  getExpenses,
  getFundUsage,
  getDirectorTransactions,
} from './_aggregates.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  // CEO and higher (admin/super_admin) can access
  const isCeoOrAbove = authReq.user?.role === 'CEO' || authReq.user?.accessRole === 'super_admin' || authReq.user?.accessRole === 'admin';
  if (!isCeoOrAbove) {
    return json(res, 403, { error: 'Access denied' });
  }

  try {
    return await handleDashboard(res);
  } catch (err) {
    console.error('[ceo]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

async function handleDashboard(res: ApiResponse) {
  const { from, to } = currentMonthRange();
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const [freezit, wifi, lodgers, expenses, fundUsage, disbursements] = await Promise.all([
    getFreezitRevenue(from, to),
    getWifiRevenue(from, to),
    getLodgerRevenue(from, to),
    getExpenses(from, to),
    getFundUsage(from, to),
    getDirectorTransactions('Disbursed', from, to),
  ]);

  const totalExpenses  = expenses + fundUsage;
  const totalIncome    = freezit + wifi + lodgers;
  const totalOutgoings = totalExpenses + disbursements;

  return json(res, 200, {
    month,
    from,
    to,
    wifi_tokens:    wifi,
    lodgers,
    freezits:       freezit,
    expenses:       totalExpenses,
    disbursements,
    total_income:   totalIncome,
    total_outgoings: totalOutgoings,
    net:            totalIncome - totalOutgoings,
  });
}
