import { eq } from "drizzle-orm";
import { getDrizzleDatabase } from "../database/init.ts";
import { settings } from "../database/schema.ts";
import { Setting } from "../types/index.ts";

export const getSettings = () => {
  const db = getDrizzleDatabase() as any;
  return db.select().from(settings).all();
};

export const updateSettings = (data: Record<string, string>) => {
  const db = getDrizzleDatabase() as any;
  const results: Setting[] = [];

  for (const [key, raw] of Object.entries(data)) {
    // Treat explicit empty strings for certain keys as clearing the setting
    const shouldClear = [
      "companyTaxId",
      "taxId", // alias that may slip through
      "companyPhone",
      "phone", // alias
      "companyEmail",
      "email", // alias
      "companyCountryCode",
      "countryCode", // alias
      "companyCity",
      "companyPostalCode",
      "locale",
    ].includes(key) && String(raw).trim() === "";

    if (shouldClear) {
      db.delete(settings).where(
        eq(settings.key, key === "taxId" ? "companyTaxId" : key),
      ).run();
      results.push({ key: key === "taxId" ? "companyTaxId" : key, value: "" });
      continue;
    }

    const value = String(raw);
    // Upsert the setting
    const existing = db.select().from(settings).where(eq(settings.key, key)).all();
    if (existing.length > 0) {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
    results.push({ key, value });
  }

  return results;
};

export const getSetting = (key: string) => {
  const db = getDrizzleDatabase() as any;
  const result = db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).all();
  return result.length > 0 ? result[0].value : null;
};

export const setSetting = (key: string, value: string) => {
  const db = getDrizzleDatabase() as any;
  const existing = db.select().from(settings).where(eq(settings.key, key)).all();

  if (existing.length > 0) {
    db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value }).run();
  }

  return { key, value };
};

export const deleteSetting = (key: string) => {
  const db = getDrizzleDatabase() as any;
  db.delete(settings).where(eq(settings.key, key)).run();
  return { key } as Pick<Setting, "key">;
};
