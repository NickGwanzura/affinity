import React, { useEffect, useState } from 'react';
import { Employee, Payslip, CompanyDetails } from '../../types';
import { dataService } from '../../services/dataService';
import { generatePayslipPDFAndDownload } from '../../services/pdfService';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import PayslipFormModal, { createEmptyPayslipForm, type PayslipFormValue } from '../shared/PayslipFormModal';

export const PayslipsTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState<PayslipFormValue>(createEmptyPayslipForm());

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');
  const handlePayslipFormChange = (updates: Partial<PayslipFormValue>) => {
    setPayslipForm((prev) => ({ ...prev, ...updates }));
  };

  const fetchData = async () => {
    try {
      const [payslipData, employeeData, companyData] = await Promise.all([
        dataService.getPayslips(),
        dataService.getEmployees(),
        dataService.getCompanyDetails(),
      ]);
      setPayslips(payslipData);
      setEmployees(employeeData);
      setCompany(companyData);
    } catch (err) {
      console.error('[PayslipsTab] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openGenerateModal = () => {
    setPayslipForm(createEmptyPayslipForm());
    setShowPayslipModal(true);
  };

  const handleGeneratePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        employee_id: payslipForm.employee_id,
        month: payslipForm.month,
        year: payslipForm.year,
        base_pay: parseFloat(payslipForm.base_pay) || 0,
        overtime_hours: parseFloat(payslipForm.overtime_hours) || 0,
        overtime_rate: parseFloat(payslipForm.overtime_rate) || 0,
        bonus: parseFloat(payslipForm.bonus) || 0,
        allowances: parseFloat(payslipForm.allowances) || 0,
        commission: parseFloat(payslipForm.commission) || 0,
        tax_deduction: parseFloat(payslipForm.tax_deduction) || 0,
        pension_deduction: parseFloat(payslipForm.pension_deduction) || 0,
        health_insurance: parseFloat(payslipForm.health_insurance) || 0,
        other_deductions: parseFloat(payslipForm.other_deductions) || 0,
        payment_date: payslipForm.payment_date,
        payment_method: payslipForm.payment_method,
        notes: payslipForm.notes
      };
      await dataService.generatePayslip(payload);
      setShowPayslipModal(false);
      setPayslipForm(createEmptyPayslipForm());
      try {
        await fetchData();
        notifySuccess('Payslip generated successfully!');
      } catch {
        notifyWarning('Payslip generated but failed to refresh list. Please refresh the page.');
      }
    } catch (err: any) {
      console.error('[PayslipsTab] handleGeneratePayslip error:', err);
      notifyError(err?.message || 'Failed to generate payslip. Please try again.');
    }
  };

  const handleUpdatePayslipStatus = async (id: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled') => {
    try {
      await dataService.updatePayslipStatus(id, status);
      await fetchData();
    } catch (err: any) {
      console.error('[PayslipsTab] handleUpdatePayslipStatus error:', err);
      notifyError(err?.message || 'Failed to update payslip status.');
    }
  };

  const handleDeletePayslip = async (id: string) => {
    const approved = await confirm({
      title: 'Delete payslip?',
      message: 'This removes the generated payslip record.',
      confirmLabel: 'Delete Payslip',
      confirmVariant: 'danger',
    });
    if (!approved) return;
    try {
      await dataService.deletePayslip(id);
      await fetchData();
      notifySuccess('Payslip deleted successfully.');
    } catch (err: any) {
      console.error('[PayslipsTab] handleDeletePayslip error:', err);
      notifyError(err?.message || 'Failed to delete payslip.');
    }
  };

  const handleDownloadPayslip = async (payslip: Payslip) => {
    if (!company) {
      notifyError('Company details not loaded. Please try again.');
      return;
    }
    try {
      await generatePayslipPDFAndDownload(payslip, company);
    } catch (err) {
      console.error('[PayslipsTab] handleDownloadPayslip error:', err);
      notifyError('Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600"></div>
        <p className="font-bold animate-pulse uppercase tracking-widest text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Loading Payslips</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action button */}
      <div className="flex items-center gap-2">
        <button
          onClick={openGenerateModal}
          className="bg-pink-600 text-white px-6 py-2.5  font-bold text-sm hover:bg-pink-700 transition-all shadow-xl shadow-pink-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
          Generate Payslip
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-8  text-white">
        <h3 className="text-2xl font-black mb-2">Payslip Management</h3>
        <p className="text-pink-100">Generate and manage employee payslips</p>
      </div>

      {/* Table */}
      <div className="overflow-hidden shadow-lg" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
        <div className="space-y-3 p-3 sm:hidden">
          {payslips.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)', background: 'var(--cds-layer-01, #f4f4f4)', color: 'var(--cds-text-secondary, #525252)' }}>
              No payslips yet. Click &quot;Generate Payslip&quot; to get started.
            </div>
          ) : (
            payslips.map((payslip) => (
              <div key={payslip.id} className="p-4" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)', background: 'var(--cds-background, #ffffff)' }}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{payslip.employee?.name || 'N/A'}</div>
                    <div className="font-mono text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{payslip.payslip_number}</div>
                  </div>
                  <span className="inline-block px-2 py-0.5 text-xs font-semibold" style={
                    payslip.status === 'Generated' ? { background: 'var(--cds-support-info-inverse, #edf5ff)', color: 'var(--cds-interactive, #D97706)' } :
                    payslip.status === 'Approved' ? { background: 'var(--cds-support-warning-inverse, #fdf6dd)', color: 'var(--cds-support-warning-inverse, #b28600)' } :
                    payslip.status === 'Paid' ? { background: 'var(--cds-support-success-inverse, #defbe6)', color: 'var(--cds-support-success, #24a148)' } :
                    { background: 'var(--cds-support-error-inverse, #fff1f1)', color: 'var(--cds-support-error, #da1e28)' }
                  }>
                    {payslip.status}
                  </span>
                </div>
                <div className="mb-1 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                <div className="mb-3 text-sm">
                  <span style={{ color: 'var(--cds-text-secondary, #525252)' }}>${payslip.gross_pay.toLocaleString()} gross</span>
                  <span className="mx-1" style={{ color: 'var(--cds-text-secondary, #525252)' }}>&rarr;</span>
                  <span className="font-bold" style={{ color: 'var(--cds-support-success, #24a148)' }}>${payslip.net_pay.toLocaleString()} net</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
                  {payslip.status === 'Generated' && (
                    <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Approved')} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-support-warning-inverse, #b28600)' }}>Approve</button>
                  )}
                  {payslip.status === 'Approved' && (
                    <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Paid')} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-support-success, #24a148)' }}>Mark Paid</button>
                  )}
                  <button
                    onClick={() => handleDownloadPayslip(payslip)}
                    className="px-2 py-1 text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    title="Download PDF"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    PDF
                  </button>
                  <button onClick={() => handleDeletePayslip(payslip.id)} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-support-error, #da1e28)' }}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Payslip #</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Employee</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Period</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Gross Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Net Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                    No payslips yet. Click &quot;Generate Payslip&quot; to get started.
                  </td>
                </tr>
              ) : (
                payslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-mono text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{payslip.payslip_number}</td>
                    <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{payslip.employee?.name || 'N/A'}</td>
                    <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                    <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>${payslip.gross_pay.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold" style={{ color: 'var(--cds-support-success, #24a148)' }}>${payslip.net_pay.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-1 text-xs font-semibold" style={
                        payslip.status === 'Generated' ? { background: 'var(--cds-support-info-inverse, #edf5ff)', color: 'var(--cds-interactive, #D97706)' } :
                        payslip.status === 'Approved' ? { background: 'var(--cds-support-warning-inverse, #fdf6dd)', color: 'var(--cds-support-warning-inverse, #b28600)' } :
                        payslip.status === 'Paid' ? { background: 'var(--cds-support-success-inverse, #defbe6)', color: 'var(--cds-support-success, #24a148)' } :
                        { background: 'var(--cds-support-error-inverse, #fff1f1)', color: 'var(--cds-support-error, #da1e28)' }
                      }>
                        {payslip.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payslip.status === 'Generated' && (
                          <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Approved')} className="font-semibold text-sm" style={{ color: 'var(--cds-support-warning-inverse, #b28600)' }}>Approve</button>
                        )}
                        {payslip.status === 'Approved' && (
                          <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Paid')} className="font-semibold text-sm" style={{ color: 'var(--cds-support-success, #24a148)' }}>Mark Paid</button>
                        )}
                        <button
                          onClick={() => handleDownloadPayslip(payslip)}
                          className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1"
                          title="Download PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          PDF
                        </button>
                        <button onClick={() => handleDeletePayslip(payslip.id)} className="font-semibold text-sm" style={{ color: 'var(--cds-support-error, #da1e28)' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayslipFormModal
        isOpen={showPayslipModal}
        title="Generate Payslip"
        onClose={() => setShowPayslipModal(false)}
        onSubmit={handleGeneratePayslip}
        form={payslipForm}
        onChange={handlePayslipFormChange}
        employees={employees}
      />

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default PayslipsTab;
