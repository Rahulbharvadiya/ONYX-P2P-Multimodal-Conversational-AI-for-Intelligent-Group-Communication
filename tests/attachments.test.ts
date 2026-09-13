import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  attachmentStoragePath,
  formatFileSize,
  isImageMime,
  validateAttachmentFile,
} from "@/lib/attachments";

describe("validateAttachmentFile", () => {
  it("accepts an allowed image within the size limit", () => {
    const v = validateAttachmentFile({ name: "p.png", size: 1024, type: "image/png" });
    expect(v).toEqual({ ok: true, mime: "image/png", size: 1024 });
  });

  it("rejects empty files", () => {
    const v = validateAttachmentFile({ name: "x.png", size: 0, type: "image/png" });
    expect(v.ok).toBe(false);
  });

  it("rejects files over the size limit", () => {
    const v = validateAttachmentFile({ name: "big.png", size: MAX_FILE_BYTES + 1, type: "image/png" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/10 MB/);
  });

  it("rejects unsupported types (svg is deliberately excluded)", () => {
    const v = validateAttachmentFile({ name: "x.svg", size: 100, type: "image/svg+xml" });
    expect(v.ok).toBe(false);
  });

  it("normalises mime type case", () => {
    const v = validateAttachmentFile({ name: "x.PDF", size: 100, type: "Application/PDF" });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.mime).toBe("application/pdf");
  });

  it("accepts markdown and pdf", () => {
    expect(validateAttachmentFile({ name: "n.md", size: 5, type: "text/markdown" }).ok).toBe(true);
    expect(validateAttachmentFile({ name: "n.pdf", size: 5, type: "application/pdf" }).ok).toBe(true);
  });
});

describe("attachmentStoragePath", () => {
  it("uses the {conversation}/{message}/{filename} convention required by RLS", () => {
    expect(attachmentStoragePath("conv", "msg", "photo.png")).toBe("conv/msg/photo.png");
  });

  it("strips path separators from the filename", () => {
    expect(attachmentStoragePath("conv", "msg", "../../etc/passwd")).toBe("conv/msg/.._.._etc_passwd");
  });
});

describe("display helpers", () => {
  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 kB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("detects image mimes", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
  });
});
