import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireRole,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { logAuditEvent } from './_audit.js';
import { sql } from './_db.js';
import { CompanySchema } from './_schemas.js';

const DEFAULT_COMPANY = {
  name: 'Your Company Name',
  registration_no: '',
  tax_id: '',
  address: '',
  contact_email: 'info@company.com',
  phone: '',
  website: '',
  logo_url: '',
};

const isMissingColumnError = (error: unknown, columnName: string): boolean =>
  error instanceof Error && error.message.includes(`column "${columnName}"`);

const isMissingTableError = (error: unknown, tableName: string): boolean =>
  error instanceof Error && error.message.includes(`relation "${tableName}" does not exist`);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    switch (req.method) {
      case 'GET':
        return await getCompany(res);
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updateCompany(req, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function getCompany(res: VercelResponse) {
  try {
    const rows = await sql`
      SELECT id, name, registration_no, tax_id, contact_email, address, phone, website, logo_url, created_at, updated_at
      FROM company_details
      LIMIT 1
    `;

    return res.status(200).json(rows[0] ?? DEFAULT_COMPANY);
  } catch (error) {
    if (isMissingColumnError(error, 'registration_no') || isMissingColumnError(error, 'tax_id') || isMissingColumnError(error, 'logo_url')) {
      const rows = await sql`
        SELECT id, name, contact_email, address, phone, website, created_at, updated_at
        FROM company_details
        LIMIT 1
      `;

      return res.status(200).json({
        ...DEFAULT_COMPANY,
        ...(rows[0] ?? {}),
      });
    }

    if (isMissingTableError(error, 'company_details')) {
      return res.status(200).json(DEFAULT_COMPANY);
    }

    return apiError(res, 500, 'Failed to load company details', error);
  }
}

async function updateCompany(req: VercelRequest, res: VercelResponse) {
  try {
    const authReq = req as AuthenticatedRequest;
    const data = CompanySchema.parse(req.body);
    const existing = await sql`SELECT * FROM company_details LIMIT 1`;

    try {
      if (existing.length > 0) {
        await sql`
          UPDATE company_details
          SET
            name = ${data.name},
            registration_no = ${data.registration_no || ''},
            tax_id = ${data.tax_id || ''},
            contact_email = ${data.contact_email},
            address = ${data.address || ''},
            phone = ${data.phone || ''},
            website = ${data.website || ''},
            logo_url = ${data.logo_url || ''},
            updated_at = NOW()
          WHERE id = ${existing[0].id}::uuid
        `;
      } else {
        await sql`
          INSERT INTO company_details (name, registration_no, tax_id, contact_email, address, phone, website, logo_url)
          VALUES (
            ${data.name},
            ${data.registration_no || ''},
            ${data.tax_id || ''},
            ${data.contact_email},
            ${data.address || ''},
            ${data.phone || ''},
            ${data.website || ''},
            ${data.logo_url || ''}
          )
        `;
      }
    } catch (error) {
      if (isMissingColumnError(error, 'registration_no') || isMissingColumnError(error, 'tax_id') || isMissingColumnError(error, 'logo_url')) {
        if (existing.length > 0) {
          await sql`
            UPDATE company_details
            SET
              name = ${data.name},
              contact_email = ${data.contact_email},
              address = ${data.address || ''},
              phone = ${data.phone || ''},
              website = ${data.website || ''},
              updated_at = NOW()
            WHERE id = ${existing[0].id}::uuid
          `;
        } else {
          await sql`
            INSERT INTO company_details (name, contact_email, address, phone, website)
            VALUES (
              ${data.name},
              ${data.contact_email},
              ${data.address || ''},
              ${data.phone || ''},
              ${data.website || ''}
            )
          `;
        }
      } else {
        throw error;
      }
    }

    await logAuditEvent({
      req,
      userId: authReq.user?.id || null,
      action: 'company.updated',
      tableName: 'company_details',
      recordId: existing[0]?.id || null,
      oldData: existing[0] || null,
      newData: data,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return apiError(res, 400, 'Invalid company details', error);
  }
}
