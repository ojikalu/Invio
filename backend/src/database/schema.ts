import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  countryCode: text("country_code"),
  taxId: text("tax_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  city: text("city"),
  postalCode: text("postal_code"),
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    customerId: text("customer_id").references(() => customers.id),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date"),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("draft"),
    subtotal: real("subtotal").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    discountPercentage: real("discount_percentage").notNull().default(0),
    taxRate: real("tax_rate").notNull().default(0),
    taxAmount: real("tax_amount").notNull().default(0),
    total: real("total").notNull(),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    shareToken: text("share_token").notNull().unique(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    pricesIncludeTax: integer("prices_include_tax", { mode: "boolean" })
      .notNull()
      .default(false),
    roundingMode: text("rounding_mode").notNull().default("line"),
    locale: text("locale"),
  },
  (table: any) => ({
    numberIndex: index("idx_invoices_number").on(table.invoiceNumber),
    customerIndex: index("idx_invoices_customer").on(table.customerId),
    statusIndex: index("idx_invoices_status").on(table.status),
    tokenIndex: index("idx_invoices_share_token").on(table.shareToken),
  }),
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .references(() => invoices.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    quantity: real("quantity").notNull(),
    unit: text("unit"),
    unitPrice: real("unit_price").notNull(),
    lineTotal: real("line_total").notNull(),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    productId: text("product_id").references(() => products.id),
  },
  (table: any) => ({
    invoiceIndex: index("idx_invoice_items_invoice").on(table.invoiceId),
  }),
);

export const invoiceAttachments = sqliteTable("invoice_attachments", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  html: text("html").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  templateType: text("template_type").notNull().default("builtin"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const taxDefinitions = sqliteTable("tax_definitions", {
  id: text("id").primaryKey(),
  code: text("code").unique(),
  name: text("name"),
  percent: real("percent").notNull(),
  categoryCode: text("category_code"),
  countryCode: text("country_code"),
  vendorSpecificId: text("vendor_specific_id"),
  defaultIncluded: integer("default_included", { mode: "boolean" })
    .notNull()
    .default(false),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invoiceItemTaxes = sqliteTable("invoice_item_taxes", {
  id: text("id").primaryKey(),
  invoiceItemId: text("invoice_item_id")
    .references(() => invoiceItems.id, { onDelete: "cascade" })
    .notNull(),
  taxDefinitionId: text("tax_definition_id").references(() => taxDefinitions.id),
  percent: real("percent").notNull(),
  taxableAmount: real("taxable_amount").notNull(),
  amount: real("amount").notNull(),
  included: integer("included", { mode: "boolean" }).notNull().default(false),
  sequence: integer("sequence").notNull().default(0),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invoiceTaxes = sqliteTable("invoice_taxes", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  taxDefinitionId: text("tax_definition_id").references(() => taxDefinitions.id),
  percent: real("percent").notNull(),
  taxableAmount: real("taxable_amount").notNull(),
  taxAmount: real("tax_amount").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    unitPrice: real("unit_price").notNull().default(0),
    sku: text("sku"),
    unit: text("unit").notNull().default("piece"),
    category: text("category"),
    taxDefinitionId: text("tax_definition_id").references(() => taxDefinitions.id),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table: any) => ({
    skuIndex: index("idx_products_sku").on(table.sku),
    activeIndex: index("idx_products_active").on(table.isActive),
    categoryIndex: index("idx_products_category").on(table.category),
  }),
);

export const productCategories = sqliteTable("product_categories", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productUnits = sqliteTable("product_units", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email"),
    displayName: text("display_name"),
    passwordHash: text("password_hash").notNull(),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    twoFactorRecoveryCodes: text("two_factor_recovery_codes"),
    oidcSubject: text("oidc_subject"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table: any) => ({
    oidcSubjectIndex: uniqueIndex("idx_users_oidc_subject").on(table.oidcSubject),
    usernameIndex: index("idx_users_username").on(table.username),
    activeIndex: index("idx_users_active").on(table.isActive),
  }),
);

export const userPermissions = sqliteTable(
  "user_permissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table: any) => ({
    userIndex: index("idx_user_permissions_user").on(table.userId),
  }),
);
