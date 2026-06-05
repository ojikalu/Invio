import { desc, eq, sql } from "drizzle-orm";
import { getDrizzleDatabase } from "../database/init.ts";
import { customers, invoices } from "../database/schema.ts";
import { CreateCustomerRequest, Customer } from "../types/index.ts";
import { generateUUID } from "../utils/uuid.ts";

const mapRowToCustomer = (row: typeof customers.$inferSelect): Customer => ({
  id: row.id,
  name: row.name,
  contactName: row.contactName ?? undefined,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  countryCode: row.countryCode ?? undefined,
  taxId: row.taxId ?? undefined,
  createdAt: new Date(String(row.createdAt)),
  city: row.city ?? undefined,
  postalCode: row.postalCode ?? undefined,
});

export const getCustomers = () => {
  const db = getDrizzleDatabase() as any;
  return db.select().from(customers).orderBy(desc(customers.createdAt)).all().map((row: typeof customers.$inferSelect) => mapRowToCustomer(row));
};

export const getCustomerById = (id: string): Customer | null => {
  const db = getDrizzleDatabase() as any;
  const results = db.select().from(customers).where(eq(customers.id, id)).all();
  if (results.length === 0) return null;
  return mapRowToCustomer(results[0] as typeof customers.$inferSelect);
};

const toNullable = (v?: string): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

export const createCustomer = (data: CreateCustomerRequest): Customer => {
  const db = getDrizzleDatabase() as any;
  const customerId = generateUUID();
  const now = new Date();

  // Normalize optional fields: store NULLs for empty strings
  const contactName = toNullable(data.contactName);
  const email = toNullable(data.email);
  const phone = toNullable(data.phone);
  const address = toNullable(data.address);
  const countryCode = toNullable(data.countryCode);
  const city = toNullable((data as { city?: string }).city);
  const postal = toNullable((data as { postalCode?: string }).postalCode);
  const taxId = toNullable(data.taxId);

  db.insert(customers).values({
    id: customerId,
    name: data.name,
    contactName,
    email,
    phone,
    address,
    countryCode,
    taxId,
    createdAt: now.toISOString(),
    city,
    postalCode: postal,
  }).run();

  // Return undefined for missing optional fields
  return {
    id: customerId,
    name: data.name,
    contactName: contactName ?? undefined,
    email: email ?? undefined,
    phone: phone ?? undefined,
    address: address ?? undefined,
    countryCode: countryCode ?? undefined,
    taxId: taxId ?? undefined,
    createdAt: now,
    city: city ?? undefined,
    postalCode: postal ?? undefined,
  };
};

export const updateCustomer = (
  id: string,
  data: Partial<CreateCustomerRequest>,
): Customer | null => {
  const db = getDrizzleDatabase() as any;
  // Read existing to support partials and normalize empties
  const existing = getCustomerById(id);
  if (!existing) return null;

  const next = {
    name: data.name ?? existing.name,
    contactName:
      data.contactName === undefined ? existing.contactName : undefined,
    email: data.email === undefined ? existing.email : undefined,
    phone: data.phone === undefined ? existing.phone : undefined,
    address: data.address === undefined ? existing.address : undefined,
    taxId: data.taxId === undefined ? existing.taxId : undefined,
  } as Partial<Customer>;

  // If provided, coerce empty to NULL
  const contactName =
    data.contactName !== undefined
      ? toNullable(data.contactName)
      : (existing.contactName ?? null);
  const email =
    data.email !== undefined
      ? toNullable(data.email)
      : (existing.email ?? null);
  const phone =
    data.phone !== undefined
      ? toNullable(data.phone)
      : (existing.phone ?? null);
  const address =
    data.address !== undefined
      ? toNullable(data.address)
      : (existing.address ?? null);
  const countryCode =
    data.countryCode !== undefined
      ? toNullable(data.countryCode)
      : (existing.countryCode ?? null);
  const taxId =
    data.taxId !== undefined
      ? toNullable(data.taxId)
      : (existing.taxId ?? null);
  const city =
    (data as { city?: string }).city !== undefined
      ? toNullable((data as { city?: string }).city)
      : (existing.city ?? null);
  const postal =
    (data as { postalCode?: string }).postalCode !== undefined
      ? toNullable((data as { postalCode?: string }).postalCode)
      : (existing.postalCode ?? null);

  db.update(customers).set({
    name: next.name,
    contactName,
    email,
    phone,
    address,
    countryCode,
    taxId,
    city,
    postalCode: postal,
  }).where(eq(customers.id, id)).run();

  return getCustomerById(id);
};

export function deleteCustomer(customerId: string): void {
  try {
    const db = getDrizzleDatabase() as any;

    const invoiceCountRows = db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.customerId, customerId)).all();
    const invoiceCount = Number(invoiceCountRows[0]?.count ?? 0);

    if (invoiceCount > 0) {
      throw new Error(
        `Cannot delete customer: ${invoiceCount} invoice(s) exist for this customer. Delete invoices first.`,
      );
    }

    const result = db.delete(customers).where(eq(customers.id, customerId)).run();
    if (Number(result?.changes ?? 0) === 0) {
      throw new Error("Customer not found");
    }
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw error;
  }
}
