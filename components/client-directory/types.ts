import type { Client } from '../../types';

export interface EnrichedClient extends Client {
  isRegistered: boolean;
}

export interface ShipmentRow {
  id: string;
  client_id: string;
  client_name?: string;
  vehicle_id?: string;
  vehicle_name?: string;
  description: string;
  origin: string;
  destination: string;
  status: 'Pending' | 'In Transit' | 'Delivered' | 'Cancelled';
  shipping_date?: string;
  delivery_date?: string;
  created_at: string;
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
  // Signed per-currency net balance (positive = client owes us,
  // negative = client is in credit). Used by ClientDetailHeader and
  // ClientListSidebar to render USD + GBP side by side.
  usdBalance: number;
  gbpBalance: number;
}

export interface LedgerRow {
  date: Date;
  type: 'opening' | 'invoice' | 'payment';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  id?: string;
  currency?: 'USD' | 'GBP';
}

export const formatMoney = (amount: number, currency: string = 'USD'): string => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.abs(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
