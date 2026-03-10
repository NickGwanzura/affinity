/**
 * Authentication Service - Neon PostgreSQL Only
 * 
 * This service handles all authentication using Neon database.
 * No Supabase dependency - completely self-hosted auth.
 */

import { sql, executeQuery } from './neonClient';
import { AppUser, UserRole, AuthSession } from '../types';

// ============================================
// PASSWORD HASHING (Using Web Crypto API)
// ============================================

const SALT_LENGTH = 16;
const HASH_ITERATIONS = 100000;
const HASH_ALGORITHM = 'SHA-256';

async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  
  let hash = await crypto.subtle.digest(HASH_ALGORITHM, data);
  
  // Multiple iterations for security
  for (let i = 0; i < HASH_ITERATIONS; i++) {
    hash = await crypto.subtle.digest(HASH_ALGORITHM, hash);
  }
  
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

// ============================================
// JWT TOKEN HANDLING
// ============================================

const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + padding);
}

async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY / 1000
  };
  
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = base64UrlEncode(JSON.stringify(fullPayload));
  
  const signature = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    await importJWTSecret(),
    new TextEncoder().encode(`${header}.${payloadStr}`)
  );
  
  const signatureStr = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${header}.${payloadStr}.${signatureStr}`;
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    
    // Verify signature
    const expectedSignature = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      await importJWTSecret(),
      new TextEncoder().encode(`${header}.${payload}`)
    );
    
    const expectedSigStr = base64UrlEncode(String.fromCharCode(...new Uint8Array(expectedSignature)));
    if (signature !== expectedSigStr) return null;
    
    // Parse and check expiry
    const decoded = JSON.parse(base64UrlDecode(payload)) as JWTPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    
    return decoded;
  } catch {
    return null;
  }
}

async function importJWTSecret(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// ============================================
// AUTH SERVICE
// ============================================

class AuthService {
  private tokenKey = 'affinity_auth_token';

  // ============================================
  // LOGIN / LOGOUT
  // ============================================

  async login(email: string, password: string): Promise<AuthSession> {
    if (!sql) throw new Error('Database not connected');

    const normalizedEmail = email.toLowerCase().trim();

    // Get user from database
    const rows = await sql`
      SELECT id, name, email, role, status, password_hash, password_salt
      FROM user_profiles
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = rows[0];

    if (user.status !== 'Active') {
      throw new Error('Account is not active. Please contact support.');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = await signJWT({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole
    });

    // Store token
    localStorage.setItem(this.tokenKey, token);

    // Update last login
    await sql`
      UPDATE user_profiles
      SET last_login = NOW()
      WHERE id = ${user.id}
    `;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        status: user.status
      }
    };
  }

  async logout(): Promise<void> {
    localStorage.removeItem(this.tokenKey);
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async getSession(): Promise<AuthSession | null> {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload) {
      localStorage.removeItem(this.tokenKey);
      return null;
    }

    // Verify user still exists and is active
    const rows = await sql`
      SELECT id, name, email, role, status
      FROM user_profiles
      WHERE id = ${payload.userId}
      LIMIT 1
    `;

    if (rows.length === 0 || rows[0].status !== 'Active') {
      localStorage.removeItem(this.tokenKey);
      return null;
    }

    const user = rows[0];

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        status: user.status
      }
    };
  }

  // ============================================
  // PASSWORD RESET
  // ============================================

  async resetPassword(email: string): Promise<void> {
    if (!sql) throw new Error('Database not connected');

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const rows = await sql`
      SELECT id, name FROM user_profiles
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Don't reveal if email exists or not for security
      console.log(`[Auth] Password reset requested for non-existent email: ${normalizedEmail}`);
      return; // Silently return
    }

    const user = rows[0];

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Store token in database
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES (${user.id}, ${resetToken}, ${expiresAt.toISOString()}, NOW())
    `;

    // Store token in localStorage for demo (in production, send via email)
    localStorage.setItem('pending_reset_token', resetToken);
    localStorage.setItem('pending_reset_email', normalizedEmail);

    console.log(`[Auth] Password reset token generated for ${normalizedEmail}: ${resetToken}`);
    
    // In production, you would send an email here with:
    // ${window.location.origin}/#type=recovery&token=${resetToken}
  }

  async verifyResetToken(token: string): Promise<{ userId: string; email: string } | null> {
    if (!sql) return null;

    const rows = await sql`
      SELECT t.user_id, t.expires_at, u.email
      FROM password_reset_tokens t
      JOIN user_profiles u ON t.user_id = u.id
      WHERE t.token = ${token}
        AND t.used = false
        AND t.expires_at > NOW()
      LIMIT 1
    `;

    if (rows.length === 0) return null;

    return {
      userId: rows[0].user_id,
      email: rows[0].email
    };
  }

  async updatePassword(token: string, newPassword: string): Promise<void> {
    if (!sql) throw new Error('Database not connected');

    // Verify token
    const resetInfo = await this.verifyResetToken(token);
    if (!resetInfo) {
      throw new Error('Invalid or expired reset token');
    }

    // Validate password
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash new password
    const salt = await generateSalt();
    const hash = await hashPassword(newPassword, salt);

    // Update password
    await sql`
      UPDATE user_profiles
      SET password_hash = ${hash},
          password_salt = ${salt},
          updated_at = NOW()
      WHERE id = ${resetInfo.userId}
    `;

    // Mark token as used
    await sql`
      UPDATE password_reset_tokens
      SET used = true,
          used_at = NOW()
      WHERE token = ${token}
    `;

    // Clear stored tokens
    localStorage.removeItem('pending_reset_token');
    localStorage.removeItem('pending_reset_email');

    console.log(`[Auth] Password updated for user: ${resetInfo.userId}`);
  }

  // ============================================
  // USER REGISTRATION (Admin only)
  // ============================================

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }): Promise<AppUser> {
    if (!sql) throw new Error('Database not connected');

    const normalizedEmail = data.email.toLowerCase().trim();

    // Check if email already exists
    const existing = await sql`
      SELECT id FROM user_profiles WHERE email = ${normalizedEmail} LIMIT 1
    `;

    if (existing.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const salt = await generateSalt();
    const hash = await hashPassword(data.password, salt);

    // Insert user
    const result = await sql`
      INSERT INTO user_profiles (email, name, role, status, password_hash, password_salt, created_at, updated_at)
      VALUES (${normalizedEmail}, ${data.name}, ${data.role}, 'Active', ${hash}, ${salt}, NOW(), NOW())
      RETURNING id, email, name, role, status
    `;

    const user = result[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      status: user.status
    };
  }

  // ============================================
  // ADMIN SET USER PASSWORD (Admin only)
  // ============================================

  async adminSetUserPassword(userId: string, newPassword: string): Promise<void> {
    if (!sql) throw new Error('Database not connected');

    // Validate password
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user exists
    const rows = await sql`
      SELECT id FROM user_profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new Error('User not found');
    }

    // Hash new password
    const salt = await generateSalt();
    const hash = await hashPassword(newPassword, salt);

    // Update password
    await sql`
      UPDATE user_profiles
      SET password_hash = ${hash},
          password_salt = ${salt},
          updated_at = NOW()
      WHERE id = ${userId}
    `;

    console.log(`[Auth] Admin changed password for user: ${userId}`);
  }

  // ============================================
  // CHANGE PASSWORD (Logged in user)
  // ============================================

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!sql) throw new Error('Database not connected');

    // Get current password
    const rows = await sql`
      SELECT password_hash, password_salt
      FROM user_profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, rows[0].password_salt, rows[0].password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const salt = await generateSalt();
    const hash = await hashPassword(newPassword, salt);

    // Update password
    await sql`
      UPDATE user_profiles
      SET password_hash = ${hash},
          password_salt = ${salt},
          updated_at = NOW()
      WHERE id = ${userId}
    `;
  }
}

export const authService = new AuthService();
