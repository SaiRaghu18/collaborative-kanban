import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendValidationError } from '../utils/apiResponse';

/**
 * Factory that returns a middleware validating req.body against a Zod schema.
 * On success, req.body is replaced with the parsed (and sanitized) value.
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = formatZodErrors(result.error);
      sendValidationError(res, fieldErrors);
      return;
    }

    req.body = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const field = err.path.join('.') || 'general';
    if (!formatted[field]) {
      formatted[field] = [];
    }
    formatted[field].push(err.message);
  });

  return formatted;
}
