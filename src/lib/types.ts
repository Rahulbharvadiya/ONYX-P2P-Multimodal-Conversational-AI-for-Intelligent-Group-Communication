export type ConversationType = "direct_ai" | "group";
export type MemberRole = "owner" | "admin" | "member";
export type SenderType = "human" | "ai";
export type MessageStatus = "sent" | "streaming" | "error" | "blocked" | "superseded";
export type AiMode = "off" | "mention_only" | "auto";
export type ThemePref = "light" | "dark" | "system";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  theme_pref: ThemePref;
  training_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  topic: string | null;
  ai_mode: AiMode;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  last_read_at: string | null;
  /** §3 pinned conversations — a per-member preference. NULL = not pinned. */
  pinned_at: string | null;
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: SenderType;
  content: string;
  content_format: string;
  status: MessageStatus;
  trigger_message_id?: string | null;
  supersedes_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  /** Attachments attached to this message (private, member-scoped). */
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Invite {
  id: string;
  conversation_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  uses: number;
  created_at: string;
}

export interface ConversationSummary extends Conversation {
  member_count: number;
  last_message: Pick<Message, "content" | "created_at" | "sender_type"> | null;
  unread: number;
  /** Mirrors the caller's conversation_members.pinned_at. */
  pinned_at: string | null;
}

export interface SearchHit {
  message_id: string;
  conversation_id: string;
  conversation_name: string | null;
  conversation_type: ConversationType;
  sender_id: string | null;
  sender_type: SenderType;
  content: string;
  created_at: string;
  rank: number;
}
