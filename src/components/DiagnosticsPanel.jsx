import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ClipboardCopy,
  Cpu,
  Download,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { log, environmentInfo } from "../lib/logger.js";
import { useEngineState, useLogs } from "../hooks/useLogs.js";
import { cx } from "../lib/utils.js";

const LEVEL_STYLE = {
  debug: "text-slate-400",
  info: "text-brand-500 dark:text-brand-300",
  warn: "text-amber-500 dark:text-amber-400",
  error: "text-rose-500 dark:text-rose-400",
};

const ENGINE_LABEL = {
  idle: "Idle",
  loading: "Loading…",
  ready: "Ready",
  error: "Error",
};

function fmtTime(at) {
  return new Date(at).toISOString().slice(11, 23);
}

export default function DiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [minLevel, setMinLevel] = useState("debug");
  const [copied, setCopied] = useState(false);
  const logs = useLogs(open);
  const engine = useEngineState();
  const env = useMemo(() => environmentInfo(), []);
  const scrollRef = useRef(null);
  const errorCount = logs.filter((l) => l.level === "error").length;

  const order = { debug: 0, info: 1, warn: 2, error: 3 };
  const visible = logs.filter((l) => order[l.level] >= order[minLevel]);

  // Keep the log pinned to the newest line.
  useEffect(() => {
    const el = scrollRef.current;
    if (open && el) el.scrollTop = el.scrollHeight;
  }, [visible.length, open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText(env, engine));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const download = () => {
    const blob = new Blob([diagnosticsText(env, engine)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "convertaro-logs.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:scale-105 hover:text-brand-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-brand-300"
        aria-label="Open diagnostics"
        title="Diagnostics & logs"
      >
        <Terminal className="h-5 w-5" />
        {errorCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {errorCount > 99 ? "99+" : errorCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      <div
        className={cx(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md transform flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-[#0d1220]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-label="Diagnostics"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-bold">Diagnostics</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-ghost h-8 w-8 !px-0"
            aria-label="Close diagnostics"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Environment / engine */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-4 text-xs dark:border-white/10">
          <Stat label="Engine">
            <span
              className={cx(
                "font-semibold",
                engine.status === "ready" && "text-emerald-500",
                engine.status === "error" && "text-rose-500",
                engine.status === "loading" && "text-amber-500"
              )}
            >
              {ENGINE_LABEL[engine.status] || engine.status}
              {engine.status === "loading" && ` ${Math.round((engine.progress || 0) * 100)}%`}
            </span>
          </Stat>
          <Stat label="Threads">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Cpu className="h-3 w-3" />
              {engine.mode === "mt" ? "Multi" : engine.mode === "st" ? "Single" : "—"}
            </span>
          </Stat>
          <Stat label="Isolated">
            <Bool value={env.crossOriginIsolated} />
          </Stat>
          <Stat label="SharedArrayBuffer">
            <Bool value={env.sharedArrayBuffer} />
          </Stat>
          <Stat label="CPU cores">{env.hardwareConcurrency ?? "—"}</Stat>
          <Stat label="OffscreenCanvas">
            <Bool value={env.offscreenCanvas} />
          </Stat>
        </div>

        {engine.status === "error" && (
          <div className="mx-4 mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            The conversion engine failed to load: {engine.error}. Check your
            network, then retry — the copy button above exports full details.
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3">
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value)}
            className="field !w-auto !py-1 text-xs"
            aria-label="Minimum log level"
          >
            <option value="debug">All</option>
            <option value="info">Info+</option>
            <option value="warn">Warnings+</option>
            <option value="error">Errors</option>
          </select>
          <span className="text-xs text-slate-400">{visible.length} entries</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={copy} className="btn-ghost h-8 w-8 !px-0" title="Copy logs + environment">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <ClipboardCopy className="h-4 w-4" />}
            </button>
            <button type="button" onClick={download} className="btn-ghost h-8 w-8 !px-0" title="Download logs">
              <Download className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => log.clear()} className="btn-ghost h-8 w-8 !px-0" title="Clear logs">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Log stream */}
        <div
          ref={scrollRef}
          className="scrollbar-thin flex-1 overflow-y-auto border-t border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed dark:border-white/10 dark:bg-black/30"
        >
          {visible.length === 0 ? (
            <p className="mt-8 text-center text-slate-400">No log entries yet. Convert a file to see activity.</p>
          ) : (
            visible.map((l) => (
              <div key={l.id} className="whitespace-pre-wrap break-words py-0.5">
                <span className="text-slate-400">{fmtTime(l.at)} </span>
                <span className={cx("font-semibold uppercase", LEVEL_STYLE[l.level])}>{l.level}</span>
                <span className="text-slate-400"> [{l.scope}] </span>
                <span className="text-slate-700 dark:text-slate-200">{l.message}</span>
                {l.data !== undefined && (
                  <span className="text-slate-400"> {JSON.stringify(l.data)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, children }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-white/5">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-800 dark:text-slate-100">{children}</span>
    </div>
  );
}

function Bool({ value }) {
  return (
    <span className={cx("font-semibold", value ? "text-emerald-500" : "text-slate-400")}>
      {value ? "Yes" : "No"}
    </span>
  );
}

function diagnosticsText(env, engine) {
  const header = [
    "=== Convertaro diagnostics ===",
    `time: ${new Date().toISOString()}`,
    `engine: ${engine.status} (${engine.mode || "—"})`,
    ...Object.entries(env).map(([k, v]) => `${k}: ${v}`),
    "",
    "=== logs ===",
  ].join("\n");
  return `${header}\n${log.toText()}`;
}
