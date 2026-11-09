import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Shared Session frame for every Runtime role surface (participant roles and the Operator console):
 * a context header, a labeled section sidebar, a page header band and one scrolling work region.
 * Labels and destinations come from the Release projection; this file owns presentation only.
 */

const ICON_PATHS = {
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  list: "M4 6h16v14H4zM8 3v4M16 3v4M4 10h16",
  inbox: "M4 13l2.5-7h11L20 13v6H4zM4 13h5l1 2h4l1-2h5",
  question: "M4 4h16v12H9l-5 4zM9 8a3 3 0 0 1 6 0c0 2-3 2-3 4M12 14h.01",
  timeline: "M6 4v16M6 6h12M6 12h8M6 18h12M4 6h4M4 12h4M4 18h4",
  action: "M13 3 5 14h6l-1 7 9-12h-6z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4",
  proposal: "M8 4h8v3H8zM6 5.5H5v15h14v-15h-1M9 12h6M9 16h4",
  resources: "M6 3h8l4 4v14H6zM14 3v4h4",
  deck: "M3 4h18v12H3zM12 16v4M8 20h8",
  status: "M4 19a8 8 0 1 1 16 0M12 13l3.5-3.5",
  presentation: "M3 5h18v11H3zM8 20l4-4 4 4",
  dashboard: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  participants: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3 6",
  export: "M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19h16",
  replay: "M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  runtime: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3",
  detail: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  refresh: "M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  chevronDown: "m7 10 5 5 5-5",
  chevronLeft: "m14 6-6 6 6 6",
  chevronRight: "m10 6 6 6-6 6",
  chevronUp: "m7 14 5-5 5 5",
  exit: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  broadcast: "M4 10v5h4l10 4V6L8 10zM8 15l2 6h3l-2-5M21 9v7",
  voice: "M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h4v-7zM20 12h2v7h-4v-7zM20 19c0 2-3 2-6 2"
} as const;

export type RuntimeIconName = keyof typeof ICON_PATHS;

export function runtimeIconName(value: unknown, fallback: RuntimeIconName): RuntimeIconName {
  return typeof value === "string" && Object.hasOwn(ICON_PATHS, value) ? value as RuntimeIconName : fallback;
}

export function RuntimeIcon({ name, className = "runtime-icon" }: { name: RuntimeIconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICON_PATHS[name]} /></svg>;
}

/** Formats whole seconds as MM:SS; minutes are not rolled into hours, so a 90-minute stage reads 90:00. */
export function formatStageClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export type StageStatus = "not_started" | "active" | "paused" | "completed";

/**
 * Remaining stage time. An active stage counts down locally from the server deadline; every other
 * status shows the server's remaining seconds unchanged. Returns null for untimed stages.
 */
export function useStageClock(status: StageStatus | null, remainingSeconds: number | null, deadlineAt: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  const ticking = status === "active" && deadlineAt !== null && !Number.isNaN(Date.parse(deadlineAt));
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking, deadlineAt]);
  if (ticking && deadlineAt !== null) return formatStageClock((Date.parse(deadlineAt) - now) / 1000);
  return remainingSeconds === null ? null : formatStageClock(remainingSeconds);
}

/** True while the viewport is wide enough to keep the navigation sidebar beside the work region. */
export function useWideViewport(query = "(min-width: 52.01rem)"): boolean {
  const [wide, setWide] = useState(() => typeof window.matchMedia !== "function" || window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return wide;
}

const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  not_started: "Not started", active: "Running", paused: "Paused", completed: "Ended"
};

/** Header popover anchored to its toggle; closes on Escape (returning focus) or an outside press. */
function HeaderMenu({ className, label, toggle, children }: {
  className: string; label: string; toggle: ReactNode; children(close: () => void): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const close = () => { setOpen(false); button.current?.focus(); };
  return <div className={`runtime-header-menu ${className}`} ref={root}>
    <button ref={button} className="runtime-header-menu-toggle" type="button" aria-expanded={open} aria-controls={id}
      aria-label={label} onClick={() => setOpen((value) => !value)}>{toggle}</button>
    <div id={id} className="runtime-header-popover" hidden={!open}>{children(close)}</div>
  </div>;
}

export interface RuntimeHeaderProps {
  sessionTitle: string;
  sessionMenu(close: () => void): ReactNode;
  stage: { label: string | null; status: StageStatus | null; clock: string | null };
  connection: { state: string; label: string };
  refreshing: boolean;
  onRefresh(): void;
  notifications: { count: number; label: string; onOpen(): void } | null;
  themeToggle: ReactNode;
  roleLabel: string;
  roleMenu(close: () => void): ReactNode;
  communicationTools?: ReactNode;
}

export function RuntimeHeader(props: RuntimeHeaderProps) {
  const { stage } = props;
  const idle = stage.label === null && stage.clock === null;
  return <header className="app-header runtime-header">
    <a className="brand-wordmark runtime-wordmark" href="/" aria-label="Plenum home">
      <img className="brand-wordmark-dark" src="/branding/plenum-wordmark-primary.png" alt="Plenum" width="2170" height="725" />
      <img className="brand-wordmark-light" src="/branding/plenum-wordmark-primary.png" alt="" width="2170" height="725" aria-hidden="true" />
    </a>
    <HeaderMenu className="runtime-session-menu" label={`Session: ${props.sessionTitle}. Open Session menu`}
      toggle={<><span className="runtime-session-title">{props.sessionTitle}</span><RuntimeIcon name="chevronDown" /></>}>
      {(close) => <><p className="runtime-full-session-title">{props.sessionTitle}</p>{props.sessionMenu(close)}</>}
    </HeaderMenu>
    <div className="runtime-header-tools">
      <span className="runtime-header-break" aria-hidden="true" />
      <div className={`runtime-stage-pill${idle ? " is-idle" : ""}`} aria-label="Stage and timer" role="group">
        <span className="runtime-stage-label">{stage.label ?? "Stage –"}</span>
        <span className="runtime-stage-divider" aria-hidden="true" />
        {stage.clock === null
          ? <span className="runtime-stage-untimed">{stage.status === null ? "Not running" : STAGE_STATUS_LABEL[stage.status]}</span>
          : <strong className="runtime-stage-clock" role="timer" aria-label={`Time remaining ${stage.clock}`}>{stage.clock}</strong>}
        {stage.clock !== null && stage.status !== null && stage.status !== "active"
          ? <span className={`runtime-stage-status runtime-stage-status-${stage.status}`}>{STAGE_STATUS_LABEL[stage.status]}</span> : null}
      </div>
      <span className="runtime-header-separator" aria-hidden="true" />
      <span className={`runtime-connection-dot runtime-connection-${props.connection.state}`} role="status" aria-live="polite"
        aria-label={`Plenum status: ${props.connection.label}`} title={props.connection.label}>
        <span className="visually-hidden">{props.connection.label}</span></span>
      <button className="runtime-header-icon" type="button" onClick={props.onRefresh} disabled={props.refreshing}
        aria-label="Refresh authoritative state" title="Refresh authoritative state"><RuntimeIcon name="refresh" /><span>Refresh</span></button>
      {props.notifications === null ? null : <button className="runtime-header-icon runtime-notifications" type="button"
        onClick={props.notifications.onOpen} aria-description={props.notifications.label} title={props.notifications.label}>
        <RuntimeIcon name="bell" /><span>Injects</span>
        {props.notifications.count > 0 ? <span className="runtime-notification-count">{props.notifications.count > 99 ? "99+" : props.notifications.count}</span> : null}
      </button>}
      {props.themeToggle}
      {props.communicationTools}
      <HeaderMenu className="runtime-role-menu" label={`Role: ${props.roleLabel}. Open role menu`}
        toggle={<><span className="runtime-role-chip"><span className="runtime-role-dot" aria-hidden="true" />{props.roleLabel}</span><RuntimeIcon name="menu" /></>}>
        {props.roleMenu}
      </HeaderMenu>
    </div>
  </header>;
}

export interface RuntimeSidebarItem {
  id: string;
  label: string;
  icon: RuntimeIconName;
  href: string;
  current: boolean;
  count?: { value: number; emphasis: boolean; label: string } | undefined;
  onSelect?: (() => void) | undefined;
}

export interface RuntimeSidebarSection {
  id: string;
  /** Visible uppercase section label. */
  label: string;
  /** Accessible name of the section's navigation landmark. */
  navigationLabel: string;
  items: RuntimeSidebarItem[];
}

export function RuntimeSidebar({ id, sections, onHide, startHere }: {
  id: string; sections: RuntimeSidebarSection[]; onHide(): void; startHere: ReactNode;
}) {
  return <aside id={id} className="runtime-sidebar" aria-label="Session navigation">
    <div className="runtime-sidebar-sections">
      {sections.map((section, index) => <nav className="runtime-sidebar-section" aria-label={section.navigationLabel} key={section.id}>
        <div className="runtime-sidebar-heading">
          <h2>{section.label}</h2>
          {index === 0 ? <button className="runtime-sidebar-collapse" type="button" onClick={onHide} aria-controls={id}
            aria-expanded="true" aria-label="Hide workspace navigation" title="Hide workspace navigation"><RuntimeIcon name="chevronLeft" /></button> : null}
        </div>
        <ul>{section.items.map((item) => <li key={item.id}>
          <a href={item.href} aria-current={item.current ? "page" : undefined} onClick={(event) => {
            if (item.onSelect === undefined) return;
            event.preventDefault();
            item.onSelect();
          }}>
            <RuntimeIcon name={item.icon} />
            <span className="runtime-sidebar-label">{item.label}</span>
            {item.count === undefined || item.count.value === 0 ? null
              : <span className={`runtime-sidebar-count${item.count.emphasis ? " is-emphasis" : ""}`}>
                {item.count.value}<span className="visually-hidden"> {item.count.label}</span></span>}
          </a>
        </li>)}</ul>
      </nav>)}
    </div>
    <details className="runtime-start-here">
      <summary><span className="runtime-start-here-mark"><RuntimeIcon name="compass" /></span><span>Start here</span>
        <RuntimeIcon name="chevronUp" className="runtime-icon runtime-start-here-chevron" /></summary>
      <div className="runtime-start-here-body">{startHere}</div>
    </details>
  </aside>;
}

export function RuntimePageHeader({ eyebrow, title, titleId, description, actions, navigationToggle }: {
  eyebrow: string; title: string; titleId: string; description?: ReactNode; actions?: ReactNode; navigationToggle?: ReactNode;
}) {
  return <div className="runtime-page-header">
    <div className="runtime-page-heading">
      {navigationToggle}
      <p className="runtime-page-eyebrow">{eyebrow}</p>
      <h1 id={titleId}>{title}</h1>
      {description === undefined ? null : <div className="runtime-page-description">{description}</div>}
    </div>
    {actions === undefined ? null : <div className="runtime-page-actions">{actions}</div>}
  </div>;
}

/** Opens the navigation on narrow screens, or shows it again after it was hidden on wide screens. */
export function RuntimeNavigationToggle({ controls, expanded, onToggle }: { controls: string; expanded: boolean; onToggle(): void }) {
  return <button className="runtime-navigation-show" type="button" aria-controls={controls} aria-expanded={expanded} onClick={onToggle}>
    <RuntimeIcon name={expanded ? "chevronLeft" : "menu"} />{expanded ? "Close workspace navigation" : "Open workspace navigation"}
  </button>;
}
