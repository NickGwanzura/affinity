/**
 * Shared date-range utilities for API routes.
 */

export interface DateRange {
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
  label: string;  // human-readable description
}

/**
 * Compute a date range for the given period, anchored at an optional date.
 *
 * @param period  'daily' | 'weekly' | 'monthly'
 * @param anchor  Optional date string (YYYY-MM-DD); defaults to today.
 */
export function dateRange(period: string, anchor?: string): DateRange {
  const base = anchor ? new Date(anchor) : new Date();
  base.setHours(12, 0, 0, 0); // avoid TZ edge cases

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (period === 'daily') {
    const d = fmt(base);
    return { from: d, to: d, label: `Daily · ${d}` };
  }

  if (period === 'weekly') {
    const day = base.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day); // back to Monday
    const mon = new Date(base);
    mon.setDate(base.getDate() + diff);
    return { from: fmt(mon), to: fmt(base), label: `Weekly · ${fmt(mon)} – ${fmt(base)}` };
  }

  // monthly
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  return {
    from: fmt(from),
    to:   fmt(base),
    label: `Monthly · ${from.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
  };
}

/** Shortcut: returns the current month range without creating a DateRange object. */
export function currentMonthRange(): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  return { from: monthStart, to: today };
}
