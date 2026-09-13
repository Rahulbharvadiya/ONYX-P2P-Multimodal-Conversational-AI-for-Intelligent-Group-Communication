import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { Reveal, RevealItem, SectionHeading } from "@/components/landing/section";
import { PLANS, PRICING_FAQ } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Per-person pricing for ONYX: streaming AI chat, group rooms with opt-in AI, moderation on both edges and private attachments on every plan.",
};

/**
 * §3 standalone pricing route. The landing page keeps its teaser section;
 * this is the full page the nav and footer point at, so `/pricing` is
 * linkable from anywhere (docs, ads, support replies) without an anchor.
 */

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-[--bg]">
      <header className="sticky top-0 z-40 border-b border-[--border]/70 bg-[--bg]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[--bg]/70">
        <nav
          aria-label="Pricing"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5"
        >
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">ONYX</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href="/#features"
              className="hidden rounded-[--r-sm] px-3 py-2 text-[13.5px] font-medium text-[--fg-muted] transition-colors duration-[--d-micro] hover:text-[--fg] sm:block"
            >
              Features
            </Link>
            <Link
              href="/changelog"
              className="hidden rounded-[--r-sm] px-3 py-2 text-[13.5px] font-medium text-[--fg-muted] transition-colors duration-[--d-micro] hover:text-[--fg] sm:block"
            >
              Changelog
            </Link>
            <ThemeToggle />
            <Button asChild href="/login" variant="ghost" size="sm">
              Sign in
            </Button>
            <Button asChild href="/signup" size="sm">
              Get started
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-10 pt-16 sm:pt-24">
          {/* faint atmosphere behind the hero only — quiet enough not to compete with the cards */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div
              className="absolute left-1/2 top-[-16rem] h-[32rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.09] blur-[110px]"
              style={{ background: "radial-gradient(circle, var(--accent), transparent 62%)" }}
            />
          </div>

          <Reveal className="mx-auto max-w-5xl">
            <SectionHeading
              eyebrow="Pricing"
              title="Priced per person, not per token"
              subtitle="Every plan includes streaming, moderation on both edges, private attachments and the full search index. The plan changes what you can create — never what you can read."
            />

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {PLANS.map((p) => (
                <RevealItem key={p.name}>
                  <div
                    className={`group relative flex h-full flex-col rounded-[--r-lg] border p-6 transition-all duration-[--d-standard] hover:-translate-y-1 ${
                      p.highlight
                        ? "border-[--accent] bg-[--surface] shadow-[--e3] hover:shadow-[--e3]"
                        : "border-[--border] bg-[--surface] hover:border-[--border-strong] hover:shadow-[--e2]"
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-2.5 left-6 rounded-full bg-[--accent] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--accent-fg]">
                        Most popular
                      </span>
                    )}
                    <h2 className="text-[15px] font-semibold">{p.name}</h2>
                    <p className="mt-1 text-[13px] text-[--fg-muted]">{p.blurb}</p>
                    <p className="mt-5 flex items-baseline gap-1.5">
                      <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                      <span className="text-[12.5px] text-[--fg-subtle]">{p.cadence}</span>
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2.5 text-[13.5px] text-[--fg-muted]">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[--success]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      href="/signup"
                      variant={p.highlight ? "primary" : "secondary"}
                      className="mt-7 w-full"
                    >
                      {p.cta}
                    </Button>
                  </div>
                </RevealItem>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="border-t border-[--border] bg-[--bg-subtle] px-5 py-20 sm:py-24">
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Questions people actually ask
            </h2>
            <dl className="mt-10 divide-y divide-[--border]">
              {PRICING_FAQ.map((item) => (
                <RevealItem key={item.q}>
                  <div className="py-5 first:pt-0 last:pb-0">
                    <dt className="text-[14.5px] font-semibold">{item.q}</dt>
                    <dd className="mt-1.5 text-pretty text-[13.5px] leading-relaxed text-[--fg-muted]">
                      {item.a}
                    </dd>
                  </div>
                </RevealItem>
              ))}
            </dl>
          </Reveal>
        </section>

        <section className="px-5 py-20 sm:py-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <RevealItem>
              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                Try it before you pay for it
              </h2>
            </RevealItem>
            <RevealItem>
              <p className="mx-auto mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-[--fg-muted]">
                The demo runs entirely in your browser — no account, no backend, no card.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild href="/signup" size="lg" className="w-full sm:w-auto">
                  Create your account
                </Button>
                <Button asChild href="/app" size="lg" variant="secondary" className="w-full sm:w-auto">
                  Explore the demo
                </Button>
              </div>
            </RevealItem>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[--border] px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo className="h-6 w-6" />
            <span className="text-[13.5px] font-semibold">ONYX</span>
            <span className="text-[12.5px] text-[--fg-subtle]">v2.0</span>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[--fg-muted]"
          >
            <Link href="/#features" className="transition-colors duration-[--d-micro] hover:text-[--fg]">
              Features
            </Link>
            <Link href="/#security" className="transition-colors duration-[--d-micro] hover:text-[--fg]">
              Security
            </Link>
            <Link href="/pricing" className="transition-colors duration-[--d-micro] hover:text-[--fg]">
              Pricing
            </Link>
            <Link href="/changelog" className="transition-colors duration-[--d-micro] hover:text-[--fg]">
              Changelog
            </Link>
            <Link href="/login" className="transition-colors duration-[--d-micro] hover:text-[--fg]">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}