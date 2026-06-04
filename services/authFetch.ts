import { getToken } from './apiClient';

/**
 * Authenticated fetch — injects Authorization: Bearer token from localStorage.
 * Drop-in replacement for `fetch()` for all internal API calls.
 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}
