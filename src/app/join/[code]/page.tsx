"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, DoorOpen, LogIn, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { consumeInvite } from "@/lib/data/api";

const ERROR_MESSAGES: Record<string, string> = {
  invite_not_found: "This invite code doesn't match any room, or the room was deleted.",
  invite_expired: "This invite has expired and is no longer valid.",
  invite_exhausted: "This invite has reached its maximum number of uses.",
  not_authenticated: "Please sign in to join this room.",
  code_required: "Please provide a valid invite code.",
};

export default function JoinInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const { code } = use(params);
  const { profile, loading: sessionLoading } = useSession();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedRoom, setJoinedRoom] = useState<{ id: string; name?: string | null } | null>(null);

  const cleanCode = code ? decodeURIComponent(code).trim().toLowerCase() : "";

  const handleJoin = async () => {
    if (!cleanCode) {
      setError("No invite code provided.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { conversation } = await consumeInvite(cleanCode);
      setJoinedRoom(conversation);
      toast.push({
        kind: "success",
        title: `Joined ${conversation.name ?? "the room"}`,
      });
      setTimeout(() => {
        router.push(`/app/c/${conversation.id}`);
      }, 700);
    } catch (e) {
      setLoading(false);
      const key = String((e as Error).message);
      setError(ERROR_MESSAGES[key] ?? "Couldn't redeem this invite code.");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[--bg-canvas] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="brand-logo-dashboard text-[24px] font-bold tracking-[-0.03em] text-[--text-primary]">
              ONYX
            </span>
          </Link>
        </div>

        {/* Join Card */}
        <div className="overflow-hidden rounded-[16px] border border-[--border-color] bg-[--bg-surface] p-6 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.08)] sm:p-8">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[--bg-subtle] text-[--text-primary] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <Users className="h-7 w-7" />
          </div>

          <div className="text-center">
            <h1 className="text-[20px] font-bold tracking-tight text-[--text-primary] sm:text-[22px]">
              Join Group Room
            </h1>
            <p className="mt-2 text-[14px] text-[--text-secondary]">
              You&apos;ve been invited to join a collaborative room on ONYX.
            </p>

            <div className="my-5 inline-flex items-center gap-2 rounded-full border border-[--border-color] bg-[--bg-subtle] px-4 py-1.5 font-mono text-[13px] font-semibold text-[--text-primary]">
              <span className="text-[--text-muted]">Code:</span>
              <span>{cleanCode || "------"}</span>
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-[--r-md] border border-red-500/20 bg-red-500/10 p-3 text-[13px] text-red-600 dark:text-red-400">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {joinedRoom ? (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-[14px] font-semibold text-[--text-primary]">
                Successfully joined {joinedRoom.name ?? "the room"}!
              </p>
              <p className="text-[12px] text-[--text-secondary]">Taking you to the conversation...</p>
            </div>
          ) : sessionLoading ? (
            <div className="py-4 text-center text-[13px] text-[--text-muted]">Checking session...</div>
          ) : !profile ? (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-[--text-muted]">
                Sign in or register to accept this invite.
              </p>
              <Button
                asChild
                href={`/login?next=/join/${encodeURIComponent(cleanCode)}`}
                className="w-full justify-center bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 font-semibold"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign in to join
              </Button>
              <Button
                asChild
                variant="secondary"
                href={`/signup?next=/join/${encodeURIComponent(cleanCode)}`}
                className="w-full justify-center border border-[--border-color] bg-[--bg-surface] text-[--text-primary] hover:bg-[--bg-subtle]"
              >
                Create an account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleJoin}
                loading={loading}
                className="w-full justify-center bg-[--accent-black] text-[--accent-foreground] hover:opacity-90 font-semibold h-11 text-[14px]"
              >
                <DoorOpen className="h-4 w-4 mr-2" />
                Join Room Now
              </Button>
              <Button
                asChild
                variant="ghost"
                href="/app"
                className="w-full justify-center text-[13px] text-[--text-secondary]"
              >
                Back to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}