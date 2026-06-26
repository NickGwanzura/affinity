/**
 * /api/exchange-rates
 *
 * GET  /api/exchange-rates          — list all rates
 * PUT  /api/exchange-rates?id=GBP&rate=1.30 — update a single rate (admin+)
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
  json,
} from './_middleware.js';
import { sql } from './_db.js';
import { logAuditEvent } from './_audit.js';

/** In-memory cache: populated once on first use, refreshed on write. */
let cachedRates: { currency: string; rate_to_usd: number }[] | null = null;

export async function getAllExchangeRates(): Promise<{ currency: string; rate_to_usd: number }[]> {
  if (cachedRates) return cachedRates;
  const rows = await sql`SELECT currency, rate_to_usd FROM exchange_rates ORDER BY currency`;
  cachedRates = rows.map((r: { currency: string; rate_to_usd: number }) => ({
    currency: r.currency,
    rate_to_usd: Number(r.rate_to_usd),
  }));
  return cachedRates;
}

export async function getExchangeRate(currency: string): Promise<number> {
  const rates = await getAllExchangeRates();
  const found = rates.find((r) => r.currency === currency);
  return found?.rate_to_usd ?? 1;
}

function invalidateCache() {
  cachedRates = null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listRates(res);
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await updateRate(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listRates(res: ApiResponse) {
  const rates = await getAllExchangeRates();
  return json(res, 200, rates);
}

async function updateRate(req: AuthenticatedRequest, res: ApiResponse) {
  const currency = typeof req.query.id === 'string' ? req.query.id.toUpperCase() : '';
  const rawRate = typeof req.query.rate === 'string' ? parseFloat(req.query.rate) : NaN;

  if (!currency || !['USD', 'GBP', 'NAD', 'BWP', 'ZAR'].includes(currency)) {
    return json(res, 400, { error: 'Invalid or missing currency (id param). Valid: USD, GBP, NAD, BWP, ZAR' });
  }
  if (!Number.isFinite(rawRate) || rawRate <= 0) {
    return json(res, 400, { error: 'Invalid or missing rate (rate param). Must be a positive number.' });
  }

  await sql`
    INSERT INTO exchange_rates (currency, rate_to_usd, updated_at)
    VALUES (${currency}, ${rawRate}, NOW())
    ON CONFLICT (currency) DO UPDATE SET rate_to_usd = ${rawRate}, updated_at = NOW()
  `;

  invalidateCache();

  await logAuditEvent({
    userId: req.user!.id,
    action: 'UPDATE_EXCHANGE_RATE',
    tableName: 'exchange_rates',
    recordId: currency,
    newData: { currency, rate_to_usd: rawRate },
  });

  return json(res, 200, { currency, rate_to_usd: rawRate, message: 'Rate updated' });
}
