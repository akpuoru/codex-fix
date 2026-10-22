<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Customer shipment lists and details explicitly filter by authenticated user ID; admin-wide access lives only in admin functions, preventing privilege-based leakage into customer views.
- Account-scoped queries include user ID and identity transitions clear cached data, preventing stale content between accounts.
- Contact requests use a validated, rate-limited database RPC with no public read access; staff review and reply through the admin inbox.
- Human live chat requires sign-in, uses one durable thread per customer and database-validated send RPCs with owner/admin RLS; Realtime updates plus fallback polling deliver replies without claiming staff availability.
- Uploaded crypto payment QR images use CDN asset pointers and display their decoded wallet address together so the copyable address matches the scanned destination; never infer a USDT network from an address alone.
