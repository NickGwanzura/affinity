import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import type { LandedCostSummary } from '../types';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
} from './_middleware.js';
import { checkRateLimit } from './_rate_limit.js';

type SanitizedSummary = {
  vehicle_id: string;
  vin_number: string;
  make_model: string;
  purchase_price_gbp: number;
  total_expenses_usd: number;
  total_landed_cost_usd: number;
  status: string;
};

type AiResponse = {
  insights: string;
  text: string;
  source: 'gemini' | 'manual';
  generatedAt: string;
};

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function asFiniteNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function asShortString(value: unknown, fallback: string, maxLength = 120): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.trim().slice(0, maxLength);
}

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function extractRawSummaries(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }

  if (!body || typeof body !== 'object') {
    return [];
  }

  const record = body as Record<string, unknown>;
  const nestedData = record.data;

  if (Array.isArray(record.summaries)) {
    return record.summaries;
  }

  if (Array.isArray(record.vehicles)) {
    return record.vehicles;
  }

  if (Array.isArray(record.data)) {
    return record.data;
  }

  if (nestedData && typeof nestedData === 'object') {
    const nestedRecord = nestedData as Record<string, unknown>;
    if (Array.isArray(nestedRecord.summaries)) {
      return nestedRecord.summaries;
    }
    if (Array.isArray(nestedRecord.vehicles)) {
      return nestedRecord.vehicles;
    }
  }

  return [];
}

function sanitizeSummaries(items: unknown[]): SanitizedSummary[] {
  return items
    .filter((item): item is Partial<LandedCostSummary> => !!item && typeof item === 'object')
    .slice(0, 10)
    .map((item, index) => ({
      vehicle_id: asShortString(item.vehicle_id, `vehicle-${index + 1}`),
      vin_number: asShortString(item.vin_number, 'Unknown VIN'),
      make_model: asShortString(item.make_model, 'Unknown vehicle'),
      purchase_price_gbp: asFiniteNumber(item.purchase_price_gbp),
      total_expenses_usd: asFiniteNumber(item.total_expenses_usd),
      total_landed_cost_usd: asFiniteNumber(item.total_landed_cost_usd),
      status: asShortString(item.status, 'Unknown', 40),
    }))
    .filter((item) => item.total_landed_cost_usd > 0 || item.total_expenses_usd > 0 || item.purchase_price_gbp > 0);
}

function extractQuestion(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const question = typeof record.question === 'string' ? record.question : record.prompt;
  return typeof question === 'string' && question.trim() ? question.trim().slice(0, 500) : null;
}

function formatCurrency(value: number, currency = 'USD'): string {
  const rounded = Math.round(value);
  return `${currency === 'GBP' ? 'GBP' : '$'}${rounded.toLocaleString()}`;
}

function buildManualSummary(data: SanitizedSummary[]): string {
  if (data.length === 0) {
    return 'No fleet data is available yet for AI analysis.';
  }

  const totalVehicles = data.length;
  const totalExpenses = data.reduce((sum, vehicle) => sum + vehicle.total_expenses_usd, 0);
  const totalLandedCost = data.reduce((sum, vehicle) => sum + vehicle.total_landed_cost_usd, 0);
  const avgLandedCost = totalLandedCost / totalVehicles;
  const statusBreakdown = data.reduce<Record<string, number>>((acc, vehicle) => {
    acc[vehicle.status] = (acc[vehicle.status] || 0) + 1;
    return acc;
  }, {});

  const topVehicles = [...data]
    .sort((a, b) => b.total_landed_cost_usd - a.total_landed_cost_usd)
    .slice(0, 3)
    .map(
      (vehicle) =>
        `${vehicle.make_model} (${vehicle.vin_number}): ${formatCurrency(vehicle.total_landed_cost_usd)} landed cost`
    );

  return [
    `Fleet snapshot: ${totalVehicles} vehicle${totalVehicles === 1 ? '' : 's'} analysed.`,
    `Average landed cost: ${formatCurrency(avgLandedCost)}.`,
    `Total tracked expenses: ${formatCurrency(totalExpenses)}.`,
    `Status mix: ${Object.entries(statusBreakdown)
      .map(([status, count]) => `${status} ${count}`)
      .join(', ')}.`,
    topVehicles.length > 0 ? `Highest landed cost vehicles: ${topVehicles.join('; ')}.` : null,
    'Live AI generation is unavailable right now, so this response is based on computed fleet metrics.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPrompt(data: SanitizedSummary[], question: string | null): string {
  const fleetData = data
    .map(
      (vehicle, index) =>
        `${index + 1}. ${vehicle.make_model} | VIN: ${vehicle.vin_number} | Status: ${vehicle.status} | Purchase GBP: ${vehicle.purchase_price_gbp} | Expenses USD: ${vehicle.total_expenses_usd} | Landed USD: ${vehicle.total_landed_cost_usd}`
    )
    .join('\n');

  return [
    'You are analysing logistics fleet cost data for an operations dashboard.',
    'Write a concise, plain-English summary with practical business insights.',
    'Focus on cost concentration, status bottlenecks, and noteworthy outliers.',
    'Keep it under 180 words and avoid markdown.',
    question ? `User question: ${question}` : 'User question: Provide a concise fleet overview.',
    'Fleet data:',
    fleetData,
  ].join('\n');
}

async function generateGeminiSummary(data: SanitizedSummary[], question: string | null): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: buildPrompt(data, question),
  });

  const text = typeof response.text === 'string' ? response.text.trim() : '';
  return text || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;

  if (!(await checkRateLimit(`ai:${authReq.user!.id}`, 10, 60000))) {
    return json(res, 429, { error: 'Rate limit exceeded. Try again in a minute.' });
  }

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      endpoint: '/api/ai',
      methods: ['GET', 'POST', 'OPTIONS'],
      generatedAt: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const parsedBody = parseBody(req.body);
  const summaries = sanitizeSummaries(extractRawSummaries(parsedBody));
  const question = extractQuestion(parsedBody);

  if (summaries.length === 0) {
    return json(res, 400, {
      error: 'Request must include a non-empty fleet summary array.',
      acceptedShapes: ['[summary, ...]', '{ summaries: [...] }', '{ data: [...] }', '{ vehicles: [...] }'],
    });
  }

  const generatedAt = new Date().toISOString();

  try {
    const aiText = await generateGeminiSummary(summaries, question);
    const insights = aiText || buildManualSummary(summaries);
    const response: AiResponse = {
      insights,
      text: insights,
      source: aiText ? 'gemini' : 'manual',
      generatedAt,
    };

    return json(res, 200, response);
  } catch (error) {
    console.error('[api/ai] Falling back to manual summary after AI failure:', error);
    const insights = buildManualSummary(summaries);
    const response: AiResponse = {
      insights,
      text: insights,
      source: 'manual',
      generatedAt,
    };

    return json(res, 200, response);
  }
}
