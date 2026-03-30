import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  AuthenticatedRequest, 
  verifyToken, 
  requireRole, 
  setSecurityHeaders, 
  handleCors, 
  apiError 
} from './_middleware';
import { sql, validateOrderColumn } from './_db';
import { ClientSchema, ClientUpdateSchema, PaginationSchema } from './_schemas';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;
  
  const authReq = req as AuthenticatedRequest;
  
  if (!verifyToken(authReq, res)) return;
  
  try {
    switch (req.method) {
      case 'GET':
        if (req.query.id) {
          return await getClient(authReq, res);
        }
        return await listClients(authReq, res);
        
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createClient(authReq, res);
        
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updateClient(authReq, res);
        
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin'])) return;
        return await deleteClient(authReq, res);
        
      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

async function listClients(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;
    
    let orderColumn = 'name';
    if (sortBy) {
      const validated = validateOrderColumn('clients', sortBy);
      if (validated) orderColumn = validated;
    }
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM clients`,
      sql`
        SELECT id, name, email, phone, address, company, notes, created_at
        FROM clients
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

async function getClient(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  const rows = await sql`
    SELECT id, name, email, phone, address, company, notes, created_at
    FROM clients
    WHERE id = ${id}::uuid
  `;
  
  if (rows.length === 0) {
    return apiError(res, 404, 'Client not found');
  }
  
  res.status(200).json(rows[0]);
}

async function createClient(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const data = ClientSchema.parse(req.body);
    
    const rows = await sql`
      INSERT INTO clients (name, email, phone, address, company, notes)
      VALUES (
        ${data.name}, 
        ${data.email || null}, 
        ${data.phone || null}, 
        ${data.address || null}, 
        ${data.company || null}, 
        ${data.notes || null}
      )
      RETURNING id, name, email, phone, address, company, notes, created_at
    `;
    
    res.status(201).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid client data', error);
  }
}

async function updateClient(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  try {
    const data = ClientUpdateSchema.parse(req.body);
    
    const rows = await sql`
      UPDATE clients
      SET 
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        address = COALESCE(${data.address ?? null}, address),
        company = COALESCE(${data.company ?? null}, company),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, name, email, phone, address, company, notes, created_at
    `;
    
    if (rows.length === 0) {
      return apiError(res, 404, 'Client not found');
    }
    
    res.status(200).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid client data', error);
  }
}

async function deleteClient(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Check for related records
  const [invoiceCount, quoteCount] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM invoices WHERE client_id = ${id}::uuid`,
    sql`SELECT COUNT(*) as count FROM quotes WHERE client_id = ${id}::uuid`
  ]);
  
  if (parseInt(invoiceCount[0].count) > 0 || parseInt(quoteCount[0].count) > 0) {
    return apiError(res, 409, 'Cannot delete client with existing invoices or quotes');
  }
  
  await sql`DELETE FROM clients WHERE id = ${id}::uuid`;
  
  res.status(204).end();
}
