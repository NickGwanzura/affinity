/**
 * Shared pagination utility for list endpoints.
 */

import { ApiRequest } from './_types.js';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT     = 5000;

/**
 * Extract pagination params from request query.
 * Reads `page` and `limit` query params, both optional.
 */
export function getPagination(req: ApiRequest): PaginationParams {
  const rawPage  = typeof req.query.page  === 'string' ? parseInt(req.query.page, 10)  : NaN;
  const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;

  const page  = Number.isFinite(rawPage)  && rawPage  > 0  ? rawPage  : DEFAULT_PAGE;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Wrap a flat array result into a paginated JSON response body.
 */
export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit) || 1,
  };
}
