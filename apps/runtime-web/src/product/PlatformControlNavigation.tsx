import { SecondaryNavigation } from "./SecondaryNavigation.js";

export function PlatformControlNavigation({ current }: { current: "organizations" | "administrators" }) {
  return <SecondaryNavigation label="Platform control plane" items={[
    { href: "/platform/organizations", label: "Organizations", current: current === "organizations" },
    { href: "/platform/administrators", label: "Platform administrators", current: current === "administrators" }
  ]} />;
}
