import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireRole,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { sql } from './_db.js';
import { PayslipSchema } from './_schemas.js';

type PayslipStatus = 'Generated' | 'Approved' | 'Paid' | 'Cancelled';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!verifyToken(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listPayslips(req, res);
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createPayslip(authReq, res);
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updatePayslipStatus(req, res);
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await deletePayslip(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listPayslips(req: VercelRequest, res: VercelResponse) {
  const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : '';
  const year = typeof req.query.year === 'string' ? parseInt(req.query.year, 10) : undefined;
  const month = typeof req.query.month === 'string' ? parseInt(req.query.month, 10) : undefined;

  const rows = employeeId
    ? await sql`
        SELECT p.*, row_to_json(e.*) AS employee
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        WHERE p.employee_id = ${employeeId}::uuid
          AND (${year || null}::int IS NULL OR p.year = ${year || null})
          AND (${month || null}::int IS NULL OR p.month = ${month || null})
        ORDER BY p.year DESC, p.month DESC
      `
    : await sql`
        SELECT p.*, row_to_json(e.*) AS employee
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        WHERE (${year || null}::int IS NULL OR p.year = ${year || null})
          AND (${month || null}::int IS NULL OR p.month = ${month || null})
        ORDER BY p.year DESC, p.month DESC
      `;

  return res.status(200).json(rows);
}

async function createPayslip(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const data = PayslipSchema.parse(req.body);
    const employeeRows = await sql`SELECT * FROM employees WHERE id = ${data.employee_id}::uuid`;
    if (employeeRows.length === 0) return apiError(res, 404, 'Employee not found');

    const employee = employeeRows[0];
    const overtimePay = (data.overtime_hours || 0) * (data.overtime_rate || 0);
    const grossPay = data.base_pay + overtimePay + (data.bonus || 0) + (data.allowances || 0) + (data.commission || 0);
    const totalDeductions =
      (data.tax_deduction || 0) +
      (data.pension_deduction || 0) +
      (data.health_insurance || 0) +
      (data.other_deductions || 0);
    const netPay = grossPay - totalDeductions;
    const payslipNumber = `PAY-${employee.employee_number}-${String(data.year).padStart(4, '0')}-${String(data.month).padStart(2, '0')}`;

    const rows = await sql`
      INSERT INTO payslips (
        payslip_number, employee_id, month, year, base_pay,
        overtime_hours, overtime_rate, overtime_pay, bonus, allowances, commission,
        tax_deduction, pension_deduction, health_insurance, other_deductions,
        gross_pay, total_deductions, net_pay, currency,
        payment_date, payment_method, status, notes, generated_by
      )
      VALUES (
        ${payslipNumber},
        ${data.employee_id}::uuid,
        ${data.month},
        ${data.year},
        ${data.base_pay},
        ${data.overtime_hours || 0},
        ${data.overtime_rate || 0},
        ${overtimePay},
        ${data.bonus || 0},
        ${data.allowances || 0},
        ${data.commission || 0},
        ${data.tax_deduction || 0},
        ${data.pension_deduction || 0},
        ${data.health_insurance || 0},
        ${data.other_deductions || 0},
        ${grossPay},
        ${totalDeductions},
        ${netPay},
        ${employee.currency},
        ${data.payment_date || null},
        ${data.payment_method || null},
        'Generated',
        ${data.notes || null},
        ${req.user?.id || null}::uuid
      )
      RETURNING id
    `;

    const fullRows = await sql`
      SELECT p.*, row_to_json(e.*) AS employee
      FROM payslips p
      LEFT JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ${rows[0].id}::uuid
    `;

    return res.status(201).json(fullRows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid payslip data', error);
  }
}

async function updatePayslipStatus(req: VercelRequest, res: VercelResponse) {
  const status = req.body?.status as PayslipStatus | undefined;
  if (!status || !['Generated', 'Approved', 'Paid', 'Cancelled'].includes(status)) {
    return apiError(res, 400, 'Invalid payslip status');
  }

  const rows = await sql`
    UPDATE payslips
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${req.query.id}::uuid
    RETURNING id
  `;
  if (rows.length === 0) return apiError(res, 404, 'Payslip not found');

  const fullRows = await sql`
    SELECT p.*, row_to_json(e.*) AS employee
    FROM payslips p
    LEFT JOIN employees e ON p.employee_id = e.id
    WHERE p.id = ${req.query.id}::uuid
  `;

  return res.status(200).json(fullRows[0]);
}

async function deletePayslip(req: VercelRequest, res: VercelResponse) {
  await sql`DELETE FROM payslips WHERE id = ${req.query.id}::uuid`;
  return res.status(204).end();
}
