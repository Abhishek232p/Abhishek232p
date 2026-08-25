import {
  boolean,
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id),
  fullName: varchar("fullName", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  city: varchar("city", { length: 80 }),
  homeArea: varchar("homeArea", { length: 160 }),
  preferredVehicle: mysqlEnum("preferredVehicle", ["car", "bike", "either"]).default("either").notNull(),
  activeRole: mysqlEnum("activeRole", ["learner", "instructor"]).default("learner").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const roleMemberships = mysqlTable("role_memberships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  role: mysqlEnum("role", ["learner", "instructor", "admin"]).notNull(),
  status: mysqlEnum("status", ["enabled", "pending", "suspended"]).default("enabled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("role_memberships_user_role_unique").on(table.userId, table.role),
  index("role_memberships_user_idx").on(table.userId),
]);

export const instructorProfiles = mysqlTable("instructor_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id),
  bio: text("bio"),
  languages: varchar("languages", { length: 255 }).default("English"),
  city: varchar("city", { length: 80 }),
  serviceAreas: varchar("serviceAreas", { length: 500 }),
  serviceLat: decimal("serviceLat", { precision: 10, scale: 7 }),
  serviceLng: decimal("serviceLng", { precision: 10, scale: 7 }),
  serviceRadiusKm: int("serviceRadiusKm").default(5).notNull(),
  vehicleTypes: varchar("vehicleTypes", { length: 120 }).default("car").notNull(),
  transmission: mysqlEnum("transmission", ["manual", "automatic", "both"]).default("manual").notNull(),
  hasDualControl: boolean("hasDualControl").default(false).notNull(),
  pricePerLessonPaise: int("pricePerLessonPaise").default(0).notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["draft", "submitted", "under_review", "verified", "rejected", "suspended"]).default("draft").notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  ratingAverage: decimal("ratingAverage", { precision: 3, scale: 2 }).default("0.00").notNull(),
  ratingCount: int("ratingCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("instructor_profiles_discovery_idx").on(table.city, table.verificationStatus, table.isOnline)]);

export const instructorApplications = mysqlTable("instructor_applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  status: mysqlEnum("status", ["draft", "submitted", "under_review", "verified", "rejected", "needs_more_info"]).default("draft").notNull(),
  reviewerUserId: int("reviewerUserId").references(() => users.id),
  reviewNotes: text("reviewNotes"),
  submittedAt: timestamp("submittedAt"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("instructor_applications_status_idx").on(table.status, table.createdAt)]);

export const verificationDocuments = mysqlTable("verification_documents", {
  id: int("id").autoincrement().primaryKey(),
  instructorUserId: int("instructorUserId").notNull().references(() => users.id),
  documentType: mysqlEnum("documentType", ["government_id", "driving_license", "instructor_certificate", "vehicle_insurance"]).notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["submitted", "approved", "rejected"]).default("submitted").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("verification_documents_instructor_idx").on(table.instructorUserId)]);

export const availabilitySlots = mysqlTable("availability_slots", {
  id: int("id").autoincrement().primaryKey(),
  instructorUserId: int("instructorUserId").notNull().references(() => users.id),
  dayOfWeek: int("dayOfWeek"),
  specificDate: date("specificDate"),
  startTime: varchar("startTime", { length: 5 }).notNull(),
  endTime: varchar("endTime", { length: 5 }).notNull(),
  isBlocked: boolean("isBlocked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("availability_instructor_date_idx").on(table.instructorUserId, table.specificDate)]);

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  learnerUserId: int("learnerUserId").notNull().references(() => users.id),
  instructorUserId: int("instructorUserId").notNull().references(() => users.id),
  packageCode: mysqlEnum("packageCode", ["trial", "starter", "license_path"]).notNull(),
  packageName: varchar("packageName", { length: 120 }).notNull(),
  lessonCount: int("lessonCount").notNull(),
  scheduledStart: timestamp("scheduledStart").notNull(),
  scheduledEnd: timestamp("scheduledEnd").notNull(),
  pickupAddress: varchar("pickupAddress", { length: 500 }).notNull(),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 7 }),
  pickupLng: decimal("pickupLng", { precision: 10, scale: 7 }),
  learnerNote: text("learnerNote"),
  pricePaise: int("pricePaise").notNull(),
  platformFeePaise: int("platformFeePaise").notNull(),
  bookingStatus: mysqlEnum("bookingStatus", ["draft", "payment_pending", "requested", "confirmed", "en_route", "in_progress", "completed", "cancelled_by_learner", "cancelled_by_instructor", "declined", "expired", "refunded"]).default("draft").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["not_started", "pending", "paid", "failed", "refunded"]).default("not_started").notNull(),
  payoutStatus: mysqlEnum("payoutStatus", ["not_eligible", "pending", "paid", "held"]).default("not_eligible").notNull(),
  payoutPaidAt: timestamp("payoutPaidAt"),
  cancellationReason: varchar("cancellationReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("bookings_instructor_start_unique").on(table.instructorUserId, table.scheduledStart),
  index("bookings_learner_status_idx").on(table.learnerUserId, table.bookingStatus),
  index("bookings_instructor_status_idx").on(table.instructorUserId, table.bookingStatus),
]);

export const bookingEvents = mysqlTable("booking_events", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id),
  actorUserId: int("actorUserId").references(() => users.id),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  previousStatus: varchar("previousStatus", { length: 40 }),
  nextStatus: varchar("nextStatus", { length: 40 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("booking_events_booking_idx").on(table.bookingId, table.createdAt)]);

export const paymentSessions = mysqlTable("payment_sessions", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().unique().references(() => bookings.id),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }).notNull().unique(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ratings = mysqlTable("ratings", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().unique().references(() => bookings.id),
  learnerUserId: int("learnerUserId").notNull().references(() => users.id),
  instructorUserId: int("instructorUserId").notNull().references(() => users.id),
  stars: int("stars").notNull(),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("ratings_instructor_idx").on(table.instructorUserId, table.createdAt)]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id),
  bookingId: int("bookingId").references(() => bookings.id),
  notificationType: varchar("notificationType", { length: 80 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  deliveryStatus: mysqlEnum("deliveryStatus", ["queued", "sent", "failed", "read"]).default("queued").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("notifications_recipient_idx").on(table.recipientUserId, table.createdAt)]);
