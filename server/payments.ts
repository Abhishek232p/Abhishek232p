import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { bookings, paymentSessions } from "../drizzle/schema";
import { createAppNotification, getDb } from "./db";

function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("Stripe is not configured");
  return new Stripe(apiKey);
}

export async function createBookingCheckout(input: { bookingId: number; userId: number; userName?: string | null; userEmail?: string | null; origin: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const booking = (await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1))[0];
  if (!booking || booking.learnerUserId !== input.userId) throw new Error("Booking was not found");
  if (booking.paymentStatus === "paid") throw new Error("This booking is already paid");

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.userEmail || undefined,
    allow_promotion_codes: true,
    client_reference_id: String(input.userId),
    metadata: {
      booking_id: String(booking.id),
      user_id: String(input.userId),
      customer_email: input.userEmail || "",
      customer_name: input.userName || "",
    },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "inr",
        unit_amount: booking.pricePaise,
        product_data: { name: booking.packageName },
      },
    }],
    success_url: `${input.origin}/learn/bookings/${booking.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/learn/checkout/${booking.id}?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  await db.insert(paymentSessions).values({
    bookingId: booking.id,
    stripeCheckoutSessionId: session.id,
  }).onDuplicateKeyUpdate({ set: { stripeCheckoutSessionId: session.id } });
  await db.update(bookings).set({ paymentStatus: "pending", bookingStatus: "payment_pending" }).where(eq(bookings.id, booking.id));
  return { checkoutUrl: session.url };
}

export async function processStripeWebhook(rawBody: Buffer, signature?: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("Stripe webhook signature is missing");
  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  if (event.id.startsWith("evt_test_")) {
    return { verified: true };
  }

  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = Number(session.metadata?.booking_id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) return { received: true, skipped: "missing_booking" };
    const booking = (await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1))[0];
    if (!booking) return { received: true, skipped: "unknown_booking" };
    await db.update(bookings).set({ paymentStatus: "failed", bookingStatus: booking.bookingStatus === "payment_pending" ? "expired" : booking.bookingStatus }).where(eq(bookings.id, booking.id));
    await createAppNotification({ recipientUserId: booking.learnerUserId, bookingId: booking.id, notificationType: "payment_failed", title: "Payment not completed", body: "Your booking has not been confirmed. You may try checkout again if the lesson slot is still available." });
    return { received: true };
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    if (!paymentIntentId) return { received: true, skipped: "missing_payment_intent" };
    const payment = (await db.select().from(paymentSessions).where(eq(paymentSessions.stripePaymentIntentId, paymentIntentId)).limit(1))[0];
    if (!payment) return { received: true, skipped: "unknown_payment" };
    const booking = (await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1))[0];
    if (!booking) return { received: true, skipped: "unknown_booking" };
    await db.update(bookings).set({ paymentStatus: "refunded", bookingStatus: "refunded" }).where(eq(bookings.id, booking.id));
    await createAppNotification({ recipientUserId: booking.learnerUserId, bookingId: booking.id, notificationType: "payment_refunded", title: "Payment refunded", body: "Your booking payment has been refunded. Check your payment method for settlement timing." });
    await createAppNotification({ recipientUserId: booking.instructorUserId, bookingId: booking.id, notificationType: "booking_refunded", title: "Booking refunded", body: "A booking payment was refunded and is no longer active." });
    return { received: true };
  }

  if (event.type !== "checkout.session.completed") return { received: true };
  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = Number(session.metadata?.booking_id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) return { received: true, skipped: "missing_booking" };
  const booking = (await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1))[0];
  if (!booking) return { received: true, skipped: "unknown_booking" };

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  await db.update(bookings).set({ paymentStatus: "paid", bookingStatus: booking.bookingStatus === "payment_pending" ? "requested" : booking.bookingStatus }).where(eq(bookings.id, booking.id));
  await db.update(paymentSessions).set({ stripePaymentIntentId: paymentIntentId, processedAt: new Date() }).where(eq(paymentSessions.bookingId, booking.id));
  await createAppNotification({
    recipientUserId: booking.learnerUserId,
    bookingId: booking.id,
    notificationType: "booking_payment_received",
    title: "Payment received",
    body: "Your booking request has been sent to the instructor.",
  });
  await createAppNotification({
    recipientUserId: booking.instructorUserId,
    bookingId: booking.id,
    notificationType: "booking_requested",
    title: "New booking request",
    body: "A learner has requested one of your available lesson slots.",
  });
  return { received: true };
}
