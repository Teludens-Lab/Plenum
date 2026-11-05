export function PlatformControlNavigation({ current }: { current: "organizations" | "administrators" }) {
  return <nav className="platform-control-navigation" aria-label="Platform control plane">
    <a href="/platform/organizations" aria-current={current === "organizations" ? "page" : undefined}>Organizations</a>
    <a href="/platform/administrators" aria-current={current === "administrators" ? "page" : undefined}>Platform administrators</a>
  </nav>;
}
