import React from 'react';
import { Receipt } from 'lucide-react';
import { MyFundsWidget } from './shared/MyFundsWidget';

export const MyExpensesView: React.FC = () => {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Receipt size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">My Expenses</h1>
          <p className="text-sm text-zinc-500">Log expenses against funds disbursed to you. Every entry is recorded in the audit trail.</p>
        </div>
      </div>

      <MyFundsWidget />
    </div>
  );
};

export default MyExpensesView;
