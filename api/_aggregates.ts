/**
 * Shared aggregate queries — revenue & expense totals by date range.
 *
 * All functions accept a `from` and `to` date string (YYYY-MM-DD)
 * and return the aggregated numeric value (or 0).
 */

import { sql } from './_db.js';

const coerce = (v: unknown): number => Number(v) || 0;

/** Total freezit sales value for the date range (inclusive). */
export async function getFreezitRevenue(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS value
    FROM freezit_sales WHERE sale_date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}

/** Total ice sales for the date range (inclusive). */
export async function getIceRevenue(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM ice_sales WHERE sale_date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}

/** Total wifi token sales for the date range (inclusive). */
export async function getWifiRevenue(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM wifi_token_sales WHERE sale_date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}

/** Total lodger payments for the date range (inclusive). */
export async function getLodgerRevenue(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM lodger_payments WHERE payment_date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}

/** Total car hire bookings revenue for the date range (inclusive, excludes cancelled). */
export async function getCarHireRevenue(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS value
    FROM car_hire_bookings WHERE created_at::date BETWEEN ${from} AND ${to} AND status != 'Cancelled'
  `;
  return coerce(row.value);
}

/** Total director transactions of a given type for the date range (inclusive). */
export async function getDirectorTransactions(type: 'Received' | 'Disbursed', from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM director_transactions WHERE type = ${type} AND date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}

/** Total expenses (from expenses table, with exchange rate conversion) for the date range (inclusive). */
export async function getExpenses(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(amount * COALESCE(exchange_rate_to_usd, 1)), 0) AS value
    FROM expenses WHERE created_at::date BETWEEN ${from} AND ${to} AND deleted_at IS NULL
  `;
  return coerce(row.value);
}

/** Total fund usage (staff spend) for the date range (inclusive). */
export async function getFundUsage(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM fund_usage_logs WHERE usage_date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}

/** Total car hire expenses for the date range (inclusive). */
export async function getCarHireExpenses(from: string, to: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM car_hire_expenses WHERE expense_date BETWEEN ${from} AND ${to}
  `;
  return coerce(row.value);
}
