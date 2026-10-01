import { randomUUID } from 'node:crypto';
import { systemClock, type Clock } from '../../shared/clock';
import { ForbiddenError } from '../../shared/errors';
import type { ActivitiesService } from '../activities/activities.service';
import { TASK_STATUSES, type TaskStatus } from '../activities/activities.types';
import type { ProgrammesService } from '../programmes/programmes.service';
import type { StaffService } from '../staff/staff.service';
import { STAFF_ROLES, type AuthUser, type StaffRole } from '../staff/staff.types';
import type { ReportsRepository } from './reports.repository';
import type { Report, ReportTrigger, StoreMetrics } from './reports.types';

const zeroCounts = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/**
 * Read-only aggregation across activities, programmes and staff.
 * Only ever reads other modules via their services; writes solely to its own repository.
 */
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly activities: ActivitiesService,
    private readonly programmes: ProgrammesService,
    private readonly staff: StaffService,
    private readonly clock: Clock = systemClock,
  ) {}

  async listForStore(actor: AuthUser, storeId?: string): Promise<Report[]> {
    return this.repository.findByStore(this.resolveStore(actor, storeId));
  }

  async generateOnDemand(actor: AuthUser, storeId?: string): Promise<Report> {
    return this.generateStoreSummary(this.resolveStore(actor, storeId), 'ON_DEMAND');
  }

  async generateStoreSummary(storeId: string, trigger: ReportTrigger, programmeId?: string): Promise<Report> {
    const metrics = await this.computeStoreMetrics(storeId);
    return this.repository.create({
      id: randomUUID(),
      type: 'STORE_SUMMARY',
      trigger,
      storeId,
      programmeId: programmeId ?? null,
      generatedAt: this.clock().toISOString(),
      metrics,
    });
  }

  private async computeStoreMetrics(storeId: string): Promise<StoreMetrics> {
    const now = this.clock();
    const programmes = await this.programmes.list({ storeId });
    const tasks = (await Promise.all(programmes.map((p) => this.activities.list({ programmeId: p.id })))).flat();
    const staff = await this.staff.list({ storeId });

    const byStatus = zeroCounts<TaskStatus>(TASK_STATUSES);
    for (const t of tasks) byStatus[t.status] += 1;
    const byRole = zeroCounts<StaffRole>(STAFF_ROLES);
    for (const s of staff) byRole[s.role] += 1;

    const overdue = tasks.filter((t) => t.status !== 'DONE' && t.dueDate !== null && new Date(t.dueDate) < now).length;
    const active = programmes.filter((p) => p.status === 'ACTIVE').length;

    return {
      programmes: { total: programmes.length, active, closed: programmes.length - active },
      activities: {
        total: tasks.length,
        byStatus,
        overdue,
        completionRate: tasks.length === 0 ? 0 : Number((byStatus.DONE / tasks.length).toFixed(4)),
      },
      staff: { total: staff.length, byRole },
    };
  }

  private resolveStore(actor: AuthUser, storeId?: string): string {
    if (actor.role === 'ASSOCIATE') throw new ForbiddenError('Associates cannot access store reports');
    const target = storeId ?? actor.storeId;
    if (target !== actor.storeId && actor.role !== 'REGIONAL_MANAGER') {
      throw new ForbiddenError('Only regional managers can view reports for other stores');
    }
    return target;
  }
}
