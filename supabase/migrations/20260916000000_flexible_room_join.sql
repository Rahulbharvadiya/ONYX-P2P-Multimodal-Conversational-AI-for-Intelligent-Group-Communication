-- Migration: 20260916000000_flexible_room_join.sql
-- Upgrades consume_invite to support invite codes, room URLs, room UUIDs, and room names.
-- Adds list_discoverable_rooms() for seamless 1-click group room discovery.

-- 1. Upgrade consume_invite to support invite codes, room IDs, and room names
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
  v_conv_id uuid;
  v_already boolean := false;
  v_clean text := lower(trim(p_code));
  v_is_uuid boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if v_clean is null or length(v_clean) = 0 then
    return jsonb_build_object('error', 'invite_not_found');
  end if;

  -- 1. Check if p_code matches an invite code
  select id, conversation_id, expires_at, max_uses, uses
  into v_invite
  from public.invites
  where lower(trim(code)) = v_clean;

  if found then
    if v_invite.expires_at < now() then
      return jsonb_build_object('error', 'invite_expired');
    end if;

    if v_invite.uses >= v_invite.max_uses then
      return jsonb_build_object('error', 'invite_exhausted');
    end if;

    v_conv_id := v_invite.conversation_id;

    update public.invites
    set uses = uses + 1
    where id = v_invite.id;
  else
    -- 2. If not an invite code, check if p_code is a conversation ID (UUID) or room name
    v_is_uuid := v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    if v_is_uuid then
      select id into v_conv_id
      from public.conversations
      where id = v_clean::uuid and type = 'group' and archived_at is null;
    end if;

    if v_conv_id is null then
      select id into v_conv_id
      from public.conversations
      where lower(trim(name)) = v_clean and type = 'group' and archived_at is null
      order by created_at desc
      limit 1;
    end if;

    if v_conv_id is null then
      return jsonb_build_object('error', 'invite_not_found');
    end if;
  end if;

  -- Check if already a member
  if exists (
    select 1 from public.conversation_members
    where conversation_id = v_conv_id and user_id = v_uid
  ) then
    v_already := true;
  else
    insert into public.conversation_members (conversation_id, user_id, role)
    values (v_conv_id, v_uid, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end if;

  select id, name, type, topic, ai_mode, created_by, created_at, archived_at
  into v_conv
  from public.conversations
  where id = v_conv_id;

  return jsonb_build_object(
    'ok', true,
    'conversation', row_to_json(v_conv),
    'already_member', v_already
  );
end;
$$;

grant execute on function public.consume_invite(text) to authenticated;

-- 2. Function to list discoverable group rooms for authenticated users
create or replace function public.list_discoverable_rooms()
returns table (
  id uuid,
  name text,
  topic text,
  type conversation_type,
  ai_mode ai_mode,
  created_by uuid,
  created_at timestamptz,
  archived_at timestamptz,
  member_count bigint,
  invite_code text,
  is_member boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.topic,
    c.type,
    c.ai_mode,
    c.created_by,
    c.created_at,
    c.archived_at,
    (select count(*) from public.conversation_members cm where cm.conversation_id = c.id) as member_count,
    (select i.code from public.invites i where i.conversation_id = c.id order by i.created_at desc limit 1) as invite_code,
    exists(select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = auth.uid()) as is_member
  from public.conversations c
  where c.type = 'group' and c.archived_at is null
  order by c.created_at desc
  limit 30;
$$;

grant execute on function public.list_discoverable_rooms() to authenticated;
