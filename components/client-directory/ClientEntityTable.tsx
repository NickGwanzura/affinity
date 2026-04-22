import React from 'react';
import { DataTableWrapper } from '../ui';
import type { DataTableColumn } from '../ui';

interface ClientEntityTableProps<T extends { id: string }> {
  title?: string;
  description?: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  emptyMessage: string;
}

export function ClientEntityTable<T extends { id: string }>({
  title,
  description,
  rows,
  columns,
  emptyMessage,
}: ClientEntityTableProps<T>) {
  return (
    <DataTableWrapper
      title={title}
      description={description}
      rows={rows}
      columns={columns}
      emptyMessage={emptyMessage}
      search={false}
      size="sm"
      isSortable
    />
  );
}

export default ClientEntityTable;
