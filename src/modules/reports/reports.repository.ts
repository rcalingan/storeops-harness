import type { Report } from './reports.types';

/** Persists generated report snapshots. Reports never write to other modules' data. */
export interface ReportsRepository {
  create(report: Report): Promise<Report>;
  findByStore(storeId: string): Promise<Report[]>;
}

const clone = (r: Report): Report => structuredClone(r);

export class InMemoryReportsRepository implements ReportsRepository {
  private readonly items = new Map<string, Report>();

  create(report: Report): Promise<Report> {
    this.items.set(report.id, clone(report));
    return Promise.resolve(clone(report));
  }

  findByStore(storeId: string): Promise<Report[]> {
    const results = [...this.items.values()]
      .filter((r) => r.storeId === storeId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return Promise.resolve(results.map(clone));
  }
}
