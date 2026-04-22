import React from 'react';
import { DataTableWrapper, type DataTableColumn } from '../ui';

export type FinancialsColumn<T> = DataTableColumn<T>;

export interface FinancialsTableProps<T extends { id: string }> {
  rows: T[];
  columns: FinancialsColumn<T>[];
  emptyMessage?: string;
  /** Turn off the search input if needed. */
  search?: boolean;
}

/**
 * Thin wrapper around `DataTableWrapper` used by every Financials section.
 *
 * Keeping the wrapper (rather than calling DataTableWrapper directly) lets us
 * tune shared defaults (search on, consistent empty-state copy) in one place
 * and keeps section components narrower.
 */
export function FinancialsTable<T extends { id: string }>({
  rows,
  columns,
  emptyMessage = 'No records found',
  search = true,
}: FinancialsTableProps<T>) {
  return (
    <DataTableWrapper
      rows={rows}
      columns={columns}
      search={search}
      emptyMessage={emptyMessage}
    />
  );
}
