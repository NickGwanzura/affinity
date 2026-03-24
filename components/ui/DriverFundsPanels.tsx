import React from 'react';
import type { DriverFundsReportData, DriverFundSummary } from '../../utils/driverFunds';
import { InsightPanel, MetricBarList, RankedMetricList } from './AnalyticsPanels';

interface DriverFundsSummaryPanelProps {
  report: DriverFundsReportData;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
  helperFormatter?: (summary: DriverFundSummary, formatValue: (value: number) => string) => string;
}

interface DriverFundsSnapshotPanelProps {
  report: DriverFundsReportData;
  title?: string;
  subtitle?: string;
  allocatedLabel?: string;
  spentLabel?: string;
  balanceLabel?: string;
  allocatedHelper?: string;
  spentHelper?: string;
  balanceHelper?: string;
  formatValue?: (value: number) => string;
}

const defaultFormatValue = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const DriverFundsSummaryPanel: React.FC<DriverFundsSummaryPanelProps> = ({
  report,
  title = 'Allocated Funds To Drivers',
  subtitle = 'See what was allocated, what has already been spent, and what remains available by driver.',
  action,
  emptyMessage = 'No driver-specific disbursements found.',
  formatValue = defaultFormatValue,
  helperFormatter = (summary, format) =>
    `${format(summary.allocatedUsd)} allocated • ${format(summary.spentUsd)} spent`,
}) => (
  <InsightPanel title={title} subtitle={subtitle} action={action}>
    <RankedMetricList
      items={report.summaries.slice(0, 8).map((summary) => ({
        label: summary.driverName,
        value: formatValue(summary.balanceUsd),
        helper: helperFormatter(summary, formatValue),
        tone: summary.balanceUsd >= 0 ? 'blue' : 'red',
      }))}
      emptyMessage={emptyMessage}
    />
  </InsightPanel>
);

export const DriverFundsSnapshotPanel: React.FC<DriverFundsSnapshotPanelProps> = ({
  report,
  title = 'Driver Funds Snapshot',
  subtitle = 'Carbon-style operational view of the disbursement cycle.',
  allocatedLabel = 'Allocated to drivers',
  spentLabel = 'Spent by drivers',
  balanceLabel = 'Remaining balance',
  allocatedHelper,
  spentHelper = 'Spend entries logged against driver funds',
  balanceHelper = 'Outstanding drawdown capacity still in the field',
  formatValue = defaultFormatValue,
}) => (
  <InsightPanel title={title} subtitle={subtitle}>
    <MetricBarList
      items={[
        {
          label: allocatedLabel,
          value: formatValue(report.totals.allocatedUsd),
          helper: allocatedHelper || `${report.totals.fundedDrivers} funded drivers`,
          percent: report.totals.allocatedUsd > 0 ? 100 : 0,
          tone: 'blue',
        },
        {
          label: spentLabel,
          value: formatValue(report.totals.spentUsd),
          helper: spentHelper.replace('{count}', String(report.spendRows.length)),
          percent: report.totals.allocatedUsd > 0
            ? (report.totals.spentUsd / report.totals.allocatedUsd) * 100
            : 0,
          tone: 'teal',
        },
        {
          label: balanceLabel,
          value: formatValue(report.totals.balanceUsd),
          helper: balanceHelper,
          percent: report.totals.allocatedUsd > 0
            ? (report.totals.balanceUsd / report.totals.allocatedUsd) * 100
            : 0,
          tone: report.totals.balanceUsd >= 0 ? 'green' : 'red',
        },
      ]}
    />
  </InsightPanel>
);
