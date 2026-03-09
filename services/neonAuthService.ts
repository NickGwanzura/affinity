/**
 * Neon Auth Service
 * 
 * Uses Neon's managed authentication service.
 * Docs: https://neon.tech/docs/guides/neon-auth
 */

import { AppUser, UserRole, AuthSession } from '../types';

// Neon Auth configuration
const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || 'https://ep-shiny-glitter-ah22khor.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth';
const JWKS_URL = `${NEON_AUTH_URL}/.well-known/jwks.json`;

// Token storage
const TOKEN_KEY = 'neon_auth_token';
const REFRESH_TOKEN_KEY = 'neon_refresh_token';

interface NeonAuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  status?: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: NeonAuthUser;
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ============================================
// API CALLS
// ============================================

async function neonAuthRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${NEON_AUTH_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// AUTH SERVICE
// ============================================

class NeonAuthService {
  
  // ============================================
  // LOGIN
  // ============================================
  
  async login(email: string, password: string): Promise<AuthSession> {
    const data = await neonAuthRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    storeTokens(data.access_token, data.refresh_token);

    return {
      user: {
        id: data.user.id,
        name: data.user.name || data.user.email.split('@')[0],
        email: data.user.email,
        role: (data.user.role || 'Driver') as UserRole,
        status: (data.user.status || 'Active') as 'Active' | 'Inactive',
      },
    };
  }

  // ============================================
  // LOGOUT
  // ============================================
  
  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    
    if (refreshToken) {
      try {
        await neonAuthRequest('/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (error) {
        console.error('[NeonAuth] Logout error:', error);
      }
    }
    
    clearTokens();
  }

  // ============================================
  // SESSION
  // ============================================
  
  async getSession(): Promise<AuthSession | null> {
    const token = getAccessToken();
    if (!token) return null;

    try {
      const data = await neonAuthRequest('/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return {
        user: {
          id: data.id,
          name: data.name || data.email.split('@')[0],
          email: data.email,
          role: (data.role || 'Driver') as UserRole,
          status: (data.status || 'Active') as 'Active' | 'Inactive',
        },
      };
    } catch (error) {
      console.error('[NeonAuth] Session error:', error);
      clearTokens();
      return null;
    }
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================
  
  async refreshSession(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const data = await neonAuthRequest('/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      storeTokens(data.access_token, data.refresh_token);
      return true;
    } catch (error) {
      console.error('[NeonAuth] Refresh error:', error);
      clearTokens();
      return false;
    }
  }

  // ============================================
  // REGISTRATION
  // ============================================
  
  async register(data: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }): Promise<AuthSession> {
    const response = await neonAuthRequest('/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.name,
        metadata: {
          role: data.role,
          status: 'Active',
        },
      }),
    });

    storeTokens(response.access_token, response.refresh_token);

    return {
      user: {
        id: response.user.id,
        name: response.user.name || data.name,
        email: response.user.email,
        role: data.role,
        status: 'Active',
      },
    };
  }

  // ============================================
  // PASSWORD RESET
  // ============================================
  
  async resetPassword(email: string): Promise<void> {
    console.log('[NeonAuth] Requesting password reset for:', email);
    console.log('[NeonAuth] Redirect URL:', `${window.location.origin}/`);
    
    try {
      const response = await neonAuthRequest('/reset-password', {
        method: 'POST',
        body: JSON.stringify({ 
          email,
          redirect_url: `${window.location.origin}/`,
        }),
      });
      console.log('[NeonAuth] Reset password response:', response);
    } catch (error) {
      console.error('[NeonAuth] Reset password error:', error);
      throw error;
    }
  }

  async updatePassword(token: string, newPassword: string): Promise<void> {
    console.log('[NeonAuth] Updating password with token:', token.substring(0, 10) + '...');
    
    await neonAuthRequest('/update-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        newPassword: newPassword,
      }),
    });
  }

  // ============================================
  // USER MANAGEMENT (Admin)
  // ============================================
  
  async getUsers(): Promise<AppUser[]> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const data = await neonAuthRequest('/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return data.users.map((u: NeonAuthUser) => ({
      id: u.id,
      name: u.name || u.email.split('@')[0],
      email: u.email,
      role: (u.role || 'Driver') as UserRole,
      status: (u.status || 'Active') as 'Active' | 'Inactive',
    }));
  }

  async updateUser(userId: string, updates: Partial<AppUser>): Promise<AppUser> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const data = await neonAuthRequest(`/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: updates.name,
        metadata: {
          role: updates.role,
          status: updates.status,
        },
      }),
    });

    return {
      id: data.id,
      name: data.name || data.email.split('@')[0],
      email: data.email,
      role: (data.role || 'Driver') as UserRole,
      status: (data.status || 'Active') as 'Active' | 'Inactive',
    };
  }

  async deleteUser(userId: string): Promise<void> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    await neonAuthRequest(`/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  // ============================================
  // CHANGE PASSWORD
  // ============================================
  
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    await neonAuthRequest('/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }
}

export const neonAuthService = new NeonAuthService();
