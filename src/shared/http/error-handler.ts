import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, InternalError, NotFoundError, ValidationError } from '../errors';
import { logger } from '../logger';

const isBodyParseError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError('Route', `${req.method} ${req.path}`));
};

/** Translates any thrown value into the AppError JSON contract. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (isBodyParseError(err)) {
    appError = new ValidationError('Malformed JSON body');
  } else {
    logger.error('Unhandled error', { error: err instanceof Error ? err.stack : String(err) });
    appError = new InternalError();
  }
  res.status(appError.statusCode).json(appError.toBody());
};
