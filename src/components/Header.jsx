import { Github, ShieldCheck } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";

const REPO_URL = "https://github.com/Venta07/Convertaro";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0e1a]/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm shadow-brand-500/30 transition-transform group-hover:scale-105">
            <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M11 9.5 6.5 16 11 22.5M21 9.5 25.5 16 21 22.5M18.5 8.5 13.5 23.5"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">
            Convert<span className="gradient-text">aro</span>
          </span>
        </a>

        <div className="flex items-center gap-2">
          <span className="chip hidden border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% local
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ghost h-10 w-10 !px-0"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
