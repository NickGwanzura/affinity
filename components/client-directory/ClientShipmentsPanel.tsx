import React, { useMemo, useState } from 'react';
import { Plus, Truck, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import { Button, Tile, Tag, TextInput, Select, SelectItem, Modal } from '../ui';
import type { Vehicle } from '../../types';
import { dataService } from '../../services/dataService';
import { useConfirm } from '../ConfirmModal';
import type { ShipmentRow } from './types';

interface ClientShipmentsPanelProps {
  clientId: string;
  shipments: ShipmentRow[];
  vehicles: Vehicle[];
  onChange: () => Promise<void> | void;
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;
}

const statusTagType: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  Pending: 'gray',
  'In Transit': 'blue',
  Delivered: 'green',
  Cancelled: 'red',
};

const statusIcon: Record<string, React.ComponentType<{ size?: number }>> = {
  Pending: Clock,
  'In Transit': Truck,
  Delivered: CheckCircle,
  Cancelled: XCircle,
};

interface ShipmentFormState {
  vehicle_id: string;
  description: string;
  origin: string;
  destination: string;
  status: ShipmentRow['status'];
  shipping_date: string;
  delivery_date: string;
}

const emptyForm: ShipmentFormState = {
  vehicle_id: '',
  description: '',
  origin: '',
  destination: '',
  status: 'Pending',
  shipping_date: '',
  delivery_date: '',
};

export const ClientShipmentsPanel: React.FC<ClientShipmentsPanelProps> = ({
  clientId,
  shipments,
  vehicles,
  onChange,
  showToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ShipmentRow | null>(null);
  const [form, setForm] = useState<ShipmentFormState>(emptyForm);
  const { confirm, ConfirmDialog } = useConfirm();

  const clientShipments = useMemo(
    () => shipments.filter((s) => s.client_id === clientId),
    [shipments, clientId]
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (s: ShipmentRow) => {
    setEditing(s);
    setForm({
      vehicle_id: s.vehicle_id || '',
      description: s.description,
      origin: s.origin,
      destination: s.destination,
      status: s.status,
      shipping_date: s.shipping_date || '',
      delivery_date: s.delivery_date || '',
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const payload = {
        client_id: clientId,
        vehicle_id: form.vehicle_id || undefined,
        description: form.description,
        origin: form.origin,
        destination: form.destination,
        status: form.status,
        shipping_date: form.shipping_date || undefined,
        delivery_date: form.delivery_date || undefined,
      };
      if (editing) {
        await dataService.updateShipment(editing.id, payload);
        showToast('Shipment updated', 'success');
      } else {
        await dataService.addShipment(payload);
        showToast('Shipment created', 'success');
      }
      setIsOpen(false);
      await onChange();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save shipment', 'error');
    }
  };

  const handleDelete = async (s: ShipmentRow) => {
    const ok = await confirm({
      title: 'Delete shipment?',
      message: `Delete shipment "${s.description}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await dataService.deleteShipment(s.id);
      showToast('Shipment deleted', 'success');
      await onChange();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete shipment', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Tile>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100">
              <Package size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Client Shipments</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Goods in transit for this client, optionally linked to a vehicle.
              </p>
            </div>
          </div>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={openAdd}>
            New Shipment
          </Button>
        </div>
      </Tile>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Description</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Vehicle</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Origin</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Destination</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Ship Date</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clientShipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No shipments for this client
                </td>
              </tr>
            ) : (
              clientShipments.map((s) => {
                const Icon = statusIcon[s.status] || Clock;
                return (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{s.description}</td>
                    <td className="px-3 py-2 text-gray-700">{s.vehicle_name || '–'}</td>
                    <td className="px-3 py-2 text-gray-700">{s.origin}</td>
                    <td className="px-3 py-2 text-gray-700">{s.destination}</td>
                    <td className="px-3 py-2">
                      <Tag type={statusTagType[s.status] || 'gray'} size="sm">
                        <span className="inline-flex items-center gap-1">
                          <Icon size={12} /> {s.status}
                        </span>
                      </Tag>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {s.shipping_date ? new Date(s.shipping_date).toLocaleDateString() : '–'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(s)}
                          className="text-red-600"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={editing ? 'Edit Shipment' : 'New Shipment'}
        label="Shipment record"
        size="md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <TextInput
            id="shipment-description"
            labelText="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Toyota Land Cruiser V8"
            required
          />
          <Select
            id="shipment-vehicle"
            labelText="Vehicle (optional)"
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
          >
            <SelectItem value="" text="No vehicle" />
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.vin_number})`} />
            ))}
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              id="shipment-origin"
              labelText="Origin"
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              placeholder="e.g. UK"
              required
            />
            <TextInput
              id="shipment-destination"
              labelText="Destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="e.g. Namibia"
              required
            />
          </div>
          <Select
            id="shipment-status"
            labelText="Status"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as ShipmentRow['status'] })
            }
          >
            <SelectItem value="Pending" text="Pending" />
            <SelectItem value="In Transit" text="In Transit" />
            <SelectItem value="Delivered" text="Delivered" />
            <SelectItem value="Cancelled" text="Cancelled" />
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              id="shipment-ship-date"
              type="date"
              labelText="Shipping Date"
              value={form.shipping_date}
              onChange={(e) => setForm({ ...form, shipping_date: e.target.value })}
            />
            <TextInput
              id="shipment-delivery-date"
              type="date"
              labelText="Delivery Date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save Changes' : 'Create Shipment'}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog />
    </div>
  );
};

export default ClientShipmentsPanel;
