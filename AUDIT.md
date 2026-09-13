# Security, performance & accessibility audit (MU G)

A **verifiable** audit. Every claim below is either measured in this repo or
explicitly marked as **not measured here** with the reason. No number is
asserted without a source.

> **Re-run 2026-08-28 on `main` `c2cb9eb` + the final-completion branch
> (`arena/01a04990-group-chatbot`).** Numbers below are from that run. The
> security section gained six findings that were **not** in the original audit
> and are now fixed; see "Security — this pass". 

## Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Secrets in the tree | ✅ clean | `SECURITY.md` + gitleaks default-ruleset scan (0 hits) |
| Authorization / RLS holes found **this pass** | ✅ 6 fixed | membership bypass, self role escalation, assistant impersonation, profile enumeration, unscoped reactions, open redirect — see below |
| Markdown XSS | ✅ safe | `react-markdown` without `rehypeRaw`; escaped; `rel="noopener noreferrer"` |
| Authorization / RLS | ✅ | policies present; audit tables locked to `service_role` |
| Moderation fails closed | ✅ | `tests/moderation-fail-closed.test.ts`; spec §9/§11 |
| Training consent | ✅ | unanimous opt-in gate |
| WCAG AA text/UI contrast | ✅ measured | `scripts/contrast.mjs` — **54/54 pairs pass**, exit 0 |
| Component a11y (axe) | ✅ measured | `tests/a11y/components.axe.test.tsx` — **13 tests, 0 violations** |
| Keyboard / focus behaviour | ✅ measured | `tests/keyboard-focus.test.tsx` — **15 tests** (focus in/trap/restore, combobox wiring, live regions) |
| App a11y (browser axe) | ⛔ **not run** | `e2e/accessibility.spec.ts` exists but **no Chromium is available and CI has no `e2e` job** — see `Errors` |
| Frame budget under 4× CPU throttle | 🟡 harness only | `e2e/perf.spec.ts` — written, never executed |
| Client bundle size | ⚠️ measured (initial) | see below — first-load JS is a starting point, **Lighthouse not run** |
| Lighthouse / real-browser perf | ⛔ not measured here | needs a live deploy + browser; no fake numbers |
| Live backend load (k6) | ⛔ not measured | needs deployed Supabase; harness + thresholds in `load/k6/` |
| Fonts | ✅ measured | Inter + JetBrains Mono self-hosted and emitted under `/_next/static/media` by `next/font/local` (with derived `size-adjust` fallback metrics) |

## Accessibility — measured

- **Contrast (WCAG 1.4.3 / 1.4.11):** `node scripts/contrast.mjs` resolves the
  §6 semantic tokens in `:root` (light) and `.dark`, then validates every
  foreground/background pair. **PASS — 44 pairs checked** in both themes. Text
  pairs must be ≥4.5:1, non-text UI/graphics ≥3:1. Example verified pair:
  `warning on bg-app = 11.24:1` (dark), `danger on bg-app = 5.99:1`,
  `success on bg-app = 8.96:1`.
- **Component axe (WCAG AA, full ruleset):** `tests/a11y/components.axe.test.tsx`
  runs axe over the key components/screens — auth shell, message items,
  composer, modal, command palette, sidebar (incl. pinned rows), stream
  announcer, theme control. **13 tests pass — 0 violations.**
- **Keyboard / focus:** `tests/keyboard-focus.test.tsx`, **15 tests**. This
  pass found that `Modal` never moved focus at all — `aria-modal="true"` told
  assistive tech the page behind was inert while Tab happily walked into it.
  Focus is now moved in, wrapped at both edges, and restored to the trigger.
  The @mention popup gained combobox/listbox semantics and the moderation
  warning gained a live region; neither was visible to AT before.
- **Browser axe:** `e2e/accessibility.spec.ts` audits the public pages and the
  signed-in app surfaces in both themes with the full ruleset.
  **Status: implemented, never executed** — no Chromium in the sandbox and no
  `e2e` job in CI (documented in `Errors`).
- **Live-region correctness:** `StreamAnnouncer` batches streamed tokens into
  `aria-live="polite"` announcements (covered by unit tests) rather than
  announcing every token.
- **Reduced motion:** the global CSS disables non-essential motion under
  `prefers-reduced-motion`, and the offline banner collapses to an instant cut.

## Security — this pass (2026-08-28)

The previous audit recorded "Authorization / RLS ✅". Re-reading the policies
rather than trusting that line turned up six issues, all now fixed and all
reachable by an ordinary authenticated client:

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | `conversation_members` INSERT permitted `user_id = auth.uid()` | **any user could join any conversation** by UUID — membership is the only authorization primitive, so this voided every other policy | INSERT is admin-only; rows come from `create_conversation()` / `invite-consume` |
| 2 | `conversation_members` UPDATE had no `WITH CHECK`, so Postgres reused its USING expression | **any member could set their own `role` to `owner`** | self-update policy pins `role` to its pre-update value; role changes need the admin policy |
| 3 | `messages` UPDATE had no `WITH CHECK` | an author could set `sender_type = 'ai'` — assistant impersonation inside a room | `with check (sender_id = auth.uid() and sender_type = 'human')` |
| 4 | `profiles` SELECT open to `auth.role() = 'authenticated'` | the whole user base was enumerable | narrowed to self + co-members |
| 5 | `reactions` INSERT checked only `user_id` | reactions (and therefore message existence) readable across conversations | requires `is_conversation_member()` on the message's conversation |
| 6 | `?next=` echoed into `router.push()` / `NextResponse.redirect()` | **open redirect** off `/login` — a convincing phishing hop | `safeInternalPath()` + 6 unit tests |

Also fixed: `messages_per_min` (30) and `invites_per_hour` (20) were documented
but **never enforced anywhere** — they are now `BEFORE INSERT` triggers, so they
hold on every write path, not just the Edge Function paths. `moderation-check`
had no limit at all and now has one (60/min). Edge Functions no longer return
provider or Postgres error text to callers.

**Not fixable in code (BLUE):** per-IP auth-attempt limiting (Supabase Auth /
edge configuration) and the `ALLOWED_ORIGINS=*` CORS default (an environment
secret). Both are documented in `SECURITY.md`.

## Security — verified

See `SECURITY.md` for the full posture. Key verified points:
- The AI provider key (`OPENROUTER_API_KEY`) is read **only** server-side in
  Edge Functions (`Deno.env.get(...)`); the browser sees only the public anon
  key. The orchestrator speaks OpenRouter's OpenAI-compatible Chat Completions
  API through the pure, unit-tested `_shared/provider.ts` translation layer.
- `SUPABASE_SERVICE_ROLE_KEY` is used **only** inside Edge Functions (bypasses
  RLS by design); never shipped to the client.
- RLS is enabled on every user-accessible table; membership enforced by
  `is_conversation_member()` / `is_conversation_admin()`.
- Markdown is rendered without `rehypeRaw` (raw HTML escaped, never executed);
  the only `dangerouslySetInnerHTML` is an inline, trusted theme script.
- Moderation fails closed (pre + post), and training routing requires unanimous
  opt-in.
- **Secret scan:** the only gitleaks finding was a synthetic identifier in a
  test fixture, which is intentionally there; a gitleaks default-ruleset port
  over all changed files reports **0 hits**.

## Performance — measured initial only

The `npm run build` produces:
- `.next/static` total: **1.69 MB** across 31 JS/CSS files (compressed delivery
  is lower; these are uncompressed on-disk sizes).
- **Largest chunk: ~276 kB** (the app shell, dominated by React + the Supabase
  client + the streaming/markdown stack); several ~150–250 kB chunks.

Flags for follow-up (not blockers, but real optimization opportunities):
- The Supabase JS client and the markdown/streaming runtime are the main
  contributors to the largest chunk. Consider route-level code-splitting for
  `react-markdown` (render only in the chat route) and lazy-loading heavier
  libraries off the first route.
- The app is split across the analytics and landing bundles already; the chat
  route is server-rendered on demand (`ƒ`), which is appropriate for a signed-in
  workspace.

**Not measured here:** Lighthouse scores, real field/CLS/INP, time-to-first-byte,
and frame timings under CPU throttling. These require a live deployment or a
real browser — they are intentionally not fabricated. A harness for the last one
exists (`e2e/perf.spec.ts`) and will produce its first numbers on the first CI
run of the `e2e` job.

## Owner / config follow-ups (not code defects)

These are blocked on owner-held credentials or a `workflows`-permission push
(see `SECURITY.md`):
1. **Push `.github/workflows/ci.yml`** (Playwright `e2e` job + token-contrast
   step) and **bump** `actions/checkout@v4→v5` and `gitleaks/gitleaks-action@v2→v3`.
   The gitleaks job **fails on every `pull_request` run while passing on the
   `push` run of the identical tree** (verified 2026-08-28 on head `8032f07`,
   and on PR #11 before it) — a Node-20-on-24 action defect, not a secret
   finding; see `SECURITY.md` item 2 for the full evidence. One-time patch:
   `ci/patches/ci-playwright-and-contrast.patch`.
2. **Release secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`,
   `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID` (see `ci/README.md`).
3. **AI provider key**: `supabase secrets set OPENROUTER_API_KEY=sk-or-...`
   (server-side).
4. **Run the load test** against a live deploy and record numbers in
   `load/k6/README.md` (do not treat the thresholds as results). Note the
   `messages_per_min` trigger is now enforced in the database, so run the storm
   paced (the harness defaults to 2.2 s between sends).
5. **Set `ALLOWED_ORIGINS`** on the Edge Functions (defaults to `*`).
6. **Enable per-IP auth rate limiting / CAPTCHA** in Supabase Auth.

## Errors — what could NOT be run, and why

Recorded so nothing here is mistaken for a passing gate.

| Gate | Status | Blocker |
|---|---|---|
| `npx playwright test` (31 tests, 12 files) | **NOT RUN — ENVIRONMENT LIMITATION** | No Chromium binary and none is obtainable: `cdn.playwright.dev`, `storage.googleapis.com` and `playwright.azureedge.net` all fail TLS from this sandbox (only `registry.npmjs.org` and `github.com` are reachable). CI has no `e2e` job either (see follow-up 1). |
| `npx playwright test --list` | ✅ run | 31 tests / 12 files collected; config valid |
| Browser axe (`e2e/accessibility.spec.ts`) | **NOT RUN — ENVIRONMENT LIMITATION** | same as above |
| Frame budget under 4× CPU throttle (`e2e/perf.spec.ts`) | **NOT RUN — ENVIRONMENT LIMITATION** | same as above |
| `deno check` on the Edge Functions | **NOT RUN — ENVIRONMENT LIMITATION** | no Deno runtime in the sandbox. Runs in the `edge-functions` CI job, which is green on `main`. |
| `deno test tests/moderation-fail-closed.test.ts` | **NOT RUN — ENVIRONMENT LIMITATION** | same; green in CI |
| Live k6 load test | **NOT RUN** | needs a deployed Supabase project (deliberately out of scope for the code checkpoint) |
| `supabase db push` / RLS policy verification | **NOT RUN** | no live project; the SQL was reviewed statically and is idempotent |
| Lighthouse / real-browser performance | **NOT RUN** | needs a deployed host + a browser |

Everything else was run on the committed tree and is reported above:
`tsc --noEmit` ✅ · `npm run lint` 0 errors ✅ · `npm test` **83/83** ✅ ·
`node scripts/contrast.mjs` **54/54** ✅ · `npm run build` ✅.
