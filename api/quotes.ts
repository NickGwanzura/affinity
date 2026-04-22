import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PoolClient } from '@neondatabase/serverless';
import { ZodError } from 'zod';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { sql, withTransaction, validateOrderColumn } from './_db.js';
import { logAuditEvent } from './_audit.js';
import { QuoteSchema, QuoteUpdateSchema, PaginationSchema } from './_schemas.js';
import { getResendClient, getAppBaseUrl, getEmailFromAddress } from './_email-utils.js';
import type { QuoteItem } from '../types';

const sendQuoteEmail = async (quote: any) => {
  if (!quote.client_email) return;

  const fromAddress = getEmailFromAddress();
  const appUrl = getAppBaseUrl();

  const html = `
    <div style="font-family: 'Geist Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #000; font-size: 24px; font-weight: 600; margin: 0;">AFFINITY LOGISTICS</h1>
        <p style="color: #666; font-size: 12px; letter-spacing: 2px; margin: 5px 0 0;">CROSS-BORDER VEHICLE LOGISTICS</p>
      </div>
      
      <h2 style="color: #000; font-size: 20px; margin-bottom: 20px;">
        Quote ${quote.quote_number}
      </h2>
      
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Dear ${quote.client_name || 'Valued Client'},
      </p>
      
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Please find your quote attached. This quote is valid for 30 days.
      </p>
      
      ${quote.description ? `<p style="color: #333; font-size: 14px; line-height: 1.6;">${quote.description}</p>` : ''}
      
      <div style="margin: 30px 0; padding: 20px; background: #f8f8f8; border-radius: 8px;">
        <p style="margin: 0;">
          <strong style="color: #000;">Amount:</strong> 
          <span style="color: #000; font-size: 18px; font-weight: 600;">$${quote.amount_usd?.toFixed(2)}</span>
        </p>
      </div>
      
      <div style="margin: 30px 0;">
        <a href="${appUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">
          View Quote Online
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px; line-height: 1.6;">
        If you have any questions about this quote, please contact us.
      </p>
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          Affinity Logistics<br/>
          Cross-Border Vehicle Logistics<br/>
          SADC Region
        </p>
      </div>
    </div>
  `;

  try {
    await getResendClient().emails.send({
      from: fromAddress,
      to: quote.client_email,
      subject: `Quote ${quote.quote_number} from Affinity Logistics`,
      html,
    });
  } catch (error) {
    console.error('Failed to send quote email:', error);
  }
};

type QuoteLineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  tax_rate?: number;
  notes?: string;
};

const computeQuoteLineItemAmounts = (item: QuoteLineItemInput) => {
  const subtotal = item.quantity * item.unit_price;
  const discountPercentage = item.discount_percentage ?? 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const amount = subtotal - discountAmount;
  const taxRate = item.tax_rate ?? 0;
  const taxAmount = amount * (taxRate / 100);

  return {
    subtotal,
    discountPercentage,
    discountAmount,
    amount,
    taxRate,
    taxAmount,
    total: amount + taxAmount,
  };
};

const buildQuoteItemsSnapshot = (items: QuoteLineItemInput[]): QuoteItem[] =>
  items.map((item, index) => {
    const amounts = computeQuoteLineItemAmounts(item);
    return {
      line_number: index + 1,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: amounts.amount,
      discount_percentage: amounts.discountPercentage,
      discount_amount: amounts.discountAmount,
      tax_rate: amounts.taxRate,
      tax_amount: amounts.taxAmount,
      notes: item.notes,
    };
  });

const calculateQuoteTotal = (items: QuoteLineItemInput[]): number =>
  items.reduce((sum, item) => sum + computeQuoteLineItemAmounts(item).total, 0);

const getQuoteInputErrorMessage = (
  error: unknown,
  fallbackMessage: string
): { status: number; message: string } => {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      status: 400,
      message: firstIssue?.message || fallbackMessage,
    };
  }

  const databaseError = error as {
    code?: string;
    constraint?: string;
  };

  if (databaseError.code === '22P02') {
    return {
      status: 400,
      message: 'One of the selected client or vehicle references is invalid.',
    };
  }

  if (databaseError.code === '23503') {
    return {
      status: 400,
      message: 'The selected client or vehicle no longer exists. Refresh and try again.',
    };
  }

  if (databaseError.code === '23505' && databaseError.constraint === 'quotes_quote_number_key') {
    return {
      status: 409,
      message: 'Quote number collision detected. Please try again.',
    };
  }

  return {
    status: 500,
    message: fallbackMessage,
  };
};

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
          return await getQuote(authReq, res);
        }
        return await listQuotes(authReq, res);

      case 'POST':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await createQuote(authReq, res);

      case 'PUT':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
        return await updateQuote(authReq, res);

      case 'DELETE':
        if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
        return await deleteQuote(authReq, res);

      default:
        apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    apiError(res, 500, 'Internal server error', error);
  }
}

async function listQuotes(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    let orderColumn = 'created_at';
    if (sortBy) {
      const validated = validateOrderColumn('quotes', sortBy);
      if (validated) orderColumn = validated;
    }
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [countResult, rows] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM quotes`,
      sql`
        SELECT q.*,
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.line_number) FROM quote_items qi WHERE qi.quote_id = q.id),
            '[]'::jsonb
          ) as items
        FROM quotes q
        ORDER BY ${sql.unsafe(orderColumn)} ${sql.unsafe(orderDirection)}
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = parseInt(countResult[0].total);

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

async function getQuote(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;

  const rows = await sql`
    SELECT q.*,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.line_number) FROM quote_items qi WHERE qi.quote_id = q.id),
        '[]'::jsonb
      ) as items
    FROM quotes q
    WHERE q.id = ${id}::uuid
  `;

  if (rows.length === 0) {
    return apiError(res, 404, 'Quote not found');
  }

  res.status(200).json(rows[0]);
}

async function generateQuoteNumber(client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const sequenceCheck = await client.query<{ sequence_name: string | null }>(
    "SELECT to_regclass('public.quote_number_seq')::text AS sequence_name"
  );

  if (sequenceCheck.rows[0]?.sequence_name) {
    const result = await client.query<{ next_value: string }>(
      "SELECT nextval('public.quote_number_seq')::text AS next_value"
    );
    const nextValue = parseInt(result.rows[0]?.next_value || '0', 10);
    return `QT-${year}-${String(nextValue).padStart(4, '0')}`;
  }

  // Fallback for environments where the sequence migration has not run yet.
  await client.query('SELECT pg_advisory_xact_lock($1)', [2026033002]);
  const fallbackResult = await client.query<{ max_value: string }>(
    `
      SELECT COALESCE(MAX((regexp_match(quote_number, $1))[1]::BIGINT), 0)::text AS max_value
      FROM quotes
      WHERE quote_number ~ $2
    `,
    [`^QT-${year}-(\\d+)$`, `^QT-${year}-\\d+$`]
  );
  const nextValue = parseInt(fallbackResult.rows[0]?.max_value || '0', 10) + 1;

  return `QT-${year}-${String(nextValue).padStart(4, '0')}`;
}

async function insertQuoteItems(client: PoolClient, quoteId: string, items: QuoteLineItemInput[]) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const amounts = computeQuoteLineItemAmounts(item);

    await client.query(
      `
        INSERT INTO quote_items (
          quote_id, line_number, description, quantity, unit_price,
          amount, discount_percentage, discount_amount, tax_rate, tax_amount, notes
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        quoteId,
        i + 1,
        item.description,
        item.quantity,
        item.unit_price,
        amounts.amount,
        amounts.discountPercentage,
        amounts.discountAmount,
        amounts.taxRate,
        amounts.taxAmount,
        item.notes || null,
      ]
    );
  }
}

async function createQuote(req: AuthenticatedRequest, res: VercelResponse) {
  const user = req.user;
  try {
    const data = QuoteSchema.parse(req.body);

    const totalAmount = calculateQuoteTotal(data.items);
    const itemsSnapshot = buildQuoteItemsSnapshot(data.items);

    const result = await withTransaction(async client => {
      const quoteNumber = await generateQuoteNumber(client);
      const quoteResult = await client.query(
        `
          INSERT INTO quotes (
            quote_number, vehicle_id, client_id, client_name, client_email, client_address,
            amount_usd, currency, status, description, valid_until, items
          )
          VALUES (
            $1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
          )
          RETURNING *
        `,
        [
          quoteNumber,
          data.vehicle_id || null,
          data.client_id || null,
          data.client_name,
          data.client_email || null,
          data.client_address || null,
          totalAmount,
          data.currency,
          data.status,
          data.description || null,
          data.valid_until || null,
          JSON.stringify(itemsSnapshot),
        ]
      );

      const quote = quoteResult.rows[0];
      await insertQuoteItems(client, quote.id, data.items);

      return quote;
    });

    await logAuditEvent({
      req,
      userId: user?.id,
      action: 'quote:create',
      tableName: 'quotes',
      recordId: result.id,
      newData: data,
    });

    // Send email notification to client if email provided and status is Sent
    if (result.client_email && result.status === 'Sent') {
      sendQuoteEmail(result);
    }

    res.status(201).json(result);
  } catch (error) {
    const { status, message } = getQuoteInputErrorMessage(error, 'Failed to create quote');
    apiError(res, status, message, error);
  }
}

async function updateQuote(req: AuthenticatedRequest, res: VercelResponse) {
  const user = req.user;
  const { id } = req.query;

  try {
    const data = QuoteUpdateSchema.parse(req.body);

    const result = await withTransaction(async client => {
      let totalAmount = undefined;
      let itemsSnapshot: QuoteItem[] | undefined;
      if (Array.isArray(data.items)) {
        totalAmount = calculateQuoteTotal(data.items);
        itemsSnapshot = buildQuoteItemsSnapshot(data.items);

        await client.query('DELETE FROM quote_items WHERE quote_id = $1::uuid', [id]);
        if (data.items.length > 0) {
          await insertQuoteItems(client, String(id), data.items);
        }
      }

      // Build dynamic SET clause — only include fields present in body
      const updates: string[] = ['updated_at = NOW()'];
      const values: unknown[] = [];
      let paramIdx = 1;

      const bodyRecord = req.body as Record<string, unknown>;
      const fieldMap: Record<string, { value: unknown; cast?: string }> = {
        vehicle_id: { value: data.vehicle_id ?? null, cast: '::uuid' },
        client_id: { value: data.client_id ?? null, cast: '::uuid' },
        client_name: { value: data.client_name },
        client_email: { value: data.client_email },
        client_address: { value: data.client_address },
        currency: { value: data.currency },
        status: { value: data.status },
        description: { value: data.description },
        valid_until: { value: data.valid_until },
      };

      for (const [field, meta] of Object.entries(fieldMap)) {
        if (field in bodyRecord) {
          const cast = meta.cast ?? '';
          updates.push(`${field} = $${paramIdx}${cast}`);
          values.push(meta.value ?? null);
          paramIdx++;
        }
      }

      // Always update amount_usd and items if items were provided
      if (totalAmount !== undefined) {
        updates.push(`amount_usd = $${paramIdx}`);
        values.push(totalAmount);
        paramIdx++;
      }
      if (itemsSnapshot) {
        updates.push(`items = $${paramIdx}::jsonb`);
        values.push(JSON.stringify(itemsSnapshot));
        paramIdx++;
      }

      values.push(id);
      const rows = await client.query(
        `UPDATE quotes SET ${updates.join(', ')} WHERE id = $${paramIdx}::uuid RETURNING *`,
        values
      );

      if (rows.rows.length === 0) {
        throw new Error('Quote not found');
      }

      return rows.rows[0];
    });

    await logAuditEvent({
      req,
      userId: user?.id,
      action: 'quote:update',
      tableName: 'quotes',
      recordId: String(id),
      newData: data,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Quote not found') {
      return apiError(res, 404, error.message);
    }
    const { status, message } = getQuoteInputErrorMessage(error, 'Failed to update quote');
    apiError(res, status, message, error);
  }
}

async function deleteQuote(req: AuthenticatedRequest, res: VercelResponse) {
  const user = req.user;
  const { id } = req.query;

  const oldQuote = await sql`SELECT * FROM quotes WHERE id = ${id}::uuid`;
  if (oldQuote.length === 0) {
    return apiError(res, 404, 'Not found');
  }

  await withTransaction(async client => {
    await client.query('DELETE FROM quote_items WHERE quote_id = $1::uuid', [id]);
    const result = await client.query('DELETE FROM quotes WHERE id = $1::uuid RETURNING id', [id]);
    if (result.rows.length === 0) {
      throw new Error('Not found');
    }
  });

  await logAuditEvent({
    req,
    userId: user?.id,
    action: 'quote:delete',
    tableName: 'quotes',
    recordId: String(id),
    oldData: oldQuote[0],
  });

  res.status(204).end();
}
