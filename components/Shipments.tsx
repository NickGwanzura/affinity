import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { Button, DashboardCard } from './ui';
import { Plus, Package, Truck, CheckCircle, XCircle, Clock } from 'lucide-react';

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
  'In Transit': 'bg-blue-100 text-blue-800',
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ToastContainer />
      <ConfirmDialog />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Shipments</h1>
            <p className="text-sm text-gray-500">Track vehicles and goods shipping</p>
          </div>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus size={18} />}>
          New Shipment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <DashboardCard>
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Shipments</div>
        </DashboardCard>
        <DashboardCard>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </DashboardCard>
        <DashboardCard>
          <div className="text-2xl font-bold text-blue-600">{stats.inTransit}</div>
          <div className="text-sm text-gray-500">In Transit</div>
        </DashboardCard>
        <DashboardCard>
          <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
          <div className="text-sm text-gray-500">Delivered</div>
        </DashboardCard>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Origin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Destination
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No shipments yet. Create your first shipment.
                </td>
              </tr>
            ) : (
              shipments.map(shipment => {
                const StatusIcon = statusIcons[shipment.status] || Clock;
                return (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{shipment.client_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-600">{shipment.description}</td>
                    <td className="px-4 py-3 text-gray-600">{shipment.origin}</td>
                    <td className="px-4 py-3 text-gray-600">{shipment.destination}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[shipment.status]}`}
                      >
                        <StatusIcon size={12} />
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingShipment ? 'Edit Shipment' : 'New Shipment'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <select
                  value={form.client_id}
                  onChange={e => setForm({ ...form, client_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle (optional)</label>
                <select
                  value={form.vehicle_id}
                  onChange={e => setForm({ ...form, vehicle_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">No vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.make_model} ({v.vin_number})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g. Toyota Land Cruiser V8"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Origin</label>
                  <input
                    type="text"
                    value={form.origin}
                    onChange={e => setForm({ ...form, origin: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g. UK"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Destination</label>
                  <input
                    type="text"
                    value={form.destination}
                    onChange={e => setForm({ ...form, destination: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g. Namibia"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Shipping Date</label>
                  <input
                    type="date"
                    value={form.shipping_date}
                    onChange={e => setForm({ ...form, shipping_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={e => setForm({ ...form, delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingShipment ? 'Save Changes' : 'Create Shipment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
