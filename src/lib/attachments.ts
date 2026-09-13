/**
 * Attachment helpers (§19/§35: private, member-scoped file attachments).
 *
 * Pure functions so the rules are unit-testable and consistent between the
 * composer and the message renderer. The storage/DB wiring lives in
 * `data/api.ts`; these only decide *what is allowed* and *how it displays*.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Conservative allowlist. SVG is deliberately excluded: it can embed scripts
// and would be served back raw, so a malicious SVG could execute on read.
const ALLOWED_MIME: Record<string, boolean> = {
  "image/png": true,
  "image/jpeg": true,
  "image/gif": true,
  "image/webp": true,
  "image/avif": true,
  "application/pdf": true,
  "text/plain": true,
  "text/markdown": true,
  "text/csv": true,
  "application/json": true,
  "audio/mpeg": true,
  "audio/ogg": true,
  "audio/wav": true,
  "video/mp4": true,
  "video/webm": true,
};

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export type AttachmentVerdict =
  | { ok: true; mime: string; size: number }
  | { ok: false; error: string };

/** Validate an attachment candidate, returning a normalized mime + size. */
export function validateAttachmentFile(file: FileLike): AttachmentVerdict {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Files must be 10 MB or smaller." };
  }
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME[mime]) {
    return { ok: false, error: "That file type isn't supported." };
  }
  return { ok: true, mime, size: file.size };
}

/**
 * Storage path convention used by the RLS policies:
 *   {conversation_id}/{message_id}/{filename}
 * The policies read `(storage.foldername(name))[1]` as the conversation id, so
 * this exact shape is required for a member to be able to upload/read.
 */
export function attachmentStoragePath(
  conversationId: string,
  messageId: string,
  filename: string,
): string {
  const safe = filename.replace(/[/\\]/g, "_").slice(0, 200);
  return `${conversationId}/${messageId}/${safe}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

/** A short human label for an attachment, e.g. "photo.png · 240 kB". */
export function attachmentLabel(name: string, sizeBytes: number): string {
  return `${name} · ${formatFileSize(sizeBytes)}`;
}
