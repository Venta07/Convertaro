import { Heart, Lock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col items-center gap-3 border-t border-slate-200/70 pt-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        <p className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Your files are processed entirely on your device and never uploaded.
        </p>
        <p className="flex items-center gap-1">
          Open source, built with
          <Heart className="h-3.5 w-3.5 text-rose-500" />
          using WebAssembly &amp; the Canvas API.
        </p>
      </div>
    </footer>
  );
}
