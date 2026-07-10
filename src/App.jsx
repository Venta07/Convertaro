import { useEffect } from "react";
import {
  Cpu,
  Download,
  Loader2,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Dropzone from "./components/Dropzone.jsx";
import FileCard from "./components/FileCard.jsx";
import DiagnosticsPanel from "./components/DiagnosticsPanel.jsx";
import { useConverter } from "./hooks/useConverter.js";
import { useEngineState } from "./hooks/useLogs.js";
import { log, environmentInfo } from "./lib/logger.js";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Truly private",
    body: "Conversions run in your browser with WebAssembly. Files never touch a server.",
  },
  {
    icon: Zap,
    title: "Fast & offline",
    body: "No uploads, no queues. Works offline once the engine has loaded.",
  },
  {
    icon: Cpu,
    title: "Images, audio & video",
    body: "PNG, JPG, WebP, MP4, WebM, GIF, MP3, WAV, FLAC and more — all client-side.",
  },
];

const STEPS = [
  { icon: Upload, title: "Drop your files", body: "Drag in images, audio or video — or click to browse. Add as many as you like." },
  { icon: MousePointerClick, title: "Pick a format", body: "Convertaro shows only the output formats that make sense for each file." },
  { icon: Wand2, title: "Convert & download", body: "Everything runs locally. Grab your converted file the moment it's ready." },
];

/** One-time banner while the ~30 MB engine downloads on the first conversion. */
function EngineBanner() {
  const engine = useEngineState();
  if (engine.status !== "loading") return null;
  const pct = Math.round((engine.progress || 0) * 100);
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-3 bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <Download className="h-4 w-4 animate-bounce" />
      <span>Downloading conversion engine… {pct}% · one-time, then cached</span>
      <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-white/25 sm:block">
        <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const { files, stats, addFiles, removeFile, clearAll, setOutputFormat, convertOne, convertAll, cancel } =
    useConverter();
  const hasFiles = files.length > 0;

  useEffect(() => {
    log.info("app", "Convertaro ready", environmentInfo());
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <EngineBanner />
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <section className="mx-auto max-w-2xl text-center">
          <span className="chip animate-fade-in border border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            Private · Open source · No upload
          </span>
          <h1 className="animate-fade-up mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Convert files{" "}
            <span className="gradient-text">without leaving your browser</span>
          </h1>
          <p className="animate-fade-up mx-auto mt-4 max-w-xl text-base text-slate-600 dark:text-slate-400" style={{ animationDelay: "60ms" }}>
            Drop an image, audio or video file and convert it locally. Nothing is uploaded —
            your data stays on your device, always.
          </p>
        </section>

        {/* Dropzone */}
        <section className="animate-fade-up mx-auto mt-10 max-w-3xl" style={{ animationDelay: "120ms" }}>
          <Dropzone onFiles={addFiles} />
        </section>

        {/* Queue */}
        {hasFiles && (
          <section className="mx-auto mt-8 max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {stats.total} file{stats.total !== 1 && "s"}
                </span>
                {stats.done > 0 && <span> · {stats.done} converted</span>}
                {stats.total - stats.convertible > 0 && (
                  <span> · {stats.total - stats.convertible} unsupported</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={clearAll} disabled={stats.converting} className="btn-ghost">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={convertAll}
                  disabled={stats.converting || stats.pending === 0}
                  className="btn-primary"
                >
                  {stats.converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {stats.converting ? "Converting…" : `Convert ${stats.pending > 1 ? "all" : ""}`}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {files.map((item) => (
                <FileCard
                  key={item.id}
                  item={item}
                  onFormatChange={setOutputFormat}
                  onConvert={convertOne}
                  onCancel={cancel}
                  onRemove={removeFile}
                />
              ))}
            </div>
          </section>
        )}

        {/* Features + How it works (empty state) */}
        {!hasFiles && (
          <>
            <section className="animate-fade-up mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3" style={{ animationDelay: "160ms" }}>
              {FEATURES.map((f) => (
                <div key={f.title} className="card p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-800 dark:text-slate-100">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.body}</p>
                </div>
              ))}
            </section>

            <section className="mx-auto mt-16 max-w-4xl">
              <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400">
                How it works
              </h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="relative text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/20">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <span className="mt-3 block text-xs font-bold text-brand-500">STEP {i + 1}</span>
                    <h3 className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{s.title}</h3>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{s.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
      <DiagnosticsPanel />
    </div>
  );
}
