/**
 * Focus helpers shared by the dialog surfaces (Modal, command palette).
 *
 * The selector is deliberately coarse: it is used to *wrap* Tab inside a
 * dialog, not to discover a tab order, so an occasional false positive
 * (a focusable element that is currently invisible) only means Tab visits
 * one extra stop inside the dialog. A false negative — missing the real
 * last control — would let focus escape, which is the bug we care about.
 *
 * Note it does NOT filter on `offsetParent`/`getClientRects`: both are
 * always empty under jsdom, and filtering on them would make the dialog
 * focus trap untestable outside a real browser.
 */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/** Every focusable descendant of `root`, in document order. */
export function focusableWithin(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true",
  );
}
