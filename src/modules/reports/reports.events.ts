import type { EventBus } from '../../shared/events/event-bus';
import type { ReportsService } from './reports.service';

/** Event-driven entry point for reports: a closed programme triggers a STORE_SUMMARY snapshot. */
export const registerReportSubscriptions = (events: EventBus, reports: ReportsService): (() => void) =>
  events.on('programme.closed', async (e) => {
    await reports.generateStoreSummary(e.storeId, 'PROGRAMME_CLOSED', e.programmeId);
  });
