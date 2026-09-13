"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Database,
  Download,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { ThemeSegmented } from "@/components/theme-provider";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { signOut, updateProfile } from "@/lib/data/api";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { riseIn, staggerParent } from "@/lib/motion";
import { buildDataExport, downloadJson, exportFilename } from "@/lib/data-export";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]";

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, refresh } = useSession();

  const [name, setName] = React.useState("");
  const [training, setTraining] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setTraining(profile.training_opt_in);
    }
  }, [profile]);

  const dirty =
    profile && (name !== profile.display_name || training !== profile.training_opt_in);

  const save = async () => {
    if (name.trim().length < 2) {
      toast.push({ kind: "error", title: "Name is too short" });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ display_name: name.trim(), training_opt_in: training });
      await refresh();
      toast.push({ kind: "success", title: "Profile saved" });
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't save", description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await buildDataExport();
      downloadJson(exportFilename(), data);
      toast.push({
        kind: "success",
        title: "Export ready",
        description: `${data.conversations.length} conversation${
          data.conversations.length === 1 ? "" : "s"
        } written to JSON.`,
      });
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't export", description: String(e) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        variants={staggerParent(0.045)}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-2xl px-6 py-10"
      >
        <motion.div variants={riseIn} className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/app")} className="-ml-2 mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1.5 text-[14px] text-[--fg-muted]">
            Your profile, appearance, and data controls.
          </p>
        </motion.div>

        {/* hairline-separated sections read as one coherent panel rather than
            loose stacked blocks */}
        <div className="divide-y divide-[--border]/70">
          {/* profile */}
          <Section title="Profile" description="How you appear to other people in rooms.">
            <div className="mb-5 flex items-center gap-4">
              <Avatar name={name || "You"} url={profile?.avatar_url} size="xl" />
              <div className="text-[12.5px] leading-relaxed text-[--fg-muted]">
                <p className="font-medium text-[--fg]">Avatar</p>
                <p>Generated from your name. Upload support ships with the attachments bucket.</p>
              </div>
            </div>
            <Field label="Display name" id="display-name">
              <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="mt-4 flex justify-end">
              <Button onClick={save} loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </Section>

          {/* appearance */}
          <Section title="Appearance" description="Applies immediately, and follows your device if you pick System.">
            <ThemeSegmented />
          </Section>

          {/* privacy */}
          <Section title="Privacy & data" description="You decide what happens to your conversations.">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-[--r-md] border border-[--border] p-4 transition-colors duration-[--d-micro] hover:bg-[--bg-hover] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[--accent]/50 has-[:focus-visible]:ring-offset-2`}
            >
              <input
                type="checkbox"
                checked={training}
                onChange={(e) => setTraining(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[--accent] focus-visible:outline-none"
              />
              <span className="text-[13px] leading-relaxed">
                <span className="font-medium text-[--fg]">Allow training on my conversations</span>
                <br />
                <span className="text-[--fg-muted]">
                  Off by default. Turning this off again stops future use immediately.
                </span>
              </span>
            </label>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => void exportData()}
                disabled={exporting}
                className={`flex w-full items-center gap-3 rounded-[--r-md] border border-[--border] px-4 py-3 text-left transition-colors duration-[--d-micro] hover:bg-[--bg-hover] disabled:opacity-60 ${focusRing}`}
              >
                <Download className="h-4 w-4 shrink-0 text-[--fg-muted]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">
                    {exporting ? "Preparing export…" : "Export my data"}
                  </span>
                  <span className="block text-[12px] text-[--fg-muted]">
                    Every conversation you can read, as JSON. Generated in your browser — nothing
                    is uploaded.
                  </span>
                </span>
              </button>

              <p className="px-1 text-[12px] leading-relaxed text-[--fg-subtle]">
                Group rooms include messages written by other members, because that is what your
                account can see. Attachment files are not inlined — only their metadata.
              </p>

              <InfoRow
                icon={ShieldCheck}
                title="Moderation runs on both edges"
                body="Your input is classified before it reaches the model, and the answer is classified before it's published. If the classifier fails, nothing ships."
              />
              <InfoRow
                icon={Database}
                title="Row Level Security enforces membership"
                body="You can only read messages in conversations you belong to — enforced by the database, not by application code."
              />
            </div>

            {dirty && (
              <div className="mt-4 flex justify-end">
                <Button onClick={save} loading={saving}>
                  Save changes
                </Button>
              </div>
            )}
          </Section>

          {/* account */}
          <Section title="Account">
            <div className="space-y-2">
              <button
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className={`flex w-full items-center gap-3 rounded-[--r-md] border border-[--border] px-4 py-3 text-left transition-colors duration-[--d-micro] hover:bg-[--bg-hover] ${focusRing}`}
              >
                <LogOut className="h-4 w-4 text-[--fg-muted]" />
                <span className="flex-1 text-[13.5px] font-medium">Sign out</span>
              </button>

              {DEMO_MODE && (
                <button
                  onClick={() => setConfirmReset(true)}
                  className={`flex w-full items-center gap-3 rounded-[--r-md] border border-[--border] px-4 py-3 text-left transition-colors duration-[--d-micro] hover:bg-[--bg-hover] ${focusRing}`}
                >
                  <RotateCcw className="h-4 w-4 text-[--fg-muted]" />
                  <span className="flex-1">
                    <span className="block text-[13.5px] font-medium">Reset demo data</span>
                    <span className="block text-[12px] text-[--fg-muted]">
                      Restores the seeded conversations and clears anything you&apos;ve added.
                    </span>
                  </span>
                </button>
              )}

              <div className="flex items-start gap-3 rounded-[--r-md] border border-[--danger]/25 bg-[--danger-subtle]/40 p-4">
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[--danger]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold">Delete account</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[--fg-muted]">
                    Removes your profile and every conversation you own. Contact support to proceed —
                    this is deliberately not a one-click action.
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </motion.div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        description="Everything you've created in this browser will be replaced with the original seed."
        confirmLabel="Reset"
        onConfirm={() => {
          demo.reset();
          demo.signIn();
          toast.push({ kind: "success", title: "Demo data reset" });
          router.push("/app");
        }}
      />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={riseIn} className="py-8 first:pt-0 last:pb-0">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {description && <p className="mb-4 mt-1 text-[13px] text-[--fg-muted]">{description}</p>}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </motion.section>
  );
}

function InfoRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[--r-md] border border-[--border]/60 bg-[--bg-subtle] p-3.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[--success]" />
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[--fg-muted]">{body}</p>
      </div>
    </div>
  );
}