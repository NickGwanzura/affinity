import React, { useState, useMemo } from 'react';
import { Trash2, Pencil, Plus, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Button, IconButton } from './Button';

export interface DataTableColumn<T = any> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableWrapperProps<T extends { id: string } = any> {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const cellPadding = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-base',
    xl: 'px-6 py-5 text-base',
  }[size];

  const filteredRows = useMemo(() => {
    let data = [...rows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter((row) =>
        columns.some((col) => {
          const val = row[col.key];
          if (val == null) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }
    if (sortKey && isSortable) {
      data.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDir === 'asc' ? -1 : 1;
        if (bVal == null) return sortDir === 'asc' ? 1 : -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDir === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return data;
  }, [rows, searchQuery, sortKey, sortDir, columns, isSortable]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (key: string) => {
    if (!isSortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const selectedRowsData = useMemo(
    () => filteredRows.filter((r) => selectedIds.has(r.id)),
    [filteredRows, selectedIds]
  );

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="bg-white border border-gray-200">
      {/* Toolbar */}
      {(title || description || search || batchActions || onAdd) && (
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>

          {batchActions && hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={() => {
                  onBatchDelete?.(selectedRowsData);
                  setSelectedIds(new Set());
                }}
              >
                Delete
              </Button>
              <IconButton
                icon={<X size={14} />}
                size="sm"
                label="Clear selection"
                onClick={() => setSelectedIds(new Set())}
              />
            </div>
          )}

          {search && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 h-9 text-sm border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
              />
            </div>
          )}

          {onAdd && (
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>
              Add
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {batchActions && (
                <th className={`${cellPadding} w-10`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${cellPadding} font-semibold text-xs uppercase tracking-wider text-gray-600 ${isSortable ? 'cursor-pointer select-none' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {isSortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && <th className={cellPadding}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (batchActions ? 1 : 0) + (onEdit || onDelete ? 1 : 0)}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {batchActions && (
                    <td className={cellPadding}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelectRow(row.id)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cellPadding}>
                      {col.render?.(row) ?? row[col.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className={cellPadding}>
                      <div className="flex gap-2">
                        {onEdit && (
                          <IconButton
                            icon={<Pencil size={14} />}
                            size="sm"
                            variant="ghost"
                            label="Edit"
                            onClick={() => onEdit(row)}
                          />
                        )}
                        {onDelete && (
                          <IconButton
                            icon={<Trash2 size={14} />}
                            size="sm"
                            variant="ghost"
                            label="Delete"
                            onClick={() => onDelete(row)}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTableWrapper;
