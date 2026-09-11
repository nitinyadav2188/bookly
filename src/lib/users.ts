import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { getDb, type DbUser } from "@/lib/db";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function toPublic(row: DbUser): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findUserByEmail(email: string): DbUser | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1")
    .get(email.trim()) as DbUser | undefined;
  return row ?? null;
}

export function findUserById(id: string): DbUser | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(id) as
    | DbUser
    | undefined;
  return row ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!input.password || input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (findUserByEmail(email)) {
    throw new Error("An account with that email already exists.");
  }

  const now = new Date().toISOString();
  const passwordHash = await hash(input.password, 12);
  const id = randomUUID();

  getDb()
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    )
    .run(id, name, email, passwordHash, now, now);

  const created = findUserById(id);
  if (!created) throw new Error("Could not create account.");
  return toPublic(created);
}

export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = findUserByEmail(email);
  if (!user?.password_hash) return null;
  const ok = await compare(password, user.password_hash);
  return ok ? toPublic(user) : null;
}

export function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): PublicUser {
  const email = input.email.trim().toLowerCase();
  const existing = findUserByEmail(email);
  const now = new Date().toISOString();
  if (existing) {
    getDb()
      .prepare(
        `UPDATE users
         SET name = COALESCE(?, name),
             avatar_url = COALESCE(?, avatar_url),
             updated_at = ?
         WHERE id = ?`,
      )
      .run(input.name?.trim() || null, input.avatarUrl || null, now, existing.id);
    return toPublic(findUserById(existing.id)!);
  }

  const id = randomUUID();
  const name = (input.name?.trim() || email.split("@")[0] || "Reader").slice(0, 80);
  getDb()
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    )
    .run(id, name, email, input.avatarUrl || null, now, now);
  return toPublic(findUserById(id)!);
}

export function updateUserName(userId: string, name: string): PublicUser {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }
  const now = new Date().toISOString();
  const result = getDb()
    .prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
    .run(trimmed, now, userId);
  if (result.changes === 0) throw new Error("Account not found.");
  return toPublic(findUserById(userId)!);
}

export function publicUserFromRow(row: DbUser): PublicUser {
  return toPublic(row);
}
