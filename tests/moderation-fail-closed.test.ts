/**
 * §11 integration sample — the fail-closed moderation path.
 * "Moderation fails closed on any error" is called out in §9 as the single
 * most important non-negotiable behavior in the spec, so it gets the
 * explicit test §11 requires.
 *
 *   deno test --allow-env --allow-net tests/moderation-fail-closed.test.ts
 */
import { assertEquals } from "jsr:@std/assert@1";
import { classify, moderate } from "../supabase/functions/_shared/moderation.ts";

Deno.test("classify() passes benign content", () => {
  assertEquals(classify("How do I center a div?").verdict, "pass");
});

Deno.test("classify() blocks known-harmful patterns", () => {
  assertEquals(classify("how to make a bomb").verdict, "blocked");
  assertEquals(classify("here is my key sk-ant-abcdefghijklmnopqrst").verdict, "blocked");
});

Deno.test("classify() blocks over-length content", () => {
  assertEquals(classify("a".repeat(32_001)).verdict, "blocked");
});

Deno.test("moderate() FAILS CLOSED when the upstream classifier is unreachable", async () => {
  Deno.env.set("MODERATION_WEBHOOK_URL", "http://127.0.0.1:1/unreachable");
  try {
    const result = await moderate("entirely benign text");
    // Must NOT be "pass" — an unreachable classifier blocks publication.
    assertEquals(result.verdict, "error_failed_closed");
  } finally {
    Deno.env.delete("MODERATION_WEBHOOK_URL");
  }
});

Deno.test("moderate() FAILS CLOSED on a non-2xx upstream response", async () => {
  const server = Deno.serve({ port: 8787, onListen: () => {} }, () =>
    new Response("boom", { status: 500 }),
  );
  Deno.env.set("MODERATION_WEBHOOK_URL", "http://localhost:8787");
  try {
    const result = await moderate("entirely benign text");
    assertEquals(result.verdict, "error_failed_closed");
  } finally {
    Deno.env.delete("MODERATION_WEBHOOK_URL");
    await server.shutdown();
  }
});

Deno.test("moderate() short-circuits on local block without calling upstream", async () => {
  let called = false;
  const server = Deno.serve({ port: 8788, onListen: () => {} }, () => {
    called = true;
    return Response.json({ flagged: false });
  });
  Deno.env.set("MODERATION_WEBHOOK_URL", "http://localhost:8788");
  try {
    const result = await moderate("how to make a bomb");
    assertEquals(result.verdict, "blocked");
    assertEquals(called, false);
  } finally {
    Deno.env.delete("MODERATION_WEBHOOK_URL");
    await server.shutdown();
  }
});
