import React, { useState } from 'react';
import { Financials as BillingSection } from '../financials/FinancialsShell';
import { AccountantDashboard as OperationsSection } from '../AccountantDashboard';

type Section = 'billing' | 'operations';

interface FinanceShellProps {
  initialSection?: Section;
}

export function FinanceShell({ initialSection = 'billing' }: FinanceShellProps) {
  const [section, setSection] = useState<Section>(initialSection);

  return (
    <div>
      <div className="mb-4 flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setSection('billing')}
          className={[
            'px-5 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            section === 'billing'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
          ].join(' ')}
        >
          Billing
        </button>
        <button
          onClick={() => setSection('operations')}
          className={[
            'px-5 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            section === 'operations'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
          ].join(' ')}
        >
          Operations
        </button>
      </div>

      {section === 'billing' ? <BillingSection /> : <OperationsSection />}
    </div>
  );
}
