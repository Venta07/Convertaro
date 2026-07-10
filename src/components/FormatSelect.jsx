import { ChevronDown } from "lucide-react";

/**
 * Native <select> styled to match the app. Native is deliberate: it is
 * accessible, keyboard-friendly, and behaves well on mobile.
 *
 * @param {string} value           currently selected output format
 * @param {{value:string,label:string}[]} options
 * @param {(v:string)=>void} onChange
 * @param {boolean} disabled
 */
export default function FormatSelect({ value, options, onChange, disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Output format"
        className="field appearance-none pr-9 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.length === 0 && <option value="">Unsupported</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
