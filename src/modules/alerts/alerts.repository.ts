import type { NotificationStatus, Notification } from './alerts.types';

export interface AlertsRepository {
  create(notification: Notification): Promise<Notification>;
  findByUser(userId: string, status?: NotificationStatus): Promise<Notification[]>;
}

export class InMemoryAlertsRepository implements AlertsRepository {
  private readonly items = new Map<string, Notification>();

  create(notification: Notification): Promise<Notification> {
    const copy = { ...notification, metadata: { ...notification.metadata } };
    this.items.set(notification.id, copy);
    return Promise.resolve({ ...copy, metadata: { ...copy.metadata } });
  }

  findByUser(userId: string, status?: NotificationStatus): Promise<Notification[]> {
    const results = [...this.items.values()]
      .filter((n) => n.userId === userId && (status === undefined || n.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(results.map((n) => ({ ...n, metadata: { ...n.metadata } })));
  }
}
