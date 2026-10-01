import { InMemoryActivitiesRepository } from './modules/activities/activities.repository';
import { ActivitiesService } from './modules/activities/activities.service';
import { registerAlertSubscriptions } from './modules/alerts/alerts.events';
import { InMemoryAlertsRepository } from './modules/alerts/alerts.repository';
import { AlertsService } from './modules/alerts/alerts.service';
import { InMemoryProgrammesRepository } from './modules/programmes/programmes.repository';
import { ProgrammesService } from './modules/programmes/programmes.service';
import { registerReportSubscriptions } from './modules/reports/reports.events';
import { InMemoryReportsRepository } from './modules/reports/reports.repository';
import { ReportsService } from './modules/reports/reports.service';
import { InMemoryStaffRepository } from './modules/staff/staff.repository';
import { StaffService } from './modules/staff/staff.service';
import { systemClock, type Clock } from './shared/clock';
import { EventBus } from './shared/events/event-bus';

export interface Container {
  clock: Clock;
  events: EventBus;
  staffService: StaffService;
  programmesService: ProgrammesService;
  activitiesService: ActivitiesService;
  alertsService: AlertsService;
  reportsService: ReportsService;
  dispose(): void;
}

export interface ContainerOptions {
  clock?: Clock;
}

/**
 * Composition root: the only place that knows about every module's concrete implementations.
 * Wires repositories → services, and subscribes alerts/reports to the event bus.
 */
export const buildContainer = ({ clock = systemClock }: ContainerOptions = {}): Container => {
  const events = new EventBus();

  const staffService = new StaffService(new InMemoryStaffRepository(), clock);
  const programmesService = new ProgrammesService(new InMemoryProgrammesRepository(), staffService, events, clock);
  const activitiesService = new ActivitiesService(
    new InMemoryActivitiesRepository(),
    programmesService,
    staffService,
    events,
    clock,
  );
  const alertsService = new AlertsService(new InMemoryAlertsRepository(), clock);
  const reportsService = new ReportsService(
    new InMemoryReportsRepository(),
    activitiesService,
    programmesService,
    staffService,
    clock,
  );

  const unsubscribers = [
    registerAlertSubscriptions(events, alertsService, staffService),
    registerReportSubscriptions(events, reportsService),
  ];

  return {
    clock,
    events,
    staffService,
    programmesService,
    activitiesService,
    alertsService,
    reportsService,
    dispose: () => unsubscribers.forEach((off) => off()),
  };
};
