/**
 * "Export my data" (§3 settings → Privacy & data).
 *
 * Serialises everything the signed-in user can *read* into a single JSON
 * document and hands it to the browser as a download. Nothing leaves the
 * device: there is no server endpoint, so there is no new surface that
 * could be induced to email someone else's archive.
 *
 * Scope note, surfaced in the UI as well: in a group room this includes
 * messages written by other members, because that is what the account can
 * see. Attachment *files* are not inlined — only their metadata — since the
 * private bucket is reachable only through short-lived member-scoped signed
 * URLs, and baking expired URLs into an archive would be worse than useless.
 */
import {
  getCurrentProfile,
  listConversations,
  listMembers,
  listMessages,
  listReactions,
} from "./data/api";
import type { Conversation, Message, Profile } from "./types";

export const EXPORT_VERSION = 1;

export interface ExportedAttachment {
  id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ExportedMessage {
  id: string;
  sender_type: Message["sender_type"];
  sender_name: string | null;
  content: string;
  status: Message["status"];
  created_at: string;
  edited_at: string | null;
  attachments: ExportedAttachment[];
  reactions: Array<{ emoji: string; user_id: string; created_at: string }>;
}

export interface ExportedConversation {
  id: string;
  type: Conversation["type"];
  name: string | null;
  topic: string | null;
  ai_mode: Conversation["ai_mode"];
  created_at: string;
  pinned_at: string | null;
  members: Array<{ user_id: string; role: string; display_name: string | null }>;
  messages: ExportedMessage[];
}

export interface DataExport {
  /** Bumped if the shape ever changes, so importers can fail loudly. */
  version: number;
  exported_at: string;
  profile: Pick<Profile, "id" | "display_name" | "theme_pref" | "training_opt_in"> | null;
  conversations: ExportedConversation[];
  notes: string[];
}

/** Filename for the download, e.g. `onyx-export-2026-08-28.json`. */
export function exportFilename(now = new Date()): string {
  return `onyx-export-${now.toISOString().slice(0, 10)}.json`;
}

export async function buildDataExport(): Promise<DataExport> {
  const profile = await getCurrentProfile();
  const conversations = await listConversations();

  const exported: ExportedConversation[] = [];
  for (const c of conversations) {
    const [messages, members, reactions] = await Promise.all([
      listMessages(c.id),
      listMembers(c.id),
      listReactions(c.id),
    ]);

    const nameById = new Map(
      members.map((m) => [m.user_id, m.profile?.display_name ?? null] as const),
    );

    exported.push({
      id: c.id,
      type: c.type,
      name: c.name,
      topic: c.topic,
      ai_mode: c.ai_mode,
      created_at: c.created_at,
      pinned_at: c.pinned_at,
      members: members.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        display_name: m.profile?.display_name ?? null,
      })),
      messages: messages
        .filter((m) => !m.deleted_at)
        .map((m) => ({
          id: m.id,
          sender_type: m.sender_type,
          sender_name: m.sender_id ? (nameById.get(m.sender_id) ?? null) : null,
          content: m.content,
          status: m.status,
          created_at: m.created_at,
          edited_at: m.edited_at,
          attachments: (m.attachments ?? []).map((a) => ({
            id: a.id,
            storage_path: a.storage_path,
            mime_type: a.mime_type,
            size_bytes: a.size_bytes,
            created_at: a.created_at,
          })),
          reactions: reactions
            .filter((r) => r.message_id === m.id)
            .map((r) => ({ emoji: r.emoji, user_id: r.user_id, created_at: r.created_at })),
        })),
    });
  }

  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    profile: profile
      ? {
          id: profile.id,
          display_name: profile.display_name,
          theme_pref: profile.theme_pref,
          training_opt_in: profile.training_opt_in,
        }
      : null,
    conversations: exported,
    notes: [
      "Group rooms include messages written by other members — this export covers everything your account can read.",
      "Attachment files are not included; only their metadata. Re-download them from the conversation.",
      "Moderation verdicts and AI usage logs are service-role-only and are not part of a personal export.",
    ],
  };
}

/**
 * Hand the export to the browser. Uses an object URL and a synthetic click
 * so the whole thing stays client-side — no endpoint, no upload.
 */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before reclaiming.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
