import { cx } from "../lib/utils.js";

/**
 * Thin animated progress bar with a moving shimmer.
 * @param {number} value 0..1
 * @param {boolean} indeterminate show a moving stripe when progress is unknown
 */
export default function ProgressBar({ value = 0, indeterminate = false }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500 transition-[width] duration-300 ease-out"
        style={{ width: indeterminate ? "100%" : `${pct}%` }}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      <div className="shimmer pointer-events-none absolute inset-0" />
    </div>
  );
}
