import type { LandedCostSummary, Vehicle, VehiclePurpose } from '../types';

export interface VehicleEditorRecord {
  id: string;
  vehicle_id?: string;
  vin_number: string;
  reg_number: string;
  make_model: string;
  purchase_price_gbp: number;
  status: Vehicle['status'];
  purpose: VehiclePurpose;
  cbca_applied: boolean;
}

export const toVehicleEditorRecord = (
  vehicle: Vehicle | LandedCostSummary
): VehicleEditorRecord => {
  if ('vehicle_id' in vehicle) {
    return {
      id: vehicle.vehicle_id,
      vehicle_id: vehicle.vehicle_id,
      vin_number: vehicle.vin_number,
      reg_number: (vehicle as any).reg_number || '',
      make_model: vehicle.make_model,
      purchase_price_gbp: vehicle.purchase_price_gbp,
      status: vehicle.status,
      purpose: (vehicle as any).purpose || 'Resale',
      cbca_applied: (vehicle as any).cbca_applied || false,
    };
  }

  return {
    id: vehicle.id,
    vin_number: vehicle.vin_number,
    reg_number: vehicle.reg_number || '',
    make_model: vehicle.make_model,
    purchase_price_gbp: vehicle.purchase_price_gbp,
    status: vehicle.status,
    purpose: vehicle.purpose || 'Resale',
    cbca_applied: vehicle.cbca_applied || false,
  };
};
