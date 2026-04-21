import React from 'react';
import type { AppUser, TripStatus, Vehicle } from '../../types';
import CarbonFormModal from './CarbonFormModal';
import { Button, Select, SelectItem, Stack, TextArea, TextInput } from '../ui';

export type TripFormValue = {
  title: string;
  status: TripStatus;
  assigned_driver_id: string;
  assigned_vehicle_id: string;
  route_origin: string;
  route_destination: string;
  route_waypoints: string;
  departure_date: string;
  eta_date: string;
  actual_departure_at: string;
  actual_arrival_at: string;
  notes: string;
};

interface TripPlannerModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  form: TripFormValue;
  drivers: AppUser[];
  vehicles: Vehicle[];
  isSubmitting?: boolean;
  onChange: (updates: Partial<TripFormValue>) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => Promise<void> | void;
}

export const createEmptyTripForm = (): TripFormValue => {
  const now = new Date();
  const departure = new Date(now);
  departure.setDate(now.getDate() + 1);
  departure.setHours(8, 0, 0, 0);

  const eta = new Date(departure);
  eta.setHours(eta.getHours() + 8);

  const toInputValue = (value: Date) => {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  return {
    title: '',
    status: 'Planned',
    assigned_driver_id: '',
    assigned_vehicle_id: '',
    route_origin: '',
    route_destination: '',
    route_waypoints: '',
    departure_date: toInputValue(departure),
    eta_date: toInputValue(eta),
    actual_departure_at: '',
    actual_arrival_at: '',
    notes: '',
  };
};

const tripStatuses: TripStatus[] = ['Planned', 'Assigned', 'In Transit', 'Delayed', 'Completed', 'Cancelled'];

export const TripPlannerModal: React.FC<TripPlannerModalProps> = ({
  isOpen,
  mode,
  form,
  drivers,
  vehicles,
  isSubmitting = false,
  onChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <CarbonFormModal
      isOpen={isOpen}
      title={mode === 'create' ? 'Create Trip' : 'Update Trip'}
      label="Trip planner"
      size="lg"
      onClose={onClose}
    >
      <p className="text-sm text-zinc-500">
        Assign routes, drivers, vehicles, statuses, and ETAs from one place.
      </p>
      <form onSubmit={onSubmit} className="space-y-6">
        <Stack gap={5}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              id="trip-title"
              labelText="Trip Title"
              value={form.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Harare to Windhoek run"
            />
            <Select
              id="trip-status"
              labelText="Status"
              value={form.status}
              onChange={(event) => onChange({ status: event.target.value as TripStatus })}
            >
              {tripStatuses.map((status) => (
                <React.Fragment key={status}>
                  <SelectItem value={status} text={status} />
                </React.Fragment>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              id="trip-driver"
              labelText="Assigned Driver"
              value={form.assigned_driver_id}
              onChange={(event) => onChange({ assigned_driver_id: event.target.value })}
            >
              <SelectItem value="" text="Unassigned" />
              {drivers.map((driver) => (
                <React.Fragment key={driver.id}>
                  <SelectItem value={driver.id} text={driver.name} />
                </React.Fragment>
              ))}
            </Select>
            <Select
              id="trip-vehicle"
              labelText="Assigned Vehicle"
              value={form.assigned_vehicle_id}
              onChange={(event) => onChange({ assigned_vehicle_id: event.target.value })}
            >
              <SelectItem value="" text="Unassigned" />
              {vehicles.map((vehicle) => (
                <React.Fragment key={vehicle.id}>
                  <SelectItem
                    value={vehicle.id}
                    text={`${vehicle.make_model} (${vehicle.vin_number})`}
                  />
                </React.Fragment>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              id="trip-origin"
              labelText="Origin"
              value={form.route_origin}
              onChange={(event) => onChange({ route_origin: event.target.value })}
              placeholder="Harare, Zimbabwe"
            />
            <TextInput
              id="trip-destination"
              labelText="Destination"
              value={form.route_destination}
              onChange={(event) => onChange({ route_destination: event.target.value })}
              placeholder="Windhoek, Namibia"
            />
          </div>

          <TextInput
            id="trip-waypoints"
            labelText="Route Waypoints"
            value={form.route_waypoints}
            onChange={(event) => onChange({ route_waypoints: event.target.value })}
            placeholder="Bulawayo, Gaborone, Gobabis"
            helperText="Comma-separated optional route stops."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              id="trip-departure"
              type="datetime-local"
              labelText="Departure"
              value={form.departure_date}
              onChange={(event) => onChange({ departure_date: event.target.value })}
            />
            <TextInput
              id="trip-eta"
              type="datetime-local"
              labelText="ETA"
              value={form.eta_date}
              onChange={(event) => onChange({ eta_date: event.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              id="trip-actual-departure"
              type="datetime-local"
              labelText="Actual Departure"
              value={form.actual_departure_at}
              onChange={(event) => onChange({ actual_departure_at: event.target.value })}
            />
            <TextInput
              id="trip-actual-arrival"
              type="datetime-local"
              labelText="Actual Arrival"
              value={form.actual_arrival_at}
              onChange={(event) => onChange({ actual_arrival_at: event.target.value })}
            />
          </div>

          <TextArea
            id="trip-notes"
            labelText="Notes"
            rows={4}
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="Border notes, cargo context, or operational instructions..."
          />
        </Stack>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {mode === 'create' ? 'Create Trip' : 'Update Trip'}
          </Button>
        </div>
      </form>
    </CarbonFormModal>
  );
};

export default TripPlannerModal;
