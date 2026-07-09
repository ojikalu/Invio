import { getDatabase } from "../database/init.ts";
import { CreateCustomerRequest, Customer } from "../types/index.ts";
import { generateUUID } from "../utils/uuid.ts";

const mapRowToCustomer = (row: unknown[]): Customer => ({
  id: row[0] as string,
  name: row[1] as string,
  contactName: (row[2] ?? undefined) as string | undefined,
  email: (row[3] ?? undefined) as string | undefined,
  phone: (row[4] ?? undefined) as string | undefined,
  address: (row[5] ?? undefined) as string | undefined,
  countryCode: (row[6] ?? undefined) as string | undefined,
  taxId: (row[7] ?? undefined) as string | undefined,
  createdAt: new Date(row[8] as string),
  // Optional city/postal_code/customer_number columns if present at the end
  city: (row[9] ?? undefined) as string | undefined,
  postalCode: (row[10] ?? undefined) as string | undefined,
  customerNumber: (row[11] ?? undefined) as number | undefined,
});

export const getCustomers = () => {
  const db = getDatabase();
  // Select with optional columns city, postal_code if exist; SQLite will ignore missing columns in SELECT list only by error, so use PRAGMA to detect
  let results: unknown[][] = [];
  try {
    results = db.query(
      "SELECT id, name, contact_name, email, phone, address, country_code, tax_id, created_at, city, postal_code, customer_number FROM customers ORDER BY created_at DESC",
    ) as unknown[][];
  } catch (_e) {
    // fallback older schema
    try {
      results = db.query(
        "SELECT id, name, email, phone, address, country_code, tax_id, created_at, city, postal_code FROM customers ORDER BY created_at DESC",
      ) as unknown[][];
    } catch (_e2) {
      results = db.query(
        "SELECT id, name, email, phone, address, country_code, tax_id, created_at FROM customers ORDER BY created_at DESC",
      ) as unknown[][];
    }
  }
  return results.map((row: unknown[]) => mapRowToCustomer(row));
};

export const getCustomerById = (id: string): Customer | null => {
  const db = getDatabase();
  let results: unknown[][] = [];
  try {
    results = db.query(
      "SELECT id, name, contact_name, email, phone, address, country_code, tax_id, created_at, city, postal_code, customer_number FROM customers WHERE id = ?",
      [id],
    ) as unknown[][];
  } catch (_e) {
    try {
      results = db.query(
        "SELECT id, name, email, phone, address, country_code, tax_id, created_at, city, postal_code FROM customers WHERE id = ?",
        [id],
      ) as unknown[][];
    } catch (_e2) {
      results = db.query(
        "SELECT id, name, email, phone, address, country_code, tax_id, created_at FROM customers WHERE id = ?",
        [id],
      ) as unknown[][];
    }
  }
  if (results.length === 0) return null;
  return mapRowToCustomer(results[0] as unknown[]);
};

const toNullable = (v?: string): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const nextCustomerNumber = (db: ReturnType<typeof getDatabase>): number => {
  const rows = db.query(
    "SELECT COALESCE(MAX(customer_number), 0) FROM customers",
  ) as unknown[][];
  return Number((rows[0] as unknown[])[0]) + 1;
};

export const createCustomer = (data: CreateCustomerRequest): Customer => {
  const db = getDatabase();
  const customerId = generateUUID();
  const now = new Date();
  const customerNumber = nextCustomerNumber(db);

  // Normalize optional fields: store NULLs for empty strings
  const contactName = toNullable(data.contactName);
  const email = toNullable(data.email);
  const phone = toNullable(data.phone);
  const address = toNullable(data.address);
  const countryCode = toNullable(data.countryCode);
  const city = toNullable((data as { city?: string }).city);
  const postal = toNullable((data as { postalCode?: string }).postalCode);
  const taxId = toNullable(data.taxId);

  try {
    db.query(
      `
      INSERT INTO customers (id, name, contact_name, email, phone, address, country_code, tax_id, created_at, city, postal_code, customer_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        customerId,
        data.name,
        contactName,
        email,
        phone,
        address,
        countryCode,
        taxId,
        now,
        city,
        postal,
        customerNumber,
      ],
    );
  } catch (_e) {
    // fallback older schema
    try {
      db.query(
        `
        INSERT INTO customers (id, name, email, phone, address, country_code, tax_id, created_at, city, postal_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          customerId,
          data.name,
          email,
          phone,
          address,
          countryCode,
          taxId,
          now,
          city,
          postal,
        ],
      );
    } catch (_e2) {
      db.query(
        `
        INSERT INTO customers (id, name, email, phone, address, country_code, tax_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [customerId, data.name, email, phone, address, countryCode, taxId, now],
      );
    }
  }

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
    customerNumber,
  };
};

export const updateCustomer = (
  id: string,
  data: Partial<CreateCustomerRequest>,
): Customer | null => {
  const db = getDatabase();
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

  try {
    db.query(
      `
      UPDATE customers SET
        name = ?, contact_name = ?, email = ?, phone = ?, address = ?, country_code = ?, tax_id = ?, city = ?, postal_code = ?
      WHERE id = ?
    `,
      [
        next.name,
        contactName,
        email,
        phone,
        address,
        countryCode,
        taxId,
        city,
        postal,
        id,
      ],
    );
  } catch (_e) {
    try {
      db.query(
        `
        UPDATE customers SET
          name = ?, email = ?, phone = ?, address = ?, country_code = ?, tax_id = ?, city = ?, postal_code = ?
        WHERE id = ?
      `,
        [
          next.name,
          email,
          phone,
          address,
          countryCode,
          taxId,
          city,
          postal,
          id,
        ],
      );
    } catch (_e2) {
      db.query(
        `
        UPDATE customers SET
          name = ?, email = ?, phone = ?, address = ?, country_code = ?, tax_id = ?
        WHERE id = ?
      `,
        [next.name, email, phone, address, countryCode, taxId, id],
      );
    }
  }

  return getCustomerById(id);
};

export function deleteCustomer(customerId: string): void {
  try {
    const db = getDatabase();

    // First check if customer has any invoices
    const invoices = db.query(
      `
      SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?
    `,
      [customerId],
    );

    const invoiceCount = invoices[0] ? Number(invoices[0][0]) : 0;

    if (invoiceCount > 0) {
      throw new Error(
        `Cannot delete customer: ${invoiceCount} invoice(s) exist for this customer. Delete invoices first.`,
      );
    }

    // Delete customer if no invoices exist
    db.query(`DELETE FROM customers WHERE id = ?`, [customerId]);
    if ((getDatabase() as unknown as { changes: number }).changes === 0) {
      throw new Error("Customer not found");
    }
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw error;
  }
}
