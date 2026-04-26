/**
 * Group 2 — Server-side auth.
 *
 * Mocks the `sql` import so no DB is touched. Exercises the bcrypt
 * roundtrip, the legacy SHA-256 verification path (and the in-place
 * upgrade to bcrypt), JWT sign/verify, force_password_change flag
 * propagation, and the reset-token attempt counter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';

// Required before importing _auth (it reads JWT secret on token ops).
process.env.JWT_SECRET = 'test-secret-please-do-not-use-in-prod';

// Capture every templated sql() call so tests can assert what was sent.
type SqlCall = { strings: TemplateStringsArray; values: unknown[] };
const sqlCalls: SqlCall[] = [];
let sqlImpl: (call: SqlCall) => unknown[] = () => [];

function makeSqlMock() {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const call: SqlCall = { strings, values };
    sqlCalls.push(call);
    return Promise.resolve(sqlImpl(call) as unknown as ReturnType<typeof Promise.resolve>);
  };
  return Object.assign(tag, {
    query: vi.fn(async () => []),
    unsafe: vi.fn(),
  });
}

vi.mock('../../api/_db.js', () => ({
  sql: makeSqlMock(),
  withTransaction: vi.fn(),
  checkConnection: vi.fn(async () => true),
  validateOrderColumn: vi.fn(),
  checkRateLimit: vi.fn(() => true),
}));

// Now import after mocks are in place.
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateUser,
  recordResetTokenAttempt,
  invalidateResetToken,
} from '../../api/_auth';

beforeEach(() => {
  sqlCalls.length = 0;
  sqlImpl = () => [];
});

// ---------------------------------------------------------------------------

describe('bcrypt roundtrip', () => {
  it('hashPassword + verifyPassword accept the same plaintext and reject others', async () => {
    const hash = await hashPassword('correct horse battery staple');
    // Sanity: bcrypt produces a $2 prefix.
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('legacy SHA-256 verification', () => {
  // Mirror the source's algorithm so the test stays honest if the constants change.
  function legacyHash(password: string, salt: string): string {
    let hash = crypto.createHash('sha256').update(`${password}${salt}`, 'utf8').digest();
    for (let i = 0; i < 100_000; i++) {
      hash = crypto.createHash('sha256').update(hash).digest();
    }
    return hash.toString('hex');
  }

  it('authenticates a legacy user whose hash was produced with sha256(password+salt) iterated 100k times', async () => {
    const salt = '0123456789abcdef0123456789abcdef'; // 32 chars (legacy detector)
    const password = 'hunter2';
    const legacy = legacyHash(password, salt);
    expect(legacy).toHaveLength(64); // sanity: legacy detector requires len 64

    sqlImpl = (call) => {
      const text = call.strings.join('');
      // First call is the SELECT for the user.
      if (text.includes('FROM user_profiles')) {
        return [
          {
            id: 'user-1',
            name: 'Legacy User',
            email: 'legacy@example.com',
            role: 'Driver',
            status: 'active',
            access_role: 'user',
            password_hash: legacy,
            password_salt: salt,
            force_password_change: false,
          },
        ];
      }
      return [];
    };

    const result = await authenticateUser('legacy@example.com', password);
    expect(result.success).toBe(true);
  });

  it('upgrades a legacy hash to bcrypt after a successful login', async () => {
    const salt = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 32 chars
    const password = 's3cret!';
    const legacy = legacyHash(password, salt);

    sqlImpl = (call) => {
      const text = call.strings.join('');
      if (text.includes('FROM user_profiles')) {
        return [
          {
            id: 'user-2',
            name: 'Upgrade Me',
            email: 'upgrade@example.com',
            role: 'Driver',
            status: 'active',
            access_role: 'user',
            password_hash: legacy,
            password_salt: salt,
            force_password_change: false,
          },
        ];
      }
      return [];
    };

    const result = await authenticateUser('upgrade@example.com', password);
    expect(result.success).toBe(true);

    // The upgrade UPDATE must have fired and supplied a bcrypt-shaped hash.
    const updateCall = sqlCalls.find((c) => c.strings.join('').includes('UPDATE user_profiles'));
    expect(updateCall).toBeDefined();
    const upgradedHash = updateCall!.values[0] as string;
    expect(typeof upgradedHash).toBe('string');
    expect(upgradedHash.startsWith('$2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('JWT sign/verify', () => {
  it('round-trips userId, role, accessRole through generate/verify', () => {
    const token = generateToken('user-99', 'Manager', 'admin');
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-99');
    expect(payload.role).toBe('Manager');
    expect(payload.accessRole).toBe('admin');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

// ---------------------------------------------------------------------------

describe('force_password_change propagation', () => {
  it('exposes force_password_change as forcePasswordChange on the returned user', async () => {
    const password = 'pw-for-bcrypt-user';
    const hash = await hashPassword(password);

    sqlImpl = (call) => {
      const text = call.strings.join('');
      if (text.includes('FROM user_profiles')) {
        return [
          {
            id: 'user-3',
            name: 'Force Me',
            email: 'force@example.com',
            role: 'Driver',
            status: 'Active',
            access_role: 'user',
            password_hash: hash,
            password_salt: null,
            force_password_change: true,
          },
        ];
      }
      return [];
    };

    const result = await authenticateUser('force@example.com', password);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.forcePasswordChange).toBe(true);
      // The raw column should not leak through.
      expect(result.user.force_password_change).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------

describe('reset-token attempt counter', () => {
  it('returns the current attempt count and lets the caller invalidate after 5', async () => {
    let attempts = 0;
    sqlImpl = (call) => {
      const text = call.strings.join('');
      if (text.includes('UPDATE password_resets') && text.includes('attempts')) {
        attempts += 1;
        return [];
      }
      if (text.includes('SELECT COALESCE(attempts')) {
        return [{ attempts }];
      }
      return [];
    };

    let count = 0;
    for (let i = 0; i < 5; i++) {
      count = await recordResetTokenAttempt('tok-abc');
    }
    expect(count).toBe(5);

    await invalidateResetToken('tok-abc');
    const lastCall = sqlCalls[sqlCalls.length - 1];
    const text = lastCall.strings.join('');
    expect(text).toContain('UPDATE password_resets');
    expect(text).toContain('used_at');
  });
});
