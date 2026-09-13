"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, MessagesSquare, Users } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ThemeSegmented } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { createConversation, updateProfile } from "@/lib/data/api";
import { stepSlide, tEnter, SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STEPS = ["Your profile", "Appearance", "First conversation"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, refresh } = useSession();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [trainingOptIn, setTrainingOptIn] = useState(false);
  const [kind, setKind] = useState<"direct_ai" | "group">("direct_ai");
  const [roomName, setRoomName] = useState("");
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const go = (d: number) => {
    setDir(d);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + d)));
  };

  const next = async () => {
    if (step === 0) {
      if (name.trim().length < 2) {
        setErrors({ name: "Use at least 2 characters." });
        return;
      }
      setErrors({});
      await updateProfile({ display_name: name.trim(), training_opt_in: trainingOptIn });
      await refresh();
    }
    go(1);
  };

  const finish = async () => {
    if (kind === "group" && roomName.trim().length < 2) {
      setErrors({ roomName: "Give the room a name." });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const id = await createConversation(
        kind === "group"
          ? { type: "group", name: roomName.trim(), topic: topic.trim() || null, ai_mode: "mention_only" }
          : { type: "direct_ai", ai_mode: "auto" },
      );
      toast.push({ kind: "success", title: "You're all set" });
      router.push(`/app/c/${id}`);
    } catch (e) {
      setLoading(false);
      toast.push({ kind: "error", title: "Couldn't create that", description: String(e) });
    }
  };

  return (
    <AuthShell title="Let's set you up" subtitle="Three quick things, then you're in.">
      {/* progress dots — fill animates on step change */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <motion.span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
              animate={{
                backgroundColor:
                  i <= step ? "var(--accent)" : "var(--bg-active)",
                color: i <= step ? "var(--accent-fg)" : "var(--fg-subtle)",
                scale: i === step ? 1.08 : 1,
              }}
              transition={SPRING}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </motion.span>
            {i < STEPS.length - 1 && (
              <motion.span
                className="h-px w-8 origin-left"
                animate={{ backgroundColor: i < step ? "var(--accent)" : "var(--border)" }}
                transition={tEnter(0.2)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-5"
          >
            {step === 0 && (
              <>
                <Field label="What should people call you?" error={errors.name} id="name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoFocus
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>

                <label className="flex cursor-pointer items-start gap-3 rounded-[--r-md] border border-[--border] p-3.5 transition-colors duration-[--d-micro] hover:bg-[--bg-hover] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[--accent]/50 has-[:focus-visible]:ring-offset-2">
                  <input
                    type="checkbox"
                    checked={trainingOptIn}
                    onChange={(e) => setTrainingOptIn(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[--accent] focus-visible:outline-none"
                  />
                  <span className="text-[13px] leading-relaxed">
                    <span className="font-medium text-[--fg]">
                      Help improve the assistant
                    </span>
                    <br />
                    <span className="text-[--fg-muted]">
                      Allow your conversations to be used for training. Off by default; you can
                      change this any time in Settings.
                    </span>
                  </span>
                </label>
              </>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[13px] font-medium">Theme</p>
                  <ThemeSegmented />
                </div>
                <p className="text-[13px] leading-relaxed text-[--fg-muted]">
                  Interface colours follow your choice immediately. If you pick System we&apos;ll
                  match your device, and switch with it.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        v: "direct_ai" as const,
                        icon: MessagesSquare,
                        title: "Chat with AI",
                        body: "A private thread, just you and the assistant.",
                      },
                      {
                        v: "group" as const,
                        icon: Users,
                        title: "Create a room",
                        body: "Invite people; the AI joins when mentioned.",
                      },
                    ]
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setKind(o.v)}
                      className={cn(
                        "rounded-[--r-md] border p-4 text-left transition-colors duration-[--d-micro]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50 focus-visible:ring-offset-2",
                        kind === o.v
                          ? "border-[--accent] bg-[--accent-subtle]"
                          : "border-[--border] hover:bg-[--bg-hover]",
                      )}
                    >
                      <o.icon
                        className={cn(
                          "mb-2 h-5 w-5",
                          kind === o.v ? "text-[--accent-text]" : "text-[--fg-muted]",
                        )}
                      />
                      <p className="text-[13.5px] font-semibold">{o.title}</p>
                      <p className="mt-1 text-[12px] leading-snug text-[--fg-muted]">{o.body}</p>
                    </button>
                  ))}
                </div>

                <AnimatePresence initial={false}>
                  {kind === "group" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={tEnter()}
                      className="space-y-4 overflow-hidden"
                    >
                      <Field label="Room name" error={errors.roomName} id="roomName">
                        <Input
                          id="roomName"
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          placeholder="Launch war room"
                          aria-invalid={Boolean(errors.roomName)}
                        />
                      </Field>
                      <Field
                        label="Topic"
                        hint="Optional — this shapes how the assistant answers in the room."
                        id="topic"
                      >
                        <Textarea
                          id="topic"
                          rows={2}
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="Shipping v2.0 — design, backend, and the go/no-go call"
                        />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish} loading={loading}>
            Finish
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </AuthShell>
  );
}