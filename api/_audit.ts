import type { VercelRequest } from '@vercel/node';
import { sql } from './_db.js';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type AuditPayload = {
  req?: VercelRequest;
  userId?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  oldData?: unknown;
  newData?: unknown;
};

const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'password_hash',
  'token',
  'invite_token',
  'receipt_url',
  'authorization',
]);

let ensureAuditSchemaPromise: Promise<void> | null = null;

const toJsonValue = (value: unknown, depth = 0): JsonValue => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 3) return value.length;
    return value.slice(0, 25).map((entry) => toJsonValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 3) return '[truncated]';
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      const normalizedKey = key.toLowerCase();
      if (REDACTED_KEYS.has(normalizedKey)) {
        return [key, '[redacted]'] as const;
      }
      return [key, toJsonValue(entryValue, depth + 1)] as const;
    });
    return Object.fromEntries(entries);
  }
  return String(value);
};

const getClientIp = (req?: VercelRequest) => {
  const forwarded = req?.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(',')[0]?.trim() || null;
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return req?.socket?.remoteAddress || null;
};

export async function ensureAuditSchema(): Promise<void> {
  if (!ensureAuditSchemaPromise) {
    ensureAuditSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          table_name TEXT,
          record_id UUID,
          old_data JSONB,
          new_data JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`;
    })().catch((error) => {
      ensureAuditSchemaPromise = null;
      throw error;
    });
  }

  return ensureAuditSchemaPromise;
}

export async function logAuditEvent(payload: AuditPayload): Promise<void> {
  try {
    await ensureAuditSchema();
    const userAgentHeader = payload.req?.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    const ipAddress = getClientIp(payload.req);

    await sql`
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address,
        user_agent
      )
      VALUES (
        ${payload.userId || null}::uuid,
        ${payload.action},
        ${payload.tableName || null},
        ${payload.recordId || null}::uuid,
        ${JSON.stringify(toJsonValue(payload.oldData))}::jsonb,
        ${JSON.stringify(toJsonValue(payload.newData))}::jsonb,
        ${ipAddress},
        ${userAgent || null}
      )
    `;
  } catch (error) {
    console.error('[Audit] Failed to record audit log:', error);
  }
}
