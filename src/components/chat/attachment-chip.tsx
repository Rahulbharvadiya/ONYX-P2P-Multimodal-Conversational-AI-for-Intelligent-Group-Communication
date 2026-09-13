"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { attachmentUrl } from "@/lib/data/api";
import { attachmentLabel, isImageMime } from "@/lib/attachments";
import type { MessageAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Renders a single message attachment. Resolves the member-scoped signed URL
 * (or the demo object URL) lazily, shows an image thumbnail for images, and a
 * file chip with the name + size for everything else. Opens the attachment in
 * a new tab (target="_blank" + rel="noopener").
 */
export function AttachmentChip({ attachment }: { attachment: MessageAttachment }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void attachmentUrl(attachment.storage_path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [attachment.storage_path]);

  const isImage = isImageMime(attachment.mime_type);

  if (failed) {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-[--r-md] border border-[--border]/70 bg-[--surface]/60 px-2.5 py-1.5 text-[12px] text-[--fg-muted] backdrop-blur-sm transition-opacity duration-[--d-micro]">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {attachmentLabel(attachment.storage_path.split("/").pop() ?? "file", attachment.size_bytes)}
        </span>
        <span className="shrink-0 text-[11px] text-[--fg-subtle]">unavailable</span>
      </span>
    );
  }

  if (isImage && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-fit overflow-hidden rounded-[--r-md] border border-[--border]/70 bg-[--surface]/60 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] backdrop-blur-sm transition-colors duration-[--d-micro] hover:border-[--border-strong] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.storage_path.split("/").pop() ?? "attachment"}
          loading="lazy"
          className="max-h-48 max-w-[16rem] object-cover transition-transform duration-300 group-hover:scale-[1.015]"
        />
        <span className="flex items-center gap-1.5 border-t border-[--border]/60 px-2 py-1 text-[11px] text-[--fg-muted] transition-colors duration-[--d-micro] group-hover:text-[--fg]">
          <Download className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {attachmentLabel(attachment.storage_path.split("/").pop() ?? "file", attachment.size_bytes)}
          </span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={url ? undefined : (e) => e.preventDefault()}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-[--r-md] border border-[--border]/70 bg-[--surface]/60 px-2.5 py-1.5 text-[12px] backdrop-blur-sm transition-all duration-[--d-micro]",
        "hover:border-[--border-strong] hover:bg-[--bg-hover] active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50",
        !url && "cursor-default opacity-70",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[--fg-muted]" />
      <span className="truncate">{attachment.storage_path.split("/").pop()}</span>
      <span className="shrink-0 text-[11px] text-[--fg-subtle]">
        {attachmentLabel("", attachment.size_bytes)}
      </span>
      <Download className="h-3 w-3 shrink-0 text-[--fg-subtle]" />
    </a>
  );
}