import { and, eq, sql } from "drizzle-orm";
import { getDrizzleDatabase } from "../database/init.ts";
import { userPermissions, users } from "../database/schema.ts";
import { generateUUID } from "../utils/uuid.ts";
import { hashPassword, verifyPassword } from "../utils/password.ts";
import type {
  Action,
  CreateUserRequest,
  Permission,
  Resource,
  UpdateUserRequest,
  User,
  UserWithPermissions,
} from "../types/index.ts";

// ---- Helpers ----

function rowToUser(row: unknown[]): User {
  return {
    id: String(row[0]),
    username: String(row[1]),
    email: row[2] ? String(row[2]) : undefined,
    displayName: row[3] ? String(row[3]) : undefined,
    isAdmin: Boolean(row[4]),
    isActive: Boolean(row[5]),
    twoFactorEnabled: Boolean(row[6]),
    createdAt: new Date(String(row[7])),
    updatedAt: new Date(String(row[8])),
  };
}

function loadPermissions(userId: string): Permission[] {
  const db = getDrizzleDatabase() as any;
  const rows = db.select({ resource: userPermissions.resource, action: userPermissions.action }).from(userPermissions).where(eq(userPermissions.userId, userId)).all();
  return rows.map((r: { resource: string; action: string }) => ({
    resource: r.resource as Resource,
    action: r.action as Action,
  }));
}

function setPermissions(userId: string, permissions: Permission[]): void {
  const db = getDrizzleDatabase() as any;
  db.delete(userPermissions).where(eq(userPermissions.userId, userId)).run();
  for (const p of permissions) {
    db.insert(userPermissions).values({
      id: generateUUID(),
      userId,
      resource: p.resource,
      action: p.action,
    }).run();
  }
}

// ---- Public API ----

export function listUsers(): User[] {
  const db = getDrizzleDatabase() as any;
  const rows = db.select().from(users).orderBy(users.createdAt).all();
  return rows.map((r: typeof users.$inferSelect) => rowToUser([
    r.id,
    r.username,
    r.email,
    r.displayName,
    r.isAdmin,
    r.isActive,
    r.twoFactorEnabled,
    r.createdAt,
    r.updatedAt,
  ]));
}

export function getUserById(id: string): UserWithPermissions | null {
  const db = getDrizzleDatabase() as any;
  const rows = db.select().from(users).where(eq(users.id, id)).all();
  if (rows.length === 0) return null;
  const user = rowToUser([
    rows[0].id,
    rows[0].username,
    rows[0].email,
    rows[0].displayName,
    rows[0].isAdmin,
    rows[0].isActive,
    rows[0].twoFactorEnabled,
    rows[0].createdAt,
    rows[0].updatedAt,
  ]) as UserWithPermissions;
  user.permissions = loadPermissions(user.id);
  return user;
}

export function getUserByUsername(
  username: string,
): UserWithPermissions | null {
  const db = getDrizzleDatabase() as any;
  const rows = db.select().from(users).where(eq(users.username, username)).all();
  if (rows.length === 0) return null;
  const user = rowToUser([
    rows[0].id,
    rows[0].username,
    rows[0].email,
    rows[0].displayName,
    rows[0].isAdmin,
    rows[0].isActive,
    rows[0].twoFactorEnabled,
    rows[0].createdAt,
    rows[0].updatedAt,
  ]) as UserWithPermissions;
  user.permissions = loadPermissions(user.id);
  return user;
}

/**
 * Retrieve only the password hash for a user by username.
 * Used during authentication.
 */
export function getPasswordHash(username: string): string | null {
  const db = getDrizzleDatabase() as any;
  const rows = db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.username, username)).all();
  if (rows.length === 0) return null;
  return String(rows[0].passwordHash);
}

export function getUserTwoFactorState(userId: string): {
  enabled: boolean;
  encryptedSecret: string | null;
  recoveryCodeHashes: string[];
} | null {
  const db = getDrizzleDatabase() as any;
  const rows = db.select({
    enabled: users.twoFactorEnabled,
    secret: users.twoFactorSecret,
    recoveryCodes: users.twoFactorRecoveryCodes,
  }).from(users).where(eq(users.id, userId)).all();
  if (rows.length === 0) return null;
  const row = rows[0] as { enabled: boolean; secret: string | null; recoveryCodes: string | null };
  let recoveryCodeHashes: string[] = [];
  try {
    recoveryCodeHashes = row.recoveryCodes ? JSON.parse(String(row.recoveryCodes)) : [];
    if (!Array.isArray(recoveryCodeHashes)) recoveryCodeHashes = [];
  } catch {
    recoveryCodeHashes = [];
  }
  return {
    enabled: Boolean(row.enabled),
    encryptedSecret: row.secret ? String(row.secret) : null,
    recoveryCodeHashes: recoveryCodeHashes.filter(
      (h) => typeof h === "string" && h.length > 0,
    ),
  };
}

export function setUserTwoFactorState(
  userId: string,
  encryptedSecret: string,
  recoveryCodeHashes: string[],
): void {
  const db = getDrizzleDatabase() as any;
  const now = new Date().toISOString();
  db.update(users).set({
    twoFactorEnabled: true,
    twoFactorSecret: encryptedSecret,
    twoFactorRecoveryCodes: JSON.stringify(recoveryCodeHashes),
    updatedAt: now,
  }).where(eq(users.id, userId)).run();
}

export function consumeUserRecoveryCodeHash(
  userId: string,
  codeHash: string,
): boolean {
  const state = getUserTwoFactorState(userId);
  if (!state) return false;
  const idx = state.recoveryCodeHashes.findIndex((v) => v === codeHash);
  if (idx === -1) return false;
  state.recoveryCodeHashes.splice(idx, 1);
  const db = getDrizzleDatabase() as any;
  const now = new Date().toISOString();
  db.update(users).set({
    twoFactorRecoveryCodes: JSON.stringify(state.recoveryCodeHashes),
    updatedAt: now,
  }).where(eq(users.id, userId)).run();
  return true;
}

export function disableUserTwoFactor(userId: string): void {
  const db = getDrizzleDatabase() as any;
  const now = new Date().toISOString();
  db.update(users).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorRecoveryCodes: null,
    updatedAt: now,
  }).where(eq(users.id, userId)).run();
}

export async function createUser(
  data: CreateUserRequest,
): Promise<UserWithPermissions> {
  const db = getDrizzleDatabase() as any;

  // Validate required fields
  if (!data.username || data.username.trim().length === 0) {
    throw new Error("Username is required");
  }
  if (!data.password || data.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Check uniqueness
  const existing = db.select({ id: users.id }).from(users).where(eq(users.username, data.username.trim())).all();
  if (existing.length > 0) {
    throw new Error("Username already exists");
  }

  const id = generateUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(data.password);

  db.insert(users).values({
    id,
    username: data.username.trim(),
    email: data.email?.trim() || null,
    displayName: data.displayName?.trim() || null,
    passwordHash,
    isAdmin: Boolean(data.isAdmin),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).run();

  // Set permissions
  if (data.permissions && data.permissions.length > 0) {
    setPermissions(id, data.permissions);
  }

  return getUserById(id)!;
}

export async function updateUser(
  id: string,
  data: UpdateUserRequest,
): Promise<UserWithPermissions> {
  const db = getDrizzleDatabase() as any;

  const existing = getUserById(id);
  if (!existing) throw new Error("User not found");

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (data.username !== undefined) {
    // Check uniqueness if changing username
    const dup = db.select({ id: users.id }).from(users).where(and(eq(users.username, data.username.trim()), sql`${users.id} != ${id}`)).all();
    if (dup.length > 0) throw new Error("Username already exists");
    patch.username = data.username.trim();
  }

  if (data.email !== undefined) {
    patch.email = data.email?.trim() || null;
  }

  if (data.displayName !== undefined) {
    patch.displayName = data.displayName?.trim() || null;
  }

  if (data.isAdmin !== undefined) {
    patch.isAdmin = Boolean(data.isAdmin);
  }

  if (data.isActive !== undefined) {
    patch.isActive = Boolean(data.isActive);
  }

  if (data.password !== undefined && data.password.length > 0) {
    if (data.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const hash = await hashPassword(data.password);
    patch.passwordHash = hash;
  }

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = now;
    db.update(users).set(patch).where(eq(users.id, id)).run();
  }

  // Update permissions if provided
  if (data.permissions !== undefined) {
    setPermissions(id, data.permissions);
  }

  return getUserById(id)!;
}

export function deleteUser(id: string): void {
  const db = getDrizzleDatabase() as any;
  const existing = getUserById(id);
  if (!existing) throw new Error("User not found");

  // Prevent deleting the last admin
  if (existing.isAdmin) {
    const adminCount = db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.isAdmin, true), eq(users.isActive, true))).all();
    const count = Number(adminCount[0]?.count ?? 0);
    if (count <= 1) {
      throw new Error("Cannot delete the last admin user");
    }
  }

  db.delete(users).where(eq(users.id, id)).run();
}

/**
 * Authenticate a user by username and password.
 * Returns the user with permissions if valid, null otherwise.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<UserWithPermissions | null> {
  const hash = getPasswordHash(username);
  if (!hash) return null;

  const valid = await verifyPassword(password, hash);
  if (!valid) return null;

  const user = getUserByUsername(username);
  if (!user || !user.isActive) return null;

  return user;
}

/**
 * Check if any users exist in the database.
 * Used during startup to determine if the admin seed is needed.
 */
export function hasUsers(): boolean {
  const db = getDrizzleDatabase() as any;
  const rows = db.select({ count: sql<number>`count(*)` }).from(users).all();
  return Number(rows[0]?.count ?? 0) > 0;
}
