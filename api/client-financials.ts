import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  getTenantId,
  handleCors,
  requireRole,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    const tenantId = getTenantId(req);
    const { action } = req.query;

    switch (req.method) {
      case 'GET':
        if (action === 'balance') {
          return await getClientBalance(authReq, res, tenantId);
        }
        if (action === 'ledger') {
          return await getClientLedger(authReq, res, tenantId);
        }
        if (action === 'all-balances') {
          return await getAllClientBalances(authReq, res, tenantId);
        }
        return apiError(res, 400, 'Invalid action. Use: balance, ledger, or all-balances');

      case 'POST':
        if (action === 'recalculate') {
          if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
          return await recalculateClientBalance(authReq, res, tenantId);
        }
        return apiError(res, 400, 'Invalid action. Use: recalculate');

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
async function getClientBalance(req: AuthenticatedRequest, res: VercelResponse, _tenantId: string) {
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
async function getClientLedger(req: AuthenticatedRequest, res: VercelResponse, _tenantId: string) {
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
async function getAllClientBalances(req: AuthenticatedRequest, res: VercelResponse, tenantId: string) {
  const { minBalance, hasOutstanding, search } = req.query;

  try {
    let query = sql`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.company,
        c.opening_balance,
        c.opening_balance_currency as currency,
        COALESCE(inv.total_invoiced, 0) as total_invoiced,
        COALESCE(pay.total_paid, 0) as total_paid,
        c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0) as balance_due,
        CASE 
          WHEN c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0) < 0 
          THEN ABS(c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0))
          ELSE 0 
        END as credit_balance,
        c.is_active,
        c.created_at
      FROM public.clients c
      -- Name-based fallback removed — use data migration to populate client_id on legacy records
      LEFT JOIN (
        SELECT
          client_id,
          SUM(amount_usd) as total_invoiced
        FROM public.invoices
        WHERE status != 'Cancelled'
          AND client_id IS NOT NULL
          AND tenant_id = ${tenantId}::uuid
        GROUP BY client_id
      ) inv ON c.id = inv.client_id
      LEFT JOIN (
        SELECT
          client_id,
          SUM(amount_usd) as total_paid
        FROM public.payments
        WHERE type = 'Inbound'
          AND client_id IS NOT NULL
          AND (is_deleted = false OR is_deleted IS NULL)
          AND tenant_id = ${tenantId}::uuid
        GROUP BY client_id
      ) pay ON c.id = pay.client_id
      WHERE c.is_active = true
        AND c.deleted_at IS NULL
    `;

    // Add filters
    if (hasOutstanding === 'true') {
      query = sql`${query} AND (c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0)) > 0`;
    }

    if (minBalance && typeof minBalance === 'string') {
      const minBal = parseFloat(minBalance);
      if (!isNaN(minBal)) {
        query = sql`${query} AND (c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0)) >= ${minBal}`;
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
      clients: results.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        company: row.company,
        balance: {
          opening_balance: Number(row.opening_balance) || 0,
          total_invoiced: Number(row.total_invoiced) || 0,
          total_paid: Number(row.total_paid) || 0,
          current_balance: Number(row.balance_due) || 0,
          credit_balance: Number(row.credit_balance) || 0,
          currency: row.currency || 'USD',
        },
        is_active: row.is_active,
        created_at: row.created_at,
      })),
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
async function recalculateClientBalance(req: AuthenticatedRequest, res: VercelResponse, _tenantId: string) {
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
