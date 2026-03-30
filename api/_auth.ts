/* global process */

/**
 * Server-Side Authentication Service
 * 
 * JWT operations and password hashing - server-side only
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql } from './_db';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = '24h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface JWTPayload {
  sub: string;  // user id
  role: string;
  iat: number;
  exp: number;
}

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

/**
 * Generate JWT token
 */
export function generateToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Authenticate user with email/password
 */
export async function authenticateUser(email: string, password: string): Promise<{ token: string; user: any } | null> {
  // Get user from database
  const rows = await sql`
    SELECT id, name, email, role, status, password_hash
    FROM user_profiles
    WHERE email = ${email.toLowerCase()}
  `;
  
  if (rows.length === 0) {
    return null;
  }
  
  const user = rows[0];
  
  // Check status
  if (user.status !== 'Active') {
    throw new Error('Account is not active');
  }
  
  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return null;
  }
  
  // Generate token
  const token = generateToken(user.id, user.role);
  
  // Return user without password_hash
  const userWithoutPassword = { ...user };
  delete userWithoutPassword.password_hash;
  
  return { token, user: userWithoutPassword };
}

/**
 * Create new user with hashed password
 */
export async function createUser(
  name: string, 
  email: string, 
  password: string, 
  role: string = 'Driver'
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
  
  // Create user
  const rows = await sql`
    INSERT INTO user_profiles (name, email, role, status, password_hash)
    VALUES (${name}, ${email.toLowerCase()}, ${role}, 'Active', ${passwordHash})
    RETURNING id, name, email, role, status, created_at
  `;
  
  return rows[0];
}

/**
 * Change user password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  // Get current password hash
  const rows = await sql`
    SELECT password_hash FROM user_profiles WHERE id = ${userId}::uuid
  `;
  
  if (rows.length === 0) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValid = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }
  
  // Hash and update new password
  const newHash = await hashPassword(newPassword);
  
  await sql`
    UPDATE user_profiles 
    SET password_hash = ${newHash}, updated_at = NOW()
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
    SET password_hash = ${newHash}, updated_at = NOW()
    WHERE id = ${userId}::uuid
  `;
  
  // Mark token as used
  await sql`
    UPDATE password_resets 
    SET used_at = NOW()
    WHERE token = ${token}
  `;
}

export async function getUserById(userId: string): Promise<{ id: string; email: string; role: string; status: string } | null> {
  const rows = await sql`
    SELECT id, email, role, status
    FROM user_profiles
    WHERE id = ${userId}::uuid
  `;

  return (rows[0] as { id: string; email: string; role: string; status: string } | undefined) ?? null;
}
