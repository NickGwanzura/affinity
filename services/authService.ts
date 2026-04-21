/**
 * Authentication Service - Frontend
 * 
 * Uses API client for all auth operations
 * No direct database access
 */

import { api, getToken, removeToken, setToken } from './apiClient';
import type { AuthSession, AppUser } from '../types';

const USER_CACHE_KEY = 'affinity_user_cache';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
}

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthSession> {
    try {
      const response = await api.auth.login(email, password);
      
      // Store token
      setToken(response.token);
      
      // Cache user data
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(response.user));
      
      return {
        user: response.user as AppUser,
        token: response.token,
        forcePasswordChange: !!response.user.forcePasswordChange,
      };
    } catch (error) {
      removeToken();
      localStorage.removeItem(USER_CACHE_KEY);
      throw error;
    }
  },

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AppUser> {
    const user = await api.auth.register(
      data.name,
      data.email,
      data.password,
      data.role || 'Driver'
    );
    return user as AppUser;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    removeToken();
    localStorage.removeItem(USER_CACHE_KEY);
  },

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    const token = getToken();
    
    if (!token) {
      return null;
    }
    
    try {
      const validatedUser = await api.auth.me();
      const cached = localStorage.getItem(USER_CACHE_KEY);

      let cachedUser: Partial<AppUser> | null = null;
      if (cached) {
        try {
          cachedUser = JSON.parse(cached) as Partial<AppUser>;
        } catch {
          cachedUser = null;
        }
      }

      const user: AppUser = {
        id: validatedUser.id,
        email: validatedUser.email,
        role: validatedUser.role as AppUser['role'],
        accessRole: validatedUser.accessRole,
        name:
          cachedUser?.id === validatedUser.id && typeof cachedUser.name === 'string' && cachedUser.name.trim()
            ? cachedUser.name
            : validatedUser.email.split('@')[0],
        status:
          typeof validatedUser.status === 'string'
            ? (validatedUser.status as AppUser['status'])
            : cachedUser?.id === validatedUser.id && cachedUser.status
            ? cachedUser.status
            : 'Active',
      };

      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      return { user, token, forcePasswordChange: !!validatedUser.forcePasswordChange };
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const apiError = error as Error & { status?: number };
        if (apiError.status === 401 || apiError.status === 403) {
          removeToken();
          localStorage.removeItem(USER_CACHE_KEY);
          return null;
        }
      }

      throw error;
    }
  },

  /**
   * Request password reset
   */
  async resetPassword(email: string): Promise<void> {
    await api.auth.forgotPassword(email);
  },

  /**
   * Reset password with token
   */
  async updatePassword(token: string, newPassword: string): Promise<void> {
    await api.auth.resetPassword(token, newPassword);
  },

  /**
   * Change password (authenticated)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    await api.auth.changePassword(userId, currentPassword, newPassword);
  },

  async createUser(data: RegisterData): Promise<AppUser> {
    return api.users.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role || 'Driver',
      status: 'Active',
    });
  },

  async adminSetUserPassword(userId: string, newPassword: string): Promise<void> {
    await api.users.setPassword(userId, newPassword);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!getToken();
  },
};

export default authService;
