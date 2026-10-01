import type { TaskPriority, TaskStatus } from '../../modules/activities/activities.types';
import type { ProjectRole } from '../../modules/programmes/programmes.types';

/**
 * Catalogue of cross-module domain events. Producers emit these via the EventBus;
 * consumers (alerts, reports) subscribe. Payloads are plain serialisable data.
 */
export interface DomainEventMap {
  'activity.assigned': {
    activityId: string;
    title: string;
    programmeId: string;
    assigneeId: string;
    assignedBy: string;
  };
  'activity.status_changed': {
    activityId: string;
    programmeId: string;
    from: TaskStatus;
    to: TaskStatus;
    changedBy: string;
  };
  'activity.sla_breached': {
    activityId: string;
    title: string;
    programmeId: string;
    priority: TaskPriority;
    dueDate: string;
    assigneeId: string | null;
    createdBy: string;
  };
  'programme.member_added': {
    programmeId: string;
    programmeName: string;
    userId: string;
    role: ProjectRole;
    addedBy: string;
  };
  'programme.closed': {
    programmeId: string;
    storeId: string;
    closedBy: string;
  };
  'inventory.low_stock': {
    storeId: string;
    sku: string;
    quantity: number;
    threshold: number;
  };
}

export type DomainEventName = keyof DomainEventMap;
