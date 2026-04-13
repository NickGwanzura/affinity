/* global process */

/**
 * API Middleware - Authentication & Security
 * 
 * Server-side JWT validation and security headers
 * This runs on Vercel's edge/serverless environment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { sql } from './_db.js';

export type AccessRole = 'super_admin' | 'tenant_admin' | 'user';

const VALID_ACCESS_ROLES: AccessRole[] = ['super_admin', 'tenant_admin', 'user'];

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

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    role: string;
    accessRole: AccessRole;
    tenantId: string | null;
    tenantStatus: string | null;
    tenantName: string | null;
    actingAsTenant: boolean;
  };
}

type UserContextRow = {
  id: string;
  role: string;
  status: string | null;
  access_role?: string | null;
  tenant_id?: string | null;
  tenant_status?: string | null;
  tenant_name?: string | null;
};

type TenantContextRow = {
  id: string;
  name: string;
  status: string;
};

const isMissingSchemaError = (error: unknown): boolean =>
  error instanceof Error &&
  (
    error.message.includes('column "access_role"') ||
    error.message.includes('column "tenant_id"') ||
    error.message.includes('relation "tenants"')
  );

function parsePathname(req: VercelRequest): string {
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

function isNonTenantPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth') || pathname.startsWith('/api/health');
}

function normaliseAccessRole(raw: unknown, legacyRole: string): AccessRole {
  if (typeof raw === 'string' && VALID_ACCESS_ROLES.includes(raw as AccessRole)) {
    return raw as AccessRole;
  }

  // Safe fallback for legacy records/tokens before migration
  return legacyRole === 'Admin' ? 'tenant_admin' : 'user';
}

async function getUserContext(userId: string): Promise<UserContextRow | null> {
  try {
    const rows = await sql`
      SELECT
        u.id,
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
    return (rows[0] as UserContextRow | undefined) ?? null;
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }

    const legacyRows = await sql`
      SELECT id, role, status
      FROM user_profiles
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;
    return (legacyRows[0] as UserContextRow | undefined) ?? null;
  }
}

async function getTenantContext(tenantId: string): Promise<TenantContextRow | null> {
  try {
    const rows = await sql`
      SELECT id, name, status
      FROM tenants
      WHERE id = ${tenantId}::uuid
      LIMIT 1
    `;
    return (rows[0] as TenantContextRow | undefined) ?? null;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Verify JWT token from Authorization header
 */
export async function verifyToken(req: AuthenticatedRequest, res: VercelResponse): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const secret = getJwtSecret();

  if (!secret) {
    const error = new Error('Server authentication misconfigured (missing JWT secret)');
    console.error('CRITICAL ERROR:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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
  const requestedTenantContext =
    typeof req.headers['x-tenant-context'] === 'string' && req.headers['x-tenant-context'].trim()
      ? req.headers['x-tenant-context'].trim()
      : null;

  const validate = async (): Promise<boolean> => {
    let decoded: {
      sub?: string;
      role?: string;
      accessRole?: string;
      tenantId?: string | null;
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
    const userTenantId = userContext.tenant_id ?? decoded.tenantId ?? null;
    const userTenantStatus = userContext.tenant_status ?? null;
    const userTenantName = userContext.tenant_name ?? null;
    const globalAdminPath = isGlobalAdminPath(pathname);
    const nonTenantPath = isNonTenantPath(pathname);

    if (accessRole === 'super_admin' && userTenantId) {
      res.status(500).json({ error: 'Super admin must not be linked to a tenant' });
      return false;
    }

    if (accessRole !== 'super_admin' && !userTenantId) {
      res.status(400).json({ error: 'User not linked to tenant' });
      return false;
    }

    if (accessRole !== 'super_admin' && globalAdminPath) {
      res.status(403).json({ error: 'Access denied' });
      return false;
    }

    let resolvedTenantId = userTenantId;
    let resolvedTenantStatus = userTenantStatus;
    let resolvedTenantName = userTenantName;
    let actingAsTenant = false;

    if (accessRole === 'super_admin') {
      if (globalAdminPath || nonTenantPath) {
        if (requestedTenantContext) {
          const requestedTenant = await getTenantContext(requestedTenantContext);
          if (requestedTenant) {
            resolvedTenantId = requestedTenant.id;
            resolvedTenantStatus = requestedTenant.status;
            resolvedTenantName = requestedTenant.name;
            actingAsTenant = true;
          }
        }
      } else {
        if (!requestedTenantContext) {
          res.status(403).json({ error: 'Super admin must explicitly select a tenant context' });
          return false;
        }

        const tenantContext = await getTenantContext(requestedTenantContext);
        if (!tenantContext) {
          res.status(400).json({ error: 'Invalid tenant context' });
          return false;
        }

        if (tenantContext.status.toLowerCase() !== 'active') {
          res.status(403).json({ error: 'Access denied' });
          return false;
        }

        resolvedTenantId = tenantContext.id;
        resolvedTenantStatus = tenantContext.status;
        resolvedTenantName = tenantContext.name;
        actingAsTenant = true;
      }
    } else {
      if (requestedTenantContext && requestedTenantContext !== userTenantId) {
        res.status(403).json({ error: 'Access denied' });
        return false;
      }

      if (resolvedTenantStatus && resolvedTenantStatus.toLowerCase() !== 'active') {
        res.status(403).json({ error: 'Access denied' });
        return false;
      }
    }

    req.user = {
      id: decoded.sub,
      role: userContext.role,
      accessRole,
      tenantId: resolvedTenantId,
      tenantStatus: resolvedTenantStatus,
      tenantName: resolvedTenantName,
      actingAsTenant,
    };
    return true;
  };

  try {
    return await validate();
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    } else {
      res.status(500).json({ error: 'Authentication validation failed' });
    }
    return false;
  }
}

/**
 * Check if user has required role
 */
export function requireRole(req: AuthenticatedRequest, res: VercelResponse, roles: string[]): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  
  if (!roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return false;
  }
  
  return true;
}

export function requireAccessRole(req: AuthenticatedRequest, res: VercelResponse, roles: AccessRole[]): boolean {
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

export function requireTenantContext(req: AuthenticatedRequest, res: VercelResponse): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  if (!req.user.tenantId) {
    res.status(400).json({ error: 'User not linked to tenant' });
    return false;
  }

  if (req.user.tenantStatus && req.user.tenantStatus.toLowerCase() !== 'active') {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }

  return true;
}

/**
 * Extract tenant ID from authenticated request
 */
export function getTenantId(req: VercelRequest): string {
  const tenantId = (req as AuthenticatedRequest).user?.tenantId;
  if (!tenantId) throw new Error('Missing tenant context');
  return tenantId;
}

/**
 * Set security headers
 */
export function setSecurityHeaders(res: VercelResponse): void {
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
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Context');
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
export function apiError(res: VercelResponse, status: number, message: string, details?: any): void {
  console.error('CRITICAL ERROR:', details || message);

  const payload: Record<string, unknown> = { error: message };

  if (details instanceof Error) {
    payload.details = details.message;
    if (process.env.NODE_ENV === 'development') {
      payload.stack = details.stack;
    }
  } else if (details !== undefined) {
    payload.details = typeof details === 'object' ? JSON.stringify(details) : details;
  }

  res.status(status).json(payload);
}
