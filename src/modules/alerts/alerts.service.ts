import { randomUUID } from 'node:crypto';
import { systemClock, type Clock } from '../../shared/clock';
import type { AlertsRepository } from './alerts.repository';
import type { AlertFilter, Notification, NotifyInput } from './alerts.types';

/**
 * Delivers in-app alerts. Other modules never call this directly —
 * alerts are raised by subscribing to domain events (see alerts.events.ts).
 */
export class AlertsService {
  constructor(
    private readonly repository: AlertsRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  listForUser(userId: string, filter: AlertFilter = {}): Promise<Notification[]> {
    return this.repository.findByUser(userId, filter.status);
  }

  notify(input: NotifyInput): Promise<Notification> {
    return this.repository.create({
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      channel: input.channel ?? 'IN_APP',
      status: 'UNREAD',
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? {},
      createdAt: this.clock().toISOString(),
      readAt: null,
    });
  }

  /** Sends the same alert to several recipients, de-duplicating user IDs. */
  async notifyMany(userIds: readonly string[], input: Omit<NotifyInput, 'userId'>): Promise<Notification[]> {
    const unique = [...new Set(userIds)];
    return Promise.all(unique.map((userId) => this.notify({ ...input, userId })));
  }
}
