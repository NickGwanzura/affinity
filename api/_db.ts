/**
 * Server-Side Database Service
 *
 * This module ONLY runs server-side in API routes.
 * Database credentials are never exposed to the browser.
 */

import { neon, neonConfig, NeonQueryFunction, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { logger } from './_logger.js';
import { captureException } from './_sentry.js';

// Required for Node.js environments (Railway, local server).
// Neon's serverless driver uses WebSockets for Pool connections;
// in Node.js there is no built-in WebSocket so we supply the ws package.
neonConfig.webSocketConstructor = ws;

let sqlInstance: NeonQueryFunction<false, false> | null = null;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('NEON_DATABASE_URL environment variable is required');
  }
  return url;
}

function getSql(): NeonQueryFunction<false, false> {
  if (!sqlInstance) {
    sqlInstance = neon(getDatabaseUrl());
  }
  return sqlInstance;
}

type SqlTag = ((
  strings: TemplateStringsArray,
  ...values: any[]
) => ReturnType<NeonQueryFunction<false, false>>) & {
  query: (queryText: string, params?: any[]) => Promise<any>;
  unsafe: (value: string) => any;
};

export const sql = Object.assign(
  ((strings: TemplateStringsArray, ...values: any[]) => getSql()(strings, ...values)) as SqlTag,
  {
    query: (queryText: string, params?: any[]) => getSql().query(queryText, params),
    unsafe: (value: string) => (getSql() as any).unsafe(value),
  }
);

// Connection check
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as health_check, NOW() as server_time`;
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    logger.error({ err: error }, '[DB] Connection check failed');
    captureException(error, { stage: 'db.checkConnection' });
    return false;
  }
}

// Column validation for ORDER BY clauses
const ALLOWED_COLUMNS: Record<string, string[]> = {
  vehicles: [
    'id',
    'vin_number',
    'reg_number',
    'make_model',
    'purchase_price_gbp',
    'status',
    'purpose',
    'client_id',
    'cbca_applied',
    'created_at',
  ],
  shipments: [
    'id',
    'client_id',
    'vehicle_id',
    'description',
    'origin',
    'destination',
    'status',
    'shipping_date',
    'delivery_date',
    'created_at',
  ],
  expenses: ['id', 'vehicle_id', 'description', 'amount', 'currency', 'category', 'created_at'],
  quotes: ['id', 'quote_number', 'client_name', 'amount_usd', 'status', 'created_at'],
  invoices: [
    'id',
    'invoice_number',
    'client_name',
    'amount_usd',
    'status',
    'due_date',
    'created_at',
  ],
  payments: ['id', 'reference_id', 'client_name', 'amount_usd', 'date', 'created_at'],
  clients: ['id', 'name', 'email', 'company', 'created_at'],
  employees: ['id', 'employee_number', 'name', 'department', 'status', 'created_at'],
  user_profiles: ['id', 'name', 'email', 'role', 'access_role', 'status', 'created_at'],
  trips: [
    'id',
    'trip_number',
    'title',
    'status',
    'route_origin',
    'route_destination',
    'departure_date',
    'eta_date',
    'created_at',
  ],
};

export function validateOrderColumn(table: string, column: string): string | null {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed) return null;
  return allowed.includes(column) ? column : null;
}

// Singleton pool — reused across withTransaction calls.
// Never call pool.end(); cold starts recreate it on the next warm invocation.
let poolInstance: Pool | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: getDatabaseUrl() });
  }
  return poolInstance;
}

// Transaction helper
export async function withTransaction<T>(
  operations: (client: import('@neondatabase/serverless').PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await operations(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    logger.error({ err: error }, '[DB] Transaction rolled back');
    captureException(error, { stage: 'db.withTransaction' });
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Query helpers with authorization
export async function queryWithAuth(
  userId: string,
  userRole: string,
  queryFn: () => Promise<any>
): Promise<any> {
  // Admin can access everything
  if (userRole === 'Admin') {
    return queryFn();
  }

  // Other roles have filtered access
  // This is where row-level filtering would be applied
  return queryFn();
}

// Rate limiting moved to api/_rate_limit.ts — supports Upstash backend when
// UPSTASH_REDIS_REST_URL + _TOKEN are set, with in-memory fallback otherwise.
