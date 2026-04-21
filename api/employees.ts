import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { EmployeeSchema, EmployeeUpdateSchema } from './_schemas.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listEmployees(res);
      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await createEmployee(req, res);
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await updateEmployee(req, res);
      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteEmployee(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listEmployees(res: VercelResponse) {
  const rows = await sql`
    SELECT *
    FROM employees
    ORDER BY created_at DESC
  `;
  return res.status(200).json(rows);
}

async function createEmployee(req: VercelRequest, res: VercelResponse) {
  try {
    const data = EmployeeSchema.parse(req.body);
    const countRows = await sql`SELECT COUNT(*) AS count FROM employees`;
    const nextNumber = parseInt(String(countRows[0]?.count || '0'), 10) + 1;
    const employeeNumber = `EMP-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

    const rows = await sql`
      INSERT INTO employees (
        employee_number, name, email, phone, department, position,
        base_pay_usd, currency, employment_type, date_hired, status,
        national_id, bank_account, bank_name, tax_number
      )
      VALUES (
        ${employeeNumber},
        ${data.name},
        ${data.email},
        ${data.phone || null},
        ${data.department || null},
        ${data.position},
        ${data.base_pay_usd},
        ${data.currency},
        ${data.employment_type},
        ${data.date_hired},
        ${data.status},
        ${data.national_id || null},
        ${data.bank_account || null},
        ${data.bank_name || null},
        ${data.tax_number || null}
      )
      RETURNING *
    `;

    return res.status(201).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid employee data', error);
  }
}

async function updateEmployee(req: VercelRequest, res: VercelResponse) {
  try {
    const data = EmployeeUpdateSchema.parse(req.body);
    const rows = await sql`
      UPDATE employees
      SET
        name = COALESCE(${data.name || null}, name),
        email = COALESCE(${data.email || null}, email),
        phone = COALESCE(${data.phone || null}, phone),
        department = COALESCE(${data.department || null}, department),
        position = COALESCE(${data.position || null}, position),
        base_pay_usd = COALESCE(${data.base_pay_usd || null}, base_pay_usd),
        currency = COALESCE(${data.currency || null}, currency),
        employment_type = COALESCE(${data.employment_type || null}, employment_type),
        date_hired = COALESCE(${data.date_hired || null}, date_hired),
        status = COALESCE(${data.status || null}, status),
        national_id = COALESCE(${data.national_id || null}, national_id),
        bank_account = COALESCE(${data.bank_account || null}, bank_account),
        bank_name = COALESCE(${data.bank_name || null}, bank_name),
        tax_number = COALESCE(${data.tax_number || null}, tax_number),
        updated_at = NOW()
      WHERE id = ${req.query.id}::uuid
      RETURNING *
    `;

    if (rows.length === 0) return apiError(res, 404, 'Employee not found');
    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid employee update', error);
  }
}

async function deleteEmployee(req: VercelRequest, res: VercelResponse) {
  await sql`DELETE FROM employees WHERE id = ${req.query.id}::uuid`;
  return res.status(204).end();
}
