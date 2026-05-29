# vids.tube — External Services Across the Roadmap

**Date:** 2026-05-29
**Status:** Reference (forward-looking; not all needed now)
**Related:** [Roadmap](./2026-05-23-vids-tube-roadmap.md) · [Finishing v1 setup (do-now checklist)](./2026-05-29-finishing-v1-setup-design.md)

## How to read this

Every "outside the code" thing the roadmap needs — accounts, dashboards, DNS,
hardware, app-store enrolment — in one place, ordered by milestone. Each item is
tagged:

- **NOW** — needed for the v1 remainder we're building next. The actionable
  step-by-step lives in the [Finishing v1 setup doc](./2026-05-29-finishing-v1-setup-design.md); summarized here for completeness.
- **SOON** — next milestone (v2); worth knowing but don't set up yet.
- **LATER** — v3/v4; provider choices below are *recommended defaults*, not
  decisions. Pin them when the slice is specced.

Don't provision LATER items now — accounts with annual fees (Apple) or
compliance surface (Stripe Connect) should start their clock when the feature is
actually being built.

## Summary

| Milestone | Feature | External thing | Tag |
|---|---|---|---|
| v1 | VOD pipeline | Cloudflare R2 + `cdn.vids.tube` | NOW |
| v1 | Credit system | Stripe keys + webhook | NOW |
| v1 | Credit system | Stripe products/prices (pricing TBD) | NOW* |
| v1 | Comments, follow | — (Supabase only) | — |
| v2 | ABR ladder, shorts reformat | Dedicated-CPU transcode VM | SOON |
| v2 | Shorts, more renditions | More R2 storage (no setup, just cost) | SOON |
| v2 | Creator analytics | — (data already captured) | — |
| v3 | Creator payouts | **Stripe Connect** (KYC, tax, payouts) | LATER |
| v3 | Multi-creator onboarding | Transactional email provider + email DNS | LATER |
| v3 | Recommendation algorithm | — (compute; maybe Supabase upgrade) | LATER |
| v3 | Handling others' content + money | Terms/Privacy/legal (not a dev step) | LATER |
| v4+ | Autoscaling ingest | More Hetzner VMs + load balancer | LATER |
| v4+ | Regional CDN tuning | Cloudflare paid features / full-zone migration | LATER |
| v4+ | Moderation tooling | Content-moderation API (optional) | LATER |
| v4+ | Mobile apps | Apple Developer + Google Play + FCM/APNs | LATER |
| any | Reliability | Error tracking / uptime monitoring | optional |

\* Products/prices are external setup but gated on the deferred pricing decision.

---

## v1 remainder — NOW

### Cloudflare R2 + `cdn.vids.tube`  (VOD pipeline)
Full steps in the [setup doc](./2026-05-29-finishing-v1-setup-design.md). In short:
1. Enable R2 (add payment method), create bucket `vids-tube-vod`.
2. Create an R2 API token → access key / secret / account id.
3. Add CORS (`GET`/`HEAD` from `https://vids.tube`).
4. Delegate `cdn.vids.tube` to Cloudflare (NS records in Google Cloud DNS), add
   it as the bucket's custom domain.
5. Secrets → Doppler: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_VOD`, `NEXT_PUBLIC_VOD_BASE_URL`.

### Stripe  (credit system)
Account is already activated. Steps:
1. Test + live API keys (`sk_*` / `pk_*`).
2. Webhook endpoint → `https://vids.tube/api/stripe/webhook`; capture
   `whsec_*`.
3. Secrets → Doppler: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test in `dev`/`stg`, live in `prd`).
4. **Pending the pricing decision:** create Products + Prices for credit packs
   (e.g. a one-time Price per pack). Do this in the credit-system slice once the
   signup grant / per-minute rate / pack denominations are set.

---

## v2 — Content depth — SOON

### Dedicated-CPU transcode VM  (ABR ladder + shorts vertical reformat)
The current VM (Hetzner **CPX22**, shared vCPU) is sized for *remux only*. ABR
(360p/720p/1080p) and vertical shorts reformatting require real-time **transcode**
(FFmpeg re-encode), which is CPU-heavy and needs dedicated cores.

Steps when v2 starts:
1. In the Hetzner console, either **resize** the existing server to a dedicated
   line (**CCX** series, e.g. CCX23/CCX33) or **add a second VM** dedicated to
   transcode. Resizing keeps one box; a second VM isolates transcode load from
   ingest. Recommendation: resize first (simpler), split later if CPU-bound.
2. Re-run the relevant runbook sections (FFmpeg ABR ladder config replaces the
   remux passthrough).
3. No new accounts or secrets — same Hetzner project, same R2 bucket (renditions
   are new object prefixes).
4. Expect higher monthly VM cost (dedicated CPU ≈ 2–4× the shared instance) and
   higher R2 storage (multiple renditions per VOD).

### R2 storage growth  (shorts + extra renditions)
No setup — same bucket. Just note storage cost scales with renditions × hours.
Clip/short objects live under a new prefix (e.g. `shorts/<channel>/<id>.mp4`).

### Creator analytics
No external dependency — built from the watch events v1 already captures in
Supabase. If query load grows, the only external action is upgrading the Supabase
plan (Pro, ~$25/mo) — a billing toggle, not an integration.

---

## v3 — Platform opening — LATER

### Stripe Connect  (creator payouts) — the big one
Paying *other* creators is a different Stripe product from charging *your* users.
You become a **platform**; creators are connected accounts.

Steps when v3 payouts start:
1. Stripe Dashboard → **Connect** → enable. Complete the **platform profile**
   (business model, what creators sell, support contact).
2. Choose account type — recommend **Express** (Stripe-hosted onboarding +
   dashboard; Stripe handles KYC identity verification and tax forms — 1099/W-8 —
   for you). Custom is more control + far more compliance burden; avoid for now.
3. Configure branding, payout schedule (daily/weekly), and the **platform
   application fee** (your cut — ties to the credit→revenue-share model).
4. Build the Connect onboarding flow (Account Links) — code, but it depends on
   Connect being enabled.
5. New webhooks: `account.updated`, `payout.paid`/`payout.failed`,
   `transfer.created`. New secrets: a separate Connect webhook signing secret.
6. **Compliance gate:** platform payouts require your business identity verified
   in live mode and acceptance of Connect terms. Start this early in v3 — it can
   take days.

### Transactional email provider + email DNS  (multi-creator onboarding)
Once non-owners onboard, you need reliable product email (invites, payout
notices, onboarding) — Supabase's built-in auth email is rate-limited and not
meant for product mail.

Steps:
1. Create an account with a transactional provider — recommend **Resend**
   (simple, good DX) or **Postmark** (deliverability-focused).
2. Verify the sending domain: add **SPF**, **DKIM**, and **DMARC** records to the
   `vids.tube` zone in **Google Cloud DNS** (the provider gives exact values).
3. API key → Doppler (e.g. `RESEND_API_KEY`).
4. Optionally point **Supabase Auth → SMTP** at the same provider so signup/reset
   emails also send from your domain reliably (Supabase project → Auth → SMTP
   settings; provider gives SMTP creds).

### Recommendation algorithm
No external account — it's compute over data you already hold. If ranking jobs
get heavy, options are a Supabase plan upgrade or a small worker VM (same Hetzner
project). Decide at spec time.

### Legal / policy (not a dev step, but external)
Hosting others' content + moving money means Terms of Service, Privacy Policy,
content/DMCA policy, and creator payout terms. Flagging so it's not forgotten;
this is a you-and-a-lawyer task, not a credential.

---

## v4+ — Scale & trust — LATER

### Autoscaling / multiple ingest VMs
1. Provision additional Hetzner VMs (same project) from the runbook image.
2. Add a **Hetzner Load Balancer** or DNS-based routing in front of ingest.
3. Consider codifying provisioning (a script or Terraform) once there's more than
   one box to keep in sync. No new vendor required.

### Regional CDN tuning
1. Cloudflare cache rules / tiered caching on `cdn.vids.tube` (free-tier config).
2. For smart routing across regions, Cloudflare **Argo** (paid add-on) — enable
   in the dashboard.
3. This is the point where **migrating the whole `vids.tube` zone to Cloudflare**
   (the fork deferred in the v1 setup doc) likely pays off — it lets Cloudflare
   cache the app + unifies DNS. Plan the migration as its own task (recreate every
   Google-DNS record, keep app/VM records DNS-only).

### Moderation tooling (optional external)
If automated moderation is wanted, add a content-moderation API — e.g. Hive,
AWS Rekognition, or OpenAI moderation. Account + API key → Doppler. Decide at
spec time; manual moderation needs nothing external.

### Mobile apps
1. **Apple Developer Program** — enrol ($99/yr USD); required to ship to the App
   Store and to use APNs push.
2. **Google Play Console** — register ($25 one-time).
3. **Push:** APNs (via the Apple account) and **FCM** (create a Firebase project,
   free) for Android/cross-platform push.
4. App Store / Play listings, icons, screenshots, privacy nutrition labels.

### Reliability (optional, any time)
Once others depend on uptime: error tracking (**Sentry**, free tier) and uptime
monitoring (**Better Stack / UptimeRobot**, free tiers). Accounts + a DSN/API key
→ Doppler. Not tied to a milestone — add when it hurts not to have it.

---

## Doppler secret additions by milestone

| Secret | Milestone | Notes |
|---|---|---|
| `R2_*` (4) + `NEXT_PUBLIC_VOD_BASE_URL` | v1 | see setup doc |
| `STRIPE_*` (3) | v1 | see setup doc |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | v3 | separate from the charges webhook |
| `RESEND_API_KEY` (or provider equivalent) | v3 | transactional email |
| moderation API key | v4+ | only if automated moderation chosen |
| `SENTRY_DSN` / monitoring keys | any | optional reliability |

## Decision points to settle at spec time (not now)

- v2: resize the existing VM vs. add a dedicated transcode VM.
- v3: Stripe Connect account type (recommend Express) + platform fee %.
- v3: email provider (Resend vs Postmark).
- v4+: migrate the full DNS zone to Cloudflare (yes, likely — schedule it).
- v4+: automated moderation vendor (or manual).
- v4+: mobile — native vs cross-platform (drives Apple/Play/Firebase scope).
