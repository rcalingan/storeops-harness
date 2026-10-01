import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { parseOrThrow } from '../../shared/http/validation';
import { getAuthUser } from './staff.auth';
import type { StaffService } from './staff.service';
import { STAFF_ROLES } from './staff.types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(STAFF_ROLES),
  storeId: z.string().min(1),
  regionId: z.string().min(1),
});

const updateProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
  })
  .strict();

/** Public staff routes (no authentication required). */
export const createStaffPublicRouter = (staffService: StaffService): Router => {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { email, password } = parseOrThrow(loginSchema, req.body);
      res.json(await staffService.login(email, password));
    }),
  );

  return router;
};

/** Authenticated staff routes. */
export const createStaffRouter = (staffService: StaffService, authenticate: RequestHandler): Router => {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(createStaffSchema, req.body);
      res.status(201).json(await staffService.createStaff(input, getAuthUser(res)));
    }),
  );

  router.get(
    '/me',
    asyncHandler(async (_req, res) => {
      res.json(await staffService.getById(getAuthUser(res).id));
    }),
  );

  router.patch(
    '/me',
    asyncHandler(async (req, res) => {
      const patch = parseOrThrow(updateProfileSchema, req.body);
      res.json(await staffService.updateProfile(getAuthUser(res).id, patch));
    }),
  );

  return router;
};
