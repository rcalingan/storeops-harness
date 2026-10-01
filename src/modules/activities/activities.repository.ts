import type { ActivityFilter, Task } from './activities.types';

export interface ActivitiesRepository {
  create(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Task | undefined>;
  findAll(filter?: ActivityFilter): Promise<Task[]>;
}

export class InMemoryActivitiesRepository implements ActivitiesRepository {
  private readonly items = new Map<string, Task>();

  create(task: Task): Promise<Task> {
    this.items.set(task.id, { ...task });
    return Promise.resolve({ ...task });
  }

  update(task: Task): Promise<Task> {
    this.items.set(task.id, { ...task });
    return Promise.resolve({ ...task });
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.items.delete(id));
  }

  findById(id: string): Promise<Task | undefined> {
    const found = this.items.get(id);
    return Promise.resolve(found && { ...found });
  }

  findAll(filter: ActivityFilter = {}): Promise<Task[]> {
    const results = [...this.items.values()].filter(
      (t) =>
        (filter.programmeId === undefined || t.programmeId === filter.programmeId) &&
        (filter.status === undefined || t.status === filter.status),
    );
    return Promise.resolve(results.map((t) => ({ ...t })));
  }
}
