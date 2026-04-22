import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError
} from './_middleware.js';
import { sql } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { ClientSchema, ClientUpdateSchema, PaginationSchema } from './_schemas.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;

  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        if (req.query.id) {
          return await getClient(authReq, res);
        }
        return await listClients(authReq, res);

      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await createClient(authReq, res);

      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updateClient(authReq, res);

      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
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

    const orderColumn = ((): string => {
      switch (sortBy) {
        case 'email': return 'email';
        case 'company': return 'company';
        case 'created_at': return 'created_at';
        case 'updated_at': return 'updated_at';
        case 'name':
        default: return 'name';
      }
    })();
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM clients WHERE deleted_at IS NULL`,
      orderColumn === 'email'
        ? (orderDirection === 'ASC'
            ? sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY email ASC LIMIT ${limit} OFFSET ${offset}`
            : sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY email DESC LIMIT ${limit} OFFSET ${offset}`)
        : orderColumn === 'company'
        ? (orderDirection === 'ASC'
            ? sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY company ASC LIMIT ${limit} OFFSET ${offset}`
            : sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY company DESC LIMIT ${limit} OFFSET ${offset}`)
        : orderColumn === 'created_at'
        ? (orderDirection === 'ASC'
            ? sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`
            : sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`)
        : orderColumn === 'updated_at'
        ? (orderDirection === 'ASC'
            ? sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY updated_at ASC LIMIT ${limit} OFFSET ${offset}`
            : sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`)
        : (orderDirection === 'ASC'
            ? sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`
            : sql`SELECT id, name, email, phone, address, company, notes, is_active, deleted_at, opening_balance, opening_balance_currency, created_at, updated_at FROM clients WHERE deleted_at IS NULL ORDER BY name DESC LIMIT ${limit} OFFSET ${offset}`)
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
    SELECT id, name, email, phone, address, company, notes,
           is_active, deleted_at, opening_balance, opening_balance_currency,
           created_at, updated_at
    FROM clients
    WHERE id = ${id}::uuid AND deleted_at IS NULL
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
      INSERT INTO clients (
        name, email, phone, address, company, notes,
        opening_balance, opening_balance_currency, is_active
      )
      VALUES (
        ${data.name},
        ${data.email || null},
        ${data.phone || null},
        ${data.address || null},
        ${data.company || null},
        ${data.notes || null},
        ${data.opening_balance ?? null},
        ${data.opening_balance_currency ?? null},
        ${data.is_active ?? null}
      )
      RETURNING id, name, email, phone, address, company, notes,
                is_active, deleted_at, opening_balance, opening_balance_currency,
                created_at, updated_at
    `;

    const created = rows[0];

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'client.create',
      tableName: 'clients',
      recordId: created.id,
      newData: created,
    });

    res.status(201).json(created);
  } catch (error) {
    apiError(res, 400, 'Invalid client data', error);
  }
}

async function updateClient(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;

  try {
    const data = ClientUpdateSchema.parse(req.body);

    // Capture pre-update state so the audit trail shows the real diff.
    const existing = await sql`
      SELECT id, name, email, phone, address, company, notes,
             is_active, deleted_at, opening_balance, opening_balance_currency,
             created_at, updated_at
      FROM clients
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;

    if (existing.length === 0) {
      return apiError(res, 404, 'Client not found');
    }

    const rows = await sql`
      UPDATE clients
      SET
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        address = COALESCE(${data.address ?? null}, address),
        company = COALESCE(${data.company ?? null}, company),
        notes = COALESCE(${data.notes ?? null}, notes),
        opening_balance = COALESCE(${data.opening_balance ?? null}, opening_balance),
        opening_balance_currency = COALESCE(${data.opening_balance_currency ?? null}, opening_balance_currency),
        is_active = COALESCE(${data.is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, name, email, phone, address, company, notes,
                is_active, deleted_at, opening_balance, opening_balance_currency,
                created_at, updated_at
    `;

    if (rows.length === 0) {
      return apiError(res, 404, 'Client not found');
    }

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'client.update',
      tableName: 'clients',
      recordId: String(id),
      oldData: existing[0],
      newData: rows[0],
    });

    res.status(200).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid client data', error);
  }
}

async function deleteClient(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;

  // Soft delete: preserves FK integrity for invoices/quotes/payments.
  const rows = await sql`
    UPDATE clients
    SET is_active = false,
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING id, deleted_at
  `;

  if (rows.length === 0) {
    return apiError(res, 404, 'Client not found');
  }

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'client.soft_delete',
    tableName: 'clients',
    recordId: String(id),
    oldData: { is_active: true, deleted_at: null },
    newData: { is_active: false, deleted_at: rows[0].deleted_at },
  });

  res.status(204).end();
}
