import React from 'react';
import { Receipt } from 'lucide-react';
import { MyFundsWidget } from './shared/MyFundsWidget';
import { useSession } from '../contexts/SessionContext';

const DISBURSE_ROLES = ['Admin', 'Manager', 'Director'];

export const MyExpensesView: React.FC = () => {
  const session = useSession();
  const role = session?.user?.role ?? '';
  const canDisburse = DISBURSE_ROLES.includes(role);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Receipt size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">My Expenses</h1>
          <p className="text-sm text-zinc-500">
            {canDisburse
              ? 'Log your expenses and disburse funds to team members.'
              : 'Log how you spent any funds disbursed to you. Every entry is recorded in the audit trail.'}
          </p>
        </div>
      </div>

      <MyFundsWidget canDisburse={canDisburse} />
    </div>
  );
};

export default MyExpensesView;
