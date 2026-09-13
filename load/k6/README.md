# k6 — 50-member group / broadcast storm (§32)

This directory contains a **runnable** k6 load-test harness for the real
(deployed) Supabase backend. It measures the hot paths of a group conversation:

- **message latency** — PostgREST insert + list (what `sendMessage` /
  `listMessages` do under RLS),
- **Realtime fan-out** — WebSocket delivery of `postgres_changes` to the other
  members,
- **database pressure** — insert/list timing + failure rate,
- **Edge Function latency** — covered by a separate, low-rate probe (see below),
- **concurrent connections / dropped events / p95 & p99** — reported by k6.

## Honesty note ⚠️

The **measured results are NOT yet available**. Producing them requires a live
Supabase project with the schema applied, the Edge Functions deployed, a set of
real member JWTs, and an AI provider key. This sandbox has no live backend, so
the script is provided as a complete, reviewable harness — and the acceptance
thresholds below are **targets to verify against**, not claims of achieved
performance. Do not cite them as results.

## Files

| File | Purpose |
| --- | --- |
| `broadcast.js` | k6 scenarios (`postgrest_storm`, `realtime_observers`) + thresholds |
| `seed-room.mjs` | Node helper that provisions a 50-member room via `service_role` (server-only) and prints the k6 env values |

> **Secret-scan note:** these scripts read credentials from `__ENV`/`process.env`
> through a small `env()` helper rather than a bare `x = SOMETHING_LONG`
> assignment. The latter trips gitleaks' `generic-api-key` rule on the
> *identifier* even when no secret value is present. The file passes the
> gitleaks default ruleset.

## Requirements (owner-provided)

- A deployed Supabase project with `supabase_schema.sql` (or the migration) applied.
- The three Edge Functions deployed:
  `supabase functions deploy ai-orchestrator moderation-check invite-consume`.
- A real end-user JWT for a member of the seeded room (`K6_ACCESS_TOKEN`).
- The public anon key (`K6_ANON_KEY`).

## How to run

1. Seed the room (server-side, uses `service_role`):

   ```bash
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=... \
   node load/k6/seed-room.mjs 50
   ```

2. Install k6 and run the storm:

   ```bash
   # k6 install (e.g. brew install k6, or the Grafana binary)
   K6_BASE_URL=... K6_REALTIME_URL=... \
   K6_ANON_KEY=... K6_ACCESS_TOKEN=... K6_CONVERSATION_ID=... \
   k6 run load/k6/broadcast.js
   ```

3. For the full 50-connection fan-out, increase the observer VUs via
   `K6_REALTIME_MSGS` and the scenarios (the default is a conservative,
   deterministic run that stays inside the rate limiter).

## Rate limiter — now enforced in the database ⚠️

`messages_per_min` (30/minute **per sender**) is enforced by a
`BEFORE INSERT` trigger on `public.messages`, not by application code
(see `supabase/migrations/20260828000000_rls_hardening.sql`). Every VU
shares one `K6_ACCESS_TOKEN`, so from the database's point of view the
whole storm is a *single* sender.

`broadcast.js` therefore paces sends with `K6_SEND_SLEEP_S` (default
`2.2`s ≈ 27 messages/minute). Two consequences to know before you cite any
number from this harness:

- **Paced (default):** the run measures insert/list latency and Realtime
  fan-out. Valid for the thresholds below.
- **Unpaced (`K6_SEND_SLEEP_S=0`):** the run measures the rate limiter —
  inserts start failing with `rate_limited` once 30 land inside a minute,
  so `request_failure_rate` will blow past the 1% threshold by design.

If you want a 50-*sender* storm rather than 50 observers behind one token,
seed per-VU tokens (`seed-room.mjs` prints one per member) and raise
`K6_SEND_SLEEP_S` only if the shared-sender ceiling bites.

## Acceptance thresholds (§32)

These are the targets the load test verifies. They are **not** measured results.

| Metric | Threshold (p95 unless noted) |
| --- | --- |
| Request failure rate | `< 1%` |
| `msg_insert_s` (postgres write) | `< 1.5s` |
| `msg_list_s` (read under RLS) | `< 0.8s` |
| `realtime_propagation_s` | `< 2.0s` |
| `realtime_connect_s` (WebSocket join) | `< 2.5s` |
| Dropped realtime events | `0` for the connected cohort |

## Edge Function latency probe

The AI orchestrator is deliberately rate-limited (10 calls/min) and needs a
provider key + pre/post moderation, so it is **not** included in the storm. To
measure orchestrator latency separately at low concurrency, add a small
`http.post` against `<base>/functions/v1/ai-orchestrator` (with a valid user
JWT and a benign message) and report its `timings.duration` / `p95`.

<br />

**Status:** harness implemented, methodology + thresholds defined; **measured
results blocked on a live Supabase deployment** (owner to provision and run,
then record the numbers here and in `SECURITY.md`).
