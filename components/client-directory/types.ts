import type { Client } from '../../types';

export interface EnrichedClient extends Client {
  isRegistered: boolean;
}

export interface ClientStats {
  totalBilled: number;
  totalPaid: number;
  openingBalance: number;
  outstanding: number;
  creditBalance: number;
  invoiceCount: number;
  quoteCount: number;
  paymentCount: number;
}

export interface LedgerRow {
  date: Date;
  type: 'opening' | 'invoice' | 'payment';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  id?: string;
}

export const formatMoney = (amount: number, currency: string = 'USD'): string => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.abs(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
