import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { parseOrThrow } from '../../shared/http/validation';
import { getAuthUser } from '../staff/staff.auth';
import type { AlertsService } from './alerts.service';
import { NOTIFICATION_STATUSES } from './alerts.types';

const listQuerySchema = z.object({
  status: z.enum(NOTIFICATION_STATUSES).optional(),
});

export const createAlertsRouter = (service: AlertsService): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const filter = parseOrThrow(listQuerySchema, req.query);
      res.json(await service.listForUser(getAuthUser(res).id, filter));
    }),
  );

  return router;
};
