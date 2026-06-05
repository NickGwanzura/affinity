import React, { useState } from 'react';
import { Download, Calendar, FileText, Loader2 } from 'lucide-react';
import { authFetch } from '../../services/authFetch';
import { generatePeriodReportPDFAndDownload, type PeriodReportData } from '../../services/pdfService';
import { useToast } from '../Toast';
import { dataService } from '../../services/dataService';

type Period = 'daily' | 'weekly' | 'monthly';

const PERIODS: { id: Period; label: string; desc: string }[] = [
  { id: 'daily',   label: 'Today',       desc: 'All income & expenses logged today' },
  { id: 'weekly',  label: 'This Week',   desc: 'Monday through today' },
  { id: 'monthly', label: 'This Month',  desc: 'First of month through today' },
];

export const PeriodReportPanel: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<Period | null>(null);

  const download = async (period: Period) => {
    setLoading(period);
    try {
      const [reportRes, company] = await Promise.all([
        authFetch(`/api/period-report?period=${period}`).then(r => r.json()),
        dataService.getCompanyDetails().catch(() => null),
      ]);

      if (reportRes.error) throw new Error(reportRes.error);

      const data = reportRes as PeriodReportData;
      await generatePeriodReportPDFAndDownload(data, company?.name || 'Affinity Logistics');
      showToast(`${period.charAt(0).toUpperCase() + period.slice(1)} report downloaded`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate report', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
          <FileText size={18} className="text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Income & Expense Reports</h3>
          <p className="text-xs text-zinc-500">Download a PDF snapshot for any period</p>
        </div>
      </div>

      <div className="divide-y divide-stone-100">
        {PERIODS.map(({ id, label, desc }) => (
          <div key={id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Calendar size={15} className="shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-800">{label}</p>
                <p className="text-xs text-zinc-400">{desc}</p>
              </div>
            </div>
            <button
              onClick={() => download(id)}
              disabled={loading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {loading === id ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeriodReportPanel;
