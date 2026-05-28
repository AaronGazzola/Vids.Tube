# Finishing v1 — External Setup & Credentials

**Date:** 2026-05-29
**Status:** Active checklist (execute alongside the Finishing v1 roadmap)
**Related:** [Roadmap](./2026-05-23-vids-tube-roadmap.md), [v1 Design](./2026-05-23-vids-tube-v1-design.md), [Live build memory](../../runbooks/live-streaming-vm.md)

## Purpose

Get every external service and credential the remaining v1 slices need wired up *before* code work starts on those slices, so each slice's build is unblocked from day one.

## Scope of external setup

| Slice | External services it needs |
|---|---|
| VOD pipeline | Cloudflare R2 + `cdn.vids.tube` custom domain |
| Comments on VODs | (none — Supabase only) |
| Follow / subscribe | (none — Supabase only) |
| Credit system | Stripe (account already ready) |

## Decisions (settled)

- **R2 custom domain:** `cdn.vids.tube` via Cloudflare *subdomain-zone delegation* (NS records in Google Cloud DNS pointing the `cdn` subdomain at Cloudflare). The apex `vids.tube` zone and `stream.vids.tube` stay on Google Cloud DNS — the working app and VM are untouched.
- **Stripe:** create test + live API keys + webhook signing secret now. **Defer product/price creation** until the credit-system slice is built (pricing TBD).
- **Comments + follow:** Supabase-only; no new external creds.

## Standardized Doppler secret names

So code, docs, and the VM all reference the same names:

| Secret | Visibility | Used by |
|---|---|---|
| `R2_ACCOUNT_ID` | server | app + VM uploader |
| `R2_ACCESS_KEY_ID` | server | app + VM uploader |
| `R2_SECRET_ACCESS_KEY` | server | app + VM uploader |
| `R2_BUCKET_VOD` | server | app + VM uploader |
| `NEXT_PUBLIC_VOD_BASE_URL` | client | watch page (hls.js source) |
| `STRIPE_SECRET_KEY` | server | app (Checkout, webhook) |
| `STRIPE_WEBHOOK_SECRET` | server | app (webhook signature verify) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | top-up UI |

Doppler config map:

| Secret | dev | stg | prd |
|---|---|---|---|
| `R2_*` (4 keys) | shared values (single owner-controlled bucket) | shared | shared |
| `NEXT_PUBLIC_VOD_BASE_URL` | `https://cdn.vids.tube` | `https://cdn.vids.tube` | `https://cdn.vids.tube` |
| `STRIPE_SECRET_KEY` | `sk_test_…` | `sk_test_…` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | from `stripe listen` | test endpoint `whsec_…` | live endpoint `whsec_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | `pk_test_…` | `pk_live_…` |

(R2 dev/stg sharing the prd bucket is the default until env isolation actually matters. Owner-only writes; nothing in the app writes to R2 from a request handler.)

## Checklist

### 1. Cloudflare R2 — VOD storage

- [ ] Cloudflare dashboard → R2 → **Enable**. Add a payment method (free tier still requires one).
- [ ] Create bucket: name `vids-tube-vod`, location hint *automatic*.
- [ ] R2 → **Manage R2 API Tokens** → Create token:
  - Permission: *Object Read & Write*
  - Scope: bucket `vids-tube-vod`
  - TTL: forever (rotate manually if compromised)
  - Capture: **Access Key ID**, **Secret Access Key**, **Account ID**, **S3 endpoint**
- [ ] Bucket → Settings → **CORS policy**:
  ```json
  [{
    "AllowedOrigins": ["https://vids.tube"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag"],
    "MaxAgeSeconds": 86400
  }]
  ```

### 2. `cdn.vids.tube` — Cloudflare subdomain-zone delegation

- [ ] Cloudflare dashboard → **Add a site** → enter `cdn.vids.tube`. Select Free plan.
- [ ] Cloudflare returns two assigned nameservers (e.g. `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`). Copy both.
- [ ] Google Cloud DNS console (`vids.tube` zone) → add two **NS** records:
  - Name: `cdn`
  - TTL: 300
  - Data: the two Cloudflare nameservers
- [ ] Back in Cloudflare, click **Check nameservers** — wait for the zone to go *Active* (usually <1 hr).
- [ ] R2 → bucket `vids-tube-vod` → Settings → **Custom Domains** → add `cdn.vids.tube`. Cloudflare auto-creates the proxied CNAME inside the new zone.
- [ ] Verify: `curl -I https://cdn.vids.tube/` returns Cloudflare headers (`cf-ray`, `server: cloudflare`).

**Fallback if Cloudflare rejects the subdomain zone on Free plan:** Cloudflare's policy on this has historically been inconsistent. If the dashboard refuses to activate `cdn.vids.tube` while the parent stays on Google DNS, fall back to one of:
- **(a) Apex migration** — move all of `vids.tube` DNS to Cloudflare; recreate every existing record (apex/Vercel, `stream.vids.tube` A record, any MX) as **DNS-only / grey-cloud** to preserve current behavior, then add `cdn.vids.tube` as a proxied CNAME for R2. Larger blast radius, propagation window.
- **(b) Defer custom domain** — use the bucket's `pub-<hash>.r2.dev` URL for the initial VOD pipeline build (rate-limited, owner-testing only) and revisit the domain step before broader use.

### 3. Stripe — credit top-ups

- [ ] Stripe dashboard (Test mode) → Developers → **API keys** → reveal **Secret key** (`sk_test_…`); copy **Publishable key** (`pk_test_…`).
- [ ] Toggle to Live mode → repeat for `sk_live_…` / `pk_live_…`.
- [ ] Webhooks:
  - **Live:** Add endpoint `https://vids.tube/api/stripe/webhook` (route doesn't exist yet — Stripe lets you create the endpoint regardless). Events: `checkout.session.completed`, `payment_intent.succeeded` (refine in the credit-system slice spec). Capture **signing secret** (`whsec_…`).
  - **Test:** either register a test-mode endpoint at the same URL (different signing secret), or rely on `stripe listen --forward-to localhost:3000/api/stripe/webhook` per dev session (the CLI prints the signing secret). Pick one approach in the credit-system slice.
- [ ] **Defer**: products + prices (credit pack denominations, per-minute live price, signup grant) — settled in the credit-system spec.

### 4. Wire secrets into Doppler

Once values exist, set them per env (I do this — just hand me the values):

```bash
doppler secrets set --config dev   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_VOD=vids-tube-vod NEXT_PUBLIC_VOD_BASE_URL=https://cdn.vids.tube
doppler secrets set --config stg   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_VOD=vids-tube-vod NEXT_PUBLIC_VOD_BASE_URL=https://cdn.vids.tube
doppler secrets set --config prd   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_VOD=vids-tube-vod NEXT_PUBLIC_VOD_BASE_URL=https://cdn.vids.tube

doppler secrets set --config dev   STRIPE_SECRET_KEY=sk_test_... NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
doppler secrets set --config stg   STRIPE_SECRET_KEY=sk_test_... NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
doppler secrets set --config prd   STRIPE_SECRET_KEY=sk_live_... NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. VM — R2 credentials for the recorder/uploader

The recorder/uploader is installed in the VOD-pipeline slice, but the credentials can land first:

```bash
ssh root@178.105.76.162
install -d -m 700 /etc/vids-tube
cat > /etc/vids-tube/r2.env <<EOF
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_VOD=vids-tube-vod
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
EOF
chmod 600 /etc/vids-tube/r2.env
```

### 6. Verification scripts

I'll add small `tsx` scripts to the repo (`scripts/verify-r2.ts`, `scripts/verify-stripe.ts`) that:

- PUT a tiny object to `R2_BUCKET_VOD`, fetch it back via `NEXT_PUBLIC_VOD_BASE_URL`, assert 200 + correct body + CORS headers.
- Create a Stripe **test-mode** PaymentIntent and confirm it returns a client secret.

Run via `doppler run -- npx tsx scripts/verify-r2.ts`. These scripts are throwaway-grade and don't ship to the app; they live to be re-run when keys rotate.

## Execution plan

1. You do steps 1–3 in the dashboards; hand me the values as you get them.
2. I run step 4 (Doppler) + step 5 (VM env file) + step 6 (verification scripts).
3. Once verification passes, this checklist is done. The VOD-pipeline slice spec can start.
