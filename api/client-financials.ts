/**
 * /api/client-financials
 *
 * GET  /api/client-financials?resource=balance&clientId=xxx        — single client balance
 * GET  /api/client-financials?resource=ledger&clientId=xxx         — client ledger
 * GET  /api/client-financials?resource=all-balances                — all client balances
 * POST /api/client-financials?resource=recalculate&clientId=xxx    — force recalculate
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requireBusinessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';

// Types for client balance
interface ClientBalance {
  client_id: string;
  client_name: string;
  current_balance: number;
  total_invoiced: number;
  total_paid: number;
  opening_balance: number;
  currency: 'USD' | 'GBP';
  credit_balance: number;
  is_active: boolean;
}

// Types for ledger entries
interface LedgerEntry {
  entry_date: string;
  entry_type: 'opening_balance' | 'invoice' | 'payment' | 'adjustment';
  reference: string;
  document_id?: string;
  debit: number;
  credit: number;
  currency: 'USD' | 'GBP';
  running_balance: number;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Accountant'])) return;

  try {
    const { resource } = req.query;

    switch (req.method) {
      case 'GET':
        if (resource === 'balance') {
          return await getClientBalance(authReq, res);
        }
        if (resource === 'ledger') {
          return await getClientLedger(authReq, res);
        }
        if (resource === 'all-balances') {
          return await getAllClientBalances(authReq, res);
        }
        return apiError(res, 400, 'Invalid resource. Use: balance, ledger, or all-balances');

      case 'POST':
        if (resource === 'recalculate') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
          return await recalculateClientBalance(authReq, res);
        }
        return apiError(res, 400, 'Invalid resource. Use: recalculate');

      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    console.error('[ClientFinancials] Error:', error);
    return apiError(res, 500, 'Internal server error', error);
  }
}

/**
 * GET /api/client-financials?action=balance&clientId=xxx
 * Returns the unified balance for a single client
 */
async function getClientBalance(req: AuthenticatedRequest, res: ApiResponse) {
  const { clientId } = req.query;

  if (!clientId || typeof clientId !== 'string') {
    return apiError(res, 400, 'Missing or invalid clientId parameter');
  }

  try {
    // Use the database function for single source of truth
    const result = await sql`
      SELECT * FROM public.get_client_balance_v2(${clientId}::uuid)
    `;

    if (result.length === 0) {
      return apiError(res, 404, 'Client not found');
    }

    const balance = result[0];
    
    // Also fetch client details
    const clientResult = await sql`
      SELECT id, name, email, company, phone, address, opening_balance, opening_balance_currency, is_active
      FROM public.clients
      WHERE id = ${clientId}::uuid
    `;

    if (clientResult.length === 0) {
      return apiError(res, 404, 'Client not found');
    }

    const client = clientResult[0];

    return res.status(200).json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        company: client.company,
        phone: client.phone,
        address: client.address,
        is_active: client.is_active,
      },
      balance: {
        current_balance: Number(balance.current_balance) || 0,
        total_invoiced: Number(balance.total_invoiced) || 0,
        total_paid: Number(balance.total_paid) || 0,
        opening_balance: Number(balance.opening_balance) || 0,
        currency: balance.currency || 'USD',
        credit_balance: Number(balance.credit_balance) || 0,
      },
      formula_applied: 'opening_balance + total_invoiced - total_paid',
    });
  } catch (error) {
    console.error('[ClientFinancials] getClientBalance error:', error);
    return apiError(res, 500, 'Failed to retrieve client balance', error);
  }
}

/**
 * GET /api/client-financials?action=ledger&clientId=xxx&from=yyyy-mm-dd&to=yyyy-mm-dd
 * Returns the ledger entries for a client with running balance
 */
async function getClientLedger(req: AuthenticatedRequest, res: ApiResponse) {
  const { clientId, from, to } = req.query;

  if (!clientId || typeof clientId !== 'string') {
    return apiError(res, 400, 'Missing or invalid clientId parameter');
  }

  try {
    // Use the database function to get ledger with running balance
    const ledgerResult = await sql`
      SELECT * FROM public.get_client_ledger(${clientId}::uuid)
    `;

    // Filter by date range if provided
    let filteredLedger = ledgerResult;
    if (from && typeof from === 'string') {
      const fromDate = new Date(from);
      filteredLedger = filteredLedger.filter(
        (entry: any) => new Date(entry.entry_date) >= fromDate
      );
    }
    if (to && typeof to === 'string') {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filteredLedger = filteredLedger.filter(
        (entry: any) => new Date(entry.entry_date) <= toDate
      );
    }

    // Get client info
    const clientResult = await sql`
      SELECT id, name, email, company, opening_balance, opening_balance_currency
      FROM public.clients
      WHERE id = ${clientId}::uuid
    `;

    if (clientResult.length === 0) {
      return apiError(res, 404, 'Client not found');
    }

    const client = clientResult[0];

    // Calculate totals
    const totals = filteredLedger.reduce(
      (acc: any, entry: any) => ({
        total_debits: acc.total_debits + Number(entry.debit),
        total_credits: acc.total_credits + Number(entry.credit),
      }),
      { total_debits: 0, total_credits: 0 }
    );

    // Get final balance from the last entry's running balance
    const finalBalance =
      filteredLedger.length > 0
        ? Number(filteredLedger[filteredLedger.length - 1].running_balance)
        : client.opening_balance || 0;

    return res.status(200).json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        company: client.company,
        currency: client.opening_balance_currency || 'USD',
      },
      date_range: {
        from: from || null,
        to: to || null,
      },
      entries: filteredLedger.map((entry: any) => ({
        date: entry.entry_date,
        type: entry.entry_type,
        reference: entry.reference,
        document_id: entry.document_id,
        debit: Number(entry.debit),
        credit: Number(entry.credit),
        currency: entry.currency || client.opening_balance_currency || 'USD',
        balance: Number(entry.running_balance),
      })),
      summary: {
        total_debits: totals.total_debits,
        total_credits: totals.total_credits,
        opening_balance: client.opening_balance || 0,
        closing_balance: finalBalance,
      },
    });
  } catch (error) {
    console.error('[ClientFinancials] getClientLedger error:', error);
    return apiError(res, 500, 'Failed to retrieve client ledger', error);
  }
}

/**
 * GET /api/client-financials?action=all-balances&minBalance=xxx
 * Returns balances for all clients, optionally filtered
 */
async function getAllClientBalances(req: AuthenticatedRequest, res: ApiResponse) {
  const { minBalance, hasOutstanding, search } = req.query;

  try {
    // Per-currency aggregates: USD and GBP are rolled up independently so
    // a GBP opening balance is never silently summed into a "USD" total.
    // Matching prefers client_id; legacy rows without client_id fall back
    // to case-insensitive name match on client_name.
    let query = sql`
      SELECT
        c.id,
        c.name,
        c.email,
        c.company,
        c.opening_balance,
        c.opening_balance_currency as currency,
        COALESCE(inv.total_invoiced_usd, 0) as total_invoiced_usd,
        COALESCE(inv.total_invoiced_gbp, 0) as total_invoiced_gbp,
        COALESCE(pay.total_paid_usd, 0) as total_paid_usd,
        COALESCE(pay.total_paid_gbp, 0) as total_paid_gbp,
        CASE WHEN c.opening_balance_currency = 'USD' THEN COALESCE(c.opening_balance, 0) ELSE 0 END
          + COALESCE(inv.total_invoiced_usd, 0)
          - COALESCE(pay.total_paid_usd, 0) as usd_balance,
        CASE WHEN c.opening_balance_currency = 'GBP' THEN COALESCE(c.opening_balance, 0) ELSE 0 END
          + COALESCE(inv.total_invoiced_gbp, 0)
          - COALESCE(pay.total_paid_gbp, 0) as gbp_balance,
        COALESCE(c.opening_balance, 0)
          + COALESCE(inv.total_invoiced_usd, 0) + COALESCE(inv.total_invoiced_gbp, 0)
          - COALESCE(pay.total_paid_usd, 0) - COALESCE(pay.total_paid_gbp, 0) as balance_due,
        CASE
          WHEN COALESCE(c.opening_balance, 0)
            + COALESCE(inv.total_invoiced_usd, 0) + COALESCE(inv.total_invoiced_gbp, 0)
            - COALESCE(pay.total_paid_usd, 0) - COALESCE(pay.total_paid_gbp, 0) < 0
          THEN ABS(COALESCE(c.opening_balance, 0)
            + COALESCE(inv.total_invoiced_usd, 0) + COALESCE(inv.total_invoiced_gbp, 0)
            - COALESCE(pay.total_paid_usd, 0) - COALESCE(pay.total_paid_gbp, 0))
          ELSE 0
        END as credit_balance,
        c.is_active,
        c.created_at
      FROM public.clients c
      LEFT JOIN (
        SELECT
          COALESCE(i.client_id, legacy.id) as resolved_client_id,
          SUM(CASE WHEN COALESCE(i.currency, 'USD') = 'GBP' THEN 0 ELSE i.amount_usd END) as total_invoiced_usd,
          SUM(CASE WHEN COALESCE(i.currency, 'USD') = 'GBP' THEN i.amount_usd ELSE 0 END) as total_invoiced_gbp
        FROM public.invoices i
        LEFT JOIN public.clients legacy
          ON i.client_id IS NULL
          AND LOWER(TRIM(legacy.name)) = LOWER(TRIM(i.client_name))
        WHERE i.status != 'Cancelled'
          AND COALESCE(i.client_id, legacy.id) IS NOT NULL
        GROUP BY COALESCE(i.client_id, legacy.id)
      ) inv ON c.id = inv.resolved_client_id
      LEFT JOIN (
        SELECT
          COALESCE(p.client_id, legacy.id) as resolved_client_id,
          SUM(CASE WHEN COALESCE(p.currency, 'USD') = 'GBP' THEN 0 ELSE p.amount_usd END) as total_paid_usd,
          SUM(CASE WHEN COALESCE(p.currency, 'USD') = 'GBP' THEN p.amount_usd ELSE 0 END) as total_paid_gbp
        FROM public.payments p
        LEFT JOIN public.clients legacy
          ON p.client_id IS NULL
          AND LOWER(TRIM(legacy.name)) = LOWER(TRIM(p.client_name))
        WHERE p.type = 'Inbound'
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND COALESCE(p.client_id, legacy.id) IS NOT NULL
        GROUP BY COALESCE(p.client_id, legacy.id)
      ) pay ON c.id = pay.resolved_client_id
      WHERE c.is_active = true
        AND c.deleted_at IS NULL
    `;

    // Add filters
    if (hasOutstanding === 'true') {
      query = sql`${query} AND (COALESCE(c.opening_balance, 0)
        + COALESCE(inv.total_invoiced_usd, 0) + COALESCE(inv.total_invoiced_gbp, 0)
        - COALESCE(pay.total_paid_usd, 0) - COALESCE(pay.total_paid_gbp, 0)) > 0`;
    }

    if (minBalance && typeof minBalance === 'string') {
      const minBal = parseFloat(minBalance);
      if (!isNaN(minBal)) {
        query = sql`${query} AND (COALESCE(c.opening_balance, 0)
          + COALESCE(inv.total_invoiced_usd, 0) + COALESCE(inv.total_invoiced_gbp, 0)
          - COALESCE(pay.total_paid_usd, 0) - COALESCE(pay.total_paid_gbp, 0)) >= ${minBal}`;
      }
    }

    if (search && typeof search === 'string') {
      const searchTerm = `%${search.toLowerCase()}%`;
      query = sql`${query} AND (
        LOWER(c.name) LIKE ${searchTerm} OR
        LOWER(COALESCE(c.email, '')) LIKE ${searchTerm} OR
        LOWER(COALESCE(c.company, '')) LIKE ${searchTerm}
      )`;
    }

    query = sql`${query} ORDER BY balance_due DESC, c.name ASC`;

    const results = await query;

    return res.status(200).json({
      count: results.length,
      clients: results.map((row: any) => {
        const totalInvoiced =
          (Number(row.total_invoiced_usd) || 0) + (Number(row.total_invoiced_gbp) || 0);
        const totalPaid =
          (Number(row.total_paid_usd) || 0) + (Number(row.total_paid_gbp) || 0);
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          company: row.company,
          balance: {
            opening_balance: Number(row.opening_balance) || 0,
            total_invoiced: totalInvoiced,
            total_paid: totalPaid,
            current_balance: Number(row.balance_due) || 0,
            credit_balance: Number(row.credit_balance) || 0,
            currency: row.currency || 'USD',
            usd_balance: Number(row.usd_balance) || 0,
            gbp_balance: Number(row.gbp_balance) || 0,
          },
          is_active: row.is_active,
          created_at: row.created_at,
        };
      }),
    });
  } catch (error) {
    console.error('[ClientFinancials] getAllClientBalances error:', error);
    return apiError(res, 500, 'Failed to retrieve client balances', error);
  }
}

/**
 * POST /api/client-financials?action=recalculate&clientId=xxx
 * Force recalculation of client balance (admin only)
 */
async function recalculateClientBalance(req: AuthenticatedRequest, res: ApiResponse) {
  const { clientId } = req.query;

  if (!clientId || typeof clientId !== 'string') {
    return apiError(res, 400, 'Missing or invalid clientId parameter');
  }

  try {
    // Get fresh calculation
    const result = await sql`
      SELECT * FROM public.get_client_balance_v2(${clientId}::uuid)
    `;

    if (result.length === 0) {
      return apiError(res, 404, 'Client not found');
    }

    const balance = result[0];

    // Log the recalculation
    await sql`
      INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data, created_at)
      VALUES (
        ${req.user?.id || null}::uuid,
        'client:balance_recalculate',
        'clients',
        ${clientId},
        ${JSON.stringify({
          current_balance: balance.current_balance,
          total_invoiced: balance.total_invoiced,
          total_paid: balance.total_paid,
          opening_balance: balance.opening_balance,
        })},
        NOW()
      )
    `;

    return res.status(200).json({
      message: 'Balance recalculated successfully',
      client_id: clientId,
      balance: {
        current_balance: Number(balance.current_balance) || 0,
        total_invoiced: Number(balance.total_invoiced) || 0,
        total_paid: Number(balance.total_paid) || 0,
        opening_balance: Number(balance.opening_balance) || 0,
        currency: balance.currency || 'USD',
        credit_balance: Number(balance.credit_balance) || 0,
      },
      formula_applied: 'opening_balance + total_invoiced - total_paid',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ClientFinancials] recalculateClientBalance error:', error);
    return apiError(res, 500, 'Failed to recalculate client balance', error);
  }
}
