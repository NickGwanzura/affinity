/**
 * Server-side Neon client for Vercel Serverless Functions.
 *
 * Uses process.env.NEON_DATABASE_URL (no VITE_ prefix — never exposed to
 * the browser). Add this variable to your Vercel project environment settings
 * as well as your local .env file.
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error('NEON_DATABASE_URL is not set. Add it to .env (server-side).');
}

export const sql = neon(connectionString);
