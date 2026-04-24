/**
 * Migration runner for Affinity CRM.
 *
 * Discovers `migrations/NNNN_*.sql` files, applies any that are not yet
 * recorded in `public.schema_migrations`, and records each with a sha256
 * checksum after it succeeds.
 *
 * Usage:  NEON_DATABASE_URL=... tsx scripts/migrate.ts
 */

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Neon's serverless driver uses WebSockets for Pool connections; in Node.js
// there is no built-in WebSocket so we supply the `ws` package (matches the
// pattern used in api/_db.ts).
neonConfig.webSocketConstructor = ws;

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const MIGRATION_RE = /^\d{4}_.+\.sql$/;

interface MigrationRow {
  filename: string;
}

async function main(): Promise<void> {
  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('NEON_DATABASE_URL not set');
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const entries = (await readdir(MIGRATIONS_DIR))
      .filter((f) => MIGRATION_RE.test(f))
      .sort();

    if (entries.length === 0) {
      console.log('No migrations found.');
      return;
    }

    // Bootstrap: ensure schema_migrations exists before we can query it.
    // The 0000 file is expected to create the table idempotently, so we run
    // it unconditionally on a fresh database.
    const first = entries[0];
    let needsBootstrap = false;
    try {
      await pool.query('SELECT 1 FROM public.schema_migrations LIMIT 1');
    } catch {
      needsBootstrap = true;
    }

    if (needsBootstrap) {
      console.log(`Bootstrapping: ${first}`);
      const initSql = await readFile(join(MIGRATIONS_DIR, first), 'utf-8');
      await pool.query(initSql);
      const checksum = createHash('sha256').update(initSql).digest('hex');
      await pool.query(
        'INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [first, checksum],
      );
    }

    const appliedResult = await pool.query<MigrationRow>(
      'SELECT filename FROM public.schema_migrations',
    );
    const applied = new Set(appliedResult.rows.map((r) => r.filename));

    let ranCount = 0;
    for (const filename of entries) {
      if (applied.has(filename)) continue;
      const body = await readFile(join(MIGRATIONS_DIR, filename), 'utf-8');
      const checksum = createHash('sha256').update(body).digest('hex');
      console.log(`Applying: ${filename}`);
      try {
        await pool.query(body);
        await pool.query(
          'INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, checksum],
        );
        ranCount++;
      } catch (err) {
        console.error(`Migration ${filename} FAILED:`, err);
        process.exit(1);
      }
    }

    console.log(
      `Done. ${ranCount} migration(s) applied. ${entries.length} total, ${applied.size} already applied.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
