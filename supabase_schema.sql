-- =====================================================================
-- AI Chat Platform — Supabase Schema (v2.0)
-- Paste this entire file into the Supabase SQL Editor on a fresh
-- project and run it top to bottom, OR save it as a migration and
-- run `supabase db push`. Idempotent: uses IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS throughout, so it is safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_net";        -- optional: webhook calls from triggers
-- create extension if not exists "vector";      -- uncomment for P2 semantic search (pgvector)

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
do $$ begin
  create type conversation_type as enum ('direct_ai', 'group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sender_type as enum ('human', 'ai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_status as enum ('sent', 'streaming', 'error', 'blocked', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_mode as enum ('off', 'mention_only', 'auto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_stage as enum ('pre', 'post');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_verdict as enum ('pass', 'blocked', 'error_failed_closed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. PROFILES  (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default 'New User',
  avatar_url        text,
  theme_pref        text not null default 'system' check (theme_pref in ('light','dark','system')),
  training_opt_in   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, training_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    -- §8: defaults OFF. Only an explicit true at signup opts in.
    coalesce((new.raw_user_meta_data->>'training_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. CONVERSATIONS  (shared model for 1:1 AI chat and group rooms)
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  type          conversation_type not null,
  name          text,                       -- null for direct_ai (derive from participants client-side)
  topic         text,
  ai_mode       ai_mode not null default 'auto',   -- direct_ai conversations effectively always 'auto'
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  archived_at   timestamptz
);

create table if not exists public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  role             member_role not null default 'member',
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz,
  primary key (conversation_id, user_id)
);

-- §3 pinned conversations: the pin is a per-member preference, so it lives
-- on the membership row, not on the conversation. NULL = not pinned.
alter table public.conversation_members add column if not exists pinned_at timestamptz;

create index if not exists idx_conv_members_user on public.conversation_members(user_id);
create index if not exists idx_conv_members_conv on public.conversation_members(conversation_id);

-- ---------------------------------------------------------------------
-- 4. MESSAGES
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  sender_id         uuid references public.profiles(id),   -- null when sender_type = 'ai'
  sender_type       sender_type not null default 'human',
  content           text not null default '',
  content_format    text not null default 'markdown',
  status            message_status not null default 'sent',
  supersedes_id     uuid references public.messages(id),   -- regenerate() chain
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz
);

create index if not exists idx_messages_conv_created on public.messages(conversation_id, created_at desc);
create index if not exists idx_messages_sender on public.messages(sender_id);

-- full-text search index (P1 global search)
alter table public.messages add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;
create index if not exists idx_messages_search on public.messages using gin(content_tsv);

create table if not exists public.message_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.messages(id) on delete cascade,
  storage_path  text not null,
  mime_type     text not null,
  size_bytes    bigint not null,
  created_at    timestamptz not null default now()
);

-- P1
create table if not exists public.reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- ---------------------------------------------------------------------
-- 5. INVITES
-- ---------------------------------------------------------------------
create table if not exists public.invites (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  code              text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by        uuid not null references public.profiles(id),
  expires_at        timestamptz not null default (now() + interval '7 days'),
  max_uses          int not null default 50,
  uses              int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_invites_code on public.invites(code);

-- ---------------------------------------------------------------------
-- 6. MODERATION + RATE LIMITING + AI USAGE LOG
-- ---------------------------------------------------------------------
create table if not exists public.moderation_events (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.messages(id) on delete cascade,
  stage       moderation_stage not null,
  verdict     moderation_verdict not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.rate_limit_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  bucket       text not null,           -- e.g. 'messages_per_min', 'ai_invocations_per_min'
  window_start timestamptz not null,
  count        int not null default 1,
  unique (user_id, bucket, window_start)
);

create table if not exists public.ai_usage_log (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  message_id       uuid references public.messages(id) on delete set null,
  model            text not null,
  input_tokens     int,
  output_tokens    int,
  latency_ms       int,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. HELPER FUNCTIONS (used by RLS policies)
-- ---------------------------------------------------------------------
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_admin(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id
      and user_id = p_user_id
      and role in ('owner','admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 8. updated_at TRIGGER HELPER
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.messages              enable row level security;
alter table public.message_attachments   enable row level security;
alter table public.reactions             enable row level security;
alter table public.invites               enable row level security;
alter table public.moderation_events     enable row level security;
alter table public.rate_limit_events     enable row level security;
alter table public.ai_usage_log          enable row level security;

-- PROFILES: you, plus the people you share a conversation with (that is the
-- only place another member's name/avatar is ever rendered). Deliberately
-- narrower than "any authenticated user reads every profile" — with the
-- latter, enumerating `profiles` leaks the whole user base.
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own_or_member" on public.profiles;
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
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
-- Fallback for the (rare) case where the auth trigger did not fire.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- CONVERSATIONS: visible only to members; insert allowed to any authenticated user
-- (they become owner via a follow-up conversation_members insert, see below);
-- update/delete restricted to admins/owners.
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member" on public.conversations
  for select using (public.is_conversation_member(id, auth.uid()));
drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated" on public.conversations
  for insert with check (auth.uid() = created_by);
drop policy if exists "conversations_update_admin" on public.conversations;
create policy "conversations_update_admin" on public.conversations
  for update using (public.is_conversation_admin(id, auth.uid()));
drop policy if exists "conversations_delete_admin" on public.conversations;
create policy "conversations_delete_admin" on public.conversations
  for delete using (public.is_conversation_admin(id, auth.uid()));

-- CONVERSATION_MEMBERS: visible to other members of the same conversation;
-- a user may delete their own membership (leave) or an admin may remove others.
drop policy if exists "members_select_same_conversation" on public.conversation_members;
create policy "members_select_same_conversation" on public.conversation_members
  for select using (public.is_conversation_member(conversation_id, auth.uid()));

-- INSERT is admin-only on purpose.
-- Membership is the single authorization primitive in this schema, so a
-- client that can insert its own membership row can join any conversation
-- whose id it knows — which would make every other policy here decorative.
-- Membership rows are minted by create_conversation() (SECURITY DEFINER,
-- adds the owner) and by the invite-consume Edge Function (service_role,
-- after the code is validated). Never by the client.
drop policy if exists "members_insert_self_or_admin" on public.conversation_members;
drop policy if exists "members_insert_admin" on public.conversation_members;
create policy "members_insert_admin" on public.conversation_members
  for insert with check (public.is_conversation_admin(conversation_id, auth.uid()));

drop policy if exists "members_delete_self_or_admin" on public.conversation_members;
create policy "members_delete_self_or_admin" on public.conversation_members
  for delete using (
    user_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid())
  );

-- UPDATE is split in two. A member must be able to write their own row
-- (last_read_at via mark_read(), pinned_at for pinned conversations), but a
-- single permissive `using (user_id = auth.uid() or is_conversation_admin(...))`
-- with no WITH CHECK lets Postgres reuse USING as the check — i.e. any member
-- could set their own role to 'owner'. The self policy therefore pins `role`
-- to its pre-update value; role changes require the admin policy.
drop policy if exists "members_update_admin" on public.conversation_members;
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

-- MESSAGES: visible to conversation members; insertable by a member as themselves
-- (human) — AI-authored rows are inserted by the ai-orchestrator Edge Function using
-- the service_role key, which bypasses RLS by design (never exposed to the client).
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select using (public.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert with check (
    sender_type = 'human'
    and sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );
-- The WITH CHECK keeps an author from re-authoring their row as the
-- assistant (sender_type = 'ai'), which would otherwise render as an
-- AI bubble inside the room. The orchestrator writes AI rows with
-- service_role and bypasses RLS, so this only constrains clients.
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update
  using (sender_id = auth.uid() and sender_type = 'human')
  with check (sender_id = auth.uid() and sender_type = 'human');

-- MESSAGE_ATTACHMENTS: visible/insertable if you can see the parent message.
drop policy if exists "attachments_select_member" on public.message_attachments;
create policy "attachments_select_member" on public.message_attachments
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );
drop policy if exists "attachments_insert_member" on public.message_attachments;
create policy "attachments_insert_member" on public.message_attachments
  for insert with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
        and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- REACTIONS
drop policy if exists "reactions_select_member" on public.reactions;
create policy "reactions_select_member" on public.reactions
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );
-- Membership matters here: without it, `user_id = auth.uid()` alone lets a
-- caller react to (and thereby confirm the existence/content of) any message
-- whose id it knows, in a conversation it does not belong to.
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
drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions
  for delete using (user_id = auth.uid());

-- INVITES: only conversation admins can view/create invites for their conversation;
-- consumption happens via the invite-consume Edge Function (service_role), not directly by the client.
drop policy if exists "invites_select_admin" on public.invites;
create policy "invites_select_admin" on public.invites
  for select using (public.is_conversation_admin(conversation_id, auth.uid()));
drop policy if exists "invites_insert_admin" on public.invites;
create policy "invites_insert_admin" on public.invites
  for insert with check (public.is_conversation_admin(conversation_id, auth.uid()));

-- MODERATION_EVENTS / RATE_LIMIT_EVENTS / AI_USAGE_LOG: service-role only (no client policies) —
-- RLS is enabled with zero policies, which means these tables are inaccessible via
-- the anon/authenticated PostgREST roles entirely; only the service_role (used inside
-- Edge Functions) can read/write them, since service_role bypasses RLS.

-- ---------------------------------------------------------------------
-- 9b. RPCs used by the client
-- ---------------------------------------------------------------------

-- Create a conversation AND the owner membership row atomically, so a client
-- can never strand a conversation it cannot see (RLS select requires membership).
create or replace function public.create_conversation(
  p_type conversation_type,
  p_name text default null,
  p_topic text default null,
  p_ai_mode ai_mode default 'auto'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.conversations (type, name, topic, ai_mode, created_by)
  values (p_type, p_name, p_topic,
          case when p_type = 'direct_ai' then 'auto'::ai_mode else p_ai_mode end,
          v_uid)
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return v_id;
end;
$$;

-- Global full-text search across every message the caller can see.
create or replace function public.search_messages(p_query text, p_limit int default 40)
returns table (
  message_id uuid,
  conversation_id uuid,
  conversation_name text,
  conversation_type conversation_type,
  sender_id uuid,
  sender_type sender_type,
  content text,
  created_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.conversation_id, c.name, c.type, m.sender_id, m.sender_type,
         m.content, m.created_at,
         ts_rank(m.content_tsv, websearch_to_tsquery('english', p_query)) as rank
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.deleted_at is null
    and m.content_tsv @@ websearch_to_tsquery('english', p_query)
    and public.is_conversation_member(m.conversation_id, auth.uid())
  order by rank desc, m.created_at desc
  limit least(coalesce(p_limit, 40), 100);
$$;

-- Mark a conversation read for the calling user.
create or replace function public.mark_read(p_conversation_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
$$;

-- Redeem an invite code to join a conversation.
-- Runs security definer so non-members can validate codes and be granted membership.
create or replace function public.consume_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
  v_conv record;
  v_already boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select id, conversation_id, expires_at, max_uses, uses
  into v_invite
  from public.invites
  where lower(trim(code)) = lower(trim(p_code));

  if not found then
    return jsonb_build_object('error', 'invite_not_found');
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('error', 'invite_expired');
  end if;

  if v_invite.uses >= v_invite.max_uses then
    return jsonb_build_object('error', 'invite_exhausted');
  end if;

  if exists (
    select 1 from public.conversation_members
    where conversation_id = v_invite.conversation_id and user_id = v_uid
  ) then
    v_already := true;
  else
    insert into public.conversation_members (conversation_id, user_id, role)
    values (v_invite.conversation_id, v_uid, 'member');

    update public.invites
    set uses = uses + 1
    where id = v_invite.id;
  end if;

  select id, name, type, topic
  into v_conv
  from public.conversations
  where id = v_invite.conversation_id;

  return jsonb_build_object(
    'ok', true,
    'conversation', row_to_json(v_conv),
    'already_member', v_already
  );
end;
$$;

grant execute on function public.create_conversation(conversation_type, text, text, ai_mode) to authenticated;
grant execute on function public.search_messages(text, int) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.consume_invite(text) to authenticated;

-- ---------------------------------------------------------------------
-- 9c. RATE LIMITS ENFORCED IN THE DATABASE
-- ---------------------------------------------------------------------
-- The Edge Functions enforce `ai_invocations_per_min`. The other two
-- documented limits (30 messages/min, 20 invites/hour) are enforced here,
-- with BEFORE INSERT triggers, so they hold on *every* write path —
-- including direct PostgREST writes that never reach an Edge Function.
--
-- Both triggers are SECURITY DEFINER (the counter query must not itself be
-- filtered by the caller's RLS) and both skip service_role / AI rows, so the
-- orchestrator's own bookkeeping never trips them.

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

-- ---------------------------------------------------------------------
-- 10. REALTIME PUBLICATION
-- ---------------------------------------------------------------------
-- Ensure the tables the frontend subscribes to (via postgres_changes) are in the
-- supabase_realtime publication. (Broadcast/Presence channels used for chat/typing
-- do not require this, but row-level change feeds for conversation_members and
-- messages benefit from it as a fallback/complement to broadcast.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'conversation_members'
  ) then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'reactions'
  ) then
    alter publication supabase_realtime add table public.reactions;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 11. STORAGE BUCKETS + POLICIES
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- avatars: public read, owner-only write (path convention: {user_id}/{filename})
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- attachments: private, only conversation members may read/write
-- (path convention: {conversation_id}/{message_id}/{filename})
drop policy if exists "attachments_member_read" on storage.objects;
create policy "attachments_member_read" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
drop policy if exists "attachments_member_write" on storage.objects;
create policy "attachments_member_write" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 12. ADMIN ANALYTICS VIEWS (P2 — defined now, RLS-safe: no client policy = service_role only)
-- ---------------------------------------------------------------------
create or replace view public.v_daily_message_volume as
select date_trunc('day', created_at) as day, sender_type, count(*) as message_count
from public.messages
group by 1, 2
order by 1 desc;

create or replace view public.v_ai_usage_by_room as
select conversation_id, count(*) as ai_messages, sum(coalesce(input_tokens,0)) as total_input_tokens,
       sum(coalesce(output_tokens,0)) as total_output_tokens, avg(latency_ms) as avg_latency_ms
from public.ai_usage_log
group by conversation_id;

create or replace view public.v_moderation_block_rate as
select stage, verdict, count(*) as event_count
from public.moderation_events
group by 1, 2;

-- =====================================================================
-- END OF SCHEMA
-- After running this file:
--   1. In Supabase Dashboard > Authentication, enable Email + Google providers.
--   2. Run: supabase secrets set OPENROUTER_API_KEY=sk-or-...
--   3. Deploy edge functions: supabase functions deploy ai-orchestrator
--      moderation-check invite-consume
--   4. Confirm RLS is ON for every table above (Dashboard > Table Editor
--      shows a shield icon) before going to production.
-- =====================================================================
