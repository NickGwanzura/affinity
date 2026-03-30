import React from 'react';
import type { Invoice, Payment, Quote, Receipt } from '../../types';

export type FinancialsTab = 'quotes' | 'invoices' | 'payments' | 'receipts' | 'statements';

interface FinancialsTabBarProps {
 activeTab: FinancialsTab;
 onChange: (tab: FinancialsTab) => void;
}

const tabs: FinancialsTab[] = ['quotes', 'invoices', 'payments', 'receipts', 'statements'];

export const FinancialsTabBar: React.FC<FinancialsTabBarProps> = ({ activeTab, onChange }) => (
 <>
 <div className="border-b border-zinc-100 bg-zinc-50/50 sm:hidden">
 <div className="flex gap-1 overflow-x-auto p-2 scrollbar-hide">
 {tabs.map((tab) => (
 <button
 key={tab}
 type="button"
 onClick={() => onChange(tab)}
 className={`min-h-[44px] flex-shrink-0 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
 activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'bg-zinc-100/50 text-zinc-500 hover:text-zinc-700'
 }`}
 >
 {tab}
 </button>
 ))}
 </div>
 </div>
 <div className="hidden border-b border-zinc-100 bg-zinc-50/50 p-2 sm:flex">
 {tabs.map((tab) => (
 <button
 key={tab}
 type="button"
 onClick={() => onChange(tab)}
 className={`min-h-[44px] flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
 activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
 }`}
 >
 {tab}
 </button>
 ))}
 </div>
 </>
);

interface QuotesSectionProps {
 quotes: Quote[];
 deletingKey: string | null;
 formatMoney: (amount: number, currency?: string) => string;
 onPreview: (quote: Quote) => void;
 onDownload: (quote: Quote) => void;
 onEdit: (quote: Quote) => void;
 onConvert: (quote: Quote) => void;
 onDelete: (quote: Quote) => void;
}

export const QuotesSection: React.FC<QuotesSectionProps> = ({
 quotes,
 deletingKey,
 formatMoney,
 onPreview,
 onDownload,
 onEdit,
 onConvert,
 onDelete,
}) => (
 <>
 <div className="space-y-3 p-3 sm:hidden">
 {quotes.map((quote) => (
 <div key={quote.id} className="border border-zinc-100 bg-white p-4 shadow-sm">
 <div className="mb-2 flex items-start justify-between">
 <span className="font-mono text-xs font-bold text-blue-600">{quote.quote_number}</span>
 <span className="bg-blue-100 px-2 py-0.5 text-xs font-black uppercase tracking-tighter text-blue-700">
 {quote.status}
 </span>
 </div>
 <div className="mb-1 font-bold text-zinc-900">{quote.client_name}</div>
 <div className="mb-2 font-black text-zinc-900">{formatMoney(quote.amount_usd, quote.currency || 'USD')}</div>
 <div className="mb-3 text-xs text-zinc-400">{new Date(quote.created_at).toLocaleDateString()}</div>
 <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
 <button type="button" onClick={() => onPreview(quote)} className="px-2 py-1 text-xs font-bold text-zinc-600 hover:text-zinc-900">Preview</button>
 <button type="button" onClick={() => onDownload(quote)} className="px-2 py-1 text-xs font-bold text-blue-600 hover:text-blue-700">Download</button>
 <button type="button" onClick={() => onEdit(quote)} className="px-2 py-1 text-xs font-bold text-amber-600 hover:text-amber-700">Edit</button>
 <button type="button" onClick={() => onConvert(quote)} className="px-2 py-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">Convert</button>
 <button
 type="button"
 onClick={() => onDelete(quote)}
 disabled={deletingKey === `quote:${quote.id}`}
 className="px-2 py-1 text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {deletingKey === `quote:${quote.id}` ? 'Deleting...' : 'Delete'}
 </button>
 </div>
 </div>
 ))}
 </div>
 <table className="hidden w-full text-left text-sm sm:table">
 <thead className="border-b border-zinc-100 bg-zinc-50">
 <tr>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Quote #</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Client</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Status</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Created</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-100">
 {quotes.map((quote) => (
 <tr key={quote.id} className="transition-colors hover:bg-zinc-50">
 <td className="px-8 py-4 font-mono text-xs font-bold text-blue-600">{quote.quote_number}</td>
 <td className="px-8 py-4 font-bold text-zinc-900">{quote.client_name}</td>
 <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(quote.amount_usd, quote.currency || 'USD')}</td>
 <td className="px-8 py-4">
 <span className="bg-blue-100 px-2 py-0.5 text-xs font-black uppercase tracking-tighter text-blue-700">
 {quote.status}
 </span>
 </td>
 <td className="px-8 py-4 text-xs text-zinc-400">{new Date(quote.created_at).toLocaleDateString()}</td>
 <td className="px-8 py-4">
 <div className="flex items-center gap-4">
 <button type="button" onClick={() => onPreview(quote)} className="text-xs font-bold text-zinc-600 hover:text-zinc-900">Preview</button>
 <button type="button" onClick={() => onDownload(quote)} className="text-xs font-bold text-blue-600 hover:text-blue-700">Download</button>
 <button type="button" onClick={() => onEdit(quote)} className="text-xs font-bold text-amber-600 hover:text-amber-700">Edit</button>
 <button type="button" onClick={() => onConvert(quote)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Convert to Invoice</button>
 <button
 type="button"
 onClick={() => onDelete(quote)}
 disabled={deletingKey === `quote:${quote.id}`}
 className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {deletingKey === `quote:${quote.id}` ? 'Deleting...' : 'Delete'}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </>
);

interface InvoicesSectionProps {
 invoices: Invoice[];
 batchFilter: string;
 onBatchFilterChange: (value: string) => void;
 onClearBatchFilter: () => void;
 deletingKey: string | null;
 formatMoney: (amount: number, currency?: string) => string;
 onPreview: (invoice: Invoice) => void;
 onEdit: (invoice: Invoice) => void;
 onDownload: (invoice: Invoice) => void;
 onDelete: (invoice: Invoice) => void;
}

export const InvoicesSection: React.FC<InvoicesSectionProps> = ({
 invoices,
 batchFilter,
 onBatchFilterChange,
 onClearBatchFilter,
 deletingKey,
 formatMoney,
 onPreview,
 onEdit,
 onDownload,
 onDelete,
}) => {
 const filteredInvoices = invoices.filter(
 (invoice) => !batchFilter || (invoice.batch || '').toLowerCase().includes(batchFilter.toLowerCase()),
 );

 return (
 <>
 <div className="flex flex-col items-start gap-2 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-8">
 <svg className="hidden h-4 w-4 shrink-0 text-zinc-400 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 4a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 4a1 1 0 011-1h2a1 1 0 010 2h-2a1 1 0 01-1-1z" />
 </svg>
 <input
 type="text"
 placeholder="Filter by batch code…"
 value={batchFilter}
 onChange={(event) => onBatchFilterChange(event.target.value)}
 className="w-full border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 sm:w-52 sm:py-1.5"
 />
 {batchFilter ? (
 <button type="button" onClick={onClearBatchFilter} className="text-xs font-bold text-zinc-400 hover:text-zinc-700">
 Clear
 </button>
 ) : null}
 {batchFilter ? (
 <span className="text-xs text-zinc-400">{filteredInvoices.length} result(s)</span>
 ) : null}
 </div>
 <div className="space-y-3 p-3 sm:hidden">
 {filteredInvoices.map((invoice) => (
 <div key={invoice.id} className="border border-zinc-100 bg-white p-4 shadow-sm">
 <div className="mb-2 flex items-start justify-between">
 <div>
 <div className="font-mono font-bold text-green-600">{invoice.invoice_number}</div>
 <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
 {invoice.invoice_kind || 'Standard'}
 </div>
 </div>
 <span className="bg-emerald-100 px-2 py-0.5 text-xs font-black uppercase tracking-tighter text-emerald-700">
 {invoice.status}
 </span>
 </div>
 <div className="mb-1 font-bold text-zinc-900">{invoice.client_name}</div>
 <div className="mb-2 font-black text-zinc-900">{formatMoney(invoice.amount_usd, invoice.currency || 'USD')}</div>
 <div className="mb-3 flex items-center gap-2">
 {invoice.batch ? (
 <span className="bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{invoice.batch}</span>
 ) : null}
 <span className="text-xs text-zinc-400">Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
 </div>
 <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
 <button type="button" onClick={() => onPreview(invoice)} className="px-2 py-1 text-xs font-bold text-zinc-600 hover:text-zinc-900">Preview</button>
 <button type="button" onClick={() => onEdit(invoice)} className="px-2 py-1 text-xs font-bold text-amber-600 hover:text-amber-700">Edit</button>
 <button type="button" onClick={() => onDownload(invoice)} className="px-2 py-1 text-xs font-bold text-green-600 hover:text-green-700">Download</button>
 <button
 type="button"
 onClick={() => onDelete(invoice)}
 disabled={deletingKey === `invoice:${invoice.id}`}
 className="px-2 py-1 text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {deletingKey === `invoice:${invoice.id}` ? 'Deleting...' : 'Delete'}
 </button>
 </div>
 </div>
 ))}
 </div>
 <table className="hidden w-full text-left text-sm sm:table">
 <thead className="border-b border-zinc-100 bg-zinc-50">
 <tr>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Invoice #</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Client</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Batch</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Status</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Due Date</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-100">
 {filteredInvoices.map((invoice) => (
 <tr key={invoice.id} className="transition-colors hover:bg-zinc-50">
 <td className="px-8 py-4">
 <div className="font-mono font-bold text-green-600">{invoice.invoice_number}</div>
 <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{invoice.invoice_kind || 'Standard'}</div>
 </td>
 <td className="px-8 py-4 font-bold text-zinc-900">{invoice.client_name}</td>
 <td className="px-8 py-4">
 {invoice.batch ? (
 <span className="bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{invoice.batch}</span>
 ) : (
 <span className="text-xs text-zinc-300">—</span>
 )}
 </td>
 <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(invoice.amount_usd, invoice.currency || 'USD')}</td>
 <td className="px-8 py-4">
 <span className="bg-emerald-100 px-2 py-0.5 text-xs font-black uppercase tracking-tighter text-emerald-700">{invoice.status}</span>
 </td>
 <td className="px-8 py-4 text-xs text-zinc-400">{new Date(invoice.due_date).toLocaleDateString()}</td>
 <td className="px-8 py-4">
 <div className="flex items-center gap-4">
 <button type="button" onClick={() => onPreview(invoice)} className="text-xs font-bold text-zinc-600 hover:text-zinc-900">Preview</button>
 <button type="button" onClick={() => onEdit(invoice)} className="text-xs font-bold text-amber-600 hover:text-amber-700">Edit</button>
 <button type="button" onClick={() => onDownload(invoice)} className="text-xs font-bold text-green-600 hover:text-green-700">Download</button>
 <button
 type="button"
 onClick={() => onDelete(invoice)}
 disabled={deletingKey === `invoice:${invoice.id}`}
 className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {deletingKey === `invoice:${invoice.id}` ? 'Deleting...' : 'Delete'}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </>
 );
};

interface PaymentsSectionProps {
 payments: Payment[];
 deletingKey: string | null;
 formatMoney: (amount: number, currency?: string) => string;
 getPaymentClientName: (payment: Payment) => string;
 getPaymentCurrency: (payment: Payment) => string;
 getPaymentAllocationSummary: (payment: Payment) => string;
 onEdit: (payment: Payment) => void;
 onDelete: (payment: Payment) => void;
}

export const PaymentsSection: React.FC<PaymentsSectionProps> = ({
 payments,
 deletingKey,
 formatMoney,
 getPaymentClientName,
 getPaymentCurrency,
 getPaymentAllocationSummary,
 onEdit,
 onDelete,
}) => (
 <>
 <div className="space-y-3 p-3 sm:hidden">
 {payments.map((payment) => (
 <div key={payment.id} className="border border-zinc-100 bg-white p-4 shadow-sm">
 <div className="mb-2 flex items-start justify-between">
 <div>
 <div className="font-bold text-zinc-900">{payment.client_name}</div>
 <div className="text-xs font-mono text-zinc-500">{payment.reference_id}</div>
 </div>
 <span className="bg-green-100 px-2 py-0.5 text-xs font-black uppercase tracking-tighter text-green-700">{payment.type}</span>
 </div>
 <div className="mb-2 font-black text-zinc-900">{formatMoney(payment.amount_usd, getPaymentCurrency(payment))}</div>
 <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
 <span className="rounded bg-zinc-100 px-2 py-0.5">{payment.method}</span>
 <span>{new Date(payment.date).toLocaleDateString()}</span>
 </div>
 <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
 <button type="button" onClick={() => onEdit(payment)} className="px-2 py-1 text-xs font-bold text-amber-600 hover:text-amber-700">Edit</button>
 <button
 type="button"
 onClick={() => onDelete(payment)}
 disabled={deletingKey === `payment:${payment.id}`}
 className="px-2 py-1 text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {deletingKey === `payment:${payment.id}` ? 'Deleting...' : 'Delete'}
 </button>
 </div>
 </div>
 ))}
 </div>
 <table className="hidden w-full text-left text-sm sm:table">
 <thead className="border-b border-zinc-100 bg-zinc-50">
 <tr>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Client</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Reference</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Type</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Currency</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Method</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Date</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-100">
 {payments.map((payment) => (
 <tr key={payment.id}>
 <td className="px-8 py-4 font-bold text-zinc-900">{getPaymentClientName(payment)}</td>
 <td className="px-8 py-4">
 <div className="font-mono text-xs font-bold text-zinc-600">{payment.reference_id}</div>
 {getPaymentAllocationSummary(payment) ? (
 <div className="mt-1 text-[11px] text-zinc-400">{getPaymentAllocationSummary(payment)}</div>
 ) : null}
 </td>
 <td className="px-8 py-4">
 <span className={`text-xs font-black uppercase ${payment.type === 'Inbound' ? 'text-emerald-600' : 'text-red-600'}`}>{payment.type}</span>
 </td>
 <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(payment.amount_usd, getPaymentCurrency(payment))}</td>
 <td className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">{getPaymentCurrency(payment)}</td>
 <td className="px-8 py-4 font-medium text-zinc-500">{payment.method}</td>
 <td className="px-8 py-4 text-xs text-zinc-400">{new Date(payment.date).toLocaleDateString()}</td>
 <td className="px-8 py-4">
 <div className="flex items-center gap-4">
 <button type="button" onClick={() => onEdit(payment)} className="text-xs font-bold text-amber-600 hover:text-amber-700">Edit</button>
 <button
 type="button"
 onClick={() => onDelete(payment)}
 disabled={deletingKey === `payment:${payment.id}`}
 className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {deletingKey === `payment:${payment.id}` ? 'Deleting...' : 'Delete'}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </>
);

interface ReceiptsSectionProps {
 receipts: Receipt[];
 formatMoney: (amount: number, currency?: string) => string;
 onRecordPayment: () => void;
 onPreview: (receipt: Receipt) => void;
 onReissue: (receipt: Receipt) => void;
}

export const ReceiptsSection: React.FC<ReceiptsSectionProps> = ({
 receipts,
 formatMoney,
 onRecordPayment,
 onPreview,
 onReissue,
}) => (
 <div className="p-3 sm:p-8">
 {receipts.length === 0 ? (
 <div className="mx-auto max-w-lg bg-green-50 p-6 text-center sm:p-8">
 <svg className="mx-auto mb-4 h-12 w-12 text-green-600 sm:h-16 sm:w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 <h3 className="mb-2 text-lg font-black text-zinc-900 sm:text-xl">Receipts</h3>
 <p className="mb-4 text-sm text-zinc-500 sm:text-base">Record payments and generate receipts for clients.</p>
 <button type="button" onClick={onRecordPayment} className="bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 touch-manipulation">
 Record Payment
 </button>
 </div>
 ) : (
 <>
 <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:mb-6 sm:flex-row sm:items-center">
 <h3 className="text-lg font-black text-zinc-900 sm:text-xl">All Receipts</h3>
 <button type="button" onClick={onRecordPayment} className="w-full bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 touch-manipulation sm:w-auto">
 Record Payment
 </button>
 </div>
 <div className="space-y-3 sm:hidden">
 {receipts.map((receipt) => (
 <div key={receipt.id} className="border border-zinc-100 bg-white p-4 shadow-sm">
 <div className="mb-2 flex items-start justify-between">
 <span className="font-mono text-xs font-bold text-green-600">{receipt.receipt_number}</span>
 <span className="text-xs text-zinc-400">{new Date(receipt.payment_date).toLocaleDateString()}</span>
 </div>
 <div className="mb-1 font-bold text-zinc-900">{receipt.client_name}</div>
 <div className="mb-3 font-black text-zinc-900">{formatMoney(receipt.amount_received, receipt.currency)}</div>
 {receipt.batch ? (
 <span className="mb-3 inline-block bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{receipt.batch}</span>
 ) : null}
 <div className="mt-2 flex gap-3 border-t border-zinc-50 pt-3">
 <button type="button" onClick={() => onPreview(receipt)} className="flex-1 py-2 text-center text-xs font-bold text-blue-600 hover:text-blue-800">Preview PDF</button>
 <button type="button" onClick={() => onReissue(receipt)} className="flex-1 py-2 text-center text-xs font-bold text-emerald-600 hover:text-emerald-800">Reissue</button>
 </div>
 </div>
 ))}
 </div>
 <table className="hidden w-full text-left text-sm sm:table">
 <thead className="border-b border-zinc-100 bg-zinc-50">
 <tr>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Receipt #</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Client</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Batch</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Date</th>
 <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-100">
 {receipts.map((receipt) => (
 <tr key={receipt.id} className="transition-colors hover:bg-zinc-50">
 <td className="px-8 py-4 font-mono text-xs font-bold text-green-600">{receipt.receipt_number}</td>
 <td className="px-8 py-4 font-bold text-zinc-900">{receipt.client_name}</td>
 <td className="px-8 py-4">
 {receipt.batch ? (
 <span className="bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{receipt.batch}</span>
 ) : (
 <span className="text-xs text-zinc-300">—</span>
 )}
 </td>
 <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(receipt.amount_received, receipt.currency)}</td>
 <td className="px-8 py-4 text-xs text-zinc-400">{new Date(receipt.payment_date).toLocaleDateString()}</td>
 <td className="px-8 py-4">
 <div className="flex items-center gap-4">
 <button type="button" onClick={() => onPreview(receipt)} className="text-xs font-bold text-blue-600 hover:text-blue-800">Preview PDF</button>
 <button type="button" onClick={() => onReissue(receipt)} className="text-xs font-bold text-emerald-600 hover:text-emerald-800">Reissue</button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </>
 )}
 </div>
);

interface StatementsSectionProps {
 selectedClient: string;
 statementDateFrom: string;
 statementDateTo: string;
 clientOptions: string[];
 onClientChange: (value: string) => void;
 onDateFromChange: (value: string) => void;
 onDateToChange: (value: string) => void;
 onGenerate: () => void;
 onClear: () => void;
}

export const StatementsSection: React.FC<StatementsSectionProps> = ({
 selectedClient,
 statementDateFrom,
 statementDateTo,
 clientOptions,
 onClientChange,
 onDateFromChange,
 onDateToChange,
 onGenerate,
 onClear,
}) => (
 <div className="p-8">
 <div className="mx-auto max-w-lg bg-blue-50 p-8 text-center">
 <svg className="mx-auto mb-4 h-16 w-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 <h3 className="mb-2 text-xl font-black text-zinc-900">Client Statements</h3>
 <p className="mb-4 text-zinc-500">Generate a branded statement for one client using only that client&apos;s invoices and matching payments, optionally filtered by statement period.</p>
 <div className="mb-3 grid gap-3 sm:grid-cols-2">
 <div className="text-left">
 <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">From</label>
 <input type="date" value={statementDateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="w-full border border-zinc-200 px-4 py-3" />
 </div>
 <div className="text-left">
 <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">To</label>
 <input type="date" value={statementDateTo} onChange={(event) => onDateToChange(event.target.value)} className="w-full border border-zinc-200 px-4 py-3" />
 </div>
 </div>
 <div className="flex flex-col justify-center gap-3 sm:flex-row">
 <select value={selectedClient} onChange={(event) => onClientChange(event.target.value)} className="border border-zinc-200 px-4 py-3">
 <option value="">Select Client</option>
 {clientOptions.map((clientName) => (
 <option key={clientName} value={clientName}>
 {clientName}
 </option>
 ))}
 </select>
 <button type="button" onClick={onGenerate} className="bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
 Generate
 </button>
 <button
 type="button"
 onClick={onClear}
 disabled={!selectedClient}
 className="border border-zinc-200 px-6 py-3 font-bold text-zinc-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
 >
 Clear
 </button>
 </div>
 </div>
 </div>
);

