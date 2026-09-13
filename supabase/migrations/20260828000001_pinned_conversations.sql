-- =====================================================================
-- §3 pinned conversations.
--
-- The pin is a per-member preference (you pin a room in *your* sidebar;
-- nobody else's list changes), so it lives on conversation_members rather
-- than on conversations. NULL = not pinned; the timestamp doubles as the
-- ordering key inside the pinned group.
--
-- No new RLS policy is needed: "members_update_self" (added in
-- 20260828000000_rls_hardening.sql) already lets a member update their own
-- row while pinning `role` to its pre-update value.
-- =====================================================================

alter table public.conversation_members
  add column if not exists pinned_at timestamptz;
