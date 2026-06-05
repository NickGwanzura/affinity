/* global process */

/**
 * Server-Side Authentication Service
 *
 * JWT operations and password hashing - server-side only
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sql } from './_db.js';

const JWT_EXPIRY = '24h';
const LEGACY_HASH_ALGORITHM = 'sha256';
const LEGACY_HASH_ITERATIONS = 100000;
const VALID_ACCESS_ROLES = ['super_admin', 'admin', 'user'] as const;

type AccessRole = typeof VALID_ACCESS_ROLES[number];

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret environment variable is required (set JWT_SECRET or VITE_JWT_SECRET)');
  }
  return secret;
}

export interface JWTPayload {
  sub: string;  // user id
  role: string;
  accessRole: AccessRole;
  iat: number;
  exp: number;
}

export type AuthFailureReason = 'INVALID_CREDENTIALS' | 'ACCOUNT_PENDING' | 'ACCOUNT_INACTIVE';

export type AuthResult =
  | {
      success: true;
      token: string;
      user: any;
    }
  | {
      success: false;
      reason: AuthFailureReason;
      message: string;
    };

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function isBcryptHash(hash: string | null | undefined): boolean {
  return typeof hash === 'string' && hash.startsWith('$2');
}

function normaliseAccessRole(rawRole: unknown, legacyRole: string): AccessRole {
  if (typeof rawRole === 'string' && (VALID_ACCESS_ROLES as readonly string[]).includes(rawRole)) {
    return rawRole as AccessRole;
  }
  return legacyRole === 'Admin' ? 'admin' : 'user';
}

function isLegacyHash(hash: string | null | undefined, salt: string | null | undefined): boolean {
  return typeof hash === 'string' && hash.length === 64 && typeof salt === 'string' && salt.length === 32;
}

function hashLegacyPassword(password: string, salt: string): string {
  let hash = crypto.createHash(LEGACY_HASH_ALGORITHM).update(`${password}${salt}`, 'utf8').digest();

  for (let i = 0; i < LEGACY_HASH_ITERATIONS; i++) {
    hash = crypto.createHash(LEGACY_HASH_ALGORITHM).update(hash).digest();
  }

  return hash.toString('hex');
}

async function verifyStoredPassword(password: string, hash: string | null, salt: string | null): Promise<boolean> {
  if (!hash) {
    return false;
  }

  if (isBcryptHash(hash)) {
    return verifyPassword(password, hash);
  }

  if (isLegacyHash(hash, salt)) {
    return hashLegacyPassword(password, salt) === hash;
  }

  return false;
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string, role: string, accessRole: AccessRole): string {
  return jwt.sign(
    { sub: userId, role, accessRole },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, getJwtSecret()) as JWTPayload;
}

/**
 * Authenticate user with email/password
 */
export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const identifier = email.trim();
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.access_role,
      u.password_hash,
      u.password_salt,
      u.force_password_change
    FROM user_profiles u
    WHERE u.email = ${identifier.toLowerCase()}
       OR u.phone = ${identifier}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      success: false,
      reason: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    };
  }

  const user = rows[0];

  const normalisedStatus = String(user.status || '').toLowerCase();
  const isApprovedStatus = normalisedStatus === 'active' || normalisedStatus === 'approved';
  if (!isApprovedStatus) {
    const isPendingStatus = normalisedStatus === 'pending';
    return {
      success: false,
      reason: isPendingStatus ? 'ACCOUNT_PENDING' : 'ACCOUNT_INACTIVE',
      message: isPendingStatus ? 'Account pending approval' : 'Account is not active',
    };
  }

  // Verify password
  const isValid = await verifyStoredPassword(password, user.password_hash, user.password_salt ?? null);
  if (!isValid) {
    return {
      success: false,
      reason: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    };
  }

  const accessRole = normaliseAccessRole(user.access_role, user.role);

  // Upgrade legacy hashes in-place after a successful login.
  if (!isBcryptHash(user.password_hash)) {
    const upgradedHash = await hashPassword(password);
    await sql`
      UPDATE user_profiles
      SET password_hash = ${upgradedHash}, password_salt = NULL, updated_at = NOW()
      WHERE id = ${user.id}::uuid
    `;
    user.password_hash = upgradedHash;
    user.password_salt = null;
  }

  // Generate token
  const token = generateToken(user.id, user.role, accessRole);

  // Return user without password_hash
  const userWithoutPassword = { ...user };
  delete userWithoutPassword.password_hash;
  delete userWithoutPassword.password_salt;
  userWithoutPassword.accessRole = accessRole;
  userWithoutPassword.forcePasswordChange = !!user.force_password_change;
  delete userWithoutPassword.force_password_change;

  return {
    success: true,
    token,
    user: userWithoutPassword,
  };
}

/**
 * Create new user with hashed password
 */
export async function createUser(
  name: string,
  email: string,
  password: string,
  role: string = 'Driver',
  options?: { accessRole?: AccessRole },
): Promise<any> {
  // Check if email exists
  const existing = await sql`
    SELECT id FROM user_profiles WHERE email = ${email.toLowerCase()}
  `;

  if (existing.length > 0) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const accessRole = options?.accessRole ?? (role === 'Admin' ? 'admin' : 'user');

  const rows = await sql`
    INSERT INTO user_profiles (name, email, role, access_role, status, password_hash)
    VALUES (
      ${name},
      ${email.toLowerCase()},
      ${role},
      ${accessRole},
      'Active',
      ${passwordHash}
    )
    RETURNING id, name, email, role, access_role, status, created_at
  `;

  return rows[0];
}

/**
 * Change user password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  // Get current password hash
  const rows = await sql`
    SELECT password_hash, password_salt FROM user_profiles WHERE id = ${userId}::uuid
  `;

  if (rows.length === 0) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await verifyStoredPassword(
    currentPassword,
    rows[0].password_hash ?? null,
    rows[0].password_salt ?? null,
  );
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash and update new password
  const newHash = await hashPassword(newPassword);

  await sql`
    UPDATE user_profiles
    SET password_hash = ${newHash}, password_salt = NULL, force_password_change = false, updated_at = NOW()
    WHERE id = ${userId}::uuid
  `;
}

/**
 * Generate password reset token (stored in DB)
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const request = await createPasswordResetRequest(email);
  return request?.token ?? null;
}

export async function createPasswordResetRequest(
  email: string,
): Promise<{ token: string; user: { id: string; name: string; email: string } } | null> {
  const rows = await sql`
    SELECT id, name, email FROM user_profiles WHERE email = ${email.toLowerCase()}
  `;

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0] as { id: string; name: string; email: string };
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour

  await sql`
    INSERT INTO password_resets (user_id, token, expires_at)
    VALUES (${user.id}::uuid, ${token}, ${expiresAt.toISOString()})
  `;

  return { token, user };
}

/**
 * Verify reset token and update password
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const rows = await sql`
    SELECT user_id FROM password_resets
    WHERE token = ${token} AND expires_at > NOW() AND used_at IS NULL
  `;

  if (rows.length === 0) {
    throw new Error('Invalid or expired reset token');
  }

  const userId = rows[0].user_id;
  const newHash = await hashPassword(newPassword);

  await sql`
    UPDATE user_profiles
    SET password_hash = ${newHash}, password_salt = NULL, force_password_change = false, updated_at = NOW()
    WHERE id = ${userId}::uuid
  `;

  // Mark token as used
  await sql`
    UPDATE password_resets
    SET used_at = NOW()
    WHERE token = ${token}
  `;
}

/**
 * Record an attempt against a given reset token and return the number of
 * attempts made so far (including this one). If the caller sees this value
 * exceed a threshold they should invalidate the token.
 */
export async function recordResetTokenAttempt(token: string): Promise<number> {
  // password_resets is expected to have an `attempts` column after this
  // migration. The UPDATE is a no-op on rows that don't exist, which is
  // exactly what we want for bogus tokens.
  await sql`
    UPDATE password_resets
    SET attempts = COALESCE(attempts, 0) + 1
    WHERE token = ${token}
  `;
  const rows = await sql`
    SELECT COALESCE(attempts, 0) AS attempts
    FROM password_resets
    WHERE token = ${token}
  `;
  return Number(rows[0]?.attempts ?? 0);
}

/**
 * Mark a reset token as used (invalidated) without actually resetting a
 * password. Used when an attacker exhausts attempts against a single token.
 */
export async function invalidateResetToken(token: string): Promise<void> {
  await sql`
    UPDATE password_resets
    SET used_at = COALESCE(used_at, NOW())
    WHERE token = ${token}
  `;
}

export async function getUserById(
  userId: string,
): Promise<{
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  access_role?: string | null;
  force_password_change?: boolean;
} | null> {
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.access_role,
      u.force_password_change
    FROM user_profiles u
    WHERE u.id = ${userId}::uuid
    LIMIT 1
  `;
  return (
    rows[0] as
      | {
          id: string;
          name: string;
          email: string;
          role: string;
          status: string;
          access_role?: string | null;
          force_password_change?: boolean;
        }
      | undefined
  ) ?? null;
}
