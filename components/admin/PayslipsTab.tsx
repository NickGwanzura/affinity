import React, { useEffect, useState } from 'react';
import { Employee, Payslip, CompanyDetails } from '../../types';
import { supabase } from '../../services/supabaseService';
import { generatePayslipPDFAndDownload } from '../../services/pdfService';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';

export const PayslipsTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState({
    employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
    tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
    payment_date: '', payment_method: 'Bank Transfer' as string, notes: ''
  });

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');

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

  const calculatePayslipTotals = () => {
    const basePay = parseFloat(payslipForm.base_pay) || 0;
    const overtimePay = (parseFloat(payslipForm.overtime_hours) || 0) * (parseFloat(payslipForm.overtime_rate) || 0);
    const bonus = parseFloat(payslipForm.bonus) || 0;
    const allowances = parseFloat(payslipForm.allowances) || 0;
    const commission = parseFloat(payslipForm.commission) || 0;
    const grossPay = basePay + overtimePay + bonus + allowances + commission;

    const tax = parseFloat(payslipForm.tax_deduction) || 0;
    const pension = parseFloat(payslipForm.pension_deduction) || 0;
    const health = parseFloat(payslipForm.health_insurance) || 0;
    const otherDeductions = parseFloat(payslipForm.other_deductions) || 0;
    const totalDeductions = tax + pension + health + otherDeductions;

    return { grossPay, totalDeductions, netPay: grossPay - totalDeductions };
  };

  const openGenerateModal = () => {
    setPayslipForm({
      employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
      base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
      tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
      payment_date: '', payment_method: 'Bank Transfer', notes: ''
    });
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
      setPayslipForm({
        employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
        tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
        payment_date: '', payment_method: 'Bank Transfer', notes: ''
      });
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

  const { grossPay, totalDeductions, netPay } = calculatePayslipTotals();

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

      {/* Generate Payslip Modal */}
      {showPayslipModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowPayslipModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">Generate Payslip</h3>
            <form onSubmit={handleGeneratePayslip} className="space-y-6">
              {/* Employee, Month, Year */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 md:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employee *</label>
                  <select
                    value={payslipForm.employee_id}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = employees.find(emp => emp.id === empId);
                      setPayslipForm({ ...payslipForm, employee_id: empId, base_pay: emp ? emp.base_pay_usd.toString() : '' });
                    }}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Month *</label>
                  <select value={payslipForm.month} onChange={(e) => setPayslipForm({ ...payslipForm, month: parseInt(e.target.value) })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString('en-US', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Year *</label>
                  <input type="number" value={payslipForm.year} onChange={(e) => setPayslipForm({ ...payslipForm, year: parseInt(e.target.value) })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
              </div>

              {/* Earnings */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Earnings
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Base Pay *</label><input type="number" step="0.01" value={payslipForm.base_pay} onChange={(e) => setPayslipForm({ ...payslipForm, base_pay: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Hours</label><input type="number" step="0.01" value={payslipForm.overtime_hours} onChange={(e) => setPayslipForm({ ...payslipForm, overtime_hours: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Rate</label><input type="number" step="0.01" value={payslipForm.overtime_rate} onChange={(e) => setPayslipForm({ ...payslipForm, overtime_rate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Bonus</label><input type="number" step="0.01" value={payslipForm.bonus} onChange={(e) => setPayslipForm({ ...payslipForm, bonus: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Allowances</label><input type="number" step="0.01" value={payslipForm.allowances} onChange={(e) => setPayslipForm({ ...payslipForm, allowances: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Commission</label><input type="number" step="0.01" value={payslipForm.commission} onChange={(e) => setPayslipForm({ ...payslipForm, commission: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div>
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                  Deductions
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Tax</label><input type="number" step="0.01" value={payslipForm.tax_deduction} onChange={(e) => setPayslipForm({ ...payslipForm, tax_deduction: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Pension</label><input type="number" step="0.01" value={payslipForm.pension_deduction} onChange={(e) => setPayslipForm({ ...payslipForm, pension_deduction: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Health Insurance</label><input type="number" step="0.01" value={payslipForm.health_insurance} onChange={(e) => setPayslipForm({ ...payslipForm, health_insurance: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div>
                  <div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Other</label><input type="number" step="0.01" value={payslipForm.other_deductions} onChange={(e) => setPayslipForm({ ...payslipForm, other_deductions: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div>
                </div>
              </div>

              {/* Live Totals */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Gross Pay</p>
                    <p className="text-2xl font-black">${grossPay.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Deductions</p>
                    <p className="text-2xl font-black">-${totalDeductions.toLocaleString()}</p>
                  </div>
                  <div className="border-l-2 border-white/30 pl-6">
                    <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Net Pay</p>
                    <p className="text-3xl font-black">${netPay.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Date</label>
                  <input type="date" value={payslipForm.payment_date} onChange={(e) => setPayslipForm({ ...payslipForm, payment_date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Method</label>
                  <select value={payslipForm.payment_method} onChange={(e) => setPayslipForm({ ...payslipForm, payment_method: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Notes</label>
                <textarea value={payslipForm.notes} onChange={(e) => setPayslipForm({ ...payslipForm, notes: e.target.value })} rows={2} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPayslipModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl shadow-lg">Generate Payslip</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default PayslipsTab;
