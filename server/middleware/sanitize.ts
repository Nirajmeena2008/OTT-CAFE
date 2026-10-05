import type { Request, Response, NextFunction } from 'express';

/**
 * Basic recursive sanitizer to strip potential script injection & HTML markup from inputs
 */
function cleanString(val: string): string {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? cleanString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    cleaned[key] = sanitizeObject(value);
  }
  return cleaned;
}

export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}
