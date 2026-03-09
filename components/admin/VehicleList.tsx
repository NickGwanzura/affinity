import React, { memo, useCallback, useMemo } from 'react';
import { VEHICLE_STATUS } from '../../constants';
import type { LandedCostSummary, VehicleStatus } from '../../types';

// ============================================
// Types
// ============================================
interface VehicleListProps {
  vehicles: LandedCostSummary[];
  onEdit: (vehicle: LandedCostSummary) => void;
  onDelete: (vehicle: LandedCostSummary) => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get status badge styles based on vehicle status
 */
const getStatusStyles = (status: VehicleStatus): string => {
  const styles: Record<VehicleStatus, string> = {
    [VEHICLE_STATUS.UK]: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
    [VEHICLE_STATUS.NAMIBIA]: 'bg-amber-50 text-amber-700 ring-amber-100',
    [VEHICLE_STATUS.ZIMBABWE]: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    [VEHICLE_STATUS.BOTSWANA]: 'bg-purple-50 text-purple-700 ring-purple-100',
    [VEHICLE_STATUS.SOLD]: 'bg-blue-50 text-blue-700 ring-blue-100'
  };
  return styles[status] || styles[VEHICLE_STATUS.UK];
};

// ============================================
// Sub-Components
// ============================================

interface VehicleRowProps {
  vehicle: LandedCostSummary;
  onEdit: (vehicle: LandedCostSummary) => void;
  onDelete: (vehicle: LandedCostSummary) => void;
}

const VehicleRow: React.FC<VehicleRowProps> = memo(({ vehicle, onEdit, onDelete }) => {
  const handleEdit = useCallback(() => {
    onEdit(vehicle);
  }, [vehicle, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(vehicle);
  }, [vehicle, onDelete]);

  const statusStyles = useMemo(() => getStatusStyles(vehicle.status), [vehicle.status]);

  return (
    <tr className="hover:bg-zinc-50 transition-all group">
      {/* Asset / VIN Column */}
      <td className="px-8 py-6">
        <div className="flex flex-col">
          <span className="font-black text-zinc-900 text-base">{vehicle.make_model}</span>
          <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            {vehicle.vin_number}
          </span>
        </div>
      </td>

      {/* Region Column */}
      <td className="px-8 py-6">
        <span 
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 ${statusStyles}`}
        >
          {vehicle.status}
        </span>
      </td>

      {/* Purchase Cost Column */}
      <td className="px-8 py-6 font-bold text-zinc-400 tracking-tight">
        £{vehicle.purchase_price_gbp.toLocaleString()}
      </td>

      {/* Landed Cost Column */}
      <td className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-black text-zinc-900 text-lg">
              ${vehicle.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              Total Valuation
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-blue-50 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              title="Edit vehicle"
              aria-label={`Edit ${vehicle.make_model}`}
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Delete vehicle"
              aria-label={`Delete ${vehicle.make_model}`}
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
});

VehicleRow.displayName = 'VehicleRow';

// ============================================
// Main Component
// ============================================

export const VehicleList: React.FC<VehicleListProps> = memo(({ vehicles, onEdit, onDelete }) => {
  // Calculate total valuation
  const totalValuation = useMemo(() => 
    vehicles.reduce((acc, vehicle) => acc + vehicle.total_landed_cost_usd, 0),
  [vehicles]);

  // Calculate in-transit count
  const inTransitCount = useMemo(() => 
    vehicles.filter(v => v.status !== VEHICLE_STATUS.SOLD).length,
  [vehicles]);

  if (vehicles.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-12 text-center">
        <svg 
          className="w-16 h-16 text-zinc-300 mx-auto mb-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
        <h3 className="text-lg font-bold text-zinc-900 mb-2">No Vehicles Found</h3>
        <p className="text-zinc-500">Add your first vehicle to start tracking your fleet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
        <div>
          <h3 className="text-xl font-black text-zinc-900 tracking-tight">Current Inventory</h3>
          <p className="text-sm text-zinc-500 mt-1">
            {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} • {inTransitCount} in transit
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total Value</p>
          <p className="text-2xl font-black text-zinc-900">
            ${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table 
          className="w-full text-left text-sm"
          role="table"
          aria-label="Vehicle inventory list"
        >
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th 
                scope="col" 
                className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Asset / VIN
              </th>
              <th 
                scope="col" 
                className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Region
              </th>
              <th 
                scope="col" 
                className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Purchase Cost
              </th>
              <th 
                scope="col" 
                className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Landed Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {vehicles.map((vehicle) => (
              <VehicleRow
                key={vehicle.vehicle_id}
                vehicle={vehicle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

VehicleList.displayName = 'VehicleList';

export default VehicleList;
