import { Cpu, ShieldCheck, Sparkles, Trash2, Zap } from "lucide-react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Dropzone from "./components/Dropzone.jsx";
import FileCard from "./components/FileCard.jsx";
import { useConverter } from "./hooks/useConverter.js";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Truly private",
    body: "Conversions run in your browser with WebAssembly. Files never touch a server.",
  },
  {
    icon: Zap,
    title: "Fast & offline",
    body: "No uploads, no queues. Works offline once the page has loaded.",
  },
  {
    icon: Cpu,
    title: "Images, audio & video",
    body: "PNG, JPG, WebP, MP4, WebM, GIF, MP3, WAV and more — all client-side.",
  },
];

export default function App() {
  const { files, stats, addFiles, removeFile, clearAll, setOutputFormat, convertOne, convertAll } =
    useConverter();

  const hasFiles = files.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <section className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            Private · Open source · No upload
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Convert files{" "}
            <span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
              without leaving your browser
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 dark:text-slate-400">
            Drop an image, audio or video file and convert it locally. Nothing is uploaded —
            your data stays on your device, always.
          </p>
        </section>

        {/* Dropzone */}
        <section className="mx-auto mt-10 max-w-3xl">
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
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={stats.converting}
                  className="btn-ghost"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={convertAll}
                  disabled={stats.converting || stats.pending === 0}
                  className="btn-primary"
                >
                  <Zap className="h-4 w-4" />
                  Convert all
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
                  onRemove={removeFile}
                />
              ))}
            </div>
          </section>
        )}

        {/* Features (shown when the queue is empty) */}
        {!hasFiles && (
          <section className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
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
        )}
      </main>

      <Footer />
    </div>
  );
}
