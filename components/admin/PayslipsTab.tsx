import React, { useEffect, useState } from 'react';
import { Employee, Payslip, CompanyDetails } from '../../types';
import { supabase } from '../../services/supabaseService';
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
        supabase.getPayslips(),
        supabase.getEmployees(),
        supabase.getCompanyDetails(),
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
      await supabase.generatePayslip(payload);
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
      await supabase.updatePayslipStatus(id, status);
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
      await supabase.deletePayslip(id);
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
        <p className="text-zinc-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Payslips</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action button */}
      <div className="flex items-center gap-2">
        <button
          onClick={openGenerateModal}
          className="bg-pink-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-pink-700 transition-all shadow-xl shadow-pink-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
          Generate Payslip
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-8 rounded-3xl text-white">
        <h3 className="text-2xl font-black mb-2">Payslip Management</h3>
        <p className="text-pink-100">Generate and manage employee payslips</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Payslip #</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Period</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Gross Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Net Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No payslips yet. Click &quot;Generate Payslip&quot; to get started.
                  </td>
                </tr>
              ) : (
                payslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-mono text-sm text-zinc-600">{payslip.payslip_number}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-900">{payslip.employee?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-zinc-600">{new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                    <td className="px-6 py-4 text-zinc-900 font-semibold">${payslip.gross_pay.toLocaleString()}</td>
                    <td className="px-6 py-4 text-green-600 font-bold">${payslip.net_pay.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-md ${
                        payslip.status === 'Generated' ? 'bg-blue-100 text-blue-700' :
                        payslip.status === 'Approved' ? 'bg-yellow-100 text-yellow-700' :
                        payslip.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {payslip.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payslip.status === 'Generated' && (
                          <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Approved')} className="text-yellow-600 hover:text-yellow-800 font-semibold text-sm">Approve</button>
                        )}
                        {payslip.status === 'Approved' && (
                          <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Paid')} className="text-green-600 hover:text-green-800 font-semibold text-sm">Mark Paid</button>
                        )}
                        <button
                          onClick={() => handleDownloadPayslip(payslip)}
                          className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1"
                          title="Download PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          PDF
                        </button>
                        <button onClick={() => handleDeletePayslip(payslip.id)} className="text-red-600 hover:text-red-800 font-semibold text-sm">Delete</button>
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
