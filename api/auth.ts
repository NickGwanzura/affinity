/* global process */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  verifyToken,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { checkRateLimit } from './_db.js';
import { logAuditEvent } from './_audit.js';
import {
  authenticateUser,
  changePassword,
  createPasswordResetRequest,
  resetPassword,
  getUserById,
} from './_auth.js';
import { isEmailTransportConfigured, sendPasswordResetEmail } from './_email.tsx';
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
} from './_schemas.js';

const normaliseAccessRole = (raw: unknown, role: string): 'super_admin' | 'admin' | 'user' => {
  if (raw === 'super_admin' || raw === 'admin' || raw === 'user') {
    return raw;
  }
  return role === 'Admin' ? 'admin' : 'user';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        if (req.query.action === 'me') {
          return await me(req, res);
        }
        return apiError(res, 405, 'Method not allowed');

      case 'POST': {
        const { action } = req.query;

        switch (action) {
          case 'login':
            return await login(req, res);
          case 'register':
            return await register(req, res);
          case 'change-password':
            return await changePasswordHandler(req, res);
          case 'forgot-password':
            return await forgotPassword(req, res);
          case 'reset-password':
            return await resetPasswordHandler(req, res);
          default:
            return apiError(res, 400, 'Invalid action');
        }
      }

      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

async function login(req: VercelRequest, res: VercelResponse) {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  try {
    const { email, password } = LoginSchema.parse(req.body);

    if (!checkRateLimit(`login:${clientIp}`, 5, 60000)) {
      return apiError(res, 429, 'Too many login attempts. Please try again later.');
    }

    const result = await authenticateUser(email, password);

    if (result.success === false) {
      const failure = result;
      await logAuditEvent({
        req,
        action: 'auth.login.failed',
        tableName: 'user_profiles',
        newData: {
          email: email.toLowerCase(),
          reason: failure.reason,
        },
      });

      if (failure.reason === 'ACCOUNT_PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Account pending approval',
        });
      }

      if (failure.reason === 'ACCOUNT_INACTIVE') {
        return apiError(res, 403, failure.message);
      }

      return apiError(res, 401, failure.message);
    }

    await logAuditEvent({
      req,
      userId: result.user.id,
      action: 'auth.login.succeeded',
      tableName: 'user_profiles',
      recordId: result.user.id,
      newData: {
        email: result.user.email,
        role: result.user.role,
      },
    });

    res.status(200).json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message.includes('JWT_SECRET') ? 500 : 400;
      return apiError(res, status, error.message);
    }
    apiError(res, 400, 'Invalid login data', error);
  }
}

async function register(req: VercelRequest, res: VercelResponse) {
  // Registration is intentionally blocked in production hardening mode.
  RegisterSchema.safeParse(req.body);
  return apiError(res, 403, 'Registration disabled');
}

async function changePasswordHandler(req: VercelRequest, res: VercelResponse) {
  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    const { userId, currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);

    if (!authReq.user) {
      return apiError(res, 401, 'Unauthorized');
    }

    if (userId && userId !== authReq.user.id) {
      return apiError(res, 403, "Cannot change another user's password");
    }

    await changePassword(authReq.user.id, currentPassword, newPassword);

    await logAuditEvent({
      req,
      userId: authReq.user.id,
      action: 'auth.password.changed',
      tableName: 'user_profiles',
      recordId: authReq.user.id,
    });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      return apiError(res, 400, error.message);
    }
    apiError(res, 500, 'Failed to change password', error);
  }
}

async function forgotPassword(req: VercelRequest, res: VercelResponse) {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);

    // Rate limiting
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!checkRateLimit(`forgot:${clientIp}`, 3, 3600000)) {
      return apiError(res, 429, 'Too many requests. Please try again later.');
    }

    const transportConfigured = isEmailTransportConfigured();
    if (!transportConfigured && process.env.NODE_ENV !== 'development') {
      return apiError(res, 503, 'Password reset email service unavailable');
    }

    const resetRequest = await createPasswordResetRequest(email);

    await logAuditEvent({
      req,
      userId: resetRequest?.user.id || null,
      action: 'auth.password_reset.requested',
      tableName: 'password_resets',
      newData: { email: email.toLowerCase(), userId: resetRequest?.user.id || null },
    });

    if (resetRequest && transportConfigured) {
      await sendPasswordResetEmail({
        to: resetRequest.user.email,
        name: resetRequest.user.name,
        token: resetRequest.token,
      });
    }

    if (process.env.NODE_ENV === 'development' && resetRequest?.token) {
      res.status(200).json({
        message: 'If an account exists, a reset email has been sent',
        dev_token: resetRequest.token,
      });
    } else {
      res.status(200).json({
        message: 'If an account exists, a reset email has been sent',
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      return apiError(res, 400, error.message);
    }
    apiError(res, 500, 'Failed to process request', error);
  }
}

async function resetPasswordHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const { token, newPassword } = ResetPasswordSchema.parse(req.body);

    await resetPassword(token, newPassword);

    await logAuditEvent({
      req,
      action: 'auth.password_reset.completed',
      tableName: 'password_resets',
      newData: { token },
    });

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof Error) {
      return apiError(res, 400, error.message);
    }
    apiError(res, 500, 'Failed to reset password', error);
  }
}

async function me(req: VercelRequest, res: VercelResponse) {
  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    if (!authReq.user) {
      return apiError(res, 401, 'Unauthorized');
    }

    const user = await getUserById(authReq.user.id);
    const normalisedStatus = String(user?.status || '').toLowerCase();
    const isApprovedStatus = normalisedStatus === 'active' || normalisedStatus === 'approved';
    if (!user || !isApprovedStatus) {
      return apiError(res, 401, 'Invalid or expired token');
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      accessRole: normaliseAccessRole((user as any).access_role, user.role),
      forcePasswordChange: !!user.force_password_change,
    });
  } catch (error) {
    return apiError(res, 500, 'Failed to load session', error);
  }
}
