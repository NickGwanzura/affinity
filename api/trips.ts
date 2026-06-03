import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requireBusinessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { logAuditEvent } from './_audit.js';
import { sql, validateOrderColumn } from './_db.js';
import { PaginationSchema, TripSchema, TripUpdateSchema } from './_schemas.js';

const TRIP_SELECT = `
  SELECT
    t.*,
    driver.name AS assigned_driver_name,
    CASE
      WHEN vehicle.id IS NULL THEN NULL
      ELSE vehicle.make_model || ' (' || vehicle.vin_number || ')'
    END AS assigned_vehicle_label
  FROM trips t
  LEFT JOIN user_profiles driver ON driver.id = t.assigned_driver_id
  LEFT JOIN vehicles vehicle ON vehicle.id = t.assigned_vehicle_id
`;

let ensureTripSchemaPromise: Promise<void> | null = null;

const ensureTripSchema = async () => {
  if (!ensureTripSchemaPromise) {
    ensureTripSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS trips (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_number TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Planned',
          assigned_driver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
          assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
          route_origin TEXT NOT NULL,
          route_destination TEXT NOT NULL,
          route_waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
          departure_date TIMESTAMPTZ NOT NULL,
          eta_date TIMESTAMPTZ NOT NULL,
          actual_departure_at TIMESTAMPTZ,
          actual_arrival_at TIMESTAMPTZ,
          notes TEXT,
          created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE SEQUENCE IF NOT EXISTS trip_number_seq START WITH 1 INCREMENT BY 1`;
      await sql`CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips (assigned_driver_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips (assigned_vehicle_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_trips_departure_date ON trips (departure_date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_trips_status ON trips (status)`;
      await sql`
        ALTER TABLE trips
        DROP CONSTRAINT IF EXISTS trips_status_check
      `;
      await sql`
        ALTER TABLE trips
        ADD CONSTRAINT trips_status_check
        CHECK (status IN ('Planned', 'Assigned', 'In Transit', 'Delayed', 'Completed', 'Cancelled'))
      `;
      await sql`
        ALTER TABLE trips
        DROP CONSTRAINT IF EXISTS trips_eta_after_departure_check
      `;
      await sql`
        ALTER TABLE trips
        ADD CONSTRAINT trips_eta_after_departure_check
        CHECK (eta_date >= departure_date)
      `;
      await sql`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `;
      await sql`DROP TRIGGER IF EXISTS update_trips_updated_at ON trips`;
      await sql`
        CREATE TRIGGER update_trips_updated_at
        BEFORE UPDATE ON trips
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
      `;
    })().catch((error) => {
      ensureTripSchemaPromise = null;
      throw error;
    });
  }

  return ensureTripSchemaPromise;
};

const normalizeWaypoints = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const buildTripNumber = async (departureDate: string) => {
  const seqRows = await sql`SELECT nextval('trip_number_seq') AS seq`;
  const sequence = Number(seqRows[0]?.seq || 1);
  const year = new Date(departureDate).getUTCFullYear();
  return `TRP-${year}-${String(sequence).padStart(4, '0')}`;
};

const validateDriverAssignment = async (driverId?: string | null) => {
  if (!driverId) return;
  const rows = await sql`
    SELECT id
    FROM user_profiles
    WHERE id = ${driverId}::uuid
      AND role = 'Driver'
      AND status = 'Active'
    LIMIT 1
  `;
  if (rows.length === 0) {
    throw new Error('Assigned driver must be an active driver account');
  }
};

const validateVehicleAssignment = async (vehicleId?: string | null) => {
  if (!vehicleId) return;
  const rows = await sql`SELECT id FROM vehicles WHERE id = ${vehicleId}::uuid LIMIT 1`;
  if (rows.length === 0) {
    throw new Error('Assigned vehicle not found');
  }
};

const getTripById = async (tripId: string, user?: AuthenticatedRequest['user']) => {
  const params: unknown[] = [tripId];
  const driverScope = user?.role === 'Driver' ? ' AND t.assigned_driver_id = $2::uuid' : '';
  if (user?.role === 'Driver') {
    params.push(user.id);
  }

  const rows = await sql.query(
    `
      ${TRIP_SELECT}
      WHERE t.id = $1::uuid${driverScope}
      LIMIT 1
    `,
    params,
  );

  return rows[0];
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Admin', 'Manager', 'Driver'])) return;

  try {
    await ensureTripSchema();

    switch (req.method) {
      case 'GET':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        if (req.query.id) return await getTrip(authReq, res);
        return await listTrips(authReq, res);
      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await createTrip(authReq, res);
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updateTrip(authReq, res);
      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteTrip(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listTrips(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const assignedDriverId = typeof req.query.assignedDriverId === 'string' ? req.query.assignedDriverId : '';
    const assignedVehicleId = typeof req.query.assignedVehicleId === 'string' ? req.query.assignedVehicleId : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
    const upcomingOnly = req.query.upcomingOnly === 'true';

    const orderColumn = validateOrderColumn('trips', sortBy || '') || 'departure_date';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (req.user?.role === 'Driver') {
      params.push(req.user.id);
      whereClauses.push(`t.assigned_driver_id = $${params.length}::uuid`);
    } else if (assignedDriverId) {
      params.push(assignedDriverId);
      whereClauses.push(`t.assigned_driver_id = $${params.length}::uuid`);
    }

    if (assignedVehicleId) {
      params.push(assignedVehicleId);
      whereClauses.push(`t.assigned_vehicle_id = $${params.length}::uuid`);
    }

    if (status) {
      params.push(status);
      whereClauses.push(`t.status = $${params.length}`);
    }

    if (dateFrom) {
      params.push(dateFrom);
      whereClauses.push(`t.departure_date >= $${params.length}::timestamptz`);
    }

    if (dateTo) {
      params.push(dateTo);
      whereClauses.push(`t.departure_date <= $${params.length}::timestamptz`);
    }

    if (upcomingOnly) {
      whereClauses.push(`t.departure_date >= NOW() - INTERVAL '1 day'`);
      whereClauses.push(`t.status NOT IN ('Completed', 'Cancelled')`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows, rows] = await Promise.all([
      sql.query(`SELECT COUNT(*) AS total FROM trips t ${whereClause}`, params),
      sql.query(
        `
          ${TRIP_SELECT}
          ${whereClause}
          ORDER BY t.${orderColumn} ${orderDirection}
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, limit, offset],
      ),
    ]);

    const total = Number.parseInt(String(countRows[0]?.total || '0'), 10);
    return res.status(200).json({
      data: rows.map((row: any) => ({
        ...row,
        route_waypoints: normalizeWaypoints(row.route_waypoints),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return apiError(res, 400, 'Invalid trip query', error);
  }
}

async function getTrip(req: AuthenticatedRequest, res: ApiResponse) {
  const trip = await getTripById(String(req.query.id), req.user);
  if (!trip) return apiError(res, 404, 'Trip not found');
  return res.status(200).json({
    ...trip,
    route_waypoints: normalizeWaypoints((trip as any).route_waypoints),
  });
}

async function createTrip(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = TripSchema.parse(req.body);
    await validateDriverAssignment(data.assigned_driver_id || null);
    await validateVehicleAssignment(data.assigned_vehicle_id || null);

    const tripNumber = await buildTripNumber(data.departure_date);
    const rows = await sql`
      INSERT INTO trips (
        trip_number,
        title,
        status,
        assigned_driver_id,
        assigned_vehicle_id,
        route_origin,
        route_destination,
        route_waypoints,
        departure_date,
        eta_date,
        actual_departure_at,
        actual_arrival_at,
        notes,
        created_by
      )
      VALUES (
        ${tripNumber},
        ${data.title},
        ${data.status},
        ${data.assigned_driver_id || null}::uuid,
        ${data.assigned_vehicle_id || null}::uuid,
        ${data.route_origin},
        ${data.route_destination},
        ${JSON.stringify(data.route_waypoints || [])}::jsonb,
        ${data.departure_date}::timestamptz,
        ${data.eta_date}::timestamptz,
        ${data.actual_departure_at || null}::timestamptz,
        ${data.actual_arrival_at || null}::timestamptz,
        ${data.notes || null},
        ${req.user?.id || null}::uuid
      )
      RETURNING id
    `;

    const trip = await getTripById(rows[0].id, req.user);
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'trips.created',
      tableName: 'trips',
      recordId: rows[0].id,
      newData: trip,
    });

    return res.status(201).json({
      ...trip,
      route_waypoints: normalizeWaypoints((trip as any).route_waypoints),
    });
  } catch (error) {
    return apiError(res, 400, 'Invalid trip data', error);
  }
}

async function updateTrip(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const tripId = String(req.query.id);
    const data = TripUpdateSchema.parse(req.body);
    const existing = await getTripById(tripId, req.user);
    if (!existing) return apiError(res, 404, 'Trip not found');

    await validateDriverAssignment(data.assigned_driver_id || null);
    await validateVehicleAssignment(data.assigned_vehicle_id || null);

    const rows = await sql`
      UPDATE trips
      SET
        title = COALESCE(${data.title || null}, title),
        status = COALESCE(${data.status || null}, status),
        assigned_driver_id = COALESCE(${data.assigned_driver_id || null}::uuid, assigned_driver_id),
        assigned_vehicle_id = COALESCE(${data.assigned_vehicle_id || null}::uuid, assigned_vehicle_id),
        route_origin = COALESCE(${data.route_origin || null}, route_origin),
        route_destination = COALESCE(${data.route_destination || null}, route_destination),
        route_waypoints = COALESCE(${data.route_waypoints ? JSON.stringify(data.route_waypoints) : null}::jsonb, route_waypoints),
        departure_date = COALESCE(${data.departure_date || null}::timestamptz, departure_date),
        eta_date = COALESCE(${data.eta_date || null}::timestamptz, eta_date),
        actual_departure_at = COALESCE(${data.actual_departure_at || null}::timestamptz, actual_departure_at),
        actual_arrival_at = COALESCE(${data.actual_arrival_at || null}::timestamptz, actual_arrival_at),
        notes = COALESCE(${data.notes || null}, notes),
        updated_at = NOW()
      WHERE id = ${tripId}::uuid
      RETURNING id
    `;

    const updated = await getTripById(rows[0].id, req.user);
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'trips.updated',
      tableName: 'trips',
      recordId: rows[0].id,
      oldData: existing,
      newData: updated,
    });

    return res.status(200).json({
      ...updated,
      route_waypoints: normalizeWaypoints((updated as any).route_waypoints),
    });
  } catch (error) {
    return apiError(res, 400, 'Invalid trip update', error);
  }
}

async function deleteTrip(req: AuthenticatedRequest, res: ApiResponse) {
  const tripId = String(req.query.id);
  const existing = await getTripById(tripId, req.user);
  if (!existing) return apiError(res, 404, 'Trip not found');

  await sql`DELETE FROM trips WHERE id = ${tripId}::uuid`;
  await logAuditEvent({
    req,
    userId: req.user?.id || null,
    action: 'trips.deleted',
    tableName: 'trips',
    recordId: tripId,
    oldData: existing,
  });

  return res.status(204).end();
}
