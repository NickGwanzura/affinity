import React from 'react';
import { Tag, Tile } from '@carbon/react';

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

const toneMap: Record<Tone, { bar: string; tag: React.ComponentProps<typeof Tag>['type'] }> = {
  blue: { bar: 'var(--cds-support-info, #0f62fe)', tag: 'blue' },
  green: { bar: 'var(--cds-support-success, #24a148)', tag: 'green' },
  red: { bar: 'var(--cds-support-error, #da1e28)', tag: 'red' },
  amber: { bar: 'var(--cds-support-warning, #f1c21b)', tag: 'warm-gray' },
  purple: { bar: '#8a3ffc', tag: 'purple' },
  teal: { bar: 'var(--cds-support-success, #24a148)', tag: 'teal' },
  gray: { bar: 'var(--cds-border-subtle, #c6c6c6)', tag: 'gray' },
};

export const InsightPanel: React.FC<InsightPanelProps> = ({ title, subtitle, action, children }) => (
  <Tile style={{ padding: '1.25rem', minHeight: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{title}</h3>
        {subtitle && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--cds-text-secondary, #525252)' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
    {children}
  </Tile>
);

export const MetricBarList: React.FC<{ items: MetricBarItem[]; emptyMessage?: string }> = ({
  items,
  emptyMessage = 'No data available.',
}) => {
  if (!items.length) {
    return <p style={{ margin: 0, color: 'var(--cds-text-secondary, #525252)', fontSize: '0.875rem' }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {items.map((item) => {
        const tone = toneMap[item.tone || 'blue'];
        const percent = Math.max(0, Math.min(100, item.percent || 0));

        return (
          <div key={`${item.label}-${item.value}`} style={{ display: 'grid', gap: '0.375rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{item.label}</span>
                {item.tagLabel && <Tag type={tone.tag}>{item.tagLabel}</Tag>}
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{item.value}</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--cds-layer-accent-01, #e8e8e8)' }}>
              <div style={{ width: `${percent}%`, height: '100%', background: tone.bar }} />
            </div>
            {item.helper && (
              <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)' }}>{item.helper}</span>
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
    return <p style={{ margin: 0, color: 'var(--cds-text-secondary, #525252)', fontSize: '0.875rem' }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {items.map((item, index) => {
        const tone = toneMap[item.tone || 'blue'];

        return (
          <div
            key={`${item.label}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '2rem 1fr auto',
              gap: '0.75rem',
              alignItems: 'center',
              padding: '0.875rem',
              background: 'var(--cds-layer-hover, #f4f4f4)',
            }}
          >
            <div
              style={{
                width: '2rem',
                height: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tone.bar,
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {index + 1}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{item.label}</div>
              {item.helper && <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)' }}>{item.helper}</div>}
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)', textAlign: 'right' }}>{item.value}</div>
          </div>
        );
      })}
    </div>
  );
};
