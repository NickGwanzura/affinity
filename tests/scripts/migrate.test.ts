/**
 * Group 4 — Migration runner.
 *
 * Mocks @neondatabase/serverless and node:fs/promises so the runner can be
 * imported and exercised without touching a real database or filesystem.
 *
 * The runner's `main()` is invoked at module-load time. We wait for it to
 * settle by hooking `pool.end()` (the runner's `finally` step).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

type QueryCall = { text: string; params?: unknown[] };

// Shared, mutable test state. `vi.hoisted` is required because vi.mock is
// hoisted above other imports.
const state = vi.hoisted(() => {
  return {
    files: [] as string[],
    fileBodies: {} as Record<string, string>,
    appliedRows: [] as { filename: string }[],
    schemaTableExists: true,
    queries: [] as QueryCall[],
    endResolve: undefined as (() => void) | undefined,
    endPromise: undefined as Promise<void> | undefined,
  };
});

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(async () => state.files),
  readFile: vi.fn(async (path: string) => {
    const filename = String(path).split(/[\\/]/).pop() as string;
    return state.fileBodies[filename] ?? '';
  }),
}));

vi.mock('dotenv/config', () => ({}));

vi.mock('ws', () => ({ default: {} }));

vi.mock('@neondatabase/serverless', () => {
  class Pool {
    async query(text: string, params?: unknown[]) {
      state.queries.push({ text, params });
      // Surface the schema_migrations bootstrap probe.
      if (text.includes('SELECT 1 FROM public.schema_migrations')) {
        if (!state.schemaTableExists) {
          throw new Error('relation "public.schema_migrations" does not exist');
        }
        return { rows: [{ '?column?': 1 }] };
      }
      if (text.includes('SELECT filename FROM public.schema_migrations')) {
        return { rows: state.appliedRows };
      }
      // INSERT into schema_migrations records what we just applied.
      if (text.includes('INSERT INTO public.schema_migrations')) {
        const filename = (params?.[0] as string) ?? '';
        if (filename) state.appliedRows.push({ filename });
        return { rows: [] };
      }
      return { rows: [] };
    }
    async end() {
      state.endResolve?.();
    }
  }
  return {
    Pool,
    neonConfig: {} as Record<string, unknown>,
  };
});

beforeEach(() => {
  state.files = [];
  state.fileBodies = {};
  state.appliedRows = [];
  state.schemaTableExists = true;
  state.queries = [];
  state.endPromise = new Promise<void>((resolve) => {
    state.endResolve = resolve;
  });
  process.env.NEON_DATABASE_URL = 'postgres://test:test@localhost/test';
  vi.resetModules();
});

async function runMigrate(): Promise<void> {
  await import('../../scripts/migrate');
  // The runner kicks off `main()` at import; its `finally` calls pool.end()
  // which resolves our endPromise.
  await state.endPromise;
}

// ---------------------------------------------------------------------------

describe('migration runner', () => {
  it('applies files in NNNN_ order', async () => {
    state.files = ['0002_second.sql', '0001_first.sql'];
    state.fileBodies = {
      '0001_first.sql': 'CREATE TABLE a();',
      '0002_second.sql': 'CREATE TABLE b();',
    };

    await runMigrate();

    const inserts = state.queries
      .filter((q) => q.text.includes('INSERT INTO public.schema_migrations'))
      .map((q) => q.params?.[0] as string);
    expect(inserts).toEqual(['0001_first.sql', '0002_second.sql']);
  });

  it('skips files already in schema_migrations', async () => {
    state.files = ['0001_first.sql', '0002_second.sql'];
    state.fileBodies = {
      '0001_first.sql': 'CREATE TABLE a();',
      '0002_second.sql': 'CREATE TABLE b();',
    };
    // Pretend 0001 has already been applied.
    state.appliedRows = [{ filename: '0001_first.sql' }];

    await runMigrate();

    const applied = state.queries
      .filter((q) => q.text.includes('INSERT INTO public.schema_migrations'))
      .map((q) => q.params?.[0] as string);
    // Only 0002 should have been inserted now.
    expect(applied).toEqual(['0002_second.sql']);
  });

  it('bootstraps the first migration when schema_migrations does not exist yet', async () => {
    state.files = ['0000_init.sql', '0001_after.sql'];
    state.fileBodies = {
      '0000_init.sql': 'CREATE TABLE schema_migrations();',
      '0001_after.sql': 'CREATE TABLE a();',
    };
    state.schemaTableExists = false;

    await runMigrate();

    // The bootstrap path must have inserted the 0000 file before the
    // SELECT-from-applied query ran.
    const inserts = state.queries
      .filter((q) => q.text.includes('INSERT INTO public.schema_migrations'))
      .map((q) => q.params?.[0] as string);
    expect(inserts).toContain('0000_init.sql');
    // And later migrations still get applied.
    expect(inserts).toContain('0001_after.sql');
  });
});
