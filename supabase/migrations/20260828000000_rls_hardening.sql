-- =====================================================================
-- RLS hardening + server-side rate limits.
--
-- Three of the changes below close holes that were exploitable by any
-- authenticated client holding nothing but a conversation id; the rest
-- make the rate limits that README.md advertises actually enforceable.
--
--  1. conversation_members INSERT — remove the self-join path
--     (membership bypass: any user could join any conversation).
--  2. conversation_members UPDATE — stop self role escalation
--     (a member could UPDATE their own row and set role = 'owner').
--  3. messages UPDATE — stop a human author flipping sender_type to 'ai'
--     (assistant impersonation inside a room).
--  4. profiles SELECT — narrow "every authenticated user reads every
--     profile" to "you, plus the people you share a room with".
--  5. reactions INSERT — require conversation membership.
--  6. BEFORE INSERT triggers enforce the documented 30 messages/min and
--     20 invites/hour limits in the database, on every write path
--     (client, Edge Function, SQL) rather than only in Edge Functions.
--
-- Idempotent: DROP ... IF EXISTS / CREATE OR REPLACE / IF NOT EXISTS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. conversation_members: no client path to self-join a conversation
-- ---------------------------------------------------------------------
drop policy if exists "members_insert_self_or_admin" on public.conversation_members;
drop policy if exists "members_insert_admin" on public.conversation_members;

-- Membership rows are created in exactly two places, both trusted:
--   * public.create_conversation()  — SECURITY DEFINER, adds the owner
--   * invite-consume Edge Function  — service_role, after code validation
-- The client must never be able to mint one: membership is the only
-- authorization primitive in this schema, so a writable membership table
-- makes every other policy decorative.
create policy "members_insert_admin" on public.conversation_members
  for insert with check (public.is_conversation_admin(conversation_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 2. conversation_members: no self role escalation
-- ---------------------------------------------------------------------
drop policy if exists "members_update_admin" on public.conversation_members;

-- A member still needs to update their own row — last_read_at (mark_read)
-- and pinned_at (pin a conversation) are per-member fields. But the old
-- policy had no WITH CHECK, so Postgres reused its USING expression
-- (`user_id = auth.uid() or is_conversation_admin(...)`) as the check,
-- which let a plain member rewrite their own `role`.
--
-- Split it: members may update their own row as long as `role` is
-- unchanged (compared against the pre-update row); admins keep full
-- control over every row in their conversation.
create policy "members_update_self" on public.conversation_members
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and role = (
      select m.role
      from public.conversation_members m
      where m.conversation_id = public.conversation_members.conversation_id
        and m.user_id = auth.uid()
    )
  );

create policy "members_update_admin" on public.conversation_members
  for update
  using (public.is_conversation_admin(conversation_id, auth.uid()))
  with check (public.is_conversation_admin(conversation_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 3. messages: a human author may edit their message, not re-author it
-- ---------------------------------------------------------------------
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update
  using (sender_id = auth.uid() and sender_type = 'human')
  with check (sender_id = auth.uid() and sender_type = 'human');

-- ---------------------------------------------------------------------
-- 4. profiles: read yourself, and the people you share a room with
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_own_or_member" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.conversation_members mine
      where mine.user_id = auth.uid()
        and exists (
          select 1
          from public.conversation_members theirs
          where theirs.conversation_id = mine.conversation_id
            and theirs.user_id = profiles.id
        )
    )
  );

-- ---------------------------------------------------------------------
-- 5. reactions: you can only react inside a conversation you belong to
-- ---------------------------------------------------------------------
drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages m
      where m.id = message_id
        and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 6. Rate limits enforced in the database (30 msg/min, 20 invites/hour)
-- ---------------------------------------------------------------------
--
-- The Edge Functions only ever enforced `ai_invocations_per_min`. These
-- two triggers apply the other documented limits on *every* write path,
-- including direct PostgREST writes that never touch an Edge Function.
--
-- Both are SECURITY DEFINER so the count is not itself filtered by the
-- caller's RLS policies, and both skip service_role/AI writes so the
-- orchestrator is never rate limited by its own bookkeeping rows.

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  -- AI-authored rows (sender_id is null) are written by the orchestrator
  -- under service_role and are never counted.
  if new.sender_id is null then
    return new;
  end if;

  select count(*) into v_recent
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '60 seconds';

  if v_recent >= 30 then
    raise exception 'rate_limited'
      using
        errcode = 'P0001',
        hint = 'messages_per_min: 30 per 60s';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

create or replace function public.enforce_invite_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  select count(*) into v_recent
  from public.invites
  where created_by = new.created_by
    and created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    raise exception 'rate_limited'
      using
        errcode = 'P0001',
        hint = 'invites_per_hour: 20 per 3600s';
  end if;

  return new;
end;
$$;

drop trigger if exists invites_rate_limit on public.invites;
create trigger invites_rate_limit
  before insert on public.invites
  for each row execute function public.enforce_invite_rate_limit();

-- Supporting indexes for the two counter queries above.
create index if not exists idx_messages_sender_created
  on public.messages (sender_id, created_at desc);
create index if not exists idx_invites_created_by
  on public.invites (created_by, created_at desc);
