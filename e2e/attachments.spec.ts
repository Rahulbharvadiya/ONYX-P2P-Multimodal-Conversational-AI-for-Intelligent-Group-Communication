import { test } from "@playwright/test";
import { expect, gotoDashboard, startAiChat, composer, messageLog } from "./helpers";

/**
 * Attachment flow (§19/§35). Demo mode stores uploaded file object URLs and
 * surfaces them as attachment chips on the message.
 *
 * We attach a small PNG-ish file through the composer's file input and assert
 * the chip appears in the message log. Browser axe + real Supabase Storage
 * verification happens in the CI e2e job / a deployed project.
 */
test("attachments: a file attached to a message is shown as a chip", async ({ page }) => {
  await gotoDashboard(page);
  await startAiChat(page);

  // 1x1 transparent PNG bytes.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
    "base64",
  );

  // Attach via the hidden input.
  await page.getByTestId("attachment-input").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: png,
  });

  // Fill and send the message.
  await composer(page).fill("Here's an image");
  await composer(page).press("Enter");

  // The attachment chip should render with the file name + a size label.
  await expect(messageLog(page)).toContainText("pixel.png");
  await expect(messageLog(page)).toContainText(/B$|kB|MB/);
});
