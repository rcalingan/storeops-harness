import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { parseOrThrow } from '../../shared/http/validation';
import { getAuthUser } from '../staff/staff.auth';
import type { ProgrammesService } from './programmes.service';
import { PROJECT_ROLES } from './programmes.types';

const createProgrammeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(PROJECT_ROLES),
});

const idParams = z.object({ id: z.string().min(1) });

export const createProgrammesRouter = (service: ProgrammesService): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await service.listForStore(getAuthUser(res)));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(createProgrammeSchema, req.body);
      res.status(201).json(await service.create(getAuthUser(res), input));
    }),
  );

  router.post(
    '/:id/members',
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idParams, req.params);
      const input = parseOrThrow(addMemberSchema, req.body);
      res.status(201).json(await service.addMember(getAuthUser(res), id, input));
    }),
  );

  return router;
};
