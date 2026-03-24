/**
 * Server-side Neon client for Vercel Serverless Functions.
 *
 * Uses process.env.NEON_DATABASE_URL (no VITE_ prefix — never exposed to
 * the browser). Add this variable to your Vercel project environment settings
 * as well as your local .env file.
 */

import { neon } from '@neondatabase/serverless';

const connectionString =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.VITE_NEON_DATABASE_URL;

if (!connectionString) {
  // Log on cold-start but don't throw — the API handler will return 503
  console.error('[_db] Database URL is not set. Add NEON_DATABASE_URL, DATABASE_URL, or VITE_NEON_DATABASE_URL to Vercel environment variables.');
}

// If the connection string is missing, sql() will throw when called.
// The try/catch in the API handler will catch it and return a proper error response.
export const sql = connectionString
  ? neon(connectionString)
  : (() => { throw new Error('Database URL is not set — add NEON_DATABASE_URL, DATABASE_URL, or VITE_NEON_DATABASE_URL to Vercel environment variables'); }) as unknown as ReturnType<typeof neon>;
