import { useEffect, useState } from "react";

const petals = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const navigationDelay = 160;
const navigationEvent = "plenum:navigate";

export function navigateWithLoader(destination: string): void {
  window.dispatchEvent(new CustomEvent(navigationEvent, { detail: destination }));
}

export function PlenumLoader({ label = "Loading", overlay = false, visible = true }: {
  label?: string;
  overlay?: boolean;
  visible?: boolean;
}) {
  const loader = <div className="plenum-loader" role="status" aria-live="polite" aria-atomic="true" aria-label={label} aria-busy="true">
    <svg className="plenum-loader__star" viewBox="-16 -16 32 32" aria-hidden="true" focusable="false">
      {petals.map((angle) => <line className="plenum-loader__petal" x1="0" y1="-6" x2="0" y2="-13" transform={`rotate(${angle})`} key={angle} />)}
    </svg>
  </div>;
  return overlay ? <div className={`plenum-loader-overlay${visible ? " is-visible" : ""}`} aria-hidden={!visible}>{loader}</div> : loader;
}

export function PlatformNavigationLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let navigating = false;
    const navigate = (destination: string) => {
      if (navigating) return;
      navigating = true;
      setVisible(true);
      const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : navigationDelay;
      window.setTimeout(() => location.assign(destination), delay);
    };
    const onNavigate = (event: Event) => navigate((event as CustomEvent<string>).detail);
    const onPageShow = () => {
      navigating = false;
      setVisible(false);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor === null || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.hasAttribute("data-no-page-transition") || anchor.getAttribute("aria-disabled") === "true") return;
      const destination = new URL(anchor.href, location.href);
      // Workspaces on the same page crossfade through the document view transition; only a change of surface uses the full-page loader.
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
      event.preventDefault();
      navigate(destination.href);
    };
    document.addEventListener("click", onClick);
    window.addEventListener(navigationEvent, onNavigate);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener(navigationEvent, onNavigate);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return <PlenumLoader label="Loading next page" overlay visible={visible} />;
}
