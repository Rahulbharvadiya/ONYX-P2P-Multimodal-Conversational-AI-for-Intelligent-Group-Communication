# Security & privacy

This document records the security posture of ONYX and the audit performed
on the current `main`, so claims are verifiable rather than assumed.

## Secrets

- The AI provider key (`OPENROUTER_API_KEY`) is **server-only**. It is read in
  the Edge Functions via `Deno.env.get(...)` and never logged or returned. The
  browser only ever sees `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (the public anon key, safe to expose).
- The `SUPABASE_SERVICE_ROLE_KEY` is used **only** inside `invite-consume`/
  `ai-orchestrator`/`moderation-check` via `supabase/functions/_shared/supabase.ts`;
  it bypasses RLS by design and is never shipped to the client.
- Client-side `.env*` files are gitignored; only `.env.example` (placeholders)
  is committed.
- A repository-wide scan for `sk-ant-`, `sk-or-`, `service_role`,
  `BEGIN ... PRIVATE KEY`, JWTs and hardcoded keys found **no committed real
  secrets** — only documentation placeholders and a synthetic test fixture in
  `tests/moderation-fail-closed.test.ts` (which exercises the credential-leak
  classifier on purpose).

## Authorization / RLS

- RLS is enabled on **every** user-accessible table; membership is enforced by
  `is_conversation_member()` policies on `conversations`, `messages`,
  `reactions`, `message_attachments`.
- Admin actions are gated by `is_conversation_admin()` (owner/admin).
- **Membership cannot be minted by a client.** `conversation_members` INSERT is
  admin-only; rows come from `create_conversation()` (SECURITY DEFINER) and the
  `invite-consume` Edge Function (service_role). The previous policy's
  `user_id = auth.uid()` disjunct let any authenticated user join any
  conversation whose UUID they knew, which made every other policy decorative.
- **No self role escalation.** A member may update their own membership row
  (`last_read_at`, `pinned_at`) but the self-update policy pins `role` to its
  pre-update value; changing a role requires `is_conversation_admin()`.
- **No assistant impersonation.** `messages` UPDATE carries
  `with check (sender_id = auth.uid() and sender_type = 'human')`, so an author
  cannot re-author their own row as the assistant. AI rows are written by the
  orchestrator with service_role, which bypasses RLS by design.
- **`profiles` is not enumerable.** SELECT is limited to yourself plus the
  people you share a conversation with, rather than every authenticated user.
- **Reactions are membership-scoped** on insert, not just on read.
- Audit tables (`moderation_events`, `rate_limit_events`, `ai_usage_log`) have
  RLS **enabled with zero policies** → unreachable from `anon`/`authenticated`;
  only `service_role` (inside Edge Functions) can touch them.
- Invite redemption goes through the `invite-consume` Edge Function
  (`service_role`), so the client has no direct RLS path to an invite for a
  room it has not joined.
- Storage (private attachments) policies mirror the same membership checks;
  access is via signed URLs only. (Upload UI is not yet implemented.)

## Input / output handling

- Markdown is rendered with `react-markdown` **without** `rehypeRaw` — raw HTML
  in message bodies is escaped, not executed. Links get `rel="noopener
  noreferrer"`. The only `dangerouslySetInnerHTML` is the trusted, inlined theme
  script in the root layout.
- **Moderation fails closed.** If the classifier cannot confirm a verdict an
  `error_failed_closed` block is emitted and the request is **not** routed to
  the model (both pre- and post-generation). This is covered by
  `tests/moderation-fail-closed.test.ts`.
- **Training consent is conservative.** AI training routing requires *unanimous*
  opt-in: every current member must have `profiles.training_opt_in = true`. Any
  opt-out, missing record, failed read or count mismatch disables routing.
- Edge Functions validate the caller's membership, rate-limit, and never return
  stack traces / provider secrets; errors map to safe `detail` strings. Provider
  and Postgres error text is written to the function logs and replaced by a
  generic message in the response.
- **`?next=` is not an open redirect.** `safeInternalPath()` collapses any
  caller-supplied redirect target to a same-origin path (rejecting absolute
  URLs, protocol-relative `//host`, backslash variants, encoded forms and
  control characters) at `/login`, the OAuth buttons and `/auth/callback`.
- **Rate limiting is enforced in the database** for the two limits that clients
  can reach without an Edge Function: `BEFORE INSERT` triggers cap messages at
  30/minute per sender and invites at 20/hour per creator. AI invocations
  (10/min) and moderation checks (60/min) are Edge Function counters.

## Secrets in outbound requests

- The only outbound credentialed call is the orchestrator's request to the
  model provider (OpenRouter's OpenAI-compatible Chat Completions API), using
  `OPENROUTER_API_KEY` read via `Deno.env.get` at module scope. If the provider
  returns an error, its body is logged server-side and **not** forwarded —
  upstream error text can echo request headers. Mid-stream provider errors
  (SSE `error` frames) are also logged server-side only; the client receives a
  generic failure.
- `TRAINING_PIPELINE_TOKEN` and `MODERATION_WEBHOOK_TOKEN` are optional and
  read the same way; the training sink is a no-op unless
  `TRAINING_PIPELINE_URL` is set and every member has opted in.

## Known open items (owner/config)

These are **not** code defects but require owner-held credentials or a
workflow-permitted push. The first two were re-verified on 2026-08-28.

1. **`.github/workflows/*` push permission.** The GitHub App used for pushes
   lacks the `workflows` permission, so it cannot write workflow files —
   confirmed server-side again on 2026-08-28 (session
   `arena/01a04990-group-chatbot`) with a real rejected push: "refusing to
   allow a GitHub App to create or update workflow … without `workflows`
   permission". The Playwright CI activation (e2e job + contrast step + action
   bumps) is therefore **not in the branch**; the byte-identical change ships
   as `ci/patches/ci-playwright-and-contrast.patch` and an owner with the
   `workflows` permission must apply/push it (see `RELEASING.md` §3).

   **Consequence worth stating plainly:** because CI has no `e2e` job and
   Chromium cannot be installed in the agent sandbox, the 31 Playwright tests
   in `e2e/` have never been executed. They are committed, type-checked and
   collected — nothing more.
2. **gitleaks fails on `pull_request` runs — this is not a secret finding.**
   `actions/checkout@v4` and `gitleaks/gitleaks-action@v2` target Node 20,
   which GitHub deprecated (2025-09-19) and now forces onto Node 24.

   **Evidence (2026-08-28, this branch):** for head `8032f07` the
   `pull_request` run's `Secret scan (gitleaks)` job *fails* while the
   `push` run's identical job on the **same tree** *succeeds* — the same
   content cannot both contain and not contain a secret. Corroborated by
   three independent sources: GitGuardian ("11 commits were scanned
   without uncovering any secrets"), a local entropy scan of every added
   line (no high-entropy token that is not a branch name or an identifier),
   and the identical outcome on PR #11 (run `33175850610` failed, its push
   sibling `33175833909` passed).

   The job fails in ~8 s, i.e. before a scan could complete, and the
   workflow emits the `Node.js 20 is deprecated … forced to run on Node.js
   24` annotation. Treat any red gitleaks **PR** job as this defect until
   the patch lands; treat a red gitleaks **push** job as a real finding.

   The bump to `actions/checkout@v5` / `setup-node@v5` /
   `gitleaks/gitleaks-action@v3` is included in
   `ci/patches/ci-playwright-and-contrast.patch` (owner push, see item 1).
3. **Release secrets.** `release.yml` fails until the owner sets
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`,
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (see `ci/README.md`).
4. **AI provider key.** `supabase secrets set OPENROUTER_API_KEY=sk-or-...`
   (server-side, never in source control).
5. **CORS on the Edge Functions.** `ALLOWED_ORIGINS` defaults to `*`. The
   functions require a Bearer JWT (stored in `localStorage`, not a cookie, so
   no ambient-authority exposure), but before launch set it to your real
   origins: `supabase secrets set ALLOWED_ORIGINS=https://your-domain.com`.
6. **Auth-attempt rate limiting per IP.** Not enforceable from application
   code: it lives in Supabase Auth (Dashboard → Auth → Rate Limits, plus
   CAPTCHA / signup protection) and at the edge in front of the app. The
   application-side limits that *are* in the repo are per-user, not per-IP.
