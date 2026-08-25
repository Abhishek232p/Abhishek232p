import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, notifications, profiles, roleMemberships, type User, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

export async function ensureMarketplaceProfile(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(profiles).values({ userId: user.id, fullName: user.name?.trim() || "drivenow member" }).onDuplicateKeyUpdate({
    set: { fullName: user.name?.trim() || "drivenow member" },
  });
  await db.insert(roleMemberships).values({ userId: user.id, role: "learner", status: "enabled" }).onDuplicateKeyUpdate({ set: { status: "enabled" } });
  return (await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1))[0];
}

export async function createAppNotification(input: { recipientUserId: number; bookingId?: number; notificationType: string; title: string; body: string; scheduledFor?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(notifications).values({
    recipientUserId: input.recipientUserId,
    bookingId: input.bookingId,
    notificationType: input.notificationType,
    title: input.title,
    body: input.body,
    scheduledFor: input.scheduledFor,
  });
}

export async function getNotificationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
}
