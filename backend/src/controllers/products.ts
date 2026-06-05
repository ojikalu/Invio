/**
 * Products Controller
 * CRUD operations for product management.
 * Products can be selected when creating invoices to auto-fill line items.
 */
import { eq, sql } from "drizzle-orm";
import { getDrizzleDatabase } from "../database/init.ts";
import { invoiceItems, products } from "../database/schema.ts";
import { CreateProductRequest, Product } from "../types/index.ts";
import { generateUUID } from "../utils/uuid.ts";

const mapRowToProduct = (row: typeof products.$inferSelect): Product => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  unitPrice: Number(row.unitPrice) || 0,
  sku: row.sku ?? undefined,
  unit: row.unit ?? "piece",
  category: row.category ?? undefined,
  taxDefinitionId: row.taxDefinitionId ?? undefined,
  isActive: Boolean(row.isActive),
  createdAt: new Date(String(row.createdAt)),
  updatedAt: new Date(String(row.updatedAt)),
});

const toNullable = (v?: string): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

export const getProducts = (includeInactive = false): Product[] => {
  const db = getDrizzleDatabase() as any;
  const query = db.select().from(products);
  const results = includeInactive
    ? query.orderBy(products.name).all()
    : query.where(eq(products.isActive, true)).orderBy(products.name).all();
  return results.map((row: typeof products.$inferSelect) => mapRowToProduct(row));
};

export const getProductById = (id: string): Product | null => {
  const db = getDrizzleDatabase() as any;
  const results = db.select().from(products).where(eq(products.id, id)).all();
  if (results.length === 0) return null;
  return mapRowToProduct(results[0] as typeof products.$inferSelect);
};

export const createProduct = (data: CreateProductRequest): Product => {
  const db = getDrizzleDatabase() as any;
  const productId = generateUUID();
  const now = new Date();

  const description = toNullable(data.description);
  const sku = toNullable(data.sku);
  const unit = toNullable(data.unit) || "piece";
  const category = toNullable(data.category);
  const taxDefinitionId = toNullable(data.taxDefinitionId);

  db.insert(products).values({
    id: productId,
    name: data.name,
    description,
    unitPrice: data.unitPrice || 0,
    sku,
    unit,
    category,
    taxDefinitionId,
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }).run();

  return {
    id: productId,
    name: data.name,
    description: description ?? undefined,
    unitPrice: data.unitPrice || 0,
    sku: sku ?? undefined,
    unit: unit,
    category: category ?? undefined,
    taxDefinitionId: taxDefinitionId ?? undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateProduct = (
  id: string,
  data: Partial<CreateProductRequest> & { isActive?: boolean },
): Product | null => {
  const db = getDrizzleDatabase() as any;
  const existing = getProductById(id);
  if (!existing) return null;

  const now = new Date();

  const name = data.name ?? existing.name;
  const description =
    data.description !== undefined
      ? toNullable(data.description)
      : existing.description ?? null;
  const unitPrice =
    data.unitPrice !== undefined ? data.unitPrice : existing.unitPrice;
  const sku =
    data.sku !== undefined ? toNullable(data.sku) : existing.sku ?? null;
  const unit =
    data.unit !== undefined
      ? toNullable(data.unit) || "piece"
      : existing.unit ?? "piece";
  const category =
    data.category !== undefined
      ? toNullable(data.category)
      : existing.category ?? null;
  const taxDefinitionId =
    data.taxDefinitionId !== undefined
      ? toNullable(data.taxDefinitionId)
      : existing.taxDefinitionId ?? null;
  const isActive =
    data.isActive !== undefined ? data.isActive : existing.isActive;

  db.update(products).set({
    name,
    description,
    unitPrice,
    sku,
    unit,
    category,
    taxDefinitionId,
    isActive,
    updatedAt: now.toISOString(),
  }).where(eq(products.id, id)).run();

  return getProductById(id);
};

export const deleteProduct = (productId: string): void => {
  const db = getDrizzleDatabase() as any;
  const existing = getProductById(productId);
  if (!existing) {
    throw new Error("Product not found");
  }

  // Soft-delete: set is_active = false
  db.update(products).set({ isActive: false, updatedAt: new Date().toISOString() }).where(eq(products.id, productId)).run();
};

export const isProductUsedInInvoices = (productId: string): boolean => {
  const db = getDrizzleDatabase() as any;
  const results = db.select({ count: sql<number>`count(*)` }).from(invoiceItems).where(eq(invoiceItems.productId, productId)).all();
  return Number(results[0]?.count ?? 0) > 0;
};

export const reactivateProduct = (productId: string): Product | null => {
  const db = getDrizzleDatabase() as any;
  const existing = getProductById(productId);
  if (!existing) return null;

  db.update(products).set({ isActive: true, updatedAt: new Date().toISOString() }).where(eq(products.id, productId)).run();

  return getProductById(productId);
};
