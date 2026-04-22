import { useCallback, useEffect, useState } from 'react';
import type { Client, Invoice, Quote, Payment, Vehicle } from '../../types';
import { dataService } from '../../services/dataService';
import type { ShipmentRow } from './types';

export interface ClientDirectoryData {
  clients: Client[];
  invoices: Invoice[];
  quotes: Quote[];
  payments: Payment[];
  vehicles: Vehicle[];
  shipments: ShipmentRow[];
  loading: boolean;
  reload: () => Promise<void>;
  // Incremental patchers — prefer these over reload() so CRUD mutations
  // don't refetch 6 endpoints and flash the split pane to a spinner.
  addClient: (client: Client) => void;
  patchClient: (id: string, partial: Partial<Client>) => void;
  removeClient: (id: string) => void;
  addVehicle: (vehicle: Vehicle) => void;
  patchVehicle: (id: string, partial: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  addShipment: (shipment: ShipmentRow) => void;
  patchShipment: (id: string, partial: Partial<ShipmentRow>) => void;
  removeShipment: (id: string) => void;
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
  // Initial load is the ONLY time loading starts true. Mutations patch
  // state locally and never flip this flag.
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

  const addClient = useCallback((client: Client) => {
    setClients((prev) =>
      prev.some((c) => c.id === client.id) ? prev : [...prev, client]
    );
  }, []);

  const patchClient = useCallback((id: string, partial: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  }, []);

  const removeClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addVehicle = useCallback((vehicle: Vehicle) => {
    setVehicles((prev) =>
      prev.some((v) => v.id === vehicle.id) ? prev : [...prev, vehicle]
    );
  }, []);

  const patchVehicle = useCallback((id: string, partial: Partial<Vehicle>) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...partial } : v)));
  }, []);

  const removeVehicle = useCallback((id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const addShipment = useCallback((shipment: ShipmentRow) => {
    setShipments((prev) =>
      prev.some((s) => s.id === shipment.id) ? prev : [...prev, shipment]
    );
  }, []);

  const patchShipment = useCallback((id: string, partial: Partial<ShipmentRow>) => {
    setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  }, []);

  const removeShipment = useCallback((id: string) => {
    setShipments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    clients,
    invoices,
    quotes,
    payments,
    vehicles,
    shipments,
    loading,
    reload,
    addClient,
    patchClient,
    removeClient,
    addVehicle,
    patchVehicle,
    removeVehicle,
    addShipment,
    patchShipment,
    removeShipment,
  };
}
