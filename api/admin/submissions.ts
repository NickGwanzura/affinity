import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  setSecurityHeaders,
  verifyToken,
} from '../_middleware.js';
import { sql } from '../_db.js';

type SubmissionType = 'registration_request' | 'questionnaire_submission';

type RegistrationSubmissionRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
};

type GenericRecordRow = {
  record: Record<string, unknown>;
};

const VALID_TYPES = ['all', 'registration_request', 'questionnaire_submission'] as const;

const toRows = <T>(result: any): T[] => {
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result?.rows)) return result.rows as T[];
  return [];
};

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function asLowerString(value: unknown): string {
  return asString(value)?.toLowerCase() || '';
}

function fallbackId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await sql`SELECT to_regclass(${`public.${tableName}`})::text AS regclass`;
  return typeof rows[0]?.regclass === 'string' && rows[0].regclass.length > 0;
}

async function loadRegistrationSubmissions(
  status: string | null,
): Promise<
  Array<{
    id: string;
    type: SubmissionType;
    status: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    title: string | null;
    submitter_name: string | null;
    submitter_email: string | null;
    metadata: Record<string, unknown>;
  }>
> {
  const registrationsExists = await tableExists('registration_requests');
  if (!registrationsExists) return [];

  const clauses: string[] = [];
  const params: any[] = [];

  if (status) {
    params.push(status);
    clauses.push(`LOWER(COALESCE(rr.status, '')) = LOWER($${params.length})`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const result = await sql.query(
    `
      SELECT
        rr.id::text AS id,
        rr.name,
        rr.email,
        rr.role,
        rr.status,
        rr.requested_at,
        rr.reviewed_at
      FROM registration_requests rr
      ${whereClause}
      ORDER BY rr.requested_at DESC
      LIMIT 500
    `,
    params,
  );

  return toRows<RegistrationSubmissionRow>(result).map((row) => ({
    id: row.id,
    type: 'registration_request',
    status: row.status || 'Unknown',
    submitted_at: row.requested_at || null,
    reviewed_at: row.reviewed_at || null,
    title: 'Registration request',
    submitter_name: row.name || null,
    submitter_email: row.email || null,
    metadata: {
      role: row.role || null,
    },
  }));
}

async function loadQuestionnaires(): Promise<
  Array<{
    id: string;
    title: string;
    status: string;
    created_at: string | null;
    updated_at: string | null;
    raw: Record<string, unknown>;
  }>
> {
  const questionnairesExists = await tableExists('questionnaires');
  if (!questionnairesExists) return [];

  const result = await sql.query(
    `
      SELECT to_jsonb(q) AS record
      FROM questionnaires q
      LIMIT 500
    `,
  );

  const records = toRows<GenericRecordRow>(result).map((row) => row.record || {});

  return records.map((record) => ({
    id: asString(record.id) || fallbackId('questionnaire'),
    title:
      asString(record.title) ||
      asString(record.name) ||
      asString(record.questionnaire_name) ||
      'Untitled questionnaire',
    status: asString(record.status) || 'unknown',
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
    raw: record,
  }));
}

async function loadQuestionnaireSubmissions(
  status: string | null,
): Promise<
  Array<{
    id: string;
    type: SubmissionType;
    status: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    title: string | null;
    submitter_name: string | null;
    submitter_email: string | null;
    metadata: Record<string, unknown>;
  }>
> {
  const submissionsExists = await tableExists('questionnaire_submissions');
  if (!submissionsExists) return [];

  const result = await sql.query(
    `
      SELECT to_jsonb(qs) AS record
      FROM questionnaire_submissions qs
      LIMIT 1000
    `,
  );

  const records = toRows<GenericRecordRow>(result).map((row) => row.record || {});

  return records
    .map((record) => {
      const recordStatus = asString(record.status) || 'unknown';
      return {
        id: asString(record.id) || asString(record.submission_id) || fallbackId('questionnaire_submission'),
        type: 'questionnaire_submission' as const,
        status: recordStatus,
        submitted_at:
          asString(record.submitted_at) ||
          asString(record.created_at) ||
          asString(record.updated_at) ||
          null,
        reviewed_at: asString(record.reviewed_at),
        title:
          asString(record.title) ||
          asString(record.questionnaire_title) ||
          asString(record.questionnaire_name) ||
          null,
        submitter_name: asString(record.submitter_name) || asString(record.name),
        submitter_email: asString(record.submitter_email) || asString(record.email),
        metadata: record,
      };
    })
    .filter((item) => (status ? asLowerString(item.status) === asLowerString(status) : true));
}

function sortBySubmittedDateDesc<T extends { submitted_at: string | null }>(records: T[]): T[] {
  return records.sort((a, b) => {
    const left = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const right = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return right - left;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  if (req.method !== 'GET') {
    return apiError(res, 405, 'Method not allowed');
  }

  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : null;
    const typeFilterRaw = typeof req.query.type === 'string' ? req.query.type.trim() : 'all';
    const typeFilter = VALID_TYPES.includes(typeFilterRaw as (typeof VALID_TYPES)[number])
      ? (typeFilterRaw as (typeof VALID_TYPES)[number])
      : 'all';

    const [questionnaires, registrationSubmissions, questionnaireSubmissions, questionnaireTable, submissionTable] =
      await Promise.all([
        loadQuestionnaires(),
        loadRegistrationSubmissions(status),
        loadQuestionnaireSubmissions(status),
        tableExists('questionnaires'),
        tableExists('questionnaire_submissions'),
      ]);

    const submissions = [
      ...(typeFilter === 'all' || typeFilter === 'registration_request' ? registrationSubmissions : []),
      ...(typeFilter === 'all' || typeFilter === 'questionnaire_submission' ? questionnaireSubmissions : []),
    ];

    const filteredQuestionnaires = status
      ? questionnaires.filter((item) => asLowerString(item.status) === asLowerString(status))
      : questionnaires;

    const sortedSubmissions = sortBySubmittedDateDesc(submissions);

    return res.status(200).json({
      summary: {
        questionnaires: filteredQuestionnaires.length,
        submissions: sortedSubmissions.length,
        pendingSubmissions: sortedSubmissions.filter((item) => asLowerString(item.status) === 'pending').length,
      },
      questionnaires: filteredQuestionnaires,
      submissions: sortedSubmissions,
      filters: {
        status,
        type: typeFilter,
      },
      sources: {
        questionnairesTable: questionnaireTable,
        questionnaireSubmissionsTable: submissionTable,
        registrationRequestsTable: await tableExists('registration_requests'),
      },
    });
  } catch (error) {
    return apiError(res, 500, 'Failed to load admin submissions', error);
  }
}
