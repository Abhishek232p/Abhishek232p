import type { Express, Request, Response } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { bookings, notifications } from "../drizzle/schema";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";

export async function queueUpcomingLessonReminders(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = await db.select().from(bookings).where(and(
    eq(bookings.bookingStatus, "confirmed"),
    eq(bookings.paymentStatus, "paid"),
    gte(bookings.scheduledStart, now),
    lt(bookings.scheduledStart, nextDay),
  ));

  let created = 0;
  for (const booking of upcoming) {
    const existing = await db.select({ id: notifications.id }).from(notifications).where(and(
      eq(notifications.bookingId, booking.id),
      eq(notifications.notificationType, "lesson_reminder_24h"),
    )).limit(1);
    if (existing.length) continue;
    const start = booking.scheduledStart.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    await db.insert(notifications).values([
      { recipientUserId: booking.learnerUserId, bookingId: booking.id, notificationType: "lesson_reminder_24h", title: "Lesson reminder", body: `Your lesson is scheduled for ${start}.`, deliveryStatus: "sent", sentAt: now },
      { recipientUserId: booking.instructorUserId, bookingId: booking.id, notificationType: "lesson_reminder_24h", title: "Lesson reminder", body: `You have a confirmed lesson scheduled for ${start}.`, deliveryStatus: "sent", sentAt: now },
    ]);
    created += 2;
  }
  return { upcoming: upcoming.length, notificationsCreated: created };
}

export function registerReminderRoutes(app: Express) {
  app.post("/api/scheduled/lesson-reminders", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await queueUpcomingLessonReminders();
      return res.json({ ok: true, ...result, taskUid: user.taskUid });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder error";
      return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
