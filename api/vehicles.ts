import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  AuthenticatedRequest, 
  verifyToken, 
  requireRole, 
  setSecurityHeaders, 
  handleCors, 
  apiError 
} from './_middleware.js';
import { sql, validateOrderColumn } from './_db.js';
import { VehicleSchema, VehicleUpdateSchema, PaginationSchema } from './_schemas.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;
  
  const authReq = req as AuthenticatedRequest;
  
  if (!(await verifyToken(authReq, res))) return;
  
  try {
    switch (req.method) {
      case 'GET':
        if (req.query.id) {
          return await getVehicle(authReq, res);
        }
        return await listVehicles(authReq, res);
        
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createVehicle(authReq, res);
        
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updateVehicle(authReq, res);
        
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin'])) return;
        return await deleteVehicle(authReq, res);
        
      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

async function listVehicles(req: AuthenticatedRequest, res: VercelResponse) {
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
        SELECT id, vin_number, make_model, purchase_price_gbp, status, created_at
        FROM vehicles
        ORDER BY ${sql.unsafe(orderColumn)} ${sql.unsafe(orderDirection)}
        LIMIT ${limit} OFFSET ${offset}
      `
    ]);
    
    const total = parseInt(countResult[0].total);
    
    res.status(200).json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    apiError(res, 400, 'Invalid query parameters', error);
  }
}

async function getVehicle(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  const rows = await sql`
    SELECT id, vin_number, make_model, purchase_price_gbp, status, created_at
    FROM vehicles
    WHERE id = ${id}::uuid
  `;
  
  if (rows.length === 0) {
    return apiError(res, 404, 'Vehicle not found');
  }
  
  res.status(200).json(rows[0]);
}

async function createVehicle(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const data = VehicleSchema.parse(req.body);
    
    const rows = await sql`
      INSERT INTO vehicles (vin_number, make_model, purchase_price_gbp, status)
      VALUES (${data.vin_number}, ${data.make_model}, ${data.purchase_price_gbp}, ${data.status})
      RETURNING id, vin_number, make_model, purchase_price_gbp, status, created_at
    `;
    
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return apiError(res, 409, 'VIN number already exists');
    }
    apiError(res, 400, 'Invalid vehicle data', error);
  }
}

async function updateVehicle(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  try {
    const data = VehicleUpdateSchema.parse(req.body);
    
    const rows = await sql`
      UPDATE vehicles
      SET 
        vin_number = COALESCE(${data.vin_number ?? null}, vin_number),
        make_model = COALESCE(${data.make_model ?? null}, make_model),
        purchase_price_gbp = COALESCE(${data.purchase_price_gbp ?? null}, purchase_price_gbp),
        status = COALESCE(${data.status ?? null}, status),
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, vin_number, make_model, purchase_price_gbp, status, created_at
    `;
    
    if (rows.length === 0) {
      return apiError(res, 404, 'Vehicle not found');
    }
    
    res.status(200).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid vehicle data', error);
  }
}

async function deleteVehicle(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  await sql`DELETE FROM vehicles WHERE id = ${id}::uuid`;
  
  res.status(204).end();
}
