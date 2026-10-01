import type { TaskStatus } from '../activities/activities.types';
import type { StaffRole } from '../staff/staff.types';

export const REPORT_TYPES = ['STORE_SUMMARY', 'REGION_SUMMARY'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TRIGGERS = ['ON_DEMAND', 'PROGRAMME_CLOSED'] as const;
export type ReportTrigger = (typeof REPORT_TRIGGERS)[number];

export interface StoreMetrics {
  programmes: { total: number; active: number; closed: number };
  activities: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    overdue: number;
    completionRate: number;
  };
  staff: { total: number; byRole: Record<StaffRole, number> };
}

export interface Report {
  id: string;
  type: ReportType;
  trigger: ReportTrigger;
  storeId: string;
  programmeId: string | null;
  generatedAt: string;
  metrics: StoreMetrics;
}
