import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '../../ui';

interface StatementsSectionProps {
  selectedClient: string;
  statementDateFrom: string;
  statementDateTo: string;
  clientOptions: { id: string; name: string }[];
  onClientChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
}

export const StatementsSection: React.FC<StatementsSectionProps> = ({
  selectedClient,
  statementDateFrom,
  statementDateTo,
  clientOptions,
  onClientChange,
  onDateFromChange,
  onDateToChange,
  onGenerate,
  onClear,
}) => {
  const panelStyle: React.CSSProperties = {
    backgroundColor: 'var(--cds-layer-01, #ffffff)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--cds-border-subtle, #d6d3d1)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--cds-text-secondary, #52525b)',
  };

  return (
    <div className="p-8">
      <div className="max-w-xl mx-auto text-center p-8" style={panelStyle}>
        <BarChart3 size={48} className="mx-auto text-blue-600 mb-3" />
        <h3
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--cds-text-primary, #18181b)' }}
        >
          Client Statements
        </h3>
        <p className="text-sm mb-6" style={labelStyle}>
          Generate a branded statement for a client using their invoices and matching payments,
          optionally filtered by date range.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-6">
          <div className="md:col-span-2">
            <label htmlFor="statement-client" className="block text-xs mb-1" style={labelStyle}>
              Client
            </label>
            <select
              id="statement-client"
              value={selectedClient}
              onChange={e => onClientChange(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a client</option>
              {clientOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="statement-from" className="block text-xs mb-1" style={labelStyle}>
              From Date
            </label>
            <input
              id="statement-from"
              type="date"
              value={statementDateFrom}
              onChange={e => onDateFromChange(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="statement-to" className="block text-xs mb-1" style={labelStyle}>
              To Date
            </label>
            <input
              id="statement-to"
              type="date"
              value={statementDateTo}
              onChange={e => onDateToChange(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <Button onClick={onGenerate} disabled={!selectedClient}>
            Generate Statement
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={!selectedClient}>
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
};
