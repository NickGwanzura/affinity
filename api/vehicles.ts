import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requireBusinessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { sql, validateOrderColumn } from './_db.js';
import { logAuditEvent } from './_audit.js';
import {
  VehicleSchema,
  VehicleUpdateSchema,
  PaginationSchema,
  ShipmentSchema,
  ShipmentUpdateSchema,
} from './_schemas.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;

  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Admin', 'Manager', 'Accountant', 'Driver'])) return;

  try {
    switch (req.method) {
      case 'GET':
        if (req.query.id) {
          if (req.query.type === 'shipment') {
            return await getShipment(authReq, res);
          }
          return await getVehicle(authReq, res);
        }
        if (req.query.type === 'shipment') {
          return await listShipments(authReq, res);
        }
        return await listVehicles(authReq, res);

      case 'POST':
        if (req.query.type === 'shipment') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
          return await createShipment(authReq, res);
        }
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await createVehicle(authReq, res);

      case 'PUT':
        if (req.query.type === 'shipment') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
          return await updateShipment(authReq, res);
        }
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updateVehicle(authReq, res);

      case 'DELETE':
        if (req.query.type === 'shipment') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
          return await deleteShipment(authReq, res);
        }
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteVehicle(authReq, res);

      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

// ============ VEHICLE FUNCTIONS ============

async function listVehicles(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    let orderColumn = 'created_at';
    if (sortBy) {
      const validated = validateOrderColumn('vehicles', sortBy);
      if (validated) orderColumn = validated;
    }
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM vehicles`,
      sql`
        SELECT id, vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url, created_at
        FROM vehicles
        ORDER BY ${sql.unsafe(orderColumn)} ${sql.unsafe(orderDirection)}
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = Number(countResult[0].total);

    res.status(200).json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    apiError(res, 400, 'Invalid query parameters', error);
  }
}

async function getVehicle(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  const rows = await sql`
    SELECT id, vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url, created_at
    FROM vehicles
    WHERE id = ${id}::uuid
  `;

  if (rows.length === 0) {
    return apiError(res, 404, 'Vehicle not found');
  }

  res.status(200).json(rows[0]);
}

async function createVehicle(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = VehicleSchema.parse(req.body);

    const rows = await sql`
      INSERT INTO vehicles (vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url)
      VALUES (${data.vin_number}, ${data.reg_number}, ${data.make_model}, ${data.purchase_price_gbp}, ${data.status}, ${data.purpose}, ${data.client_id ?? null}, ${data.cbca_applied}, ${data.reg_book_url ?? null})
      RETURNING id, vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url, created_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'vehicle.create',
      tableName: 'vehicles',
      recordId: String(rows[0].id),
      newData: rows[0],
    });

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return apiError(res, 409, 'VIN number already exists');
    }
    apiError(res, 400, 'Invalid vehicle data', error);
  }
}

async function updateVehicle(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  try {
    const data = VehicleUpdateSchema.parse(req.body);

    const existing = await sql`
      SELECT id, vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url, created_at
      FROM vehicles WHERE id = ${id}::uuid
    `;
    if (existing.length === 0) return apiError(res, 404, 'Vehicle not found');

    const rows = await sql`
      UPDATE vehicles
      SET
        vin_number = COALESCE(${data.vin_number ?? null}, vin_number),
        reg_number = COALESCE(${data.reg_number ?? null}, reg_number),
        make_model = COALESCE(${data.make_model ?? null}, make_model),
        purchase_price_gbp = COALESCE(${data.purchase_price_gbp ?? null}, purchase_price_gbp),
        status = COALESCE(${data.status ?? null}, status),
        purpose = COALESCE(${data.purpose ?? null}, purpose),
        client_id = ${data.client_id ?? null},
        cbca_applied = COALESCE(${data.cbca_applied ?? null}, cbca_applied),
        reg_book_url = CASE WHEN ${data.reg_book_url === undefined}::boolean
                            THEN reg_book_url
                            ELSE ${data.reg_book_url ?? null}
                       END,
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url, created_at
    `;

    if (rows.length === 0) {
      return apiError(res, 404, 'Vehicle not found');
    }

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'vehicle.update',
      tableName: 'vehicles',
      recordId: String(id),
      oldData: existing[0],
      newData: rows[0],
    });

    res.status(200).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid vehicle data', error);
  }
}

async function deleteVehicle(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  const existing = await sql`
    SELECT id, vin_number, reg_number, make_model, purchase_price_gbp, status, purpose, client_id, cbca_applied, reg_book_url, created_at
    FROM vehicles WHERE id = ${id}::uuid
  `;
  if (existing.length === 0) return apiError(res, 404, 'Vehicle not found');

  await sql`DELETE FROM vehicles WHERE id = ${id}::uuid`;

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'vehicle.delete',
    tableName: 'vehicles',
    recordId: String(id),
    oldData: existing[0],
  });

  res.status(204).end();
}

// ============ SHIPMENT FUNCTIONS ============

async function listShipments(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    let orderColumn = 'created_at';
    if (sortBy) {
      const validated = validateOrderColumn('shipments', sortBy);
      if (validated) orderColumn = validated;
    }
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM shipments`,
      sql`
        SELECT s.id, s.client_id, s.vehicle_id, s.description, s.origin, s.destination, s.status, s.shipping_date, s.delivery_date, s.created_at,
               c.name as client_name, v.make_model as vehicle_name
        FROM shipments s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN vehicles v ON s.vehicle_id = v.id
        ORDER BY ${sql.unsafe(orderColumn)} ${sql.unsafe(orderDirection)}
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = Number(countResult[0].total);

    res.status(200).json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    apiError(res, 400, 'Invalid query parameters', error);
  }
}

async function getShipment(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  const rows = await sql`
    SELECT s.id, s.client_id, s.vehicle_id, s.description, s.origin, s.destination, s.status, s.shipping_date, s.delivery_date, s.created_at,
           c.name as client_name, v.make_model as vehicle_name
    FROM shipments s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.id = ${id}::uuid
  `;

  if (rows.length === 0) {
    return apiError(res, 404, 'Shipment not found');
  }

  res.status(200).json(rows[0]);
}

async function createShipment(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = ShipmentSchema.parse(req.body);

    const rows = await sql`
      INSERT INTO shipments (client_id, vehicle_id, description, origin, destination, status, shipping_date, delivery_date)
      VALUES (${data.client_id}, ${data.vehicle_id ?? null}, ${data.description}, ${data.origin}, ${data.destination}, ${data.status}, ${data.shipping_date ?? null}, ${data.delivery_date ?? null})
      RETURNING id, client_id, vehicle_id, description, origin, destination, status, shipping_date, delivery_date, created_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'shipment.create',
      tableName: 'shipments',
      recordId: String(rows[0].id),
      newData: rows[0],
    });

    res.status(201).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid shipment data', error);
  }
}

async function updateShipment(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  try {
    const data = ShipmentUpdateSchema.parse(req.body);

    const existing = await sql`
      SELECT id, client_id, vehicle_id, description, origin, destination, status, shipping_date, delivery_date, created_at
      FROM shipments WHERE id = ${id}::uuid
    `;
    if (existing.length === 0) return apiError(res, 404, 'Shipment not found');

    const rows = await sql`
      UPDATE shipments
      SET
        client_id = COALESCE(${data.client_id ?? null}, client_id),
        vehicle_id = CASE WHEN ${data.vehicle_id === undefined}::boolean
                          THEN vehicle_id
                          ELSE ${data.vehicle_id ?? null}
                     END,
        description = COALESCE(${data.description ?? null}, description),
        origin = COALESCE(${data.origin ?? null}, origin),
        destination = COALESCE(${data.destination ?? null}, destination),
        status = COALESCE(${data.status ?? null}, status),
        shipping_date = COALESCE(${data.shipping_date ?? null}, shipping_date),
        delivery_date = COALESCE(${data.delivery_date ?? null}, delivery_date),
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, client_id, vehicle_id, description, origin, destination, status, shipping_date, delivery_date, created_at
    `;

    if (rows.length === 0) {
      return apiError(res, 404, 'Shipment not found');
    }

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'shipment.update',
      tableName: 'shipments',
      recordId: String(id),
      oldData: existing[0],
      newData: rows[0],
    });

    res.status(200).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid shipment data', error);
  }
}

async function deleteShipment(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  const existing = await sql`
    SELECT id, client_id, vehicle_id, description, origin, destination, status, shipping_date, delivery_date, created_at
    FROM shipments WHERE id = ${id}::uuid
  `;
  if (existing.length === 0) return apiError(res, 404, 'Shipment not found');

  await sql`DELETE FROM shipments WHERE id = ${id}::uuid`;

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'shipment.delete',
    tableName: 'shipments',
    recordId: String(id),
    oldData: existing[0],
  });

  res.status(204).end();
}
