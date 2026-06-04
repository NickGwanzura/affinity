
import React, { useState, useEffect, useMemo } from 'react';
import { Expense, Vehicle, CompanyDetails, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../components/Toast';
import { getDriverIdentityAliases } from '../utils/driverIdentity';
import { DashboardPageHeader, DashboardSection, Button } from './ui';
import { Modal } from './ui/Modal';

export const Documents: React.FC = () => {
  const session = useSession();
  const [activeTab, setActiveTab] = useState<'receipts' | 'statements'>('receipts');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const viewerRole: UserRole | null = session?.user?.role ?? null;
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Expense | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [modalImageError, setModalImageError] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const uniqueById = <T extends { id: string }>(items: T[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const role = session?.user?.role || null;

        const driverAliases = role === 'Driver' ? getDriverIdentityAliases(session?.user) : [];

        const [expenseGroups, v, c] = await Promise.all([
          role === 'Driver'
            ? Promise.all(driverAliases.map((alias) => dataService.getExpensesByDriver(alias).catch(() => [] as Expense[])))
            : Promise.resolve([await dataService.getExpenses()]),
          dataService.getVehicles(),
          dataService.getCompanyDetails()
        ]);

        const scopedExpenses: Expense[] = uniqueById(expenseGroups.flat());
        const scopedVehicles =
          role === 'Driver'
            ? v.filter((vehicle) => scopedExpenses.some((expense) => expense.vehicle_id === vehicle.id))
            : v;

        setExpenses(scopedExpenses);
        setVehicles(scopedVehicles);
        setCompany(c);
        setLoading(false);
      } catch (error) {
        setLoading(false);
        showToast('Failed to load documents. Please refresh the page.', 'error');
      }
    };
    load();
  }, []);

  // Memoized expensive calculations
  const unassignedExpenses = useMemo(() => 
    expenses.filter(e => !e.vehicle_id),
    [expenses]
  );

  const vehicleData = useMemo(() => {
    return vehicles.map(v => {
      const vehicleExpenses = expenses.filter(e => e.vehicle_id === v.id);
      const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0);
      return {
        vehicle: v,
        expenses: vehicleExpenses,
        totalExpenses
      };
    });
  }, [vehicles, expenses]);

  const generateVehicleStatement = async (vehicle: Vehicle) => {
    if (!company) {
      showToast('Company details not loaded', 'error');
      return;
    }

    try {
      const vehicleExpenses = expenses.filter(e => e.vehicle_id === vehicle.id);
      const { generateVehicleStatementPDFAndDownload } = await import('../services/pdfService');
      await generateVehicleStatementPDFAndDownload(vehicle, vehicleExpenses, company);
      showToast('Vehicle statement generated successfully!', 'success');
    } catch {
      showToast('Failed to generate statement', 'error');
    }
  };

  const viewReceiptDetails = (expense: Expense) => {
    setSelectedReceipt(expense);
    setModalImageError(false);
  };

  const closeReceiptModal = () => {
    setSelectedReceipt(null);
    setModalImageError(false);
  };

  const handleModalImageError = () => {
    setModalImageError(true);
  };

  if (loading) return <div className="p-20 text-center text-zinc-400">Loading Document Center...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Documents"
        subtitle={
          viewerRole === 'Driver'
            ? 'Your receipts and statements tied to your trip activity'
            : 'Generated PDFs, uploaded files, and reg books'
        }
      />

      <div className="flex w-full gap-1 bg-zinc-100 p-1.5 sm:w-fit">
        <button 
          onClick={() => setActiveTab('receipts')}
          aria-label="View Digital Receipts"
          aria-pressed={activeTab === 'receipts'}
          className={`min-h-[44px] flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest transition-all sm:flex-none sm:px-8 ${activeTab === 'receipts' ? 'bg-white text-[#D97706] shadow-sm' : 'text-zinc-400'}`}
        >
          Digital Receipts
        </button>
        <button 
          onClick={() => setActiveTab('statements')}
          aria-label="View Fleet Statements"
          aria-pressed={activeTab === 'statements'}
          className={`min-h-[44px] flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest transition-all sm:flex-none sm:px-8 ${activeTab === 'statements' ? 'bg-white text-[#D97706] shadow-sm' : 'text-zinc-400'}`}
        >
          Fleet Statements
        </button>
      </div>

      {activeTab === 'receipts' ? (
        <DashboardSection title="Digital Receipts">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {expenses.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 mb-4">
                <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-zinc-900">No Receipts Yet</p>
              <p className="text-sm text-zinc-500 mt-2">Add expenses to see digital receipts here</p>
            </div>
          ) : (
            expenses.map((exp) => (
              <div key={exp.id} onClick={() => viewReceiptDetails(exp)} className="bg-white overflow-hidden border border-zinc-200 shadow-sm group cursor-pointer hover:border-[#D97706] transition-all">
                <div className="aspect-[3/4] bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                  {exp.receipt_url ? (
                    failedImages.has(exp.id) ? (
                      <div className="text-zinc-400 text-center p-4">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-xs font-semibold">Receipt Image</p>
                      </div>
                    ) : (
                      <img 
                        src={exp.receipt_url} 
                        alt={`Receipt for ${exp.description}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        onError={() => {
                          setFailedImages(prev => new Set(prev).add(exp.id));
                        }} 
                      />
                    )
                  ) : (
                    <div className="text-zinc-400 text-center p-4">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs font-semibold">Digital Receipt</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <button 
                      aria-label={`View details for ${exp.description} receipt`}
                      className="text-white text-xs font-black uppercase tracking-widest w-full py-2 bg-white/20 backdrop-blur-md"
                    >
                      View Details
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-xs font-black text-[#D97706] uppercase tracking-widest mb-1">{exp.category}</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{exp.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-black text-zinc-400">{new Date(exp.created_at).toLocaleDateString()}</span>
                    <span className="text-xs font-black text-zinc-900">{exp.currency} {exp.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </DashboardSection>
      ) : (
        <DashboardSection title="Fleet Statements">
        <div className="space-y-6">
          {/* Show general expenses without vehicle assignment */}
          {unassignedExpenses.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-6">
              <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Unassigned General Expenses
              </h3>
              <p className="text-sm text-amber-700 mb-4">
                {unassignedExpenses.length} expenses not assigned to any vehicle
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedExpenses.map(exp => (
                  <div key={exp.id} className="bg-white p-4 border border-amber-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-amber-600 uppercase">{exp.category}</span>
                      <span className="text-xs text-zinc-500">{new Date(exp.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 mb-2">{exp.description}</p>
                    <p className="text-lg font-black text-amber-900">{exp.currency} {exp.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Vehicle-specific statements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {vehicles.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 mb-4">
                <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0 a2 2 0 114 0" />
                </svg>
              </div>
              <p className="text-lg font-bold text-zinc-900">No Vehicles Yet</p>
              <p className="text-sm text-zinc-500 mt-2">Add vehicles to generate statements</p>
            </div>
          ) : (
            vehicleData.map(({ vehicle: v, expenses: vehicleExpenses, totalExpenses }) => (
              <div key={v.id} className="bg-white p-8 border border-zinc-200 shadow-sm group hover:shadow-xl hover:shadow-stone-100 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-amber-50 group-hover:text-[#D97706] transition-colors">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2.5" /></svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-zinc-900 tracking-tight">{v.make_model}</h4>
                      <p className="text-xs font-mono font-bold text-zinc-400">{v.vin_number}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4 bg-zinc-50 p-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-1">Expenses</p>
                    <p className="text-sm font-black text-zinc-900">{vehicleExpenses.length} items</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-1">Total USD</p>
                    <p className="text-sm font-black text-zinc-900">${totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => generateVehicleStatement(v)}
                  aria-label={`Generate statement for ${v.make_model}`}
                  className="bg-zinc-900 text-white px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-lg hover:bg-[#B45309] transition-all w-full"
                >
                  Generate Statement
                </button>
              </div>
            ))
          )}
          </div>
        </div>
        </DashboardSection>
      )}

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Receipt Details Modal */}
      <Modal
        isOpen={!!selectedReceipt}
        onClose={closeReceiptModal}
        title="Receipt Details"
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeReceiptModal}>Close</Button>
            {selectedReceipt?.receipt_url && (
              <a
                href={selectedReceipt.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 font-bold text-sm bg-[#D97706] text-white hover:bg-[#B45309] rounded"
              >
                Open Receipt
              </a>
            )}
          </div>
        }
      >
        {selectedReceipt && (
          <div className="space-y-6">
            <p className="text-xs text-zinc-400 font-mono">Expense ID: {selectedReceipt.id}</p>

            {/* Basic Info */}
            <section>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Basic Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">Category</label>
                    <p className="text-lg font-bold text-zinc-900 mt-1">{selectedReceipt.category}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">Location</label>
                    <p className="text-lg font-bold text-zinc-900 mt-1">{selectedReceipt.location}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">Description</label>
                  <p className="text-base text-zinc-900 mt-1">{selectedReceipt.description}</p>
                </div>
              </div>
            </section>

            {/* Financial Details */}
            <section>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Financial Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">Amount</label>
                    <p className="text-xl font-black text-zinc-900 mt-1">{selectedReceipt.currency} {selectedReceipt.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">USD Equivalent</label>
                    <p className="text-xl font-black text-[#D97706] mt-1">${(selectedReceipt.amount * selectedReceipt.exchange_rate_to_usd).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">Date</label>
                    <p className="text-base font-bold text-zinc-900 mt-1">{new Date(selectedReceipt.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.08em]">Exchange Rate</label>
                  <p className="text-sm text-zinc-900 mt-1">1 {selectedReceipt.currency} = ${selectedReceipt.exchange_rate_to_usd} USD</p>
                </div>
              </div>
            </section>

            {/* Receipt Image */}
            {selectedReceipt.receipt_url && (
              <section>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Receipt Image</h3>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-stone-100/70">
                  {modalImageError ? (
                    <div className="text-center text-zinc-400 py-8">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>Image not available</p>
                    </div>
                  ) : (
                    <img
                      src={selectedReceipt.receipt_url}
                      alt={`Receipt for ${selectedReceipt.description}`}
                      className="w-full rounded-lg"
                      onError={handleModalImageError}
                    />
                  )}
                </div>
              </div>
              </section>
            )}

            {/* Audit Trail */}
            <section>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Audit Trail</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800">Created: {new Date(selectedReceipt.created_at).toLocaleString()}</p>
                  <p className="text-sm text-amber-800 mt-1">Vehicle ID: {selectedReceipt.vehicle_id}</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};
