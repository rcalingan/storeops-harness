import type { Project, ProgrammeStatus } from './programmes.types';

export interface ProgrammeFilter {
  storeId?: string;
  status?: ProgrammeStatus;
}

export interface ProgrammesRepository {
  create(project: Project): Promise<Project>;
  update(project: Project): Promise<Project>;
  findById(id: string): Promise<Project | undefined>;
  findAll(filter?: ProgrammeFilter): Promise<Project[]>;
}

const clone = (p: Project): Project => ({ ...p, members: p.members.map((m) => ({ ...m })) });

export class InMemoryProgrammesRepository implements ProgrammesRepository {
  private readonly items = new Map<string, Project>();

  create(project: Project): Promise<Project> {
    this.items.set(project.id, clone(project));
    return Promise.resolve(clone(project));
  }

  update(project: Project): Promise<Project> {
    this.items.set(project.id, clone(project));
    return Promise.resolve(clone(project));
  }

  findById(id: string): Promise<Project | undefined> {
    const found = this.items.get(id);
    return Promise.resolve(found && clone(found));
  }

  findAll(filter: ProgrammeFilter = {}): Promise<Project[]> {
    const results = [...this.items.values()].filter(
      (p) =>
        (filter.storeId === undefined || p.storeId === filter.storeId) &&
        (filter.status === undefined || p.status === filter.status),
    );
    return Promise.resolve(results.map(clone));
  }
}
