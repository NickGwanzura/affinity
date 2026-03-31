import React, { useMemo } from 'react';
import type { Trip } from '../../types';

interface AdminTripsViewProps {
  trips: Trip[];
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (trip: Trip) => void;
}

const statusClasses: Record<Trip['status'], string> = {
  Planned: 'bg-slate-100 text-slate-700 border-slate-200',
  Assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Transit': 'bg-amber-100 text-amber-700 border-amber-200',
  Delayed: 'bg-rose-100 text-rose-700 border-rose-200',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export const AdminTripsView: React.FC<AdminTripsViewProps> = ({ trips, onEditTrip, onDeleteTrip }) => {
  const now = new Date();
  const upcoming = useMemo(
    () => trips
      .filter((trip) => new Date(trip.departure_date).getTime() >= now.getTime() - 86400000 && trip.status !== 'Cancelled')
      .sort((left, right) => new Date(left.departure_date).getTime() - new Date(right.departure_date).getTime()),
    [trips, now],
  );

  const nextSevenDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const isoDate = date.toISOString().slice(0, 10);
      return {
        isoDate,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        count: upcoming.filter((trip) => trip.departure_date.slice(0, 10) === isoDate).length,
      };
    });
  }, [upcoming]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className=" border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Open Trips</p>
          <p className="mt-3 text-3xl font-black text-blue-950">
            {trips.filter((trip) => !['Completed', 'Cancelled'].includes(trip.status)).length}
          </p>
        </div>
        <div className=" border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Departing Soon</p>
          <p className="mt-3 text-3xl font-black text-amber-950">{upcoming.length}</p>
        </div>
        <div className=" border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Completed</p>
          <p className="mt-3 text-3xl font-black text-emerald-950">
            {trips.filter((trip) => trip.status === 'Completed').length}
          </p>
        </div>
      </div>

      <div className=" border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-xl font-black text-zinc-900">Departure Calendar</h3>
          <p className="mt-1 text-sm text-zinc-500">Operational view of the next 7 days.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-7">
          {nextSevenDays.map((day) => (
            <div key={day.isoDate} className={` border p-3 ${day.count > 0 ? 'border-blue-200 bg-blue-50' : 'border-zinc-200 bg-zinc-50'}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{day.label}</p>
              <p className="mt-2 text-2xl font-black text-zinc-900">{day.dayNumber}</p>
              <p className="mt-2 text-xs text-zinc-600">{day.count > 0 ? `${day.count} departure${day.count === 1 ? '' : 's'}` : 'No trips'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className=" border border-zinc-200 bg-white shadow-sm">
        {trips.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No trips created yet. Add the first planned route to begin scheduling.</div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {trips.map((trip) => (
              <div key={trip.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-zinc-900">{trip.title}</p>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses[trip.status]}`}>
                        {trip.status}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                        {trip.trip_number}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      {trip.route_origin} → {trip.route_destination}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                      <span>Driver: {trip.assigned_driver_name || 'Unassigned'}</span>
                      <span>Vehicle: {trip.assigned_vehicle_label || 'Unassigned'}</span>
                      <span>Departure: {new Date(trip.departure_date).toLocaleString()}</span>
                      <span>ETA: {new Date(trip.eta_date).toLocaleString()}</span>
                    </div>
                    {trip.route_waypoints && trip.route_waypoints.length > 0 && (
                      <p className="mt-2 text-xs text-zinc-500">Waypoints: {trip.route_waypoints.join(', ')}</p>
                    )}
                    {trip.notes && (
                      <p className="mt-3 text-sm text-zinc-600">{trip.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEditTrip(trip)}
                      className="inline-flex min-h-[44px] items-center justify-center  bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrip(trip)}
                      className="inline-flex min-h-[44px] items-center justify-center  border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTripsView;
