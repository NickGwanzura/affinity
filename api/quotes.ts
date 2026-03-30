import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PoolClient } from '@neondatabase/serverless';
import { 
  AuthenticatedRequest, 
  verifyToken, 
  requireRole, 
  setSecurityHeaders, 
  handleCors, 
  apiError 
} from './_middleware';
import { sql, withTransaction, validateOrderColumn } from './_db';
import { QuoteSchema, QuoteUpdateSchema, PaginationSchema } from './_schemas';
import type { QuoteItem } from '../types';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;
  
  const authReq = req as AuthenticatedRequest;
  
  if (!verifyToken(authReq, res)) return;
  
  try {
    switch (req.method) {
      case 'GET':
        if (req.query.id) {
          return await getQuote(authReq, res);
        }
        return await listQuotes(authReq, res);
        
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await createQuote(authReq, res);
        
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await updateQuote(authReq, res);
        
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin'])) return;
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
  const result = await client.query<{ next_value: string }>("SELECT nextval('public.quote_number_seq')::text AS next_value");
  const nextValue = parseInt(result.rows[0]?.next_value || '0', 10);
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
      ],
    );
  }
}

async function createQuote(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const data = QuoteSchema.parse(req.body);

    const totalAmount = calculateQuoteTotal(data.items);
    const itemsSnapshot = buildQuoteItemsSnapshot(data.items);

    const result = await withTransaction(async (client) => {
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
        ],
      );

      const quote = quoteResult.rows[0];
      await insertQuoteItems(client, quote.id, data.items);

      return quote;
    });
    
    res.status(201).json(result);
  } catch (error) {
    apiError(res, 400, 'Invalid quote data', error);
  }
}

async function updateQuote(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  try {
    const data = QuoteUpdateSchema.parse(req.body);
    
    const result = await withTransaction(async (client) => {
      let totalAmount = undefined;
      let itemsSnapshot: QuoteItem[] | undefined;
      if (data.items && data.items.length > 0) {
        totalAmount = calculateQuoteTotal(data.items);
        itemsSnapshot = buildQuoteItemsSnapshot(data.items);

        await client.query('DELETE FROM quote_items WHERE quote_id = $1::uuid', [id]);
        await insertQuoteItems(client, String(id), data.items);
      }

      const rows = await client.query(
        `
          UPDATE quotes
          SET
            vehicle_id = COALESCE($1::uuid, vehicle_id),
            client_id = COALESCE($2::uuid, client_id),
            client_name = COALESCE($3, client_name),
            client_email = COALESCE($4, client_email),
            client_address = COALESCE($5, client_address),
            amount_usd = COALESCE($6, amount_usd),
            currency = COALESCE($7, currency),
            status = COALESCE($8, status),
            description = COALESCE($9, description),
            valid_until = COALESCE($10, valid_until),
            items = COALESCE($11::jsonb, items),
            updated_at = NOW()
          WHERE id = $12::uuid
          RETURNING *
        `,
        [
          data.vehicle_id ?? null,
          data.client_id ?? null,
          data.client_name ?? null,
          data.client_email ?? null,
          data.client_address ?? null,
          totalAmount ?? null,
          data.currency ?? null,
          data.status ?? null,
          data.description ?? null,
          data.valid_until ?? null,
          itemsSnapshot ? JSON.stringify(itemsSnapshot) : null,
          id,
        ],
      );

      if (rows.rows.length === 0) {
        throw new Error('Quote not found');
      }

      return rows.rows[0];
    });
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Quote not found') {
      return apiError(res, 404, error.message);
    }
    apiError(res, 400, 'Invalid quote data', error);
  }
}

async function deleteQuote(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query;
  
  await withTransaction(async (client) => {
    await client.query('DELETE FROM quote_items WHERE quote_id = $1::uuid', [id]);
    await client.query('DELETE FROM quotes WHERE id = $1::uuid', [id]);
  });
  
  res.status(204).end();
}
