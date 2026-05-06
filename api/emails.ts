import type { ApiRequest, ApiResponse } from './_types.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { sql } from './_db.js';
import { PaginationSchema } from './_schemas.js';
import { z } from 'zod';
import { getResendClient, getEmailFromAddress } from './_email-utils.js';

const EmailQueueFilterSchema = PaginationSchema.extend({
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  type: z.string().max(50).optional(),
});

const SendEmailSchema = z.object({
  to_email: z.string().email(),
  to_name: z.string().max(200).optional().nullable(),
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  type: z.string().max(50).optional(),
  template_id: z.string().uuid().optional(),
});

const TemplateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  is_active: z.boolean().optional(),
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  try {
    switch (req.method) {
      case 'GET':
        if (req.query.type === 'templates') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
          return await listEmailTemplates(authReq, res);
        }
        if (req.query.type === 'queue') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
          return await listEmailQueue(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      case 'POST':
        if (req.query.type === 'templates') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
          return await createEmailTemplate(authReq, res);
        }
        if (req.query.type === 'queue' || req.query.action === 'send') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
          return await sendEmail(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      case 'PUT':
        if (req.query.type === 'templates') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
          return await updateEmailTemplate(authReq, res);
        }
        return apiError(res, 400, 'Invalid query');

      case 'DELETE':
        if (req.query.type === 'templates') {
          if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
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

async function listEmailTemplates(req: AuthenticatedRequest, res: ApiResponse) {
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

async function createEmailTemplate(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = TemplateSchema.parse(req.body);

    const rows = await sql`
      INSERT INTO email_templates (name, type, subject, body, created_by)
      VALUES (${data.name}, ${data.type}, ${data.subject}, ${data.body}, ${req.user?.id ?? null})
      RETURNING id, name, type, subject, body, is_active, created_at
    `;

    res.status(201).json(rows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid data', error);
  }
}

async function updateEmailTemplate(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  try {
    const data = TemplateSchema.partial().parse(req.body);

    const rows = await sql`
      UPDATE email_templates
      SET name = COALESCE(${data.name ?? null}, name),
          type = COALESCE(${data.type ?? null}, type),
          subject = COALESCE(${data.subject ?? null}, subject),
          body = COALESCE(${data.body ?? null}, body),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
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

async function deleteEmailTemplate(req: AuthenticatedRequest, res: ApiResponse) {
  const { id } = req.query;

  await sql`DELETE FROM email_templates WHERE id = ${id}::uuid`;

  res.status(204).end();
}

async function listEmailQueue(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const { page, limit, status, type } = EmailQueueFilterSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const [countResult, rows] = await Promise.all([
      sql`
        SELECT COUNT(*) as total FROM email_queue
        WHERE (${status ?? null}::text IS NULL OR status = ${status ?? null})
          AND (${type ?? null}::text IS NULL OR type = ${type ?? null})
      `,
      sql`
        SELECT eq.*, up.name as creator_name
        FROM email_queue eq
        LEFT JOIN user_profiles up ON eq.created_by = up.id
        WHERE (${status ?? null}::text IS NULL OR eq.status = ${status ?? null})
          AND (${type ?? null}::text IS NULL OR eq.type = ${type ?? null})
        ORDER BY eq.created_at DESC
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

async function sendEmail(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const payload = SendEmailSchema.parse(req.body);

    let emailSubject = payload.subject;
    let emailBody = payload.body;

    if (payload.template_id) {
      const templateRows = await sql`
        SELECT subject, body FROM email_templates WHERE id = ${payload.template_id}::uuid AND is_active = true
      `;

      if (templateRows.length > 0) {
        emailSubject = templateRows[0].subject;
        emailBody = templateRows[0].body;
      }
    }

    if (!emailSubject || !emailBody) {
      return apiError(res, 400, 'Missing subject or body (provide both, or a valid template_id)');
    }

    const fromAddress = getEmailFromAddress();

    let sendError: unknown = null;
    try {
      const result = await getResendClient().emails.send({
        from: fromAddress,
        to: payload.to_email,
        subject: emailSubject,
        html: emailBody,
      });
      if (result.error) sendError = result.error;
    } catch (resendError) {
      console.error('Resend error:', resendError);
      sendError = resendError;
    }

    const sentAt = sendError ? null : new Date().toISOString();
    const queueRows = await sql`
      INSERT INTO email_queue (to_email, to_name, subject, body, type, status, sent_at, created_by)
      VALUES (
        ${payload.to_email},
        ${payload.to_name ?? null},
        ${emailSubject},
        ${emailBody},
        ${payload.type ?? 'manual'},
        ${sendError ? 'failed' : 'sent'},
        ${sentAt},
        ${req.user?.id ?? null}
      )
      RETURNING id, to_email, to_name, subject, type, status, sent_at, created_at
    `;

    if (sendError) {
      return apiError(res, 502, 'Failed to send email', sendError);
    }

    res.status(201).json(queueRows[0]);
  } catch (error) {
    apiError(res, 400, 'Invalid data', error);
  }
}
