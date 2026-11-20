import type { Transition } from 'motion/react';

/**
 * Motion presets, mirroring tokens.css (--ease-out, --d-1, --d-2). Routine UI only:
 * popovers grow from their anchor and leave faster than they came; a new pane arrangement
 * fades up from 40% (Trade.tsx, useAnimate) so every pane's jump reads as one change.
 * MotionConfig reducedMotion="user" (main.tsx) drops the movement and keeps the fades.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const enter: Transition = { duration: 0.16, ease: EASE_OUT };
const leave: Transition = { duration: 0.1, ease: 'easeIn' };

/** a popover opening below its button */
export const popover = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: enter },
  exit: { opacity: 0, y: -2, scale: 0.99, transition: leave },
} as const;

/** a flyout opening to the right of the tool rail */
export const flyout = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0, transition: enter },
  exit: { opacity: 0, x: -3, transition: leave },
} as const;

/** the toast, centred by x: -50% (Motion owns its transform) */
export const toast = {
  initial: { opacity: 0, x: '-50%', y: 8 },
  animate: { opacity: 1, x: '-50%', y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: { opacity: 0, x: '-50%', y: 0, transition: leave },
} as const;

