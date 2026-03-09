
import React, { useState, useEffect, useMemo } from 'react';
import { Expense, Vehicle, CompanyDetails } from '../types';
import { supabase } from '../services/supabaseService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

export const Documents: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'receipts' | 'statements'>('receipts');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Expense | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [modalImageError, setModalImageError] = useState(false);
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    const load = async () => {
      try {
        const [e, v, c] = await Promise.all([
          supabase.getExpenses(),
          supabase.getVehicles(),
          supabase.getCompanyDetails()
        ]);
        setExpenses(e);
        setVehicles(v);
        setCompany(c);
        setLoading(false);
      } catch (error) {
        setLoading(false);
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
      const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + (e.amount * (e.exchange_rate_to_usd || 1)), 0);
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
      const doc = new jsPDF();
      
      // Add company logo if exists
      if (company.logo_url) {
        try {
          doc.addImage(company.logo_url, 'PNG', 15, 15, 40, 40);
        } catch {
          // Silently handle logo load failure
        }
      }
      
      // Company Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, company.logo_url ? 60 : 15, 25);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(company.address, company.logo_url ? 60 : 15, 32);
      doc.text(`Email: ${company.contact_email}`, company.logo_url ? 60 : 15, 37);
      if (company.phone) doc.text(`Phone: ${company.phone}`, company.logo_url ? 60 : 15, 42);
      
      // Statement Title
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('VEHICLE EXPENSE STATEMENT', 15, 70);
      
      // Vehicle Details Box
      doc.setFillColor(249, 250, 251);
      doc.rect(15, 80, 180, 30, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Vehicle:', 20, 88);
      doc.text('VIN:', 20, 95);
      doc.text('Status:', 20, 102);
      doc.text('Purchase Price:', 120, 88);
      doc.text('Statement Date:', 120, 95);
      
      doc.setFont('helvetica', 'normal');
      doc.text(vehicle.make_model, 45, 88);
      doc.text(vehicle.vin_number, 45, 95);
      doc.text(vehicle.status, 45, 102);
      doc.text(`£${vehicle.purchase_price_gbp.toLocaleString()}`, 165, 88);
      doc.text(new Date().toLocaleDateString(), 165, 95);
      
      // Get vehicle expenses
      const vehicleExpenses = expenses.filter(e => e.vehicle_id === vehicle.id);
      
      if (vehicleExpenses.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text('No expenses recorded for this vehicle yet.', 15, 130);
      } else {
        // Expenses Table
        const tableData = vehicleExpenses.map(exp => [
          new Date(exp.created_at).toLocaleDateString(),
          exp.category,
          exp.description,
          exp.location,
          `${exp.currency} ${exp.amount.toLocaleString()}`,
          `$${(exp.amount * (exp.exchange_rate_to_usd || 1)).toLocaleString()}`
        ]);
        
        autoTable(doc, {
          startY: 120,
          head: [['Date', 'Category', 'Description', 'Location', 'Amount', 'USD Equiv.']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [59, 130, 246],
            fontStyle: 'bold',
            fontSize: 9
          },
          styles: {
            fontSize: 8,
            cellPadding: 4
          },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 25 },
            2: { cellWidth: 45 },
            3: { cellWidth: 25 },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 30, halign: 'right' }
          }
        });
        
        // Totals
        const finalY = (doc as any).lastAutoTable.finalY || 120;
        const totalExpensesUSD = vehicleExpenses.reduce((sum, exp) => 
          sum + (exp.amount * (exp.exchange_rate_to_usd || 1)), 0
        );
        const purchasePriceUSD = vehicle.purchase_price_gbp * 1.27; // GBP to USD
        const totalLandedCost = purchasePriceUSD + totalExpensesUSD;
        
        doc.setFillColor(249, 250, 251);
        doc.rect(120, finalY + 10, 75, 40, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Purchase Price (USD):', 125, finalY + 18);
        doc.text(`$${purchasePriceUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}`, 190, finalY + 18, { align: 'right' });
        
        doc.text('Total Expenses (USD):', 125, finalY + 26);
        doc.text(`$${totalExpensesUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}`, 190, finalY + 26, { align: 'right' });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total Landed Cost:', 125, finalY + 38);
        doc.setTextColor(59, 130, 246);
        doc.text(`$${totalLandedCost.toLocaleString(undefined, {maximumFractionDigits: 2})}`, 190, finalY + 38, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        
        // Expense breakdown by category
        const categoryTotals: Record<string, number> = {};
        vehicleExpenses.forEach(exp => {
          const usdAmount = exp.amount * (exp.exchange_rate_to_usd || 1);
          categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + usdAmount;
        });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Expense Breakdown by Category', 15, finalY + 18);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        let yPos = finalY + 26;
        Object.entries(categoryTotals).forEach(([category, total]) => {
          doc.text(`${category}:`, 20, yPos);
          doc.text(`$${total.toLocaleString(undefined, {maximumFractionDigits: 2})}`, 70, yPos);
          yPos += 6;
        });
      }
      
      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Generated by Affinity Logistics Management System', 105, 285, { align: 'center' });
      doc.text(`${company.contact_email} | ${company.phone || 'N/A'}`, 105, 290, { align: 'center' });
      
      // Save PDF
      const fileName = `Statement_${vehicle.make_model.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Document Center</h2>
        <p className="text-zinc-500 font-medium">Audit-ready receipts and consolidated fleet statements</p>
      </div>

      <div className="flex gap-1 bg-zinc-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('receipts')}
          aria-label="View Digital Receipts"
          aria-pressed={activeTab === 'receipts'}
          className={`px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'receipts' ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400'}`}
        >
          Digital Receipts
        </button>
        <button 
          onClick={() => setActiveTab('statements')}
          aria-label="View Fleet Statements"
          aria-pressed={activeTab === 'statements'}
          className={`px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'statements' ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400'}`}
        >
          Fleet Statements
        </button>
      </div>

      {activeTab === 'receipts' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {expenses.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-zinc-900">No Receipts Yet</p>
              <p className="text-sm text-zinc-500 mt-2">Add expenses to see digital receipts here</p>
            </div>
          ) : (
            expenses.map((exp) => (
              <div key={exp.id} onClick={() => viewReceiptDetails(exp)} className="bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-sm group cursor-pointer hover:border-blue-300 transition-all">
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
                      className="text-white text-[10px] font-black uppercase tracking-widest w-full py-2 bg-white/20 backdrop-blur-md rounded-lg"
                    >
                      View Details
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{exp.category}</p>
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
      ) : (
        <div className="space-y-6">
          {/* Show general expenses without vehicle assignment */}
          {unassignedExpenses.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
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
                  <div key={exp.id} className="bg-white p-4 rounded-xl border border-amber-200">
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 rounded-2xl mb-4">
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
              <div key={v.id} className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm group hover:shadow-xl hover:shadow-blue-50 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2.5" /></svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-zinc-900 tracking-tight">{v.make_model}</h4>
                      <p className="text-xs font-mono font-bold text-zinc-400">{v.vin_number}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4 bg-zinc-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-1" scope="row">Expenses</p>
                    <p className="text-sm font-black text-zinc-900">{vehicleExpenses.length} items</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-1" scope="row">Total USD</p>
                    <p className="text-sm font-black text-zinc-900">${totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => generateVehicleStatement(v)}
                  aria-label={`Generate statement for ${v.make_model}`}
                  className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-all w-full"
                >
                  Generate Statement
                </button>
              </div>
            ))
          )}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Confirmation Dialog */}
      <ConfirmDialog />

      {/* Receipt Details Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={closeReceiptModal}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 id="receipt-modal-title" className="text-2xl font-black text-zinc-900">Receipt Details</h3>
                <p className="text-sm text-zinc-500 mt-1">Expense ID: {selectedReceipt.id}</p>
              </div>
              <button 
                onClick={closeReceiptModal} 
                aria-label="Close receipt details"
                className="text-zinc-400 hover:text-zinc-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">Category</label>
                  <p className="text-lg font-bold text-zinc-900 mt-1">{selectedReceipt.category}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">Location</label>
                  <p className="text-lg font-bold text-zinc-900 mt-1">{selectedReceipt.location}</p>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">Description</label>
                <p className="text-base text-zinc-900 mt-1">{selectedReceipt.description}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">Amount</label>
                  <p className="text-xl font-black text-zinc-900 mt-1">{selectedReceipt.currency} {selectedReceipt.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">USD Equivalent</label>
                  <p className="text-xl font-black text-blue-600 mt-1">${(selectedReceipt.amount * selectedReceipt.exchange_rate_to_usd).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">Date</label>
                  <p className="text-base font-bold text-zinc-900 mt-1">{new Date(selectedReceipt.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" scope="row">Exchange Rate</label>
                <p className="text-sm text-zinc-900 mt-1">1 {selectedReceipt.currency} = ${selectedReceipt.exchange_rate_to_usd} USD</p>
              </div>
              
              {selectedReceipt.receipt_url && (
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block" scope="row">Receipt Image</label>
                  <div className="bg-zinc-50 rounded-xl p-4">
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
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
                <p className="text-xs font-semibold text-blue-900 mb-2">✓ Audit Trail</p>
                <p className="text-sm text-blue-800">Created: {new Date(selectedReceipt.created_at).toLocaleString()}</p>
                <p className="text-sm text-blue-800">Vehicle ID: {selectedReceipt.vehicle_id}</p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-6">
              <button 
                onClick={closeReceiptModal} 
                aria-label="Close receipt details"
                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50"
              >
                Close
              </button>
              {selectedReceipt.receipt_url && (
                <a 
                  href={selectedReceipt.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="Open receipt in new tab"
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 text-center"
                >
                  Open Receipt
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
