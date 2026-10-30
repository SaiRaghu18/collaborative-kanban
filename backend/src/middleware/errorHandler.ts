import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { config } from '../config/env';
import { sendError } from '../utils/apiResponse';
import { Prisma } from '@prisma/client';

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  // Our custom AppErrors (including subclasses: NotFoundError, ForbiddenError, etc.)
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Prisma-specific errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation
      const fields = (err.meta?.target as string[])?.join(', ') ?? 'field';
      sendError(res, `A record with this ${fields} already exists`, 409);
      return;
    }
    if (err.code === 'P2025') {
      // Record not found
      sendError(res, 'Record not found', 404);
      return;
    }
  }

  // Unknown errors — hide details in production
  const message = config.isDevelopment ? err.message : 'An unexpected error occurred';
  sendError(res, message, 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}
