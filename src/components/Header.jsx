import { Github, ShieldCheck } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/70 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f19]/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
            <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M11 9.5 6.5 16 11 22.5M21 9.5 25.5 16 21 22.5M18.5 8.5 13.5 23.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">
            Convert<span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">aro</span>
          </span>
        </a>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% local
          </span>
          <a
            href="https://github.com"
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
