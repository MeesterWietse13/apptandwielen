"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/ontdekzone", label: "Ontdekzone", icon: "🔧" },
  { href: "/labzone", label: "Labzone", icon: "🧪" },
  { href: "/buildzone", label: "Buildzone", icon: "🏗️" },
  { href: "/fietslab", label: "Fietslab", icon: "🚲" },
  { href: "/mijn-ontdekkingen", label: "Mijn ontdekkingen", icon: "📒" },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="relative inline-block" style={{ width: size * 1.6, height: size }} aria-hidden>
      <svg className="absolute left-0 top-0 spin-slow" width={size} height={size} viewBox="0 0 24 24">
        <path d="M12 2l1.6 2.6 3-.6.6 3L19.8 8.6 18 11l1.8 2.4-2.6 1.6-.6 3-3-.6L12 22l-1.6-2.6-3 .6-.6-3-2.6-1.6L6 12 4.2 9.6 6.8 8l.6-3 3 .6z" fill="#38bdf8" />
        <circle cx="12" cy="12" r="3" fill="#0f172a" />
      </svg>
      <svg className="absolute spin-slow-rev" style={{ left: size * 0.72, top: size * 0.3 }} width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24">
        <path d="M12 2l1.6 2.6 3-.6.6 3L19.8 8.6 18 11l1.8 2.4-2.6 1.6-.6 3-3-.6L12 22l-1.6-2.6-3 .6-.6-3-2.6-1.6L6 12 4.2 9.6 6.8 8l.6-3 3 .6z" fill="#fbbf24" />
        <circle cx="12" cy="12" r="3" fill="#0f172a" />
      </svg>
    </span>
  );
}

interface AppShellProps {
  fullscreenAvailable?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function AppShell({ fullscreenAvailable = false, isFullscreen = false, onToggleFullscreen }: AppShellProps) {
  const pathname = usePathname();
  return (
    <header className="print:hidden z-40 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-3 text-slate-100">
      <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
        <Logo size={24} />
        <span className="text-base">
          Tandwielen<span className="text-sky-400">lab</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-bold transition ${active ? "bg-sky-500/20 text-sky-300" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="mr-1">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          );
        })}
        {fullscreenAvailable && onToggleFullscreen && (
          <button
            type="button"
            className="fullscreen-button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Volledig scherm verlaten" : "Volledig scherm"}
          >
            <span aria-hidden>⛶</span>
            <span className="fullscreen-label">{isFullscreen ? "Volledig scherm verlaten" : "Volledig scherm"}</span>
          </button>
        )}
      </nav>
    </header>
  );
}
