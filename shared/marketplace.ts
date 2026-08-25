export const lessonPackages = {
  trial: { title: "Trial lesson", lessons: 1 },
  starter: { title: "Starter 5", lessons: 5 },
  license_path: { title: "License path 10", lessons: 10 },
} as const;

export type LessonPackageCode = keyof typeof lessonPackages;
export type LessonStatus = "confirmed" | "en_route" | "in_progress" | "completed";

export function calculateBookingPrice(pricePerLessonPaise: number, packageCode: LessonPackageCode) {
  const lessonCount = lessonPackages[packageCode].lessons;
  const pricePaise = pricePerLessonPaise * lessonCount;
  return { lessonCount, pricePaise, platformFeePaise: Math.round(pricePaise * 0.18) };
}

export function canTransitionLesson(currentStatus: string, nextStatus: LessonStatus) {
  if (nextStatus === "en_route") return currentStatus === "confirmed";
  if (nextStatus === "in_progress") return currentStatus === "confirmed" || currentStatus === "en_route";
  return currentStatus === "in_progress";
}

export function canLearnerCancelBooking(status: string) {
  return ["draft", "payment_pending", "requested", "confirmed"].includes(status);
}

export function isPayoutEligible(bookingStatus: string, paymentStatus: string) {
  return bookingStatus === "completed" && paymentStatus === "paid";
}

export function stripeBookingOutcome(eventType: string) {
  if (eventType === "checkout.session.completed") return "paid" as const;
  if (eventType === "checkout.session.expired" || eventType === "checkout.session.async_payment_failed") return "failed" as const;
  if (eventType === "charge.refunded") return "refunded" as const;
  return "ignored" as const;
}
