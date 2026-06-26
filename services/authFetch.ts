import { getToken } from './apiClient';

/**
 * @deprecated Use `api.request()` or the typed api.* methods from `./apiClient` instead.
 *
 * This function is kept for backward compatibility during migration.
 * New code should import `api` from `./apiClient` and call `api.get(path)` or
 * use the typed module methods (api.vehicles.list(), api.carHire.vehicles(), etc.).
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
