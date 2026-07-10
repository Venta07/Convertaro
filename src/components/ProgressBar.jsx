import { cx } from "../lib/utils.js";

/**
 * Thin animated progress bar.
 * @param {number} value 0..1
 * @param {boolean} indeterminate show a moving stripe when progress is unknown
 */
export default function ProgressBar({ value = 0, indeterminate = false }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div
        className={cx(
          "h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-[width] duration-200 ease-out",
          indeterminate && "animate-pulse"
        )}
        style={{ width: indeterminate ? "100%" : `${pct}%` }}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
