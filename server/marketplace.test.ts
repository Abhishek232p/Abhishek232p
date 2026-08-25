import { describe, expect, it } from "vitest";
import { calculateBookingPrice, canLearnerCancelBooking, canTransitionLesson, isPayoutEligible, stripeBookingOutcome } from "../shared/marketplace";

describe("marketplace booking rules", () => {
  it("calculates package prices and the transparent platform fee from a lesson rate", () => {
    expect(calculateBookingPrice(60000, "starter")).toEqual({
      lessonCount: 5,
      pricePaise: 300000,
      platformFeePaise: 54000,
    });
  });

  it("only permits the ordered active-lesson status transitions", () => {
    expect(canTransitionLesson("confirmed", "en_route")).toBe(true);
    expect(canTransitionLesson("en_route", "in_progress")).toBe(true);
    expect(canTransitionLesson("in_progress", "completed")).toBe(true);
    expect(canTransitionLesson("requested", "completed")).toBe(false);
    expect(canTransitionLesson("completed", "en_route")).toBe(false);
  });

  it("protects terminal bookings from learner cancellation and only makes paid completed lessons payout-eligible", () => {
    expect(canLearnerCancelBooking("confirmed")).toBe(true);
    expect(canLearnerCancelBooking("in_progress")).toBe(false);
    expect(canLearnerCancelBooking("completed")).toBe(false);
    expect(isPayoutEligible("completed", "paid")).toBe(true);
    expect(isPayoutEligible("completed", "pending")).toBe(false);
  });

  it("maps payment-provider lifecycle events to a locally visible booking outcome", () => {
    expect(stripeBookingOutcome("checkout.session.completed")).toBe("paid");
    expect(stripeBookingOutcome("checkout.session.async_payment_failed")).toBe("failed");
    expect(stripeBookingOutcome("charge.refunded")).toBe("refunded");
    expect(stripeBookingOutcome("customer.created")).toBe("ignored");
  });
});
