import React, { useMemo, useState } from 'react';
import { Plus, Link2, Unlink, FileText, AlertCircle } from 'lucide-react';
import { Button, IconButton, Tag, Tile, Select, SelectItem } from '../ui';
import type { Vehicle } from '../../types';
import { dataService } from '../../services/dataService';
import VehicleFormModal, { type VehicleFormValue } from '../shared/VehicleFormModal';
import { useConfirm } from '../ConfirmModal';

interface ClientVehiclesPanelProps {
  clientId: string;
  vehicles: Vehicle[];
  // Incremental patchers replace the old onChange=reload() plumbing so
  // add/edit/unlink no longer refetches the whole directory.
  addVehicle: (vehicle: Vehicle) => void;
  patchVehicle: (id: string, partial: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;
}

const emptyVehicleForm: VehicleFormValue = {
  vin: '',
  reg: '',
  model: '',
  price: '',
  purpose: 'Client',
  cbcaApplied: false,
  regBookUrl: '',
  currency: 'GBP',
};

export const ClientVehiclesPanel: React.FC<ClientVehiclesPanelProps> = ({
  clientId,
  vehicles,
  addVehicle,
  patchVehicle,
  // Vehicles here are only linked/unlinked (patched), never hard-deleted,
  // so removeVehicle is accepted but unused. Kept on the props for shape
  // consistency with the other fleet panel.
  removeVehicle: _removeVehicle,
  showToast,
}) => {
  void _removeVehicle;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleFormValue>(emptyVehicleForm);
  const [linkSelection, setLinkSelection] = useState<string>('');
  const { confirm, ConfirmDialog } = useConfirm();

  const linkedVehicles = useMemo(
    () => vehicles.filter((v) => v.client_id === clientId),
    [vehicles, clientId]
  );

  const availableToLink = useMemo(
    () => vehicles.filter((v) => !v.client_id),
    [vehicles]
  );

  const openAdd = () => {
    setEditingVehicle(null);
    setForm(emptyVehicleForm);
    setIsFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      vin: vehicle.vin_number,
      reg: vehicle.reg_number || '',
      model: vehicle.make_model,
      price: String(vehicle.purchase_price_gbp || ''),
      purpose: (vehicle.purpose as 'Resale' | 'Client') || 'Client',
      cbcaApplied: Boolean(vehicle.cbca_applied),
      regBookUrl: vehicle.reg_book_url || '',
      currency: 'GBP',
    });
    setIsFormOpen(true);
  };

  const handleFormChange = (updates: Partial<VehicleFormValue>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        vin_number: form.vin,
        reg_number: form.reg,
        make_model: form.model,
        purchase_price_gbp: parseFloat(form.price),
        purpose: form.purpose,
        cbca_applied: form.cbcaApplied,
        reg_book_url: form.regBookUrl || undefined,
        client_id: clientId,
      };
      if (editingVehicle) {
        const updated = await dataService.updateVehicle(editingVehicle.id, payload);
        patchVehicle(editingVehicle.id, updated);
        showToast('Vehicle updated successfully', 'success');
      } else {
        const created = await dataService.addVehicle({
          ...payload,
          status: 'UK',
        } as Omit<Vehicle, 'id' | 'created_at'>);
        addVehicle(created);
        showToast('Vehicle added successfully', 'success');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save vehicle', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (vehicle: Vehicle) => {
    const ok = await confirm({
      title: 'Unlink vehicle?',
      message: `Unlink "${vehicle.make_model}" (${vehicle.vin_number}) from this client?`,
      confirmLabel: 'Unlink',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await dataService.updateVehicle(vehicle.id, { client_id: undefined });
      // Clear the linkage locally so the row falls out of linkedVehicles.
      patchVehicle(vehicle.id, { client_id: undefined });
      showToast('Vehicle unlinked from client', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to unlink vehicle', 'error');
    }
  };

  const handleLinkExisting = async () => {
    if (!linkSelection) return;
    try {
      await dataService.updateVehicle(linkSelection, { client_id: clientId });
      patchVehicle(linkSelection, { client_id: clientId });
      showToast('Vehicle linked to client', 'success');
      setLinkSelection('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to link vehicle', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Tile>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Client Vehicles</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Vehicles linked to this client, including reg-book uploads.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            {availableToLink.length > 0 && (
              <div className="flex gap-2 items-end">
                <Select
                  id="link-existing-vehicle"
                  labelText="Link existing"
                  hideLabel
                  value={linkSelection}
                  onChange={(e) => setLinkSelection(e.target.value)}
                  className="min-w-[14rem]"
                >
                  <SelectItem value="" text="Link an existing vehicle..." />
                  {availableToLink.map((v) => (
                    <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.vin_number})`} />
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Link2 size={14} />}
                  onClick={handleLinkExisting}
                  disabled={!linkSelection}
                >
                  Link
                </Button>
              </div>
            )}
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={openAdd}>
              Add Vehicle
            </Button>
          </div>
        </div>
      </Tile>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Make/Model</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reg #</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">VIN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Purpose</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reg Book</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {linkedVehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No vehicles linked to this client yet
                </td>
              </tr>
            ) : (
              linkedVehicles.map((v) => (
                <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{v.make_model}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{v.reg_number || '–'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{v.vin_number}</td>
                  <td className="px-3 py-2">
                    <Tag type="cool-gray" size="sm">{v.status}</Tag>
                  </td>
                  <td className="px-3 py-2">
                    <Tag type={v.purpose === 'Client' ? 'blue' : 'gray'} size="sm">
                      {v.purpose}
                    </Tag>
                  </td>
                  <td className="px-3 py-2">
                    {v.reg_book_url ? (
                      <a
                        href={v.reg_book_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-amber-600 hover:underline text-xs"
                      >
                        <FileText size={12} /> View
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                        <AlertCircle size={12} /> Missing
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                        Edit
                      </Button>
                      <IconButton
                        icon={<Unlink size={14} />}
                        size="sm"
                        variant="ghost"
                        label="Unlink from client"
                        onClick={() => handleUnlink(v)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <VehicleFormModal
        isOpen={isFormOpen}
        isEditing={Boolean(editingVehicle)}
        onClose={() => {
          setIsFormOpen(false);
          setEditingVehicle(null);
          setForm(emptyVehicleForm);
        }}
        onSubmit={handleSubmit}
        form={form}
        onChange={handleFormChange}
        isSubmitting={isSubmitting}
        hidePurpose={true}
      />
      <ConfirmDialog />
    </div>
  );
};

export default ClientVehiclesPanel;
