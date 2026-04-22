import { useCallback, useEffect, useState } from 'react';
import type { Client, Invoice, Quote, Payment, Vehicle } from '../../types';
import { dataService } from '../../services/dataService';

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

export interface ClientDirectoryData {
  clients: Client[];
  invoices: Invoice[];
  quotes: Quote[];
  payments: Payment[];
  vehicles: Vehicle[];
  shipments: ShipmentRow[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useClientDirectoryData(
  onError: (message: string) => void
): ClientDirectoryData {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [cli, inv, quo, pay, veh, shp] = await Promise.all([
        dataService.getClients(),
        dataService.getInvoices(),
        dataService.getQuotes(),
        dataService.getPayments(),
        dataService.getVehicles(),
        dataService.getShipments(),
      ]);
      setClients(cli);
      setInvoices(inv);
      setQuotes(quo);
      setPayments(pay);
      setVehicles(veh);
      setShipments(shp as ShipmentRow[]);
    } catch (err: any) {
      onError(err?.message || 'Failed to load client directory');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { clients, invoices, quotes, payments, vehicles, shipments, loading, reload };
}
