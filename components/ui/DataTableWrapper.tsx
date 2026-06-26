import React, { useState, useMemo, useCallback } from 'react';
import { Trash2, Pencil, Plus, Search, X, ChevronUp, ChevronDown, Inbox, ChevronsUpDown, Download } from 'lucide-react';
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
  csvExport?: boolean;
  csvFilename?: string;
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
  csvExport = false,
  csvFilename = 'export.csv',
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

  const colCount = columns.length + (batchActions ? 1 : 0) + (onEdit || onDelete ? 1 : 0);
  const isSearching = searchQuery.trim().length > 0;

  const handleCsvExport = useCallback(() => {
    // Build CSV from the currently displayed (filtered+sorted) rows
    const headers = columns.map((c) => c.header);
    const body = filteredRows.map((row) =>
      columns.map((col) => {
        const val = col.render ? stripHtml(col.render(row) as string) : row[col.key];
        const str = val == null ? '' : String(val);
        // Escape quotes and wrap in quotes to handle commas
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [headers.join(','), ...body].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, columns, csvFilename]);

  function stripHtml(html: string): string {
    if (!html || typeof html !== 'string') return html;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      {(title || description || search || batchActions || onAdd) && (
        <div className="px-4 py-3 sm:px-5 border-b border-stone-200 flex flex-wrap items-center gap-x-3 gap-y-2.5">
          {(title || description) && (
            <div className="flex-1 min-w-0 basis-full sm:basis-auto">
              {title && <h3 className="text-base font-semibold text-zinc-900 truncate">{title}</h3>}
              {description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{description}</p>}
            </div>
          )}

          {batchActions && hasSelection && (
            <div className="flex items-center gap-2 order-3 sm:order-none w-full sm:w-auto">
              <span className="text-sm text-zinc-600 tabular-nums">
                <span className="font-semibold text-zinc-900">{selectedIds.size}</span> selected
              </span>
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

          <div className="flex items-center gap-2 ml-auto order-2 sm:order-none">
            {search && (
              <div className="relative flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm border border-stone-300 rounded-md bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#D97706]/30 focus:border-[#D97706] w-full sm:w-56 transition-shadow"
                />
                {isSearching && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-stone-100 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/40"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {onAdd && (
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>
                Add
              </Button>
            )}
            {csvExport && filteredRows.length > 0 && (
              <IconButton
                icon={<Download size={14} />}
                size="sm"
                variant="ghost"
                label="Download CSV"
                onClick={handleCsvExport}
              />
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left table-card-mobile">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200">
              {batchActions && (
                <th className={`${cellPadding} w-10`}>
                  <input
                    type="checkbox"
                    aria-label={selectedIds.size === filteredRows.length && filteredRows.length > 0 ? 'Deselect all rows' : 'Select all rows'}
                    className="h-4 w-4 rounded border-stone-300 text-[#D97706] focus:ring-[#D97706]/30"
                    checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSortedCol = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isSortable && isSortedCol
                        ? sortDir === 'asc' ? 'ascending' : 'descending'
                        : undefined
                    }
                    className={`${cellPadding} font-semibold text-[11px] uppercase tracking-[0.08em] text-zinc-600 transition-colors ${
                      isSortable ? 'cursor-pointer select-none hover:bg-stone-100/70 hover:text-zinc-900' : ''
                    }`}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="whitespace-nowrap">{col.header}</span>
                      {isSortable && (
                        isSortedCol ? (
                          sortDir === 'asc'
                            ? <ChevronUp size={14} className="text-[#D97706]" aria-hidden="true" />
                            : <ChevronDown size={14} className="text-[#D97706]" aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown size={14} className="text-zinc-300 group-hover:text-zinc-400" aria-hidden="true" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
              {(onEdit || onDelete) && (
                <th
                  scope="col"
                  className={`${cellPadding} font-semibold text-[11px] uppercase tracking-[0.08em] text-zinc-600 text-right`}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-12 sm:py-16 text-center"
                >
                  <div className="app-fade-in flex flex-col items-center justify-center gap-3 text-zinc-500">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-zinc-400 ring-1 ring-stone-200/80"
                    >
                      {isSearching ? <Search size={20} /> : <Inbox size={20} />}
                    </span>
                    <p className="text-sm font-medium text-zinc-700">
                      {isSearching ? 'No matches found' : emptyMessage}
                    </p>
                    {isSearching && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-medium text-[#D97706] hover:text-[#B45309] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/40 rounded px-1"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`group transition-colors duration-100 ${
                      isSelected ? 'bg-[#D97706]/[0.04] hover:bg-[#D97706]/[0.06]' : 'hover:bg-stone-50'
                    }`}
                  >
                    {batchActions && (
                      <td className={cellPadding}>
                        <input
                          type="checkbox"
                          aria-label={`Select row ${row.id}`}
                          className="h-4 w-4 rounded border-stone-300 text-[#D97706] focus:ring-[#D97706]/30"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`${cellPadding} text-zinc-800`} data-label={col.header}>
                        {col.render?.(row) ?? row[col.key]}
                      </td>
                    ))}
                    {(onEdit || onDelete) && (
                      <td className={cellPadding}>
                        <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTableWrapper;
