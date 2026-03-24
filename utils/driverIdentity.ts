import type { AppUser } from '../types';

export const normalizeDriverIdentity = (value?: string | null) => (value || '').trim().toLowerCase();

const getEmailHandle = (email?: string | null) => {
  const trimmed = (email || '').trim();
  if (!trimmed) return '';
  return trimmed.split('@')[0]?.trim() || '';
};

export function getDriverIdentityAliases(user?: Partial<Pick<AppUser, 'name' | 'email'>> | null): string[] {
  const values = [user?.name, user?.email, getEmailHandle(user?.email)];
  const seen = new Set<string>();

  return values
    .map((value) => (value || '').trim())
    .filter((value) => {
      const normalized = normalizeDriverIdentity(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function createDriverIdentityNameMap(drivers: AppUser[] = []): Map<string, string> {
  const aliases = new Map<string, string>();

  drivers
    .filter((driver) => driver.role === 'Driver')
    .forEach((driver) => {
      const canonicalName = driver.name.trim();
      getDriverIdentityAliases(driver).forEach((alias) => {
        aliases.set(normalizeDriverIdentity(alias), canonicalName);
      });
    });

  return aliases;
}
