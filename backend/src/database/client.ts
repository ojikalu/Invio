import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";

export class AppDatabase {
  changes = 0;

  constructor(private client: any) {}

  query(sql: string, params: unknown[] = []): unknown[][] {
    const statement = this.client.prepare(sql);
    const normalized = sql.trim().toLowerCase();
    const isReadQuery =
      normalized.startsWith("select") ||
      normalized.startsWith("with") ||
      normalized.startsWith("pragma") ||
      normalized.startsWith("explain");

    if (isReadQuery) {
      return statement.raw(true).all(...params) as unknown[][];
    }

    const result = statement.run(...params);
    this.changes = Number(result?.changes ?? 0);
    return [];
  }

  execute(sql: string): void {
    this.client.exec(sql);
  }

  prepare(sql: string): any {
    return this.client.prepare(sql);
  }

  close(): void {
    this.client.close();
  }
}

export function createDatabase(dbPath: string): {
  raw: AppDatabase;
  orm: any;
} {
  const client = new Database(dbPath);
  const raw = new AppDatabase(client);
  const orm = drizzle(client, { schema });
  return { raw, orm };
}
