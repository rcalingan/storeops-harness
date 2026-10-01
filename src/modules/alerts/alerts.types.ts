export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['UNREAD', 'READ'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const ALERT_TYPES = ['SLA_BREACH', 'TASK_ASSIGNED', 'PROGRAMME_MEMBER_ADDED', 'INVENTORY_LOW'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export interface Notification {
  id: string;
  userId: string;
  type: AlertType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  message: string;
  metadata: Record<string, string>;
  createdAt: string;
  readAt: string | null;
}

export interface NotifyInput {
  userId: string;
  type: AlertType;
  title: string;
  message: string;
  channel?: NotificationChannel;
  metadata?: Record<string, string>;
}

export interface AlertFilter {
  status?: NotificationStatus;
}
