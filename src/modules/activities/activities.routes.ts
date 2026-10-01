import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { parseOrThrow } from '../../shared/http/validation';
import { getAuthUser } from '../staff/staff.auth';
import type { ActivitiesService } from './activities.service';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from './activities.types';

const listQuerySchema = z.object({
  programmeId: z.string().min(1).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  programmeId: z.string().min(1),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateSchema = z
  .object({
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

const idParams = z.object({ id: z.string().min(1) });

export const createActivitiesRouter = (service: ActivitiesService): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const filter = parseOrThrow(listQuerySchema, req.query);
      res.json(await service.list(filter));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(createSchema, req.body);
      res.status(201).json(await service.create(getAuthUser(res), input));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idParams, req.params);
      res.json(await service.getById(id));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idParams, req.params);
      const patch = parseOrThrow(updateSchema, req.body);
      res.json(await service.update(getAuthUser(res), id, patch));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idParams, req.params);
      await service.delete(getAuthUser(res), id);
      res.status(204).send();
    }),
  );

  return router;
};
