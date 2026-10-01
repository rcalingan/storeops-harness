import { createApp } from './app';
import { buildContainer } from './container';
import { SEED_PASSWORD, seed } from './seed';
import { logger } from './shared/logger';

const PORT = Number(process.env.PORT ?? 3000);
const SLA_CHECK_INTERVAL_MS = Number(process.env.SLA_CHECK_INTERVAL_MS ?? 60_000);

const main = async (): Promise<void> => {
  const container = buildContainer();
  if (process.env.SEED !== 'false') {
    const emails = await seed(container);
    logger.info('Seeded development staff', { emails, password: SEED_PASSWORD });
  }

  // Stub scheduler: periodically flag overdue CRITICAL activities (emits activity.sla_breached).
  setInterval(() => {
    container.activitiesService.checkSlaBreaches().catch((err: unknown) => {
      logger.error('SLA check failed', { error: String(err) });
    });
  }, SLA_CHECK_INTERVAL_MS).unref();

  createApp(container).listen(PORT, () => {
    logger.info('StoreOps API listening', { port: PORT });
  });
};

main().catch((err: unknown) => {
  logger.error('Failed to start StoreOps API', { error: String(err) });
  process.exit(1);
});
