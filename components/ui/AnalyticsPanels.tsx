import React from 'react';

type Tone = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'teal' | 'gray';

interface InsightPanelProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

interface MetricBarItem {
  label: string;
  value: string;
  helper?: string;
  percent?: number;
  tone?: Tone;
  tagLabel?: string;
}

interface RankedMetricItem {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}

const toneMap: Record<Tone, { bar: string; tagClasses: string }> = {
  blue:   { bar: '#2563eb', tagClasses: 'bg-blue-100 text-blue-800' },
  green:  { bar: '#16a34a', tagClasses: 'bg-green-100 text-green-800' },
  red:    { bar: '#dc2626', tagClasses: 'bg-red-100 text-red-800' },
  amber:  { bar: '#f59e0b', tagClasses: 'bg-amber-100 text-amber-800' },
  purple: { bar: '#7c3aed', tagClasses: 'bg-purple-100 text-purple-800' },
  teal:   { bar: '#14b8a6', tagClasses: 'bg-teal-100 text-teal-800' },
  gray:   { bar: '#d1d5db', tagClasses: 'bg-zinc-100 text-zinc-700' },
};

export const InsightPanel: React.FC<InsightPanelProps> = ({ title, subtitle, action, children }) => (
  <div className="bg-white border border-zinc-200 p-5 min-h-full">
    <div className="flex justify-between items-start gap-4 mb-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 m-0">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
    {children}
  </div>
);

export const MetricBarList: React.FC<{ items: MetricBarItem[]; emptyMessage?: string }> = ({
  items,
  emptyMessage = 'No data available.',
}) => {
  if (!items.length) {
    return <p className="m-0 text-zinc-500 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => {
        const tone = toneMap[item.tone || 'blue'];
        const percent = Math.max(0, Math.min(100, item.percent || 0));

        return (
          <div key={`${item.label}-${item.value}`} className="grid gap-1.5">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-zinc-900">{item.label}</span>
                {item.tagLabel && <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${tone.tagClasses}`}>{item.tagLabel}</span>}
              </div>
              <span className="text-sm font-semibold text-zinc-900">{item.value}</span>
            </div>
            <div className="w-full h-2 bg-zinc-100">
              <div className="h-full transition-all" style={{ width: `${percent}%`, background: tone.bar }} />
            </div>
            {item.helper && (
              <span className="text-xs text-zinc-500">{item.helper}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const RankedMetricList: React.FC<{ items: RankedMetricItem[]; emptyMessage?: string }> = ({
  items,
  emptyMessage = 'No ranked data available.',
}) => {
  if (!items.length) {
    return <p className="m-0 text-zinc-500 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const tone = toneMap[item.tone || 'blue'];

        return (
          <div
            key={`${item.label}-${index}`}
            className="grid items-center gap-3 p-3.5 bg-zinc-50"
            style={{ gridTemplateColumns: '2rem 1fr auto' }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold"
              style={{ background: tone.bar }}
            >
              {index + 1}
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">{item.label}</div>
              {item.helper && <div className="text-xs text-zinc-500">{item.helper}</div>}
            </div>
            <div className="text-sm font-semibold text-zinc-900 text-right">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
};
