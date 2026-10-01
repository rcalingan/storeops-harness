import type { EventBus } from '../../shared/events/event-bus';
import type { StaffService } from '../staff/staff.service';
import type { AlertsService } from './alerts.service';

/**
 * Event-driven entry point for the alerts module: translates domain events into notifications.
 * Returns an unsubscribe function that detaches every handler.
 */
export const registerAlertSubscriptions = (
  events: EventBus,
  alerts: AlertsService,
  staff: StaffService,
): (() => void) => {
  const unsubscribers = [
    events.on('activity.assigned', async (e) => {
      await alerts.notify({
        userId: e.assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'New activity assigned',
        message: `You have been assigned "${e.title}"`,
        metadata: { activityId: e.activityId, programmeId: e.programmeId },
      });
    }),

    events.on('activity.sla_breached', async (e) => {
      const recipients = [e.createdBy, ...(e.assigneeId ? [e.assigneeId] : [])];
      await alerts.notifyMany(recipients, {
        type: 'SLA_BREACH',
        title: 'SLA breached',
        message: `${e.priority} activity "${e.title}" is overdue (due ${e.dueDate})`,
        metadata: { activityId: e.activityId, programmeId: e.programmeId },
      });
    }),

    events.on('programme.member_added', async (e) => {
      await alerts.notify({
        userId: e.userId,
        type: 'PROGRAMME_MEMBER_ADDED',
        title: 'Added to programme',
        message: `You have been added to "${e.programmeName}" as ${e.role}`,
        metadata: { programmeId: e.programmeId },
      });
    }),

    events.on('inventory.low_stock', async (e) => {
      const managers = (await staff.list({ storeId: e.storeId })).filter((u) => u.role === 'STORE_MANAGER');
      await alerts.notifyMany(
        managers.map((m) => m.id),
        {
          type: 'INVENTORY_LOW',
          title: 'Low stock',
          message: `SKU ${e.sku} is at ${e.quantity} units (threshold ${e.threshold})`,
          metadata: { storeId: e.storeId, sku: e.sku },
        },
      );
    }),
  ];

  return () => unsubscribers.forEach((off) => off());
};
