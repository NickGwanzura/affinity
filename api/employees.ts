import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql, withTransaction } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { EmployeeSchema, EmployeeUpdateSchema } from './_schemas.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
        return await createEmployee(authReq, res);
      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await updateEmployee(authReq, res);
      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteEmployee(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listEmployees(res: ApiResponse) {
  const rows = await sql`
    SELECT *
    FROM employees
    ORDER BY created_at DESC
  `;
  return res.status(200).json(rows);
}

async function createEmployee(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = EmployeeSchema.parse(req.body);

    const created = await withTransaction(async (client) => {
      const seqResult = await client.query(`SELECT nextval('employee_number_seq') AS next`);
      const year = new Date().getFullYear();
      const seqValue = String(seqResult.rows[0]?.next ?? '0');
      const employeeNumber = `EMP-${year}-${seqValue.padStart(4, '0')}`;

      const insert = await client.query(
        `INSERT INTO employees (
           employee_number, name, email, phone, department, position,
           base_pay_usd, currency, employment_type, date_hired, status,
           national_id, bank_account, bank_name, tax_number
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          employeeNumber,
          data.name,
          data.email,
          data.phone || null,
          data.department || null,
          data.position,
          data.base_pay_usd,
          data.currency,
          data.employment_type,
          data.date_hired,
          data.status,
          data.national_id || null,
          data.bank_account || null,
          data.bank_name || null,
          data.tax_number || null,
        ]
      );

      return insert.rows[0];
    });

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'employee.create',
      tableName: 'employees',
      recordId: String(created.id),
      newData: created,
    });

    return res.status(201).json(created);
  } catch (error) {
    return apiError(res, 400, 'Invalid employee data', error);
  }
}

async function updateEmployee(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = EmployeeUpdateSchema.parse(req.body);
    const id = req.query.id;

    const existing = await sql`SELECT * FROM employees WHERE id = ${id}::uuid`;
    if (existing.length === 0) return apiError(res, 404, 'Employee not found');

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
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (rows.length === 0) return apiError(res, 404, 'Employee not found');

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'employee.update',
      tableName: 'employees',
      recordId: String(id),
      oldData: existing[0],
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid employee update', error);
  }
}

async function deleteEmployee(req: AuthenticatedRequest, res: ApiResponse) {
  const id = req.query.id;
  const existing = await sql`SELECT * FROM employees WHERE id = ${id}::uuid`;
  if (existing.length === 0) return apiError(res, 404, 'Employee not found');

  await sql`DELETE FROM employees WHERE id = ${id}::uuid`;

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'employee.delete',
    tableName: 'employees',
    recordId: String(id),
    oldData: existing[0],
  });

  return res.status(204).end();
}
