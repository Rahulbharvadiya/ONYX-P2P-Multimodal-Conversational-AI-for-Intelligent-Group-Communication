/**
 * §3 pricing — single source of truth for the plan table.
 *
 * Shared by the landing-page teaser (`#pricing`) and the standalone
 * `/pricing` route so the two can never drift apart.
 */

export interface Plan {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "For trying the whole thing out.",
    features: ["Unlimited 1:1 AI chats", "3 group rooms", "30-day history", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Team",
    price: "$12",
    cadence: "per user / month",
    blurb: "For groups that actually ship together.",
    features: [
      "Unlimited rooms & members",
      "Full history + global search",
      "File attachments",
      "Admin analytics",
      "Priority model access",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    blurb: "For when procurement gets involved.",
    features: ["SSO / SAML", "Audit log export", "Data residency", "Custom moderation policy", "99.9% SLA"],
    cta: "Talk to us",
    highlight: false,
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const PRICING_FAQ: Faq[] = [
  {
    q: "Is my data used for training?",
    a: "No, unless you turn it on. Training opt-in is off by default and is a per-person setting; in a group room every member has to opt in before anything can be routed to a training pipeline.",
  },
  {
    q: "Is pricing per token?",
    a: "No. Plans are per person per month, so a long thread with the assistant costs the same as a short one. Rate limits (30 messages/minute, 10 AI invocations/minute) apply on every plan.",
  },
  {
    q: "What happens to my conversations if I downgrade?",
    a: "Nothing is deleted. You keep every conversation you can see; the plan only changes what you can create — the Free tier caps new group rooms at three.",
  },
  {
    q: "Can I export everything and leave?",
    a: "Yes. Settings → Privacy & data exports every conversation you have access to as JSON, and account deletion removes your profile and every conversation you own.",
  },
];
