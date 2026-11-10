"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Hoje" },
  { href: "/ideias", label: "Ideias" },
] as const;

/** Abas do topo. A atual usa o estado de seleção (lima + borda escura), igual ao seletor de dias. */
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções" className="flex gap-2">
      {TABS.map((t) => {
        const current = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-(--radius-control) border px-4 py-2 text-sm font-medium transition-[background-color,border-color] duration-150 ${
              current
                ? "border-fg bg-accent text-accent-fg"
                : "border-border bg-surface hover:border-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
