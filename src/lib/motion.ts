/**
 * Global motion tokens (§2.7).
 * Every animated component MUST import timings/easings from here —
 * no ad hoc per-component values.
 *
 * Rule: animate `transform` / `opacity` only. Never width/height/top/left.
 */
import type { Transition, Variants } from "framer-motion";

export const DURATION = {
  micro: 0.12, // hover / press
  standard: 0.2, // most transitions
  emphasis: 0.32, // modals, page transitions
  hero: 0.48, // landing only
} as const;

export const EASE = {
  /** ease-out-expo feel — anything ENTERING */
  enter: [0.16, 1, 0.3, 1] as const,
  /** anything EXITING */
  exit: [0.7, 0, 0.84, 0] as const,
};

export const SPRING: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 32,
  mass: 0.7,
};

/** Overshoot spring — reactions popping in */
export const SPRING_POP: Transition = {
  type: "spring",
  stiffness: 640,
  damping: 18,
  mass: 0.6,
};

export const tEnter = (d: number = DURATION.standard): Transition => ({
  duration: d,
  ease: EASE.enter,
});

export const tExit = (d: number = DURATION.micro): Transition => ({
  duration: d,
  ease: EASE.exit,
});

/* ------------------------------------------------------------------ */
/* Shared variants                                                     */
/* ------------------------------------------------------------------ */

/** Scroll-triggered fade + rise (landing sections) */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: tEnter(DURATION.hero) },
};

/** Staggered container, 40–60ms stagger */
export const staggerParent = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** New message slide-up + fade */
export const messageIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: tEnter(DURATION.standard) },
};

/** Modal panel: scale-from-.95 + slight rise; exit reverse & snappier */
export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: tEnter(DURATION.emphasis) },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: tExit(DURATION.micro) },
};

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tEnter(DURATION.standard) },
  exit: { opacity: 0, transition: tExit(DURATION.micro) },
};

/** Dropdown / popover scaling from its origin */
export const popover: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  show: { opacity: 1, scale: 1, y: 0, transition: tEnter(DURATION.micro) },
  exit: { opacity: 0, scale: 0.98, transition: tExit(0.1) },
};

/** Inline validation error: slide-down + fade (never pop) */
export const fieldError: Variants = {
  hidden: { opacity: 0, y: -4, height: 0 },
  show: { opacity: 1, y: 0, height: "auto", transition: tEnter(DURATION.micro) },
  exit: { opacity: 0, y: -4, height: 0, transition: tExit(0.1) },
};

/** Press feedback for CTAs — scale .97 with spring return */
export const pressable = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.97 },
  transition: SPRING,
};

/** Badge / unread pop */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: SPRING_POP },
  exit: { opacity: 0, scale: 0.6, transition: tExit(0.1) },
};

/** Horizontal step transition (onboarding) */
export const stepSlide: Variants = {
  hidden: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  show: { opacity: 1, x: 0, transition: tEnter(DURATION.emphasis) },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -48 : 48,
    transition: tExit(DURATION.micro),
  }),
};

/** Toast entry */
export const toastIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: tEnter(DURATION.standard) },
  exit: { opacity: 0, y: 8, scale: 0.97, transition: tExit(DURATION.micro) },
};
