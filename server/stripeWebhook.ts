import express, { type Express, type Request, type Response } from "express";
import { processStripeWebhook } from "./payments";

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    try {
      const result = await processStripeWebhook(req.body as Buffer, req.headers["stripe-signature"] as string | undefined);
      if ("verified" in result && result.verified) return res.json({ verified: true });
      return res.json(result);
    } catch (error) {
      console.error("[Stripe Webhook]", error);
      return res.status(400).json({ error: "Webhook verification failed" });
    }
  });
}
