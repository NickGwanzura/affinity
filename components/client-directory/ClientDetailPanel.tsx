import React from 'react';
import { Users } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '../ui';
import type { Client, Invoice, Quote, Payment, Vehicle } from '../../types';
import { ClientDetailHeader } from './ClientDetailHeader';
import { ClientEntityTable } from './ClientEntityTable';
import { ClientStatementLedger } from './ClientStatementLedger';
import { ClientVehiclesPanel } from './ClientVehiclesPanel';
import { ClientShipmentsPanel } from './ClientShipmentsPanel';
import { invoiceColumns, quoteColumns, paymentColumns } from './columns';
import {
  buildClientLedger,
  computeClientStats,
  sameName,
} from './helpers';
import type { EnrichedClient } from './types';

interface ShipmentRow {
  id: string;
  client_id: string;
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

interface Props {
  client: EnrichedClient | null;
  enrichedClients: EnrichedClient[];
  invoices: Invoice[];
  quotes: Quote[];
  payments: Payment[];
  vehicles: Vehicle[];
  shipments: ShipmentRow[];
  activeTab: number;
  onActiveTabChange: (i: number) => void;
  onBack: () => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onRefresh: () => Promise<void> | void;
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onDownloadPdf: () => void;
  isGeneratingPdf: boolean;
}

export const ClientDetailPanel: React.FC<Props> = ({
  client: c,
  enrichedClients,
  invoices,
  quotes,
  payments,
  vehicles,
  shipments,
  activeTab,
  onActiveTabChange,
  onBack,
  onEdit,
  onDelete,
  onRefresh,
  showToast,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onDownloadPdf,
  isGeneratingPdf,
}) => {
  if (!c) {
    return (
      <div className="bg-white border border-gray-200 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users size={36} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 text-sm font-medium">Select a client to view details</p>
        </div>
      </div>
    );
  }

  const clientInvoices = invoices.filter((i) => sameName(i.client_name, c.name));
  const clientQuotes = quotes.filter((q) => sameName(q.client_name, c.name));
  const clientPayments = payments.filter((p) => sameName(p.client_name, c.name));
  const stats = computeClientStats(c.name, enrichedClients, invoices, quotes, payments);
  const canShowFleet = c.isRegistered && !c.id.startsWith('inv-');

  return (
    <div className="flex flex-col gap-4">
      <ClientDetailHeader
        client={c}
        stats={stats}
        onEdit={() => onEdit(c)}
        onDelete={() => onDelete(c)}
        onBack={onBack}
      />

      <div className="bg-white border border-gray-200">
        <Tabs
          selectedIndex={activeTab}
          onChange={({ selectedIndex }) => onActiveTabChange(selectedIndex)}
        >
          <TabList>
            <Tab>Statement</Tab>
            <Tab>{`Invoices (${clientInvoices.length})`}</Tab>
            <Tab>{`Quotes (${clientQuotes.length})`}</Tab>
            <Tab>{`Payments (${clientPayments.length})`}</Tab>
            {canShowFleet && <Tab>Vehicles</Tab>}
            {canShowFleet && <Tab>Shipments</Tab>}
          </TabList>
          <TabPanels>
            <TabPanel className="p-4">
              <ClientStatementLedger
                ledger={buildClientLedger(c, invoices, payments)}
                stats={stats}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={onDateFromChange}
                onDateToChange={onDateToChange}
                onDownloadPdf={onDownloadPdf}
                isGenerating={isGeneratingPdf}
              />
            </TabPanel>
            <TabPanel className="p-4">
              <ClientEntityTable
                rows={clientInvoices}
                columns={invoiceColumns}
                emptyMessage="No invoices for this client"
              />
            </TabPanel>
            <TabPanel className="p-4">
              <ClientEntityTable
                rows={clientQuotes}
                columns={quoteColumns}
                emptyMessage="No quotes for this client"
              />
            </TabPanel>
            <TabPanel className="p-4">
              <ClientEntityTable
                rows={clientPayments}
                columns={paymentColumns}
                emptyMessage="No payments recorded for this client"
              />
            </TabPanel>
            {canShowFleet && (
              <TabPanel className="p-4">
                <ClientVehiclesPanel
                  clientId={c.id}
                  vehicles={vehicles}
                  onChange={onRefresh}
                  showToast={showToast}
                />
              </TabPanel>
            )}
            {canShowFleet && (
              <TabPanel className="p-4">
                <ClientShipmentsPanel
                  clientId={c.id}
                  shipments={shipments}
                  vehicles={vehicles}
                  onChange={onRefresh}
                  showToast={showToast}
                />
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientDetailPanel;
