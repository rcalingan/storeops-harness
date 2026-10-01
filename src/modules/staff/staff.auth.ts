import type { RequestHandler, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { asyncHandler } from '../../shared/http/async-handler';
import type { StaffService } from './staff.service';
import type { AuthUser } from './staff.types';

const BEARER = /^Bearer\s+(\S+)$/i;

/** HTTP middleware: resolves the bearer token via StaffService and attaches the identity. */
export const createAuthenticate = (staffService: StaffService): RequestHandler =>
  asyncHandler(async (req, res, next) => {
    const match = BEARER.exec(req.header('authorization') ?? '');
    if (!match?.[1]) throw new UnauthorizedError('Missing bearer token');
    res.locals.user = await staffService.authenticate(match[1]);
    next();
  });

/** Reads the authenticated identity from the response context. */
export const getAuthUser = (res: Response): AuthUser => {
  const user = res.locals.user as AuthUser | undefined;
  if (!user) throw new UnauthorizedError();
  return user;
};
