/// <reference lib="deno.ns" />

declare const Deno: typeof globalThis.Deno;

declare module "better-sqlite3" {
  const Database: any;
  export default Database;
}

declare module "drizzle-orm" {
  export const sql: any;
  export const and: any;
  export const desc: any;
  export const eq: any;
}

declare module "drizzle-orm/better-sqlite3" {
  export const drizzle: any;
}

declare module "drizzle-orm/sqlite-core" {
  export const sqliteTable: any;
  export const text: any;
  export const integer: any;
  export const real: any;
  export const index: any;
  export const uniqueIndex: any;
}