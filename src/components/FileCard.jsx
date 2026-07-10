import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileAudio,
  FileImage,
  FileQuestion,
  FileVideo,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import FormatSelect from "./FormatSelect.jsx";
import ProgressBar from "./ProgressBar.jsx";
import { cx, formatBytes, sizeDelta } from "../lib/utils.js";

const CATEGORY_ICON = {
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  unknown: FileQuestion,
};

const CATEGORY_TINT = {
  image: "from-violet-500/20 to-fuchsia-500/20 text-violet-500 dark:text-violet-300",
  audio: "from-amber-500/20 to-orange-500/20 text-amber-500 dark:text-amber-300",
  video: "from-sky-500/20 to-cyan-500/20 text-sky-500 dark:text-sky-300",
  unknown: "from-slate-400/20 to-slate-500/20 text-slate-500 dark:text-slate-300",
};

/**
 * @param {object} props
 * @param {import('../hooks/useConverter.js').QueueItem} props.item
 * @param {(id:string, format:string)=>void} props.onFormatChange
 * @param {(id:string)=>void} props.onConvert
 * @param {(id:string)=>void} props.onRemove
 */
export default function FileCard({ item, onFormatChange, onConvert, onRemove }) {
  const Icon = CATEGORY_ICON[item.category] || FileQuestion;
  const busy = item.status === "converting";
  const done = item.status === "done";
  const errored = item.status === "error";
  const unsupported = item.outputOptions.length === 0;
  const delta = done && item.result ? sizeDelta(item.size, item.result.size) : null;

  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      {/* Thumbnail / icon */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cx(
            "relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br",
            CATEGORY_TINT[item.category]
          )}
        >
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={item.name}>
            {item.name}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-medium uppercase dark:bg-white/10">
              {item.inputFormat || "?"}
            </span>
            <span>{formatBytes(item.size)}</span>
          </p>
        </div>
      </div>

      {/* Controls / status */}
      <div className="flex shrink-0 flex-col gap-2 sm:w-[19rem]">
        {busy ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {item.statusText || "Converting…"}
              </span>
              {item.progress > 0 && <span>{Math.round(item.progress * 100)}%</span>}
            </div>
            <ProgressBar value={item.progress} indeterminate={item.progress <= 0} />
          </div>
        ) : done && item.result ? (
          <div className="flex items-center gap-2">
            <a
              href={item.result.url}
              download={item.result.name}
              className="btn-primary flex-1"
            >
              <Download className="h-4 w-4" />
              Download
              <span className="font-normal opacity-90">· {formatBytes(item.result.size)}</span>
            </a>
            <button
              type="button"
              onClick={() => onFormatChange(item.id, item.outputFormat)}
              className="btn-ghost h-11 w-11 !px-0"
              title="Convert again / change format"
              aria-label="Convert again"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="hidden text-slate-400 sm:block">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <FormatSelect
                value={item.outputFormat}
                options={item.outputOptions}
                disabled={unsupported}
                onChange={(v) => onFormatChange(item.id, v)}
              />
            </div>
            <button
              type="button"
              onClick={() => onConvert(item.id)}
              disabled={unsupported}
              className="btn-primary whitespace-nowrap"
            >
              {errored ? "Retry" : "Convert"}
            </button>
          </div>
        )}

        {/* Status line */}
        {done && item.result && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done{typeof delta === "number" && ` · ${delta > 0 ? "+" : ""}${delta}% size`}
          </p>
        )}
        {errored && (
          <p className="flex items-start gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{item.error || "Conversion failed."}</span>
          </p>
        )}
        {unsupported && !busy && !done && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No client-side conversion available for this file type.
          </p>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={busy}
        className="btn-ghost absolute right-3 top-3 h-8 w-8 !px-0 sm:static sm:h-9 sm:w-9"
        aria-label={`Remove ${item.name}`}
        title="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
