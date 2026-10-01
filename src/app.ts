import express, { type Express } from 'express';
import { buildContainer, type Container } from './container';
import { createActivitiesRouter } from './modules/activities/activities.routes';
import { createAlertsRouter } from './modules/alerts/alerts.routes';
import { createProgrammesRouter } from './modules/programmes/programmes.routes';
import { createReportsRouter } from './modules/reports/reports.routes';
import { createAuthenticate } from './modules/staff/staff.auth';
import { createStaffPublicRouter, createStaffRouter } from './modules/staff/staff.routes';
import { errorHandler, notFoundHandler } from './shared/http/error-handler';

export const createApp = (container: Container = buildContainer()): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const authenticate = createAuthenticate(container.staffService);

  app.use('/api/staff', createStaffPublicRouter(container.staffService));
  app.use('/api/staff', createStaffRouter(container.staffService, authenticate));
  app.use('/api/activities', authenticate, createActivitiesRouter(container.activitiesService));
  app.use('/api/programmes', authenticate, createProgrammesRouter(container.programmesService));
  app.use('/api/alerts', authenticate, createAlertsRouter(container.alertsService));
  app.use('/api/reports', authenticate, createReportsRouter(container.reportsService));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
