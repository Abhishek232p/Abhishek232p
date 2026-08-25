# drivenow

drivenow is a mobile-first marketplace for connecting learners with verified local driving instructors. The application includes a public landing experience, learner discovery and booking flows, an instructor verification and operations workspace, an admin review queue, secure Stripe Checkout integration, and in-app lifecycle notifications.

## Product surfaces

| Surface | Included capability |
| --- | --- |
| Public | Brand-led landing page with Learner, Instructor, and Admin entry points. |
| Learner | Account setup, instructor discovery, map workspace, instructor comparison, package and slot selection, pickup point selection, checkout, booking hub, cancellation, and ratings. |
| Instructor | Application and KYC document upload, verification status, availability, online state, job inbox, active-lesson controls, and earnings view. |
| Admin | Verification queue with approve, reject, and more-information decisions. |
| Platform | Role-aware tRPC APIs, Drizzle schema, booking-event history, Stripe webhook handling, in-app notification records, and a cron-safe reminder endpoint. |

## Technology

The project uses React 19, Tailwind CSS 4, Express, tRPC, Drizzle ORM, MySQL/TiDB, Manus OAuth, the platform-managed Google Maps proxy, S3-compatible file storage, and Stripe Checkout. The workspace intentionally uses original CSS/SVG route graphics rather than bundling third-party animation assets.

## Local development

Install dependencies and run the development server with the standard package scripts.

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
```

Database changes are represented in `drizzle/schema.ts`. Generate a migration with `pnpm drizzle-kit generate`, review the generated SQL, and apply it through the managed database workflow. The initial marketplace migration is `drizzle/0001_burly_rhino.sql`.

## Marketplace rules

The core booking state and payment state are deliberately separate. A booking begins in `payment_pending`; Stripe’s verified webhook moves payment to `paid` and the booking to `requested`. The instructor can then accept or decline it. Lesson progress is ordered as `confirmed → en_route → in_progress → completed` and is enforced server-side.

The booking table uses a unique `(instructorUserId, scheduledStart)` key to block duplicate assignments for the same instructor time. Payment code stores Stripe identifiers only, alongside the product’s local booking payment state required to gate marketplace workflow.

## Payments

The server creates Stripe Checkout Sessions at `marketplace.checkout`, using the current signed-in user and server-side booking amounts. The webhook endpoint is `/api/stripe/webhook`; it verifies the Stripe signature before marking a booking as paid. Do not place card data, Stripe secret keys, webhook payloads, or client secrets in the database.

For test-mode validation, use Stripe’s documented test card `4242 4242 4242 4242`. Claim the project’s Stripe sandbox from the project settings before testing payments. Production activation requires Stripe KYC and live credentials in the project payment settings.

## Maps and locations

The app uses the preconfigured Google Maps proxy through `MapView`; no browser API key should be added. The learner map screen shows saved instructor service points when an instructor profile has coordinates and lets the learner save a proposed pickup point for the booking form. Instructor service coordinates are part of the server data model and should be collected as part of the final onboarding refinement.

## Notifications and reminders

Booking, verification, cancellation, payment, job-response, and lesson-status changes create in-app notification records. The cron-safe callback `/api/scheduled/lesson-reminders` is idempotent and creates 24-hour reminders for paid, confirmed lessons.

> The reminder callback must not be scheduled until the site is published. After publishing, create a project-owned Heartbeat task that calls `/api/scheduled/lesson-reminders`, for example at `0 0 * * * *` (hourly, UTC). External SMS, WhatsApp, or email delivery requires a provider-specific integration and user-supplied credentials; this codebase does not pretend that in-app notifications are external delivery.

## Launch checklist

| Area | Required action |
| --- | --- |
| Stripe | Claim the test sandbox, add the production keys after KYC, register the deployed webhook URL, and run a test payment. |
| Maps | Confirm the final city, service-area coordinate capture policy, consent copy, and attribution requirements. |
| KYC | Define document-retention, manual-review, rejection, and appeal policies before public launch. |
| Messaging | Select an approved SMS, WhatsApp, or email provider if external delivery is required. |
| Legal | Publish the privacy policy, terms, cancellation/refund policy, and instructor agreement. |
| Operations | Publish the application before creating the reminder schedule, then monitor schedule history and webhook delivery. |

## Tests

`pnpm test` validates logout behavior, marketplace pricing, booking and payment lifecycle policies, and authorization guards for learner booking, cancellation, checkout, instructor application/job/lesson controls, and admin review procedures. These authorization tests deliberately run without seeded marketplace data. `pnpm check` performs a strict TypeScript validation. Visual checks cover desktop and mobile public routes. Full booking payment, KYC review, map interactions, and cron delivery require authenticated real-provider testing after the project is published and configured.

Optional provider variable names and delivery safeguards are documented in `EXTERNAL_INTEGRATIONS.example.md`. Platform policy keeps actual environment files and all secret values outside the repository.

## References

- [Stripe Checkout documentation](https://docs.stripe.com/payments/checkout)
- [Stripe webhook documentation](https://docs.stripe.com/webhooks)
- [Google Maps Platform documentation](https://developers.google.com/maps/documentation)
- [ThreeUI Community repository](https://github.com/MengTo/threeui)
