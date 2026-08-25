import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
  availabilitySlots,
  bookingEvents,
  bookings,
  instructorApplications,
  instructorProfiles,
  notifications,
  profiles,
  ratings,
  roleMemberships,
  users,
} from "../../drizzle/schema";
import { createAppNotification, ensureMarketplaceProfile, getDb, getNotificationsForUser } from "../db";
import { createBookingCheckout } from "../payments";
import { storagePut } from "../storage";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { calculateBookingPrice, canLearnerCancelBooking, canTransitionLesson, lessonPackages } from "../../shared/marketplace";

function dbUnavailable() {
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The drivenow data service is unavailable." });
}

async function requireInstructorProfile(userId: number) {
  const db = await getDb();
  if (!db) throw dbUnavailable();
  const profile = (await db.select().from(instructorProfiles).where(eq(instructorProfiles.userId, userId)).limit(1))[0];
  if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Instructor profile not found." });
  return { db, profile };
}

export const marketplaceRouter = router({
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => ensureMarketplaceProfile(ctx.user)),
    setup: protectedProcedure.input(z.object({
      fullName: z.string().min(2).max(120), city: z.string().min(2).max(80), homeArea: z.string().min(2).max(160), preferredVehicle: z.enum(["car", "bike", "either"]), phone: z.string().min(8).max(32).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await ensureMarketplaceProfile(ctx.user);
      await db.update(profiles).set(input).where(eq(profiles.userId, ctx.user.id));
      return { success: true };
    }),
    switchRole: protectedProcedure.input(z.object({ role: z.enum(["learner", "instructor"]) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await ensureMarketplaceProfile(ctx.user);
      if (input.role === "instructor") {
        const membership = (await db.select().from(roleMemberships).where(and(eq(roleMemberships.userId, ctx.user.id), eq(roleMemberships.role, "instructor"))).limit(1))[0];
        if (!membership) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Start your instructor application before switching workspaces." });
      }
      await db.update(profiles).set({ activeRole: input.role }).where(eq(profiles.userId, ctx.user.id));
      return { success: true, activeRole: input.role };
    }),
    notifications: protectedProcedure.query(async ({ ctx }) => getNotificationsForUser(ctx.user.id)),
  }),

  learn: router({
    discover: publicProcedure.input(z.object({ city: z.string().max(80).optional(), vehicle: z.enum(["car", "bike", "either"]).optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const results = await db.select({
        userId: instructorProfiles.userId, fullName: profiles.fullName, bio: instructorProfiles.bio, city: instructorProfiles.city,
        serviceAreas: instructorProfiles.serviceAreas, serviceLat: instructorProfiles.serviceLat, serviceLng: instructorProfiles.serviceLng, vehicleTypes: instructorProfiles.vehicleTypes, transmission: instructorProfiles.transmission,
        hasDualControl: instructorProfiles.hasDualControl, pricePerLessonPaise: instructorProfiles.pricePerLessonPaise,
        ratingAverage: instructorProfiles.ratingAverage, ratingCount: instructorProfiles.ratingCount, isOnline: instructorProfiles.isOnline,
      }).from(instructorProfiles).innerJoin(profiles, eq(profiles.userId, instructorProfiles.userId))
        .where(eq(instructorProfiles.verificationStatus, "verified"))
        .orderBy(desc(instructorProfiles.isOnline), asc(instructorProfiles.pricePerLessonPaise));
      return results.filter(result => (!input?.city || result.city === input.city) && (!input?.vehicle || input.vehicle === "either" || result.vehicleTypes?.includes(input.vehicle)));
    }),
    instructor: publicProcedure.input(z.object({ instructorUserId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const profile = (await db.select({
        userId: instructorProfiles.userId, fullName: profiles.fullName, bio: instructorProfiles.bio, city: instructorProfiles.city,
        serviceAreas: instructorProfiles.serviceAreas, serviceLat: instructorProfiles.serviceLat, serviceLng: instructorProfiles.serviceLng, vehicleTypes: instructorProfiles.vehicleTypes, transmission: instructorProfiles.transmission,
        hasDualControl: instructorProfiles.hasDualControl, pricePerLessonPaise: instructorProfiles.pricePerLessonPaise,
        ratingAverage: instructorProfiles.ratingAverage, ratingCount: instructorProfiles.ratingCount, isOnline: instructorProfiles.isOnline,
      }).from(instructorProfiles).innerJoin(profiles, eq(profiles.userId, instructorProfiles.userId))
        .where(and(eq(instructorProfiles.userId, input.instructorUserId), eq(instructorProfiles.verificationStatus, "verified"))).limit(1))[0];
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "This instructor is not available." });
      const slots = await db.select().from(availabilitySlots).where(and(eq(availabilitySlots.instructorUserId, input.instructorUserId), eq(availabilitySlots.isBlocked, false))).orderBy(asc(availabilitySlots.dayOfWeek), asc(availabilitySlots.startTime));
      return { profile, slots, packages: Object.entries(lessonPackages).map(([code, config]) => ({ code, ...config, pricePaise: profile.pricePerLessonPaise * config.lessons })) };
    }),
    createBooking: protectedProcedure.input(z.object({
      instructorUserId: z.number().int().positive(), packageCode: z.enum(["trial", "starter", "license_path"]), scheduledStart: z.coerce.date(),
      pickupAddress: z.string().min(4).max(500), pickupLat: z.number().min(-90).max(90).optional(), pickupLng: z.number().min(-180).max(180).optional(), learnerNote: z.string().max(600).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await ensureMarketplaceProfile(ctx.user);
      if (input.scheduledStart <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a future lesson time." });
      const instructor = (await db.select().from(instructorProfiles).where(and(eq(instructorProfiles.userId, input.instructorUserId), eq(instructorProfiles.verificationStatus, "verified"))).limit(1))[0];
      if (!instructor || instructor.pricePerLessonPaise <= 0) throw new TRPCError({ code: "NOT_FOUND", message: "This instructor is not available for booking." });
      const config = lessonPackages[input.packageCode];
      const { pricePaise, platformFeePaise } = calculateBookingPrice(instructor.pricePerLessonPaise, input.packageCode);
      const scheduledEnd = new Date(input.scheduledStart.getTime() + 60 * 60 * 1000);
      try {
        const bookingId = await db.transaction(async tx => {
          const conflict = (await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.instructorUserId, input.instructorUserId), eq(bookings.scheduledStart, input.scheduledStart))).limit(1))[0];
          if (conflict) throw new TRPCError({ code: "CONFLICT", message: "That time is no longer available. Please choose another slot." });
          const inserted = await tx.insert(bookings).values({
            learnerUserId: ctx.user.id, instructorUserId: input.instructorUserId, packageCode: input.packageCode, packageName: config.title,
            lessonCount: config.lessons, scheduledStart: input.scheduledStart, scheduledEnd, pickupAddress: input.pickupAddress,
            pickupLat: input.pickupLat?.toString(), pickupLng: input.pickupLng?.toString(), learnerNote: input.learnerNote,
            pricePaise, platformFeePaise, bookingStatus: "payment_pending", paymentStatus: "pending",
          });
          const id = Number(inserted[0].insertId);
          await tx.insert(bookingEvents).values({ bookingId: id, actorUserId: ctx.user.id, eventType: "booking_created", nextStatus: "payment_pending" });
          return id;
        });
        return { bookingId, pricePaise, platformFeePaise };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "CONFLICT", message: "That time is no longer available. Please choose another slot." });
      }
    }),
    myBookings: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      return db.select({ booking: bookings, instructorName: profiles.fullName }).from(bookings).innerJoin(profiles, eq(profiles.userId, bookings.instructorUserId)).where(eq(bookings.learnerUserId, ctx.user.id)).orderBy(desc(bookings.scheduledStart));
    }),
    booking: protectedProcedure.input(z.object({ bookingId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const result = (await db.select({ booking: bookings, instructorName: profiles.fullName }).from(bookings).innerJoin(profiles, eq(profiles.userId, bookings.instructorUserId)).where(and(eq(bookings.id, input.bookingId), eq(bookings.learnerUserId, ctx.user.id))).limit(1))[0];
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, input.bookingId)).orderBy(asc(bookingEvents.createdAt));
      return { ...result, events };
    }),
    cancelBooking: protectedProcedure.input(z.object({ bookingId: z.number().int().positive(), reason: z.string().min(3).max(500) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const booking = (await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.learnerUserId, ctx.user.id))).limit(1))[0];
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (!canLearnerCancelBooking(booking.bookingStatus)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This booking can no longer be cancelled from the learner workspace." });
      await db.update(bookings).set({ bookingStatus: "cancelled_by_learner", cancellationReason: input.reason }).where(eq(bookings.id, booking.id));
      await db.insert(bookingEvents).values({ bookingId: booking.id, actorUserId: ctx.user.id, eventType: "cancelled", previousStatus: booking.bookingStatus, nextStatus: "cancelled_by_learner", note: input.reason });
      await createAppNotification({ recipientUserId: booking.instructorUserId, bookingId: booking.id, notificationType: "booking_cancelled", title: "Booking cancelled", body: "A learner cancelled a booked lesson." });
      return { success: true };
    }),
    rateBooking: protectedProcedure.input(z.object({ bookingId: z.number().int().positive(), stars: z.number().int().min(1).max(5), body: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const booking = (await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.learnerUserId, ctx.user.id))).limit(1))[0];
      if (!booking || booking.bookingStatus !== "completed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You can rate a lesson after it is completed." });
      const previous = (await db.select().from(ratings).where(eq(ratings.bookingId, booking.id)).limit(1))[0];
      if (previous) throw new TRPCError({ code: "CONFLICT", message: "You have already rated this lesson." });
      const instructor = (await db.select().from(instructorProfiles).where(eq(instructorProfiles.userId, booking.instructorUserId)).limit(1))[0];
      if (!instructor) throw new TRPCError({ code: "NOT_FOUND", message: "Instructor profile not found." });
      const ratingAverage = ((Number(instructor.ratingAverage) * instructor.ratingCount + input.stars) / (instructor.ratingCount + 1)).toFixed(2);
      await db.insert(ratings).values({ bookingId: booking.id, learnerUserId: ctx.user.id, instructorUserId: booking.instructorUserId, stars: input.stars, body: input.body });
      await db.update(instructorProfiles).set({ ratingAverage, ratingCount: instructor.ratingCount + 1 }).where(eq(instructorProfiles.userId, booking.instructorUserId));
      return { success: true };
    }),
  }),

  teach: router({
    application: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const [profile] = await db.select().from(instructorProfiles).where(eq(instructorProfiles.userId, ctx.user.id)).limit(1);
      const [application] = await db.select().from(instructorApplications).where(eq(instructorApplications.userId, ctx.user.id)).orderBy(desc(instructorApplications.createdAt)).limit(1);
      return { profile: profile ?? null, application: application ?? null };
    }),
    submitApplication: protectedProcedure.input(z.object({
      bio: z.string().min(40).max(1200), city: z.string().min(2).max(80), serviceAreas: z.string().min(2).max(500), serviceLat: z.number().min(-90).max(90).optional(), serviceLng: z.number().min(-180).max(180).optional(),
      languages: z.string().min(2).max(255), vehicleTypes: z.string().min(3).max(120), transmission: z.enum(["manual", "automatic", "both"]),
      hasDualControl: z.boolean(), serviceRadiusKm: z.number().int().min(1).max(50), pricePerLessonPaise: z.number().int().min(5000).max(500000),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await ensureMarketplaceProfile(ctx.user);
      await db.insert(roleMemberships).values({ userId: ctx.user.id, role: "instructor", status: "pending" }).onDuplicateKeyUpdate({ set: { status: "pending" } });
      const profileValues = { ...input, serviceLat: input.serviceLat?.toString(), serviceLng: input.serviceLng?.toString(), verificationStatus: "submitted" as const };
      await db.insert(instructorProfiles).values({ userId: ctx.user.id, ...profileValues }).onDuplicateKeyUpdate({ set: profileValues });
      await db.insert(instructorApplications).values({ userId: ctx.user.id, status: "submitted", submittedAt: new Date() });
      await createAppNotification({ recipientUserId: ctx.user.id, notificationType: "verification_submitted", title: "Application submitted", body: "Your instructor application is ready for review." });
      return { success: true };
    }),
    uploadVerificationDocument: protectedProcedure.input(z.object({
      documentType: z.enum(["government_id", "driving_license", "instructor_certificate", "vehicle_insurance"]),
      fileName: z.string().min(1).max(255),
      contentType: z.string().regex(/^(image\/|application\/pdf)/),
      dataBase64: z.string().min(20).max(15_000_000),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const { verificationDocuments } = await import("../../drizzle/schema");
      const base64 = input.dataBase64.includes(",") ? input.dataBase64.split(",")[1] : input.dataBase64;
      const content = Buffer.from(base64, "base64");
      if (content.byteLength > 8_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Document files must be 8 MB or smaller." });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { key } = await storagePut(`kyc/${ctx.user.id}/${Date.now()}-${safeName}`, content, input.contentType);
      await db.insert(verificationDocuments).values({ instructorUserId: ctx.user.id, documentType: input.documentType, fileName: safeName, storageKey: key });
      return { success: true, storageKey: key };
    }),
    saveAvailability: protectedProcedure.input(z.object({ slots: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), isBlocked: z.boolean().default(false) })).min(1).max(21) })).mutation(async ({ ctx, input }) => {
      const { db } = await requireInstructorProfile(ctx.user.id);
      await db.delete(availabilitySlots).where(eq(availabilitySlots.instructorUserId, ctx.user.id));
      await db.insert(availabilitySlots).values(input.slots.map(slot => ({ ...slot, instructorUserId: ctx.user.id })));
      return { success: true };
    }),
    setOnline: protectedProcedure.input(z.object({ isOnline: z.boolean() })).mutation(async ({ ctx, input }) => {
      const { db } = await requireInstructorProfile(ctx.user.id);
      await db.update(instructorProfiles).set({ isOnline: input.isOnline }).where(eq(instructorProfiles.userId, ctx.user.id));
      return { success: true };
    }),
    jobs: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      return db.select({ booking: bookings, learnerName: profiles.fullName, learnerArea: profiles.homeArea }).from(bookings).innerJoin(profiles, eq(profiles.userId, bookings.learnerUserId)).where(eq(bookings.instructorUserId, ctx.user.id)).orderBy(desc(bookings.scheduledStart));
    }),
    respondToJob: protectedProcedure.input(z.object({ bookingId: z.number().int().positive(), decision: z.enum(["accept", "decline"]) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const booking = (await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.instructorUserId, ctx.user.id))).limit(1))[0];
      if (!booking || booking.bookingStatus !== "requested" || booking.paymentStatus !== "paid") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This job is not ready for a response." });
      const nextStatus = input.decision === "accept" ? "confirmed" : "declined";
      await db.update(bookings).set({ bookingStatus: nextStatus }).where(eq(bookings.id, booking.id));
      await db.insert(bookingEvents).values({ bookingId: booking.id, actorUserId: ctx.user.id, eventType: `job_${input.decision}`, previousStatus: booking.bookingStatus, nextStatus });
      await createAppNotification({ recipientUserId: booking.learnerUserId, bookingId: booking.id, notificationType: `job_${input.decision}`, title: input.decision === "accept" ? "Lesson confirmed" : "Lesson declined", body: input.decision === "accept" ? "Your instructor accepted this lesson." : "Your instructor could not accept this slot." });
      return { success: true, bookingStatus: nextStatus };
    }),
    updateLessonStatus: protectedProcedure.input(z.object({ bookingId: z.number().int().positive(), status: z.enum(["en_route", "in_progress", "completed"]) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const booking = (await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.instructorUserId, ctx.user.id))).limit(1))[0];
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      const permitted = canTransitionLesson(booking.bookingStatus, input.status);
      if (!permitted) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This lesson cannot move to that status yet." });
      await db.update(bookings).set({ bookingStatus: input.status, ...(input.status === "completed" ? { payoutStatus: "pending" as const } : {}) }).where(eq(bookings.id, booking.id));
      await db.insert(bookingEvents).values({ bookingId: booking.id, actorUserId: ctx.user.id, eventType: "lesson_status_changed", previousStatus: booking.bookingStatus, nextStatus: input.status });
      await createAppNotification({ recipientUserId: booking.learnerUserId, bookingId: booking.id, notificationType: "lesson_status", title: "Lesson status updated", body: `Your lesson is now ${input.status.replace("_", " ")}.` });
      return { success: true };
    }),
    earnings: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const completed = await db.select().from(bookings).where(and(eq(bookings.instructorUserId, ctx.user.id), eq(bookings.bookingStatus, "completed"), eq(bookings.paymentStatus, "paid")));
      const grossPaise = completed.reduce((total, booking) => total + booking.pricePaise, 0);
      const feePaise = completed.reduce((total, booking) => total + booking.platformFeePaise, 0);
      return { completed, grossPaise, feePaise, netPaise: grossPaise - feePaise };
    }),
  }),

  admin: router({
    verificationQueue: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      return db.select({ application: instructorApplications, profile: instructorProfiles, person: profiles }).from(instructorApplications)
        .innerJoin(instructorProfiles, eq(instructorProfiles.userId, instructorApplications.userId))
        .innerJoin(profiles, eq(profiles.userId, instructorApplications.userId))
        .where(gt(instructorApplications.id, 0)).orderBy(desc(instructorApplications.createdAt));
    }),
    reviewApplication: adminProcedure.input(z.object({ applicationId: z.number().int().positive(), status: z.enum(["verified", "rejected", "needs_more_info"]), reviewNotes: z.string().max(1200).optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const application = (await db.select().from(instructorApplications).where(eq(instructorApplications.id, input.applicationId)).limit(1))[0];
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found." });
      const profileStatus = input.status === "verified" ? "verified" : input.status === "rejected" ? "rejected" : "under_review";
      const membershipStatus = input.status === "verified" ? "enabled" : "pending";
      await db.update(instructorApplications).set({ status: input.status, reviewerUserId: ctx.user.id, reviewNotes: input.reviewNotes, reviewedAt: new Date() }).where(eq(instructorApplications.id, application.id));
      await db.update(instructorProfiles).set({ verificationStatus: profileStatus }).where(eq(instructorProfiles.userId, application.userId));
      await db.update(roleMemberships).set({ status: membershipStatus }).where(and(eq(roleMemberships.userId, application.userId), eq(roleMemberships.role, "instructor")));
      await createAppNotification({ recipientUserId: application.userId, notificationType: "verification_updated", title: input.status === "verified" ? "You are verified" : "Application update", body: input.status === "verified" ? "Your instructor workspace is now ready for bookings." : input.reviewNotes || "Your application status has been updated." });
      return { success: true };
    }),
  }),

  checkout: protectedProcedure.input(z.object({ bookingId: z.number().int().positive(), origin: z.string().url() })).mutation(async ({ ctx, input }) => {
    return createBookingCheckout({ bookingId: input.bookingId, userId: ctx.user.id, userName: ctx.user.name, userEmail: ctx.user.email, origin: input.origin });
  }),
});
