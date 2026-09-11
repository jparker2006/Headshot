import type { TitleRow, TitlesStore } from "./types";

/** The titles cache in process memory: keyless dev, tests, and the reference. */
export class MemoryTitlesStore implements TitlesStore {
  private rows = new Map<string, TitleRow>();

  async getMany(ids: string[]): Promise<Map<string, TitleRow>> {
    const out = new Map<string, TitleRow>();
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) out.set(id, structuredClone(row));
    }
    return out;
  }

  async upsertMany(rows: TitleRow[]): Promise<void> {
    for (const row of rows) this.rows.set(row.imdbId, structuredClone(row));
  }
}
