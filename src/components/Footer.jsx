import { Github, Heart, Lock } from "lucide-react";

const REPO_URL = "https://github.com/Venta07/Convertaro";

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col items-center gap-3 border-t border-slate-200/70 pt-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        <p className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Your files are processed entirely on your device and never uploaded.
        </p>
        <p className="flex flex-wrap items-center justify-center gap-1">
          Open source, built with
          <Heart className="h-3.5 w-3.5 text-rose-500" />
          using WebAssembly &amp; the Canvas API.
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-1 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            <Github className="h-3.5 w-3.5" />
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}
