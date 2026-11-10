/** Painel padrão do site: superfície clara, borda fina, sem sombra (DESIGN.md) */
export function Panel({
  title,
  aside,
  className = "",
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-(--radius-panel) border border-border bg-surface p-5 ${className}`}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
