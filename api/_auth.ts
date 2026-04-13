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
const VALID_ACCESS_ROLES = ['super_admin', 'tenant_admin', 'user'] as const;

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
  tenantId: string | null;
  iat: number;
  exp: number;
}

export type AuthFailureReason = 'INVALID_CREDENTIALS' | 'ACCOUNT_PENDING' | 'ACCOUNT_INACTIVE' | 'TENANT_LINK_MISSING';

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

const isMissingTenantSchemaError = (error: unknown): boolean =>
  error instanceof Error &&
  (
    error.message.includes('column "access_role"') ||
    error.message.includes('column "tenant_id"') ||
    error.message.includes('relation "tenants"')
  );

function normaliseAccessRole(rawRole: unknown, legacyRole: string): AccessRole {
  if (typeof rawRole === 'string' && (VALID_ACCESS_ROLES as readonly string[]).includes(rawRole)) {
    return rawRole as AccessRole;
  }
  return legacyRole === 'Admin' ? 'tenant_admin' : 'user';
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
export function generateToken(userId: string, role: string, accessRole: AccessRole, tenantId: string | null): string {
  return jwt.sign(
    { sub: userId, role, accessRole, tenantId },
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
  let rows: any[];
  try {
    rows = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.access_role,
        u.tenant_id,
        t.status AS tenant_status,
        t.name AS tenant_name,
        u.password_hash,
        u.password_salt
      FROM user_profiles u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ${email.toLowerCase()}
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingTenantSchemaError(error)) {
      throw error;
    }

    rows = await sql`
      SELECT id, name, email, role, status, password_hash, password_salt
      FROM user_profiles
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;
  }
  
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
  const tenantId = user.tenant_id ?? null;
  const tenantStatus = user.tenant_status ?? null;

  if (accessRole === 'super_admin' && tenantId) {
    return {
      success: false,
      reason: 'ACCOUNT_INACTIVE',
      message: 'Super admin must not be linked to a tenant',
    };
  }

  if (accessRole !== 'super_admin' && !tenantId) {
    return {
      success: false,
      reason: 'TENANT_LINK_MISSING',
      message: 'User not linked to tenant',
    };
  }

  if (accessRole !== 'super_admin' && typeof tenantStatus === 'string' && tenantStatus.toLowerCase() !== 'active') {
    return {
      success: false,
      reason: 'ACCOUNT_INACTIVE',
      message: 'Tenant account is not active',
    };
  }

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
  const token = generateToken(user.id, user.role, accessRole, tenantId);
  
  // Return user without password_hash
  const userWithoutPassword = { ...user };
  delete userWithoutPassword.password_hash;
  delete userWithoutPassword.password_salt;
  userWithoutPassword.accessRole = accessRole;
  userWithoutPassword.tenantId = tenantId;
  userWithoutPassword.tenantStatus = tenantStatus;
  userWithoutPassword.tenantName = user.tenant_name ?? null;
  
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
  options?: { accessRole?: AccessRole; tenantId?: string | null },
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
  const accessRole = options?.accessRole ?? (role === 'Admin' ? 'tenant_admin' : 'user');
  const tenantId = options?.tenantId ?? null;
  
  let rows: any[];
  try {
    rows = await sql`
      INSERT INTO user_profiles (name, email, role, access_role, tenant_id, status, password_hash)
      VALUES (
        ${name},
        ${email.toLowerCase()},
        ${role},
        ${accessRole},
        ${tenantId},
        'Active',
        ${passwordHash}
      )
      RETURNING id, name, email, role, access_role, tenant_id, status, created_at
    `;
  } catch (error) {
    if (!isMissingTenantSchemaError(error)) {
      throw error;
    }

    rows = await sql`
      INSERT INTO user_profiles (name, email, role, status, password_hash)
      VALUES (${name}, ${email.toLowerCase()}, ${role}, 'Active', ${passwordHash})
      RETURNING id, name, email, role, status, created_at
    `;
  }
  
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
    SET password_hash = ${newHash}, password_salt = NULL, updated_at = NOW()
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
    SET password_hash = ${newHash}, password_salt = NULL, updated_at = NOW()
    WHERE id = ${userId}::uuid
  `;
  
  // Mark token as used
  await sql`
    UPDATE password_resets 
    SET used_at = NOW()
    WHERE token = ${token}
  `;
}

export async function getUserById(
  userId: string,
): Promise<{
  id: string;
  email: string;
  role: string;
  status: string;
  access_role?: string | null;
  tenant_id?: string | null;
  tenant_status?: string | null;
  tenant_name?: string | null;
} | null> {
  try {
    const rows = await sql`
      SELECT
        u.id,
        u.email,
        u.role,
        u.status,
        u.access_role,
        u.tenant_id,
        t.status AS tenant_status,
        t.name AS tenant_name
      FROM user_profiles u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = ${userId}::uuid
      LIMIT 1
    `;
    return (
      rows[0] as
        | {
            id: string;
            email: string;
            role: string;
            status: string;
            access_role?: string | null;
            tenant_id?: string | null;
            tenant_status?: string | null;
            tenant_name?: string | null;
          }
        | undefined
    ) ?? null;
  } catch (error) {
    if (!isMissingTenantSchemaError(error)) {
      throw error;
    }

    const rows = await sql`
      SELECT id, email, role, status
      FROM user_profiles
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;
    return (rows[0] as { id: string; email: string; role: string; status: string } | undefined) ?? null;
  }
}
