# Releasing ONYX (MU H — release readiness)

This is the owner-run release checklist. Each step is **blocked on owner-held
credentials or a `workflows`-permission push** — the GitHub App credential used
for this branch cannot write workflow files and cannot start a release against
a Supabase/Vercel project you haven't wired up. Everything is listed in order
so the release can be executed against a real deployment.

## 0. Current state (verified 2026-08-28, session `arena/01a04990-group-chatbot`)

- `main` (`c2cb9eb`) contains: the v2.0 app, MU2 (Playwright E2E + browser axe
  + §6 AA tokens), MU-C (k6 harness), MU-D (attachments), MU-E (read
  receipts), MU-F (offline), MU-G (security/perf/a11y audit). All three CI
  jobs on `main` are green.
- **Code-complete checkpoint.** The final pass on this branch added: RLS
  hardening (membership bypass, self role escalation, profile enumeration,
  reaction scoping), database-enforced `messages_per_min` / `invites_per_hour`
  limits, an open-redirect guard, opaque Edge Function errors, pinned
  conversations, the standalone `/pricing` route, client-side data export,
  self-hosted fonts, dialog focus management, and combobox semantics for the
  @mention popup. Gates: `tsc` clean · lint 0 errors · **83 vitest tests** ·
  **54/54 contrast pairs** · `next build` clean · **31 Playwright tests
  collected** (not executed — see below).
- The Playwright CI **job is still not active on `main`.** The change is held
  **out of** `arena/01a04990-group-chatbot` because the session's GitHub App
  credential cannot push workflow files — re-confirmed 2026-08-28 by an actual
  rejected push (`refusing to allow a GitHub App to create or update workflow
  … without 'workflows' permission`). It ships in the branch as
  `ci/patches/ci-playwright-and-contrast.patch` (verified to apply cleanly to
  `c2cb9eb`), awaiting the one-time owner action in §3. The 31 E2E tests are
  committed and collected; **none of them has ever been executed**, because
  Chromium cannot be installed in the sandbox (`cdn.playwright.dev` is
  unreachable).
- The **Release** workflow still fails at "Push migrations" because the
  Supabase release secrets are not set (expected until you run §4).

## 1. Secrets — server-side (Edge Functions)

Set in Supabase, never in source control or the browser:

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...   # OpenRouter key (openrouter.ai/keys)
```

The orchestrator calls OpenRouter's OpenAI-compatible Chat Completions API
(`https://openrouter.ai/api/v1/chat/completions`); default model is
`anthropic/claude-sonnet-4.6` (override per environment with `AI_MODEL`).

Optional, for the training pipeline (unanimous-consent gate):
```bash
supabase secrets set TRAINING_PIPELINE_URL=...
```

## 2. Secrets — client-safe (public)

Add to the hosting env (Vercel) and to GitHub Actions:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the public anon key

**These are public** (the anon key is safe to expose); only the `service_role`
key and the provider key must stay server-side.

## 3. Activate CI (one-time owner push)

**State as of 2026-08-28 (two independent sessions, same result):** the
session's GitHub credential works for code, PRs and merges, but a push of any
commit touching `.github/workflows/ci.yml` is **rejected server-side by
GitHub**: "refusing to allow a GitHub App to create or update workflow
`.github/workflows/ci.yml` without `workflows` permission". The
CI-activation commit is therefore **not in `arena/01a04990-group-chatbot`**;
the byte-identical change ships in the branch as
`ci/patches/ci-playwright-and-contrast.patch` and lands on `main` with the
merge.

One-time owner action (either path):

- **A. Grant the session's GitHub App the `workflows` permission** (repo
  Settings → GitHub Apps → the installation → Repository permissions →
  *Workflows*: read & write) and let this session know — the session then
  applies the patch, commits, pushes, PRs, merges and verifies CI.
- **B. Apply the patch on `main` yourself** — with any credential that has
  `workflows: write`:

  ```bash
  git apply ci/patches/ci-playwright-and-contrast.patch
  git add .github/workflows/ci.yml
  git commit -m "ci: run Playwright E2E + token-contrast; bump actions to Node-24-safe"
  git push
  ```

The patch in `ci/patches/` is the exact diff of the held-back CI-activation
commit — verified byte-identical and clean-applying to `main` (e2e job +
contrast step + `actions/checkout@v4 -> @v5`, `actions/setup-node@v4 -> @v5`,
`gitleaks/gitleaks-action@v2 -> @v3`). Without the bump, the Node-20 actions
run on the Node 24 runners and intermittently crash the gitleaks job (no
secret finding — documented in `SECURITY.md`).

Once the job is live it needs **no secrets**: the suite runs the app in demo
mode (the `webServer` env forces empty Supabase vars).

Its first run is also the first time the E2E suite executes at all, so expect
to iterate: `e2e/perf.spec.ts` in particular reports frame timings that have
never been observed before. The perf spec enforces only a jank ceiling
(p95 ≤ 50 ms, no frame > 250 ms); the §2.7 60 fps bar is reported, not
asserted, until there is a baseline to set it against.

## 4. Release workflow secrets (owner)

`release.yml` runs `db push`, `functions deploy`, and a Vercel deploy. It needs
these GitHub repository secrets:

- `SUPABASE_ACCESS_TOKEN` — Supabase token
- `SUPABASE_PROJECT_REF` — the project ref
- `SUPABASE_DB_PASSWORD` — DB password
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — Vercel deploy creds

Set them, then re-run the Release workflow (or push to `main`).

## 5. Apply the database schema + functions (once, against live)

`supabase/migrations/` is the versioned history and `supabase db push` applies
it in order; `supabase_schema.sql` is the equivalent one-shot snapshot if you
prefer the SQL Editor. Current migrations:

| Migration | What it does |
|---|---|
| `20260101000000_init.sql` | tables, RLS, storage buckets/policies, RPCs, realtime publication, analytics views |
| `20260828000000_rls_hardening.sql` | closes the membership bypass / self role escalation / assistant-impersonation holes, narrows `profiles` SELECT, scopes `reactions` INSERT, adds the `messages_rate_limit` and `invites_rate_limit` triggers |
| `20260828000001_pinned_conversations.sql` | `conversation_members.pinned_at` |

Apply and deploy:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy ai-orchestrator moderation-check invite-consume
```

## 5b. Optional environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GITHUB_REPO` | frontend build | repo whose Releases feed `/changelog` (defaults to `Rahulbharvadiya/Group-Chatbot`) |
| `GITHUB_TOKEN` | frontend build, **server only** | raises the GitHub API rate limit for `/changelog`. The page falls back to a static entry if it is unset |
| `AI_MODEL` | Supabase Edge Function secret | OpenRouter model slug; defaults to `anthropic/claude-sonnet-4.6` |
| `ALLOWED_ORIGINS` | Supabase Edge Function secret | comma-separated allowlist for the functions' CORS. Defaults to `*` — set it to your real origins before launch |

## 6. Verify production

- Run the Playwright suite against the deployed build:
  `npx playwright test` (the `e2e` job does this in CI once §3 is done).
  Note the suite is written for demo mode; pointing `baseURL` at a production
  deployment means supplying real credentials, and the specs that assert on
  seeded demo data will not apply.
- Run the live load test and record real numbers in `load/k6/README.md`
  (see `load/k6/` for the harness + acceptance thresholds).
- Confirm the signed-URL attachment flow against the real bucket (the policies
  are in the schema; the client mints 24h member-scoped URLs).

## 7. Go/no-go

All CI on `main` green, §1–§5 executed, attachments + read receipts + offline
validated against the live deployment, then flip the room `ai_mode` and ship.
