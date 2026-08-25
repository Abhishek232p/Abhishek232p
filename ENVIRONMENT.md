# Environment Configuration

The managed project injects its core authentication, database, storage, maps, analytics, and payment variables. Do **not** commit an `.env` file with real values.

| Variable | Managed by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Platform | MySQL/TiDB database connection. |
| `JWT_SECRET` | Platform | Session signing. |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | Platform | Manus OAuth flow. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Platform | Managed platform services such as storage and scheduling. |
| `STRIPE_SECRET_KEY` | Payment settings | Server-side Stripe Checkout and webhook verification. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Payment settings | Browser-safe Stripe publishable key for future client-side payment UI if needed. |
| `STRIPE_WEBHOOK_SECRET` | Payment settings | Stripe webhook signature verification. |

## External notification providers

The current release uses in-app notifications. If an external provider is approved later, request the credential through the managed project secrets workflow rather than adding it to source control. Suggested names are `RESEND_API_KEY` for transactional email, `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` for SMS, or provider-specific WhatsApp credentials. Add a focused test whenever a new secret is configured.
