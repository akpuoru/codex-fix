# Global Reach Platform

can you build a complete, production-quality international logistics, courier,luggage delivery, shipment booking, and tracking web platform?

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bridgeway.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b2c744bc-8b10-41c1-8c0e-8430b739b8c6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Flight reservations

The Flights area searches for airline offers that support an unpaid hold, creates the hold through Duffel, and stores the carrier booking reference and itinerary for the signed-in customer. It does not charge the customer at reservation time. The hold still expires at the airline's payment deadline; expired reservations are shown as expired and their PNR must not be presented as an active booking.

Before enabling live reservations:

1. Apply `drizzle/migrations/0010_flight_holds.sql` once to the connected Supabase database.
2. Add `DUFFEL_ACCESS_TOKEN` as a **server-side secret** in Cloudflare Workers & Pages for the production environment. Never prefix it with `VITE_` or put it in `wrangler.jsonc` as a plain variable.
3. Make sure `SUPABASE_SERVICE_ROLE_KEY` is also configured as a server-side secret; it is used only by the server to save airline-created holds.
4. Use a Duffel live token only after the Duffel account is ready for live bookings. A test token does not create live airline reservations.

Seat maps and unpaid holds are airline-dependent. The app only offers search results that Duffel reports can be held without immediate payment; available seats and any seat charges are shown when the airline supplies them.

## Admin support reply emails

The admin inbox has separate actions for posting a reply to the support conversation and emailing the customer privately. An email sent with **Send email only** goes to the address used on the support form and is not added to the site conversation. Email is sent through Resend from the server; the API key must never be added to a `VITE_` variable.

Admins can delete a complete guest support conversation, an individual message in that conversation, or an individual live-chat message. Apply `drizzle/migrations/0017_admin_delete_support.sql` to the connected Supabase database before using these controls. The migration restricts deletion to admins and permits cleanup of attached support photos.

Before enabling email replies:

1. Verify a sending domain in Resend and create an API key.
2. In Cloudflare Workers & Pages, add `RESEND_API_KEY` as a server-side secret.
3. Add `SUPPORT_EMAIL_FROM` as a server-side variable, using a sender on the verified domain, for example `Bridgeway Support <support@your-verified-domain.com>`.
4. Optionally set `SUPPORT_EMAIL_REPLY_TO` to the support mailbox where customer email replies should go.
5. Redeploy the app. Until these values are set, site replies still post to the support conversation, while email-only replies are not sent or added to the conversation.

## Guest WhatsApp and Telegram support

The public contact page and floating support dialog show direct WhatsApp and Telegram links to visitors, including people who are not signed in. The defaults below are Bridgeway's public support contacts; they can be overridden with build-time variables in Cloudflare Workers & Pages:

- `VITE_SUPPORT_WHATSAPP_NUMBER`: support's WhatsApp number in international format. Default: `+553173007351`.
- `VITE_SUPPORT_TELEGRAM_URL`: support's Telegram username or an HTTPS `t.me` link. Default: `https://t.me/bridgewaytrack`.

If an override is blank, the default contact is used. These are public contact details, not secrets.
