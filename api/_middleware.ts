/* global process */

/**
 * API Middleware - Authentication & Security
 *
 * Server-side JWT validation and security headers.
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import jwt from 'jsonwebtoken';
import { sql } from './_db.js';
import { logger } from './_logger.js';
import { captureException, initSentry } from './_sentry.js';

// Init at module load so Sentry is armed for the first request.
// No-op when SENTRY_DSN is unset.
initSentry();

export type AccessRole = 'super_admin' | 'admin' | 'user';

const VALID_ACCESS_ROLES: AccessRole[] = ['super_admin', 'admin', 'user'];

function getJwtSecret(): string | null {
  return process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || null;
}

function getTokenFromCookieHeader(cookieHeader: string | string[] | undefined): string | null {
  if (!cookieHeader) return null;

  const rawCookieHeader = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;

  const supportedCookieNames = ['affinity_auth_token', 'auth_token', 'token'];
  const pairs = rawCookieHeader.split(';').map((part) => part.trim());

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = pair.slice(0, separatorIndex);
    const rawValue = pair.slice(separatorIndex + 1);
    if (!supportedCookieNames.includes(key)) continue;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export interface AuthenticatedRequest extends ApiRequest {
  user?: {
    id: string;
    role: string;
    accessRole: AccessRole;
    forcePasswordChange: boolean;
  };
}

type UserContextRow = {
  id: string;
  role: string;
  status: string | null;
  access_role?: string | null;
  force_password_change?: boolean | null;
};

function parsePathname(req: ApiRequest): string {
  const raw = req.url || '/';
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function isGlobalAdminPath(pathname: string): boolean {
  return pathname.startsWith('/api/admin/');
}

function normaliseAccessRole(raw: unknown, legacyRole: string): AccessRole {
  if (typeof raw === 'string' && VALID_ACCESS_ROLES.includes(raw as AccessRole)) {
    return raw as AccessRole;
  }

  // Safe fallback for legacy records/tokens before migration
  return legacyRole === 'Admin' ? 'admin' : 'user';
}

async function getUserContext(userId: string): Promise<UserContextRow | null> {
  const rows = await sql`
    SELECT
      u.id,
      u.role,
      u.status,
      u.access_role,
      u.force_password_change
    FROM user_profiles u
    WHERE u.id = ${userId}::uuid
    LIMIT 1
  `;
  return (rows[0] as UserContextRow | undefined) ?? null;
}

/**
 * Verify JWT token from Authorization header
 */
export async function verifyToken(req: AuthenticatedRequest, res: ApiResponse): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const secret = getJwtSecret();

  if (!secret) {
    const error = new Error('Server authentication misconfigured (missing JWT secret)');
    logger.error({ err: error }, 'JWT secret missing');
    captureException(error, { stage: 'verifyToken.config' });
    res.status(500).json({
      error: error.message,
    });
    return false;
  }

  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = getTokenFromCookieHeader(req.headers.cookie);
  const token = headerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return false;
  }

  const pathname = parsePathname(req);

  const validate = async (): Promise<boolean> => {
    let decoded: {
      sub?: string;
      role?: string;
      accessRole?: string;
    };
    try {
      decoded = jwt.verify(token, secret) as typeof decoded;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return false;
    }

    if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
      res.status(401).json({ error: 'Invalid or expired token' });
      return false;
    }

    const userContext = await getUserContext(decoded.sub);
    if (!userContext) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return false;
    }

    const normalisedStatus = String(userContext.status || '').toLowerCase();
    const isApprovedStatus = normalisedStatus === 'active' || normalisedStatus === 'approved';
    if (!isApprovedStatus) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return false;
    }

    const accessRole = normaliseAccessRole(userContext.access_role ?? decoded.accessRole, userContext.role);
    const globalAdminPath = isGlobalAdminPath(pathname);

    if (accessRole !== 'super_admin' && globalAdminPath) {
      res.status(403).json({ error: 'Access denied' });
      return false;
    }

    req.user = {
      id: decoded.sub,
      role: userContext.role,
      accessRole,
      forcePasswordChange: !!userContext.force_password_change,
    };
    return true;
  };

  try {
    return await validate();
  } catch (error) {
    logger.error({ err: error, pathname }, 'Token validation failed');
    captureException(error, { stage: 'verifyToken.validate', pathname });
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Authentication validation failed' });
    }
    return false;
  }
}

export function requireAccessRole(req: AuthenticatedRequest, res: ApiResponse, roles: AccessRole[]): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  if (!roles.includes(req.user.accessRole)) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }

  return true;
}

/**
 * Check that the authenticated user has one of the allowed business roles.
 * Super admins and admins always pass through.
 */
export function requireBusinessRole(req: AuthenticatedRequest, res: ApiResponse, allowedRoles: string[]): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  // Super admin and admin bypass business-role checks
  if (req.user.accessRole === 'super_admin' || req.user.accessRole === 'admin') {
    return true;
  }

  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }

  return true;
}

/**
 * Block authenticated requests from users who still need to change
 * their initial password. Callers should invoke this immediately
 * after verifyToken, *except* on the change-password/me/logout paths.
 *
 * Returns true when the request is allowed to proceed; false when a
 * 403 has already been sent.
 */
export function requirePasswordCurrent(req: AuthenticatedRequest, res: ApiResponse): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  if (req.user.forcePasswordChange) {
    res.status(403).json({ error: 'password_change_required' });
    return false;
  }

  return true;
}

/**
 * Set security headers
 */
export function setSecurityHeaders(res: ApiResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data: https://1.www.s81c.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https:;"
  );
}

/**
 * Handle CORS preflight
 */
export function handleCors(req: ApiRequest, res: ApiResponse): boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

/**
 * API Error wrapper
 */
export function apiError(res: ApiResponse, status: number, message: string, details?: any): void {
  logger.error({ err: details, status, message }, 'API error response');
  if (details instanceof Error || (status >= 500 && details !== undefined)) {
    captureException(details ?? new Error(message), { status, message });
  }

  const payload: Record<string, unknown> = { error: message };

  if (details instanceof Error) {
    payload.details = details.message;
  } else if (details !== undefined) {
    payload.details = typeof details === 'object' ? JSON.stringify(details) : String(details);
  }

  res.status(status).json(payload);
}
