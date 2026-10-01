import { randomUUID } from 'node:crypto';
import { systemClock, type Clock } from '../../shared/clock';
import { ForbiddenError, NotFoundError } from '../../shared/errors';
import type { EventBus } from '../../shared/events/event-bus';
import type { ProgrammesService } from '../programmes/programmes.service';
import type { StaffService } from '../staff/staff.service';
import type { AuthUser } from '../staff/staff.types';
import type { ActivitiesRepository } from './activities.repository';
import type { ActivityFilter, CreateActivityInput, Task, UpdateActivityInput } from './activities.types';

export class ActivitiesService {
  constructor(
    private readonly repository: ActivitiesRepository,
    private readonly programmes: ProgrammesService,
    private readonly staff: StaffService,
    private readonly events: EventBus,
    private readonly clock: Clock = systemClock,
  ) {}

  list(filter: ActivityFilter = {}): Promise<Task[]> {
    return this.repository.findAll(filter);
  }

  async getById(id: string): Promise<Task> {
    const task = await this.repository.findById(id);
    if (!task) throw new NotFoundError('Activity', id);
    return task;
  }

  async create(actor: AuthUser, input: CreateActivityInput): Promise<Task> {
    // Cross-module reads go through the owning module's service layer.
    await this.programmes.getById(input.programmeId);
    const assigneeId = input.assigneeId ?? null;
    if (assigneeId) await this.staff.getById(assigneeId);

    const now = this.clock().toISOString();
    const task = await this.repository.create({
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      programmeId: input.programmeId,
      status: 'TODO',
      priority: input.priority ?? 'MEDIUM',
      category: input.category ?? 'GENERAL',
      assigneeId,
      createdBy: actor.id,
      dueDate: input.dueDate ?? null,
      slaBreachedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    if (task.assigneeId) await this.emitAssigned(task, task.assigneeId, actor);
    return task;
  }

  async update(actor: AuthUser, id: string, patch: UpdateActivityInput): Promise<Task> {
    const existing = await this.getById(id);
    const assigneeChanged = patch.assigneeId !== undefined && patch.assigneeId !== existing.assigneeId;
    if (assigneeChanged && patch.assigneeId) await this.staff.getById(patch.assigneeId);

    const updated = await this.repository.update({
      ...existing,
      ...patch,
      updatedAt: this.clock().toISOString(),
    });

    if (patch.status !== undefined && patch.status !== existing.status) {
      await this.events.emit('activity.status_changed', {
        activityId: updated.id,
        programmeId: updated.programmeId,
        from: existing.status,
        to: patch.status,
        changedBy: actor.id,
      });
    }
    if (assigneeChanged && updated.assigneeId) await this.emitAssigned(updated, updated.assigneeId, actor);
    return updated;
  }

  /** Only the activity's creator or a store manager may delete it. */
  async delete(actor: AuthUser, id: string): Promise<void> {
    const task = await this.getById(id);
    if (task.createdBy !== actor.id && actor.role !== 'STORE_MANAGER') {
      throw new ForbiddenError('Only the activity owner or a store manager can delete this activity');
    }
    await this.repository.delete(id);
  }

  /**
   * Flags CRITICAL activities that are past due and not DONE, emitting one SLA breach event per activity.
   * Intended to be invoked by a scheduler; returns the activities newly flagged.
   */
  async checkSlaBreaches(): Promise<Task[]> {
    const now = this.clock();
    const candidates = await this.repository.findAll();
    const breached = candidates.filter(
      (t) =>
        t.priority === 'CRITICAL' &&
        t.status !== 'DONE' &&
        t.slaBreachedAt === null &&
        t.dueDate !== null &&
        new Date(t.dueDate) < now,
    );

    const flagged: Task[] = [];
    for (const task of breached) {
      const updated = await this.repository.update({ ...task, slaBreachedAt: now.toISOString() });
      flagged.push(updated);
      await this.events.emit('activity.sla_breached', {
        activityId: updated.id,
        title: updated.title,
        programmeId: updated.programmeId,
        priority: updated.priority,
        dueDate: updated.dueDate ?? now.toISOString(),
        assigneeId: updated.assigneeId,
        createdBy: updated.createdBy,
      });
    }
    return flagged;
  }

  private emitAssigned(task: Task, assigneeId: string, actor: AuthUser): Promise<void> {
    return this.events.emit('activity.assigned', {
      activityId: task.id,
      title: task.title,
      programmeId: task.programmeId,
      assigneeId,
      assignedBy: actor.id,
    });
  }
}
