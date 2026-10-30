// ─────────────────────────────────────────────────────────────────────────────
// Standardized API response helpers
// All responses follow: { success, data?, error?, message? }
// ─────────────────────────────────────────────────────────────────────────────

import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 500,
  errors?: Record<string, string[]>
): Response {
  const body: ApiResponse<null> = { success: false, error };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

export function sendNotFound(res: Response, resource = 'Resource'): Response {
  return sendError(res, `${resource} not found`, 404);
}

export function sendForbidden(res: Response, message = 'Access denied'): Response {
  return sendError(res, message, 403);
}

export function sendUnauthorized(res: Response, message = 'Unauthorized'): Response {
  return sendError(res, message, 401);
}

export function sendValidationError(
  res: Response,
  errors: Record<string, string[]>
): Response {
  return sendError(res, 'Validation failed', 422, errors);
}
