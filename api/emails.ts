import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  verifyToken,
  requireRole,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { sql, validateOrderColumn } from './_db.js';
import { PaginationSchema } from './_schemas.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

const getEmailFromAddress = (): string => {
  return process.env.EMAIL_FROM_ADDRESS || 'noreply@affinitylogsitics.site';
};

const getAppBaseUrl = (): string => {
  const explicitBaseUrl = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:5173';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    switch (req.method) {
      case 'GET':
        if (req.query.type === 'templates') {
          return await listEmailTemplates(authReq, res);
        }
        if (req.query.type === 'queue') {
          return await listEmailQueue(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      case 'POST':
        if (req.query.type === 'templates') {
          if (!requireRole(authReq, res, ['Admin'])) return;
          return await createEmailTemplate(authReq, res);
        }
        if (req.query.type === 'queue' || req.query.action === 'send') {
          if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
          return await sendEmail(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      case 'PUT':
        if (req.query.type === 'templates') {
          if (!requireRole(authReq, res, ['Admin'])) return;
          return await updateEmailTemplate(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      case 'DELETE':
        if (req.query.type === 'templates') {
          if (!requireRole(authReq, res, ['Admin'])) return;
          return await deleteEmailTemplate(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

async function listEmailTemplates(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM email_templates`,
      sql`
        SELECT et.*, up.name as creator_name
        FROM email_templates et
        LEFT JOIN user_profiles up ON et.created_by = up.id
        ORDER BY et.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    res.status(200).json({
      data: rows,
      total: parseInt(countResult[0].total),
      page,
      limit,
    });
  } catch (error) {
    apiError(res, 400, 'Invalid query', error);
  }
}

async function createEmailTemplate(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { name, type, subject, body } = req.body;

    if (!name || !type || !subject || !body) {
      return apiError(res, 400, 'Missing required fields');
    }

    const rows = await sql`
      INSERT INTO email_templates (name, type, subject, body, created_by)
      VALUES (${name}, ${type}, ${subject}, ${body}, ${req.user?.id ?? null})
      RETURNING id, name, type, subject, body, is_active, created_at
    `;

    res.status(201).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid data', error);
  }
}

async function updateEmailTemplate(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;

  try {
    const { name, type, subject, body, is_active } = req.body;

    const rows = await sql`
      UPDATE email_templates
      SET name = COALESCE(${name ?? null}, name),
          type = COALESCE(${type ?? null}, type),
          subject = COALESCE(${subject ?? null}, subject),
          body = COALESCE(${body ?? null}, body),
          is_active = COALESCE(${is_active ?? null}, is_active),
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, name, type, subject, body, is_active, created_at
    `;

    if (rows.length === 0) {
      return apiError(res, 404, 'Template not found');
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid data', error);
  }
}

async function deleteEmailTemplate(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;

  await sql`DELETE FROM email_templates WHERE id = ${id}::uuid`;

  res.status(204).end();
}

async function listEmailQueue(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { page, limit, status, type } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause += ` WHERE status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      whereClause +=
        params.length > 0 ? ` AND type = $${params.length}` : ` WHERE type = $${params.length}`;
    }

    const countResult =
      await sql`SELECT COUNT(*) as total FROM email_queue ${sql.unsafe(whereClause)}`;
    const rows = await sql`
      SELECT eq.*, up.name as creator_name
      FROM email_queue eq
      LEFT JOIN user_profiles up ON eq.created_by = up.id
      ${sql.unsafe(whereClause)}
      ORDER BY eq.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.status(200).json({
      data: rows,
      total: parseInt(countResult[0].total),
      page,
      limit,
    });
  } catch (error) {
    apiError(res, 400, 'Invalid query', error);
  }
}

async function sendEmail(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { to_email, to_name, subject, body, type, template_id } = req.body;

    let emailSubject = subject;
    let emailBody = body;

    if (template_id) {
      const templateRows = await sql`
        SELECT subject, body FROM email_templates WHERE id = ${template_id}::uuid AND is_active = true
      `;

      if (templateRows.length > 0) {
        emailSubject = templateRows[0].subject;
        emailBody = templateRows[0].body;
      }
    }

    if (!to_email || !emailSubject || !emailBody) {
      return apiError(res, 400, 'Missing required fields');
    }

    const fromAddress = getEmailFromAddress();

    let sentResult;
    try {
      sentResult = await resend.emails.send({
        from: fromAddress,
        to: to_email,
        subject: emailSubject,
        html: emailBody,
      });
    } catch (resendError) {
      console.error('Resend error:', resendError);
      sentResult = { error: resendError };
    }

    const queueRows = await sql`
      INSERT INTO email_queue (to_email, to_name, subject, body, type, status, sent_at, created_by)
      VALUES (${to_email}, ${to_name ?? null}, ${emailSubject}, ${emailBody}, ${type ?? 'manual'}, ${sentResult.error ? 'failed' : 'sent'}, ${sentResult.error ? null : NOW()}, ${req.user?.id ?? null})
      RETURNING id, to_email, to_name, subject, type, status, sent_at, created_at
    `;

    if (sentResult.error) {
      return apiError(res, 500, 'Failed to send email', sentResult.error);
    }

    res.status(201).json(queueRows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid data', error);
  }
}
