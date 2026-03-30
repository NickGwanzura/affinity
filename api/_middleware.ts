/* global process */

/**
 * API Middleware - Authentication & Security
 * 
 * Server-side JWT validation and security headers
 * This runs on Vercel's edge/serverless environment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string | null {
  return process.env.JWT_SECRET || null;
}

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Verify JWT token from Authorization header
 */
export function verifyToken(req: AuthenticatedRequest, res: VercelResponse): boolean {
  const authHeader = req.headers.authorization;
  const secret = getJwtSecret();

  if (!secret) {
    res.status(500).json({ error: 'Server authentication misconfigured (missing JWT_SECRET)' });
    return false;
  }
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return false;
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, secret) as { sub?: string; role?: string };
    if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
      res.status(401).json({ error: 'Invalid or expired token' });
      return false;
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };
    return true;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
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

/**
 * Set security headers
 */
export function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
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
export function apiError(res: VercelResponse, status: number, message: string, details?: any): void {
  console.error(`[API Error ${status}]`, message, details);
  res.status(status).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && details ? { details } : {})
  });
}
