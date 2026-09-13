# §17 Acceptance Criteria Checklist

Status against the v2.0 master build prompt.

Legend: **GREEN** done and verified · **YELLOW** implemented, not fully verified ·
**RED** missing/broken · **BLUE** needs external/manual infrastructure ·
**OPTIONAL** non-blocking

(The tables below use the symbols they were originally written with:
✅ done · 🟡 partial / implemented but unverified · ⛔ pending ·
🔵 external infrastructure · ➖ out of scope for this pass.)

---

## Final code-completion pass (session `arena/01a04990-group-chatbot`, 2026-08-28)

Everything below was re-verified against the code in this session rather than
taken from previous reports.

### Gates run locally in this session (all on the committed tree)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ clean |
| Lint | `npm run lint` | ✅ 0 errors (19 pre-existing `<EffectEvent>`/set-state-in-effect warnings) |
| Unit + a11y | `npm test` | ✅ **83 tests / 9 files** |
| Token contrast | `node scripts/contrast.mjs` | ✅ **54 pairs**, both themes |
| Production build | `npm run build` | ✅ 14 routes, 0 errors |
| Playwright collection | `npx playwright test --list` | ✅ **31 tests / 12 files** |
| Playwright execution | `npx playwright test` | ⛔ **NOT RUN — ENVIRONMENT LIMITATION** (no Chromium; `cdn.playwright.dev` unreachable from the sandbox) |
| Deno typecheck / integration | `deno check …`, `deno test …` | ⛔ **NOT RUN — ENVIRONMENT LIMITATION** (no Deno runtime in the sandbox; both run in the `edge-functions` CI job, which is green) |

### What this pass changed

**Security (all previously exploitable or leaking):**

| Finding | Fix | Status |
|---|---|---|
| `conversation_members` INSERT allowed `user_id = auth.uid()` → **any authenticated user could join any conversation** by UUID, defeating every other policy | INSERT is now admin-only; membership is minted by `create_conversation()` / `invite-consume` only | GREEN |
| `conversation_members` UPDATE had no `WITH CHECK` → Postgres reused USING, so **any member could set their own `role` to `owner`** | split into a self policy that pins `role` to its pre-update value + an admin policy | GREEN |
| `messages` UPDATE had no `WITH CHECK` → an author could flip `sender_type` to `'ai'` (assistant impersonation) | `with check (sender_id = auth.uid() and sender_type = 'human')` | GREEN |
| `profiles` SELECT was open to every authenticated user → whole user base enumerable | narrowed to self + co-members | GREEN |
| `reactions` INSERT did not check membership | now requires membership of the message's conversation | GREEN |
| **Open redirect**: `?next=` echoed into `router.push()` / `NextResponse.redirect()` | `safeInternalPath()` applied at `/login`, the OAuth buttons and `/auth/callback`; 6 unit tests | GREEN |
| Edge Functions returned provider/Postgres error text to callers | logged server-side, generic messages returned | GREEN |
| `messages_per_min` (30) and `invites_per_hour` (20) were documented but **never enforced** | `BEFORE INSERT` triggers, enforced on every write path | GREEN |
| `moderation-check` had no rate limit at all | `moderation_checks_per_min` (60) | GREEN |
| Auth attempts per IP | not implementable in app code — Supabase Auth / CAPTCHA configuration | **BLUE** |
| `ALLOWED_ORIGINS` defaults to `*` on the Edge Functions | configure per environment; tokens are not cookies so exposure is limited | **BLUE** |

**Features that were missing:**

| Item | Before | After | Status |
|---|---|---|---|
| Pinned conversations (§3) | ⛔ none | `conversation_members.pinned_at`, `setPinned()`, a Pinned group in the sidebar with an accessible toggle | GREEN |
| Standalone `/pricing` (§3, P1) | 🟡 landing section only | `/pricing` route sharing one plan table with the landing teaser | GREEN |
| Export my data (§3 settings) | ⛔ none | client-side JSON export of everything the account can read | GREEN |
| Self-hosted fonts (§2.3) | 🟡 declared, resolved to system fallbacks | Inter + JetBrains Mono committed and served from origin via `next/font/local` | GREEN |
| 60fps @ 4× CPU throttle (§2.7) | ⛔ not measured | measurement harness added (`e2e/perf.spec.ts`); **the number is still unmeasured** | **YELLOW** |

**Accessibility (found and fixed, none of them visible to axe):**

| Gap | Fix | Status |
|---|---|---|
| `Modal` set `aria-modal="true"` but **never moved focus** — keyboard users were stranded behind the backdrop | focus in on open, Tab wrapped at both edges, focus restored to the trigger on close | GREEN |
| Command palette dropped focus on close | focus restored to the opener | GREEN |
| `@mention` autocomplete had **no combobox/listbox semantics** | WAI-ARIA 1.2 combobox + listbox + `aria-activedescendant` | GREEN |
| Moderation warning / attachment error appeared silently | persistent `role="status"` / `role="alert"` regions | GREEN |
| Landing page had no `<main>` landmark | wrapped | GREEN |
| Sidebar groups were unlabelled runs of links | named `<ul>` per group | GREEN |

---

## GitHub status (verified, not assumed)

| Item | Status | Evidence |
|---|---|---|
| `main` at session start | `c2cb9eb` | `fix: clear WCAG AA violations found in pre-CI axe audit; align E2E specs (#11)` |
| `ci.yml` / `release.yml` | ✅ live in `.github/workflows/` since `99ebad0` | |
| CI jobs currently on `main` | `verify` (typecheck/lint/unit/build), `edge-functions` (deno check + fail-closed), `secrets-scan` (gitleaks) | `.github/workflows/ci.yml` — **no `e2e` job, no contrast step** |
| **Playwright `e2e` job on `main`** | 🔴 **NOT PRESENT — re-verified 2026-08-28** | the session's credential is a GitHub App; pushing a commit that touches `.github/workflows/ci.yml` is rejected server-side: *"refusing to allow a GitHub App to create or update workflow … without `workflows` permission"*. The byte-identical diff ships as `ci/patches/ci-playwright-and-contrast.patch` |
| Release workflow | 🔴 **blocked on owner secrets** | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `VERCEL_*` unset |
| Real Supabase / Vercel deployment | 🔴 **not started** (deliberately — this session is the code checkpoint) | see `RELEASING.md` |

## §2 Design system

| Item | Status | Notes |
|---|---|---|
| §2.2 primitives (neutral/accent/ai-teal/semantic) | ✅ | exact hex values |
| §2.2 semantic tokens, light → dark | ✅ | incl. `--bubble-*` |
| AI identity = `ai-teal-500`, not gray/brand | ✅ | **corrected** — was brand-purple |
| Real bubbles, not flat rows | ✅ | **corrected** — §2.2 requires a bg container |
| §2.3 Inter + JetBrains Mono, 14/20 default | ✅ | **self-hosted** variable woff2 in `src/app/fonts`, wired via `next/font/local` (fallback metrics derived, no CDN request) |
| §2.4 spacing/radius/elevation/breakpoints | ✅ | 6/12/20/999 radii |
| §2.5 AI ring + "AI" pill + teal typing dots | ✅ | |
| §2.5 `ai_mode` badge (dot/outline/filled) | ✅ | **corrected** |
| §2.6 focus ring, `prefers-reduced-motion` | ✅ | instant cut, not slower; dialogs now move/trap/restore focus |
| §2.6 contrast audit at 4.5:1 | ✅ | `scripts/contrast.mjs` — **54/54 pairs pass**, both themes. Browser colour-contrast is in the Playwright axe spec (runs locally when Chromium is available; **not in CI yet**, see GitHub status) |
| §2.7 motion tokens, all surfaces | ✅ | 5 one-offs replaced with `tExit()` |
| §2.7 60fps under 4x CPU throttle | 🟡 | `e2e/perf.spec.ts` measures frame intervals under CDP 4× throttling and enforces a jank ceiling (p95 ≤ 50 ms, no frame > 250 ms). The 60 fps (16.7 ms) bar is **reported, not asserted**, until CI produces a first baseline — see the header note |

---

## §3 Page inventory

| Screen | Status | Notes |
|---|---|---|
| Landing (hero, live demo, features, pricing teaser, footer) | ✅ | |
| Pricing page (P1) | ✅ | **standalone `/pricing` route**; plan table shared with the landing teaser |
| **Changelog / release notes** | ✅ | **added** — GitHub Releases API, ISR |
| Status page (P2) | ➖ | |
| Sign up + **default-OFF training checkbox** | ✅ | **added to signup**, never pre-checked |
| Log in / forgot / reset / OAuth callback | ✅ | |
| Verify email | 🟡 | "check your inbox" state; no standalone route |
| Onboarding (≤3 steps) | ✅ | |
| Conversation list / dashboard | ✅ | unread badges, search entry |
| Pinned conversations | ✅ | `conversation_members.pinned_at` (per-member) + a Pinned group in the sidebar and an accessible toggle; 8 unit tests + 4 E2E |
| 1:1 AI chat (stream/stop/regenerate/edit, md+copy) | ✅ | |
| Group room (members, presence, @ai, badge, invites) | ✅ | |
| Typing indicators / reactions (P1) | ✅ | |
| Read receipts (P1) | ✅ | `last_read_at` surfaced as a "Seen by …" indicator on the sender's own messages in a room; `computeReadReceipt` helper + `conversation_members` realtime subscription; unit-tested |
| Room settings + danger zone | ✅ | |
| Global search (P1) | 🟡 | full-text works; no sender/date filters (**OPTIONAL**) |
| **Command palette (⌘K)** | ✅ | **added** — navigate/create/theme; search moved to ⌘/ |
| User settings (profile, theme, training toggle) | 🟡 | **JSON data export added** (client-side, no endpoint). Notifications and connected accounts need a push/email provider and OAuth provider configuration respectively — **BLUE**, not code work. Account deletion stays a support action by design |
| File attachments (P1) | ✅ | composer upload (validate 10MB, allowlist, excludes SVG), private bucket write + member-scoped signed-URL chips; real-mode storage calls + demo object URLs; unit + E2E specs |
| Admin analytics (P2) | ➖ | views exist |
| Empty / error / loading states | ✅ | skeletons, moderation notice, 404 |
| Offline / reconnecting banner | ✅ | `NetworkProvider` + `OfflineBanner` (online/offline/reconnecting/restored); real-mode sends are refused while offline (not pretended); unit-tested + `e2e/offline.spec.ts` |

---

## §4–§9 Backend

| Item | Status | Notes |
|---|---|---|
| Shared `conversation` model | ✅ | |
| `ai_mode` OFF/MENTION_ONLY/AUTO | ✅ | |
| Key only via `Deno.env.get("OPENROUTER_API_KEY")` | ✅ | one read, never logged, never in a response |
| **Moderation fails closed, both stages** | ✅ | try/catch → `error_failed_closed`; tested |
| Orchestrator flow (§7 steps 1–7) | ✅ | incl. `superseded` on regenerate |
| Streaming delivery | ✅ | intentional deviation from §6, ratified — see Interpretation calls |
| RLS enabled + explicit policies, every table | ✅ | 10/10 tables |
| Default-deny, membership-scoped | ✅ | audit tables: RLS on, zero policies |
| Storage policies mirror membership | ✅ | SECURITY DEFINER helper |
| Signed URLs for attachments | ✅ | `attachmentUrl()` mints member-scoped 24h signed URLs (or demo object URLs); chips render/download |
| `training_opt_in` default false | ✅ | DB + trigger + signup + settings |
| **Orchestrator checks flag before training** | ✅ | unanimous opt-in — ratified, see Interpretation calls |
| Rate limits: messages, AI, invites | ✅ | 30 msg/min and 20 invites/hr are `BEFORE INSERT` triggers (every write path); 10 AI calls/min and 60 moderation checks/min are Edge Function counters |
| Rate limits: auth attempts per IP | 🔵 | **BLUE** — Supabase Auth rate limits + CAPTCHA are Dashboard/Auth configuration, not application code. Nothing in this repo can enforce it; documented in `SECURITY.md` |

---

## §10–§12

| Item | Status | Notes |
|---|---|---|
| Keyboard reachability, focus trap, ARIA | ✅ | dialogs labelled **and** focus-managed (in/trap/restore, 10 tests); combobox + listbox for @mentions; live regions for moderation verdicts; `role="log"` message list; named `<ul>` sidebar groups; `<main>` on every route. 13 axe tests, 0 violations |
| `aria-live="polite"` batched for streaming | ✅ | **added** — 1s batching + completion flush, tested |
| axe-core in CI, merge-blocking | ✅ | `tests/a11y/` (**13 tests**) runs inside `npm test`, which the `verify` CI job runs — so it is merge-blocking. jsdom covers structural rules; colour-contrast needs a real browser |
| Unit test sample | ✅ | 83 tests / 9 files, including `tests/keyboard-focus.test.tsx` (15) and `tests/data-export.test.ts` (8) |
| Integration test (fail-closed) | ✅ | `tests/moderation-fail-closed.test.ts` |
| E2E Playwright (MU2) | 🟡 | `e2e/` — **31 tests / 12 files** (AI chat, group room, @ai + moderation, ⌘K palette, history, offline, attachments, **pinned**, **settings/export**, **fonts**, **perf**, browser axe in both themes). Chromium is unreachable in this sandbox and the `e2e` CI job is blocked, so **the suite has never been executed** — treat it as implemented-but-unverified |
| Design-token contrast (WCAG AA) | ✅ | `scripts/contrast.mjs` — **54/54 pairs PASS**, both themes. Runnable locally; CI wiring is in the held-back patch |
| k6 50-member broadcast storm | 🟡 | `load/k6/broadcast.js` harness + `seed-room.mjs` + `load/k6/README.md` (methodology + explicit acceptance thresholds). **Measured results pending a live Supabase deployment** — no results are claimed (see `load/k6/README.md`). |
| gitleaks | ✅ | wired into CI |
| `ci.yml` | ✅ | lint, typecheck, unit, deno check, fail-closed, gitleaks — **green on GitHub** (run `33117956383`) |
| `release-major.yml` | 🟡 | live as `.github/workflows/release.yml` (push to `main` + dispatch); **red — blocked on repo secrets**, not on code; not tag-triggered on `v[0-9]+.0.0` |

---

## Interpretation calls (ratified)

These are points where the spec was silent or where we knowingly diverged.
Each has been reviewed and **locked in** — they are not open questions.

### 1. Streaming transport — intentional deviation from §6 ✅ ratified

§4/§6 specify `ai_delta`/`ai_done` broadcasts on the `room:{conversation_id}`
Realtime channel. We instead stream **SSE directly to the invoking client**
while progressively updating a single `messages` row (`status: 'streaming'`),
which every other member observes through `postgres_changes`.

**Reasoning for keeping it:**

- **The partial answer survives a refresh.** The row *is* the state, so a
  reload mid-stream resumes from the real content. With pure broadcast, the
  deltas are ephemeral — a client that reloads or joins late has missed them.
- **Identical UX for the sender**, who reads from the SSE stream directly.
- **One fewer moving part** — no separate broadcast fan-out to keep in sync
  with the persisted row, and no reconciliation step where the two disagree.

**Accepted trade-off:** other members receive coarser updates (~400ms row
flushes) rather than token-level deltas, and **any external client written
against the literal §6 broadcast contract will not find `ai_delta`/`ai_done`
events.** If a third-party consumer ever needs that contract, the broadcast
can be layered on top of the existing flow without replacing it.

### 2. `training_opt_in` in group rooms — unanimous consent ✅ ratified

§8 mandates `training_opt_in` defaults false and that the orchestrator checks
it before any training routing, but **does not define the group case** — what
happens when a room's members disagree.

**Ruling: training routing requires unanimous opt-in.** A conversation is
eligible only when *every* current member has `training_opt_in = true`. Any
single hold-out disables routing for the entire room. A missing profile row, a
member count mismatch, or a failed read all evaluate to **not eligible**.

**Reasoning:** it is the privacy-protective default, and it's the only reading
that doesn't let one member's choice export another member's messages — in a
group room, a single conversation contains everyone's words, so consent has to
be collective to be meaningful. Consistent with §8's framing of default-OFF as
a hard requirement rather than a soft preference.

Implemented in `supabase/functions/ai-orchestrator/index.ts` (step 2b);
`routeToTrainingPipeline()` is additionally a no-op unless
`TRAINING_PIPELINE_URL` is configured, so default deployments route nothing
regardless of opt-in state.

---

## Known deviations from spec

These are environmental/scope limitations rather than design decisions.

1. **Workflow-file edits require the owner's credentials.** The push credential
   used by the agent (a GitHub App) lacks the `workflows` permission, so it
   cannot create commits touching `.github/workflows/*` — the original reason
   the pipelines shipped under `ci/`. Activation was applied by the owner
   (`99ebad0`), and the Deno CI fix (`9230ff1`) was deliberately designed to
   need **zero** workflow changes. **Re-confirmed 2026-08-28 in this session:**
   a push of the `e2e`-job commit was rejected server-side. Any future workflow
   edit must be pushed by the owner; `ci/README.md` documents the pipelines.

2. **Rate limiting is per-sender, not per-IP.** The 30 msg/min trigger counts
   per `sender_id`; per-IP abuse protection is a Supabase Auth / edge
   configuration matter (BLUE).

3. **Notifications and connected accounts** are not implemented: the first
   needs a push/email provider, the second needs OAuth provider configuration.
   Both are infrastructure, not application code.
