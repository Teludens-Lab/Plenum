export function SecondaryNavigation({ label, items }: {
  label: string; items: readonly { href: string; label: string; current?: boolean }[];
}) {
  return <nav className="secondary-navigation" aria-label={label}>
    <ul>{items.map((item) => <li key={item.href}><a href={item.href}
      aria-current={(item.current ?? window.location.pathname.replace(/\/$/u, "") === item.href) ? "page" : undefined}>
      {item.label}
    </a></li>)}</ul>
  </nav>;
}
