import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { Button, DashboardKpiCard, DashboardPageHeader, DashboardSection, Modal, TextInput, Select, SelectItem, TextArea } from './ui';
import { Plus, Truck, CheckCircle, Clock, Package, XCircle } from 'lucide-react';

interface Shipment {
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

const statusColors: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  'In Transit': 'bg-[#D97706]/10 text-[#D97706]',
  Delivered: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const statusIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Pending: Clock,
  'In Transit': Truck,
  Delivered: CheckCircle,
  Cancelled: XCircle,
};

export const Shipments: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [form, setForm] = useState({
    client_id: '',
    vehicle_id: '',
    description: '',
    origin: '',
    destination: '',
    status: 'Pending' as const,
    shipping_date: '',
    delivery_date: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [shipmentData, clientData, vehicleData] = await Promise.all([
        dataService.getShipments(),
        dataService.getClients(),
        dataService.getVehicles(),
      ]);
      setShipments(shipmentData);
      setClients(clientData);
      setVehicles(vehicleData);
    } catch (error) {
      showToast('Failed to load shipments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShipment) {
        await dataService.updateShipment(editingShipment.id, form);
        showToast('Shipment updated successfully', 'success');
      } else {
        await dataService.addShipment(form);
        showToast('Shipment created successfully', 'success');
      }
      setShowModal(false);
      setEditingShipment(null);
      resetForm();
      fetchData();
    } catch (error) {
      showToast('Failed to save shipment', 'error');
    }
  };

  const resetForm = () => {
    setForm({
      client_id: '',
      vehicle_id: '',
      description: '',
      origin: '',
      destination: '',
      status: 'Pending',
      shipping_date: '',
      delivery_date: '',
    });
  };

  const openEditModal = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setForm({
      client_id: shipment.client_id,
      vehicle_id: shipment.vehicle_id || '',
      description: shipment.description,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      shipping_date: shipment.shipping_date || '',
      delivery_date: shipment.delivery_date || '',
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingShipment(null);
    resetForm();
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Shipment',
      message: 'Are you sure you want to delete this shipment? This cannot be undone.',
      confirmLabel: 'Delete',
      isDangerous: true,
    });
    if (!ok) return;
    try {
      await dataService.deleteShipment(id);
      showToast('Shipment deleted', 'success');
      fetchData();
    } catch {
      showToast('Failed to delete shipment', 'error');
    }
  };

  const stats = {
    total: shipments.length,
    pending: shipments.filter(s => s.status === 'Pending').length,
    inTransit: shipments.filter(s => s.status === 'In Transit').length,
    delivered: shipments.filter(s => s.status === 'Delivered').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-stone-200 border-t-[#D97706]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      <ConfirmDialog />

      <DashboardPageHeader
        title="Shipments"
        subtitle="Cross-border vehicle logistics"
        actions={
          <Button onClick={openAddModal} leftIcon={<Plus size={18} />}>
            New Shipment
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardKpiCard label="Total Shipments" value={stats.total} icon={Package} iconTone="amber" />
        <DashboardKpiCard label="Pending" value={stats.pending} icon={Clock} iconTone="stone" />
        <DashboardKpiCard label="In Transit" value={stats.inTransit} icon={Truck} iconTone="blue" />
        <DashboardKpiCard label="Delivered" value={stats.delivered} icon={CheckCircle} iconTone="emerald" />
      </div>

      <DashboardSection title="All Shipments">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                Origin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                Destination
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No shipments yet. Create your first shipment.
                </td>
              </tr>
            ) : (
              shipments.map(shipment => {
                const StatusIcon = statusIcons[shipment.status] || Clock;
                return (
                  <tr key={shipment.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{shipment.client_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-zinc-600">{shipment.description}</td>
                    <td className="px-4 py-3 text-zinc-600">{shipment.origin}</td>
                    <td className="px-4 py-3 text-zinc-600">{shipment.destination}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[shipment.status]}`}
                      >
                        <StatusIcon size={12} />
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-sm">
                      {shipment.shipping_date
                        ? new Date(shipment.shipping_date).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(shipment)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(shipment.id)}
                        className="text-red-600"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </DashboardSection>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingShipment ? 'Edit Shipment' : 'New Shipment'}
        label="Shipment"
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="shipment-form" variant="primary">
              {editingShipment ? 'Save Changes' : 'Create Shipment'}
            </Button>
          </div>
        }
      >
        <form id="shipment-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Client & Vehicle */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Client & Vehicle</h3>
              <div className="space-y-3">
              <Select
                id="shipment-client"
                labelText="Client"
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
                required
              >
                <SelectItem value="" text="Select client" />
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} text={c.name} />
                ))}
              </Select>
              <Select
                id="shipment-vehicle"
                labelText="Vehicle"
                helperText="Optional — leave empty for general shipments"
                value={form.vehicle_id}
                onChange={e => setForm({ ...form, vehicle_id: e.target.value })}
              >
                <SelectItem value="" text="No vehicle" />
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.vin_number})`} />
                ))}
              </Select>
            </div>
          </div>
        </section>

          {/* Route */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Route</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                id="shipment-origin"
                labelText="Origin"
                placeholder="e.g. UK"
                value={form.origin}
                onChange={e => setForm({ ...form, origin: e.target.value })}
                required
              />
              <TextInput
                id="shipment-destination"
                labelText="Destination"
                placeholder="e.g. Namibia"
                value={form.destination}
                onChange={e => setForm({ ...form, destination: e.target.value })}
                required
              />
            </div>
          </div>
        </section>

          {/* Description */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Description</h3>
              <TextInput
              id="shipment-description"
              labelText="Shipment Description"
              placeholder="e.g. Toyota Land Cruiser V8"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
        </section>

          {/* Status & Dates */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Status & Dates</h3>
              <div className="space-y-3">
              <Select
                id="shipment-status"
                labelText="Status"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as any })}
              >
                <SelectItem value="Pending" text="Pending" />
                <SelectItem value="In Transit" text="In Transit" />
                <SelectItem value="Delivered" text="Delivered" />
                <SelectItem value="Cancelled" text="Cancelled" />
              </Select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  id="shipment-shipping-date"
                  labelText="Shipping Date"
                  type="date"
                  value={form.shipping_date}
                  onChange={e => setForm({ ...form, shipping_date: e.target.value })}
                />
                <TextInput
                  id="shipment-delivery-date"
                  labelText="Delivery Date"
                  type="date"
                  value={form.delivery_date}
                  onChange={e => setForm({ ...form, delivery_date: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>
        </form>
      </Modal>
    </div>
  );
};

export default Shipments;
