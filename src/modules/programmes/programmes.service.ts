import { randomUUID } from 'node:crypto';
import { systemClock, type Clock } from '../../shared/clock';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import type { EventBus } from '../../shared/events/event-bus';
import type { StaffService } from '../staff/staff.service';
import type { AuthUser } from '../staff/staff.types';
import type { ProgrammeFilter, ProgrammesRepository } from './programmes.repository';
import type { AddMemberInput, CreateProgrammeInput, Project } from './programmes.types';

export class ProgrammesService {
  constructor(
    private readonly repository: ProgrammesRepository,
    private readonly staff: StaffService,
    private readonly events: EventBus,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Programmes belonging to the caller's store. */
  listForStore(actor: AuthUser): Promise<Project[]> {
    return this.repository.findAll({ storeId: actor.storeId });
  }

  /** Read-only lookup used by other modules (activities, reports). */
  list(filter: ProgrammeFilter = {}): Promise<Project[]> {
    return this.repository.findAll(filter);
  }

  async getById(id: string): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) throw new NotFoundError('Programme', id);
    return project;
  }

  async create(actor: AuthUser, input: CreateProgrammeInput): Promise<Project> {
    if (actor.role !== 'STORE_MANAGER' && actor.role !== 'REGIONAL_MANAGER') {
      throw new ForbiddenError('Only store or regional managers can create programmes');
    }
    const now = this.clock().toISOString();
    return this.repository.create({
      id: randomUUID(),
      name: input.name,
      description: input.description ?? '',
      storeId: actor.storeId,
      status: 'ACTIVE',
      ownerId: actor.id,
      members: [{ userId: actor.id, role: 'STORE_MANAGER', addedAt: now }],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    });
  }

  async addMember(actor: AuthUser, programmeId: string, input: AddMemberInput): Promise<Project> {
    const project = await this.getById(programmeId);
    this.assertCanManage(actor, project);
    if (project.status === 'CLOSED') {
      throw new ConflictError(`Programme '${programmeId}' is closed`);
    }
    if (project.members.some((m) => m.userId === input.userId)) {
      throw new ConflictError(`Staff member '${input.userId}' is already a member of this programme`);
    }
    const member = await this.staff.getById(input.userId);
    if (member.storeId !== project.storeId) {
      throw new ValidationError('Staff member belongs to a different store than the programme');
    }

    const now = this.clock().toISOString();
    const updated = await this.repository.update({
      ...project,
      members: [...project.members, { userId: input.userId, role: input.role, addedAt: now }],
      updatedAt: now,
    });

    await this.events.emit('programme.member_added', {
      programmeId: updated.id,
      programmeName: updated.name,
      userId: input.userId,
      role: input.role,
      addedBy: actor.id,
    });
    return updated;
  }

  /** Closes a programme; reports reacts to the emitted event with a STORE_SUMMARY. */
  async close(actor: AuthUser, programmeId: string): Promise<Project> {
    const project = await this.getById(programmeId);
    this.assertCanManage(actor, project);
    if (project.status === 'CLOSED') {
      throw new ConflictError(`Programme '${programmeId}' is already closed`);
    }
    const now = this.clock().toISOString();
    const updated = await this.repository.update({ ...project, status: 'CLOSED', closedAt: now, updatedAt: now });
    await this.events.emit('programme.closed', {
      programmeId: updated.id,
      storeId: updated.storeId,
      closedBy: actor.id,
    });
    return updated;
  }

  private assertCanManage(actor: AuthUser, project: Project): void {
    const isRegional = actor.role === 'REGIONAL_MANAGER';
    const isProgrammeManager = project.members.some((m) => m.userId === actor.id && m.role === 'STORE_MANAGER');
    if (!isRegional && !isProgrammeManager) {
      throw new ForbiddenError('Only the programme store manager or a regional manager can manage this programme');
    }
  }
}
