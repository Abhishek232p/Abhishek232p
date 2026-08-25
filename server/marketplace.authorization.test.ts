import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "admin" | null): TrpcContext {
  const user = role ? {
    id: 42,
    openId: "marketplace-test-user",
    name: "Test member",
    email: "test@example.com",
    loginMethod: "test",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } : null;
  return {
    user,
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("marketplace authorization", () => {
  it("rejects learner profile access without a signed-in user", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.marketplace.profile.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated learner booking, cancellation, and checkout procedures", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.marketplace.learn.booking({ bookingId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.marketplace.learn.cancelBooking({ bookingId: 1, reason: "Schedule changed" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.marketplace.checkout({ bookingId: 1, origin: "https://drivenow.example" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated instructor application and lesson-control procedures", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.marketplace.teach.submitApplication({
      bio: "I teach with a calm, structured approach that focuses on confident local driving.",
      city: "Bengaluru",
      serviceAreas: "Indiranagar",
      languages: "English",
      vehicleTypes: "car",
      transmission: "manual",
      hasDualControl: true,
      serviceRadiusKm: 5,
      pricePerLessonPaise: 60000,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.marketplace.teach.respondToJob({ bookingId: 1, decision: "accept" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.marketplace.teach.updateLessonStatus({ bookingId: 1, status: "in_progress" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects the verification queue for a non-admin account before database access", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.marketplace.admin.verificationQueue()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.marketplace.admin.reviewApplication({ applicationId: 1, status: "verified" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
