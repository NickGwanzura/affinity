import type { LandedCostSummary, Vehicle } from '../types';

export interface VehicleEditorRecord {
  id: string;
  vehicle_id?: string;
  vin_number: string;
  make_model: string;
  purchase_price_gbp: number;
  status: Vehicle['status'];
}

export const toVehicleEditorRecord = (
  vehicle: Vehicle | LandedCostSummary,
): VehicleEditorRecord => {
  if ('vehicle_id' in vehicle) {
    return {
      id: vehicle.vehicle_id,
      vehicle_id: vehicle.vehicle_id,
      vin_number: vehicle.vin_number,
      make_model: vehicle.make_model,
      purchase_price_gbp: vehicle.purchase_price_gbp,
      status: vehicle.status,
    };
  }

  return {
    id: vehicle.id,
    vin_number: vehicle.vin_number,
    make_model: vehicle.make_model,
    purchase_price_gbp: vehicle.purchase_price_gbp,
    status: vehicle.status,
  };
};
