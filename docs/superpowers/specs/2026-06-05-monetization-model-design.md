# vids.tube — Monetization Model Design

**Date:** 2026-06-05
**Status:** Design agreed (pending written review)
**Supersedes:** the deferred per-minute credit-wallet model in
`2026-05-23-vids-tube-roadmap.md` → "Deferred — Credit system" and
`2026-05-23-vids-tube-v1-design.md`. See "Relationship to the old credit model".

## Goal

A "wholesome" alternative to YouTube: monetization that is **honest, fair, and
transparent**. Viewers pay for live access, always see exactly what they pay and
how much goes to the streamer, and can donate more on top. The platform takes no
margin from streamer earnings — it only covers its real costs.

## The cost reality this model is built on

This is the foundation; the pricing exists to match it.

- **VOD is ~free to serve.** Recordings live on Cloudflare R2 + CDN, where egress
  to viewers is $0. The only cost is storage. An extra VOD viewer costs ~nothing.
- **Live has a real per-viewer cost — today.** Live HLS is served **directly from
  the ingest VM** (`stream.vids.tube`, not behind a cache). So:
  - **Compute** (OBS → RTMP → MediaMTX remux → HLS) is **fixed per stream-hour** —
    the same for 1 or 1,000 viewers.
  - **Delivery** (bandwidth + held connections) **scales with concurrent viewers**
    (~1.8 GB/hour per viewer at 720p), all out of one VM.
  - Each VM has a hard **concurrency ceiling** (the NIC), on the order of a few
    hundred 720p viewers.
- **Cost is lumpy, not smooth.** Within one VM's capacity the bandwidth bill is
  basically flat. To serve more concurrent viewers than one VM holds, you add a
  VM — a **step up**. A minor extra cost is monthly data overage (~$1/TB past the
  included allowance).
- **Planning placeholder:** assume **~1 VM per ~100 concurrent viewers**. The real
  figure is set by the costing investigation (below).

**Implication:** the scarce, costly thing is **concurrent live capacity at a
moment in time**. That is what we price. VOD/delayed playback is free because it
genuinely costs ~nothing.

## The model

### 1. Live access is a per-stream ticket — not a wallet

- Viewers **pay to access a specific stream**. There is **no balance to top up and
  drain** and no per-minute meter.
- Viewers can **book ahead** of time.
- **Refunds:** if the streamer cancels, bookers are refunded. Viewer-initiated
  cancellation policy is an open decision (see Open decisions).

### 2. Pricing is dynamic, tied to real capacity cost

- The access price for a **time window** rises as total bookings across **all
  streams in that window** grow — because concurrent demand is what forces new
  capacity.
- Pre-booking is the key enabler: it turns unpredictable real-time surge into a
  **known number we can price and show in advance.**
- **Cost recovery must lead the cost.** Because capacity is lumpy (a whole VM at a
  time), the price accumulates a **buffer ahead of each capacity step**, so the
  next VM is already paid for by the time it is needed. This makes the curve a
  smooth rise, **anchored to real amortized capacity cost** — not arbitrary surge,
  and shown transparently so viewers can see what they are paying for.
- **No "sold out."** Pricing and capacity **expand to cover demand**. (At scale
  this implies autoscaling VMs — see Open decisions.)

### 3. Streamer pricing layer (the "fair" part)

Each ticket price has two parts, both shown to the viewer:

- **Base rate → platform.** Covers the real capacity cost for the window, plus a
  platform fee, plus payment-processing fees.
- **Streamer extra → 100% to the streamer.** The streamer sets this. The platform
  takes **0% margin** on it.
- **Payment processing is always covered** (Stripe ~2.9% + 30¢ per charge, plus
  payout fees) — either passed through visibly or folded into the base. This is the
  one carve-out from "0% cut": the platform must not lose money as streamers earn
  more. 0% **margin**, not 0% of a fee Stripe charges regardless.
- **Donations:** viewers can tip extra on top of the ticket, 100% to the streamer
  (processing covered).

When the streamer schedules a slot, they see an **estimate** of what it will cost
viewers for that window. The estimate firms up as the window fills.

### 4. Access tiers

- **Free = delayed cast.** Anyone (anonymous or signed-in) can watch a stream
  **delayed by a few minutes** (default ~5 min), served from **R2** — so it costs
  the platform ~nothing and scales infinitely. Read-only: **no live chat.** This
  is the discovery funnel — sample free, convert to paid.
- **Paid = real-time live + chat.** Paying for admission unlocks the real-time
  stream (the scarce VM capacity) and live chat participation. Gating chat to
  payers also reduces moderation load.

Decided: there is **no "free live watch time."** A real-time viewer always
consumes a paid VM slot, so the only free tier is the delayed cast. Free =
delayed; live = paid.

## Build sequencing

- **Single streamer first.** The whole framework works with one streamer (the
  owner). For a single streamer, "platform cost vs. streamer earnings" is just
  internal accounting (owner is both sides), so payouts can wait.
- **Real-money prerequisites** must land before charging:
  - **Stripe** integration (keys not yet in Doppler — added when this starts).
  - **Terms of Service / Privacy / eligibility** — Linear **AZ-30**.
  - **Refund policy** decided.
- **Measurement primitive before dynamic pricing.** Build concurrency + cost-per-
  window tracking first (ties into the analytics work, Linear **AZ-26**). Turn on
  *dynamic* pricing only once more than one VM actually runs — until then there is
  no real surge to price.
- **Scheduling is the foundation.** Paid booking builds on the scheduled-stream
  work (Linear **AZ-28**), which becomes booking-capable.
- **Payouts (Stripe Connect)** are deferred until other streamers are allowed
  (multi-channel, Linear **AZ-31** / a later milestone).

## Open decisions (resolve at build time)

- **Exact pricing curve / amortization math** — via a dedicated **costing
  investigation**: real VM cost, true per-VM concurrent ceiling, buffer size,
  base-fee level. Nothing about the formula is locked yet beyond "fair, transparent,
  costs always covered, pre-funded ahead of each capacity step."
- **Viewer-initiated cancellation/refund policy** (e.g. full refund up to a cutoff;
  restricted late cancels because they distort others' pricing).
- **Delay length** for the free cast (~5 min default).
- **Walk-up (unbooked) live access** — pay the current dynamic price if capacity
  remains.
- **Autoscaling VM provisioning** (how capacity expands to honor "no sold out").

## Relationship to the old credit model

The earlier design used a **per-minute credit wallet** (signup grant, top-ups, a
balance drained by playback heartbeats). That is **replaced**: the user-facing
primitive is now a **per-stream access ticket with dynamic, pre-booked pricing**,
not a metered wallet. An append-only ledger may still be used internally for
transparent accounting (what each party paid/earned), but there is no
top-up-and-drain balance. The roadmap's "Deferred — Credit system" section should
be updated to point here.
