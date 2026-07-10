import { useCallback, useRef, useState } from "react";
import { FileAudio, FileImage, FileVideo, UploadCloud } from "lucide-react";
import { cx } from "../lib/utils.js";

const HINTS = [
  { icon: FileImage, label: "PNG · JPG · WebP · SVG" },
  { icon: FileVideo, label: "MP4 · WebM · MOV · GIF" },
  { icon: FileAudio, label: "MP3 · WAV · FLAC · M4A" },
];

/**
 * Drag-and-drop + click-to-browse upload area.
 * @param {(files: File[]) => void} onFiles
 */
export default function Dropzone({ onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    (list) => {
      const files = Array.from(list || []).filter((f) => f && f.size >= 0);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setDragging(false);
  }, []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload files by dropping them here or click to browse"
      className={cx(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
        dragging
          ? "scale-[1.01] border-brand-500 bg-brand-500/10"
          : "border-slate-300 bg-white/50 hover:border-brand-400 hover:bg-white/80 dark:border-white/15 dark:bg-white/[0.02] dark:hover:border-brand-400/60 dark:hover:bg-white/[0.04]"
      )}
    >
      {/* sheen on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
        accept="image/*,audio/*,video/*"
      />

      <span
        className={cx(
          "grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25 transition-all duration-200",
          dragging ? "scale-110 rotate-3" : "group-hover:scale-105"
        )}
      >
        <UploadCloud className="h-8 w-8" />
      </span>

      <div>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {dragging ? "Drop to add your files" : "Drag & drop files here"}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          or <span className="font-semibold text-brand-600 dark:text-brand-400">browse</span> — convert as many as you like
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {HINTS.map((h) => (
          <span key={h.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <h.icon className="h-3.5 w-3.5" />
            {h.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        🔒 Files stay on your device — nothing is ever uploaded.
      </p>
    </div>
  );
}
