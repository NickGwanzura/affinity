import React from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableBatchActions,
  TableBatchAction,
  Button,
} from '@carbon/react';
import { TrashCan, Edit, Add } from '@carbon/icons-react';

export interface DataTableColumn<T = any> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableWrapperProps<T = any> {
  title?: string;
  description?: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  batchActions?: boolean;
  search?: boolean;
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onBatchDelete?: (selectedRows: T[]) => void;
  emptyMessage?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isSortable?: boolean;
}

export function DataTableWrapper<T extends { id: string }>({
  title,
  description,
  rows,
  columns,
  batchActions = false,
  search = true,
  onAdd,
  onEdit,
  onDelete,
  onBatchDelete,
  emptyMessage = 'No data available',
  size = 'md',
  isSortable = true,
}: DataTableWrapperProps<T>) {
  const headers = columns.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }));

  return (
    <DataTable
      rows={rows}
      headers={headers}
      isSortable={isSortable}
      render={({
        rows,
        headers,
        getHeaderProps,
        getRowProps,
        getSelectionProps,
        getToolbarProps,
        getBatchActionProps,
        onInputChange,
        selectedRows,
      }) => (
        <TableContainer
          title={title}
          description={description}
          style={{
            background: 'var(--cds-layer-01, #ffffff)',
            border: '1px solid var(--cds-border-subtle, #e0e0e0)',
          }}
        >
          {(search || batchActions || onAdd) && (
            <TableToolbar {...getToolbarProps()}>
              {batchActions && (
                <TableBatchActions {...getBatchActionProps()}>
                  <TableBatchAction
                    tabIndex={getBatchActionProps().shouldShowBatchActions ? 0 : -1}
                    renderIcon={TrashCan}
                    onClick={() => onBatchDelete?.(selectedRows.map((r) => rows.find((row: any) => row.id === r.id)!))}
                  >
                    Delete
                  </TableBatchAction>
                </TableBatchActions>
              )}
              <TableToolbarContent>
                {search && (
                  <TableToolbarSearch
                    persistent
                    tabIndex={getBatchActionProps().shouldShowBatchActions ? -1 : 0}
                    onChange={onInputChange}
                  />
                )}
                {onAdd && (
                  <Button
                    tabIndex={getBatchActionProps().shouldShowBatchActions ? -1 : 0}
                    onClick={onAdd}
                    renderIcon={Add}
                    size="sm"
                  >
                    Add
                  </Button>
                )}
              </TableToolbarContent>
            </TableToolbar>
          )}
          <Table size={size}>
            <TableHead>
              <TableRow>
                {batchActions && <TableHeader {...getSelectionProps()} />}
                {headers.map((header: any) => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key} style={{ width: header.width }}>
                    {header.header}
                  </TableHeader>
                ))}
                {(onEdit || onDelete) && <TableHeader>Actions</TableHeader>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length + (batchActions ? 2 : 1)} style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--cds-text-secondary, #525252)' }}>{emptyMessage}</p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {batchActions && <TableCell><input type="checkbox" {...getSelectionProps({ row })} /></TableCell>}
                    {headers.map((header: any) => (
                      <TableCell key={header.key}>
                        {columns.find((c) => c.key === header.key)?.render?.(row) ?? row[header.key]}
                      </TableCell>
                    ))}
                    {(onEdit || onDelete) && (
                      <TableCell>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {onEdit && (
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={Edit}
                              iconDescription="Edit"
                              onClick={() => onEdit(row)}
                              hasIconOnly
                            />
                          )}
                          {onDelete && (
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={TrashCan}
                              iconDescription="Delete"
                              onClick={() => onDelete(row)}
                              hasIconOnly
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    />
  );
}

export default DataTableWrapper;
