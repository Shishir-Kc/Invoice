import type { Context } from "hono";

/**
 * Response helpers that preserve the exact JSON shapes the frontend expects
 * (see frontend/src/types/index.ts). No breaking changes to the API contract.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function ok<T>(c: Context, data: T, message = ""): Response {
  return c.json<ApiResponse<T>>({ success: true, data, message });
}

export function paginated<T>(
  c: Context,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Response {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return c.json<PaginatedResponse<T>>({ data, total, page, pageSize, totalPages });
}
