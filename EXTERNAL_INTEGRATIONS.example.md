# Optional External Delivery Configuration

This release creates **in-app** booking, verification, cancellation, payment, and lesson notifications. It deliberately does not include unconfigured external SMS, WhatsApp, or email delivery.

When an external provider is approved, add the corresponding secret through the managed project settings. Never add a value to source control.

| Delivery channel | Suggested secret names | Usage after configuration |
| --- | --- | --- |
| Transactional email | `RESEND_API_KEY` | Booking and verification email delivery. |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | OTP or lesson reminder SMS delivery. |
| WhatsApp | Provider-specific API key and sender identifier | Approved template reminders and booking updates. |

Each provider integration must include a dedicated server-side implementation, consent and opt-out handling, delivery failure logging, and a focused automated test before enabling public delivery.
