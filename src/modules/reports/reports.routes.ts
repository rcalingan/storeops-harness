import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { parseOrThrow } from '../../shared/http/validation';
import { getAuthUser } from '../staff/staff.auth';
import type { ReportsService } from './reports.service';

const storeQuerySchema = z.object({
  storeId: z.string().min(1).optional(),
});

export const createReportsRouter = (service: ReportsService): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { storeId } = parseOrThrow(storeQuerySchema, req.query);
      res.json(await service.listForStore(getAuthUser(res), storeId));
    }),
  );

  router.post(
    '/store-summary',
    asyncHandler(async (req, res) => {
      const { storeId } = parseOrThrow(storeQuerySchema, req.body ?? {});
      res.status(201).json(await service.generateOnDemand(getAuthUser(res), storeId));
    }),
  );

  return router;
};
