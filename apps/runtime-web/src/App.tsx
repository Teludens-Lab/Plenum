import { LandingPage } from "./landing/LandingPage.js";
import { reportFileLabel, formatDate, displayStatus, statusClass, authorityLabel, plural } from "../../../packages/design-system/src/presentation.mjs";
import { ArtifactCard, ArtifactContent, ArtifactHeading, CreateTask, CreateWorkspace, FieldEditor, createTaskKey } from "./runtime/ArtifactForms.js";
import { FormAttachments } from "./runtime/FormAttachments.js";
import { StaffingPersonPicker } from "./runtime/StaffingPersonPicker.js";
import { OperatorInjectSchedule } from "./runtime/OperatorInjectSchedule.js";
import { RecordExport } from "./runtime/RecordInterchange.js";
import { ArtifactWorkspace, moduleArtifacts } from "./runtime/ArtifactWorkspace.js";
import { SessionTool } from "./runtime/SessionTool.js";
import { StageControls } from "./runtime/StageControls.js";
import { extensionSeconds } from "./runtime/timer-extension.js";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import {
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type AdjudicationRequestV1,
  type AdjudicationOptionV1,
  type ErrorEnvelopeV1,
  type EffectProposalV1,
  type JsonObject,
  type OperatorProjectionV1,
  type ReadinessProjectionV1,
  type ReplayCapabilityV1,
  type RuntimeActionV1,
  type RuntimeArtifactV1,
  type RuntimeInjectV1,
  type RuntimeMessageV1,
  type RuntimeModuleV1,
  type RuntimePollV1,
  type RuntimeProjectionV1,
  type RuntimeVoiceChannelV1,
  type FloorLeaseV1,
  type ProductShellContextV1
} from "@plenum/event-contracts";
import type { OfflineCommandV1, OfflineOutboxV1, SyncBootstrapV1, SyncSnapshotV1, SyncDeltasV1 } from "@plenum/event-contracts";
import {
  canQueueOffline,
  createOfflineOutbox,
  enqueueOfflineCommand,
  minimizeOfflineProjection,
  orderedOfflineCommands,
  recordOfflineReceipt,
  subscribeRuntime,
  decodeRuntimeSse,
  updateOfflineDraft
} from "@plenum/sync-client";
import { VoiceControls } from "./voice/VoiceControls.js";
import { AdjudicationReview } from "./adjudication/AdjudicationReview.js";
import { RevisionHistory } from "./runtime/RevisionHistory.js";
import type { RuntimeArtifactHistoryV1 } from "@plenum/event-contracts";
import { OfflineRuntimeStore } from "./offline/storage.js";
import { SessionTimeline } from "./runtime/SessionTimeline.js";
import { SessionSettings } from "./runtime/SessionSettings.js";
import { LocalDraftContext } from "./runtime/LocalDrafts.js";
import { ProjectPortal } from "./product/ProjectPortal.js";
import { LifecyclePortal } from "./product/LifecyclePortal.js";
import { ParticipantPortal } from "./product/ParticipantPortal.js";
import { AdministrationPortal } from "./product/AdministrationPortal.js";
import { ResearchReportingPortal } from "./product/ResearchReportingPortal.js";
import { ProjectDemo } from "./product/ProjectDemo.js";
import { PlatformOrganizationsPortal } from "./product/PlatformOrganizationsPortal.js";
import { PlatformAdministratorsPortal } from "./product/PlatformAdministratorsPortal.js";
import { navigateWithLoader, PlenumLoader } from "./PlenumLoader.js";
import {
  formatStageClock,
  RuntimeHeader,
  RuntimeIcon,
  runtimeIconName,
  RuntimeNavigationToggle,
  RuntimePageHeader,
  RuntimeSidebar,
  useStageClock,
  useWideViewport,
  type RuntimeIconName,
  type RuntimeSidebarItem,
  type RuntimeSidebarSection
} from "./runtime/RuntimeFrame.js";
import { ToastRegion, useToasts } from "./runtime/Toasts.js";

type ConnectionState = "loading" | "online" | "offline" | "unauthorized" | "error" | "reconnecting";

const DEVICE_STORAGE_KEY = "plenum.runtime.deviceId";
const offlineStore = new OfflineRuntimeStore();

class ApiError extends Error {
  constructor(readonly status: number, readonly envelope: ErrorEnvelopeV1) {
    super(envelope.error.message);
  }
}

function isCommandReceipt(value: unknown): value is CommandReceiptV1 {
  return typeof value === "object" && value !== null && "commandId" in value &&
    typeof value.commandId === "string" && "status" in value &&
    ["received", "accepted", "rejected", "needs_reconciliation"].includes(String(value.status));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) {
    if (typeof body === "object" && body !== null && "error" in body) {
      throw new ApiError(response.status, body as ErrorEnvelopeV1);
    }
    throw new Error(`Request failed with status ${response.status}`);
  }
  return body as T;
}

function sessionId(): string | null {
  const stablePath = window.location.pathname.match(/^\/(?:admin\/)?sessions\/([0-9a-f-]{36})(?:\/|$)/iu)?.[1];
  return stablePath ?? new URLSearchParams(window.location.search).get("sessionId");
}

function friendlyReference(value: string, fallback: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(value)) return fallback;
  return value.replaceAll(/[-_]+/gu, " ").replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
}

function connectionLabel(state: ConnectionState): string {
  return state === "online" ? "Connected"
    : state === "reconnecting" ? "Reconnecting"
    : state === "loading" ? "Connecting"
      : state === "offline" ? "Offline"
        : state === "unauthorized" ? "Sign-in required"
          : "Connection error";
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label = connectionLabel(state);
  return <span className={`badge badge-${state}`} role="status" aria-live="polite" aria-atomic="true" aria-label={`Plenum status: ${label}`}>{label}</span>;
}

function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const label = connectionLabel(state);
  return <span className={`connection-indicator connection-indicator-${state}`} role="status" aria-live="polite" aria-label={`Plenum status: ${label}`}>
    <span className="visually-hidden">{label}</span>
  </span>;
}

function BrandWordmark() {
  return <a className="brand-wordmark" href="/" aria-label="Plenum home">
    <img className="brand-wordmark-dark" src="/branding/plenum-wordmark-primary.png" alt="Plenum" width="2170" height="725" />
    <img className="brand-wordmark-light" src="/branding/plenum-wordmark-primary.png" alt="" width="2170" height="725" aria-hidden="true" />
  </a>;
}

function ThemeToggle({ landing = false }: { landing?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const synchronizeTheme = (event: StorageEvent) => {
      if (event.key === "plenum.theme") setTheme(event.newValue === "dark" || event.newValue === "light" ? event.newValue : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    };
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      try { if (["light", "dark"].includes(localStorage.getItem("plenum.theme") ?? "")) return; } catch { /* Follow the system when storage is unavailable. */ }
      setTheme(preference.matches ? "dark" : "light");
    };
    window.addEventListener("storage", synchronizeTheme);
    preference.addEventListener("change", followSystem);
    return () => { window.removeEventListener("storage", synchronizeTheme); preference.removeEventListener("change", followSystem); };
  }, [theme]);
  const nextTheme = theme === "light" ? "dark" : "light";
  const toggleTheme = () => { setTheme(nextTheme); try { localStorage.setItem("plenum.theme", nextTheme); } catch { /* The document theme still applies. */ } };
  if (landing) return <button className="theme-toggle" type="button" aria-label={`Theme: ${theme}. Use ${nextTheme} theme`} title={`Use ${nextTheme} theme`} aria-pressed={theme === "dark"} onClick={toggleTheme}>
        <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>
        </svg>
        <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>
        </svg>
      </button>;
  return <button className="btn-secondary theme-toggle" type="button"
    aria-label={`Theme: ${theme}. Use ${nextTheme} theme`} title={`Use ${nextTheme} theme`}
    onClick={toggleTheme}>
    <span className="theme-label">Theme</span>{theme === "light" ? <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg> : <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
    </svg>}
  </button>;
}

const WORKSPACE_ICON_PATHS = {
  projects: "M4 7h6l2 2h8v10H4zM4 7V5h6l2 2",
  lifecycle: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5",
  sessions: "M4 5h16v14H4zM8 3v4M16 3v4M4 10h16",
  editor: "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3",
  administration: "M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4",
  platform: "M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01",
  research: "M4 4v16h16M8 16v-4M12 16V8M16 16v-6"
} as const;

const RUNTIME_MODULE_ICONS: Record<RuntimeModuleV1["type"], RuntimeIconName> = {
  session_status: "status",
  artifact_form: "edit",
  task_list: "list",
  artifact_presentation: "presentation",
  slide_deck: "deck",
  resource_library: "resources",
  message_inbox: "inbox",
  proposal_thread: "proposal",
  inject_inbox: "bell",
  session_timeline: "list"
};

function WorkspaceIcon({ name }: { name: keyof typeof WORKSPACE_ICON_PATHS }) {
  return <svg className="section-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={WORKSPACE_ICON_PATHS[name]} /></svg>;
}

function Shell({ connection, children, bounded = false, entry = false, entryLoading = false, brandContent, headerContent }: {
  connection: ConnectionState; children: ReactNode; bounded?: boolean; entry?: boolean; entryLoading?: boolean;
  brandContent?: ReactNode;
  headerContent?: ReactNode;
}) {
  return <div className={`app-frame${bounded ? " app-frame-bounded" : ""}${entry ? " app-frame-entry" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      {brandContent ?? <BrandWordmark />}
      {entry ? <span className="entry-descriptor">Governed simulation platform</span> : null}
      {entry ? <div className="header-actions entry-header-actions">
        {entryLoading ? null : <>
          <a className="entry-header-sign-in" href="/auth/login?returnTo=%2F">Sign in</a>
        </>}
        <ThemeToggle />
        <span className="visually-hidden" role="status" aria-live="polite"
          aria-label={`Plenum status: ${entryLoading ? "Connecting" : "Sign-in required"}`}>
          {entryLoading ? "Connecting" : "Sign-in required"}
        </span>
      </div> : headerContent ?? <div className="header-actions"><ThemeToggle /><ConnectionBadge state={connection} /></div>}
    </header>
    {children}
  </div>;
}

function EntryTransition({ label }: { label: string }) {
  return <PlenumLoader label={label} overlay />;
}

function EntryLanding() {
  const [transitioning, setTransitioning] = useState(false);
  const signInOpen = new URLSearchParams(window.location.search).get("signIn") === "1";
  const beginEntry = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    if (transitioning) return;
    setTransitioning(true);
    const destination = event.currentTarget.href;
    window.setTimeout(() => window.location.assign(destination), 160);
  };
  if (signInOpen) return <Shell connection="unauthorized" entry>
    <main id="main-content" className="entry-auth-page" tabIndex={-1}><section className="entry-auth-panel" aria-labelledby="entry-auth-title">
      <a className="entry-auth-close" href="/" aria-label="Close sign in"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg></a>
      <BrandWordmark />
      <h1 id="entry-auth-title">Welcome back.</h1><p className="entry-auth-intro">Continue through your Organization identity provider.</p>
      <form action="/auth/login" method="get"><div className="field"><label htmlFor="organization-email">Work email</label>
        <input id="organization-email" name="email" type="email" autoComplete="email" autoFocus required placeholder="you@organization.com" /></div>
        <input type="hidden" name="returnTo" value="/" />
        <button className="entry-auth-submit" type="submit">Continue securely</button></form>
      <p className="entry-auth-note">Plenum uses your verified domain to select the governed sign-in provider. Your password stays with your Organization.</p>
      <a className="entry-recovery-link" href="/auth/login?platformRecovery=1&returnTo=%2Fplatform%2Forganizations">Platform recovery</a>
    </section></main>
  </Shell>;
  return <LandingPage themeControl={<ThemeToggle landing />} onEntry={beginEntry}>
    {transitioning ? <EntryTransition label="Resolving next state" /> : null}
  </LandingPage>;
}

function EntryLoadingState() {
  return <Shell connection="loading" entry entryLoading>
    <main id="main-content" className="entry-loading-page" tabIndex={-1} aria-busy="true">
      <h1 className="visually-hidden">Loading Plenum</h1><PlenumLoader label="Resolving next state" overlay />
    </main>
  </Shell>;
}

function FirstAdminInvitation({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<{ organizationName: string } | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError("");
    try {
      setAccepted(await api<{ organizationName: string }>(`/v1/platform/invitations/${token}/accept`, {
        method: "POST", body: JSON.stringify({ displayName: String(data.get("displayName")) })
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invitation could not be accepted.");
    } finally { setPending(false); }
  };
  return <Shell connection="unauthorized" bounded headerContent={<div className="header-actions"><ThemeToggle /></div>}>
    <main id="main-content" className="first-admin-entry" tabIndex={-1}>
      <section className="first-admin-panel" aria-labelledby="first-admin-title">
        {accepted === null ? <><h1 id="first-admin-title">Accept Organization Admin access</h1>
          <p>Set the name shown to members of your Organization. This invitation grants Organization authority, not Plenum platform authority.</p>
          <form onSubmit={(event) => void submit(event)}><div className="field"><label htmlFor="first-admin-display-name">Display name</label>
            <input id="first-admin-display-name" name="displayName" autoComplete="name" required minLength={2} maxLength={200}
              aria-invalid={error.length > 0} aria-describedby={error.length > 0 ? "first-admin-error" : undefined} /></div>
            {error.length > 0 ? <p id="first-admin-error" className="field-error" role="alert">{error}</p> : null}
            <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Accepting…" : "Accept Admin invitation"}</button></form></> : <>
          <h1 id="first-admin-title">Admin access accepted</h1><p>Your Admin membership for {accepted.organizationName} is ready. After a Plenum Platform Administrator activates the Organization, sign in with this invitationâ€™s verified email address to link your identity provider account.</p>
          <a className="btn-primary link-button" href="/auth/login?returnTo=%2Fadmin%2Fmembers">Sign in after activation</a></>}
      </section>
    </main>
  </Shell>;
}

function PlatformAdministratorInvitation({ token }: { token: string }) {
  const signInUrl = `/auth/login?platformAdminInvitation=${encodeURIComponent(token)}&stepUp=1&returnTo=%2Fplatform%2Fadministrators`;
  return <Shell connection="unauthorized" bounded headerContent={<div className="header-actions"><ThemeToggle /></div>}>
    <main id="main-content" className="first-admin-entry" tabIndex={-1}>
      <section className="first-admin-panel" aria-labelledby="platform-administrator-invitation-title">
        <h1 id="platform-administrator-invitation-title">Join Plenum platform operations</h1>
        <p>Sign in through the identity provider for the invited work email. Plenum will verify the exact email address and require multifactor authentication before assigning platform authority.</p>
        <a className="btn-primary link-button" href={signInUrl}>Verify identity and continue</a>
        <p className="field-hint">This invitation grants Plenum Platform Administrator authority. It does not add an Organization Role.</p>
      </section>
    </main>
  </Shell>;
}

function OrganizationWorkforceInvitation({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<{ organizationName: string; email: string } | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError("");
    try { setAccepted(await api<{ organizationName: string; email: string }>(`/v1/organization/invitations/${token}/accept`, {
      method: "POST", body: JSON.stringify({ displayName: String(data.get("displayName")) })
    })); } catch (cause) { setError(cause instanceof Error ? cause.message : "The invitation could not be accepted."); }
    finally { setPending(false); }
  };
  const signInUrl = accepted === null ? "#" : `/auth/login?email=${encodeURIComponent(accepted.email)}&returnTo=%2F`;
  return <Shell connection="unauthorized" bounded headerContent={<div className="header-actions"><ThemeToggle /></div>}>
    <main id="main-content" className="first-admin-entry" tabIndex={-1}><section className="first-admin-panel" aria-labelledby="workforce-invitation-title">
      {accepted === null ? <><h1 id="workforce-invitation-title">Join your Organization</h1><p>Confirm the name shown to colleagues. Your Organization Roles remain inactive until Plenum verifies the invited work identity.</p>
        <form onSubmit={(event) => void submit(event)}><div className="field"><label htmlFor="workforce-invitation-name">Display name</label><input id="workforce-invitation-name" name="displayName" autoComplete="name" required minLength={2} maxLength={200}
          aria-invalid={error.length > 0} aria-describedby={error.length > 0 ? "workforce-invitation-error" : undefined} /></div>
          {error.length > 0 ? <p id="workforce-invitation-error" className="field-error" role="alert">{error}</p> : null}
          <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Acceptingâ€¦" : "Accept invitation"}</button></form></> : <>
        <h1 id="workforce-invitation-title">Invitation accepted</h1><p>Continue through {accepted.organizationName} sign-in with <strong>{accepted.email}</strong>. Exact-email verification activates the approved Organization Roles.</p>
        <a className="btn-primary link-button" href={signInUrl}>Verify identity and continue</a></>}
    </section></main>
  </Shell>;
}

function StatePage({ connection, title, message, retry }: {
  connection: ConnectionState; title: string; message: string; retry?: () => void;
}) {
  return <Shell connection={connection}>
    <main id="main-content" className="state-page" tabIndex={-1}>
      {connection === "loading" ? <><h1 className="visually-hidden">{title}</h1><PlenumLoader label={message} overlay /></> : <section className="workspace-section state-card">
        <p className="eyebrow">Runtime status</p>
        <h1>{title}</h1>
        <p role={connection === "error" ? "alert" : "status"}>{message}</p>
        {retry === undefined ? null : <button className="btn-primary" type="button" onClick={retry}>Retry</button>}
      </section>}
    </main>
  </Shell>;
}

const clearsOfflineData = (error: ApiError): boolean =>
  ["ACCESS_REVOKED", "NOT_A_PARTICIPANT", "DEVICE_NOT_REGISTERED", "PERMISSION_DENIED"]
    .includes(error.envelope.error.code);

function AccessContext({ context, titleId, onSignOut }: {
  context: ProductShellContextV1;
  titleId: string;
  onSignOut: () => Promise<void>;
}) {
  const roles = context.organization.roles.map((role) => friendlyReference(role, "Session participant")).join(", ") || "Session participant";
  return <>
    <div className="account-menu-identity"><h2 id={titleId}>{context.principal.displayName}</h2>
      <p>{context.organization.name}</p><span className="badge badge-state">{roles}</span></div>
    <p className="account-menu-connection"><span className="connection-indicator connection-indicator-online" aria-hidden="true" />Connected</p>
    <button className="account-menu-sign-out" type="button" onClick={() => void onSignOut()}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></svg>
      Sign out
    </button>
  </>;
}

function ProductHeader({ context, connection, workspaceTitle, navigationOpen, accountOpen, accountToggleRef, accountMenuRef,
  showNavigation, onToggleNavigation, onToggleAccount, onSignOut }: {
  context: ProductShellContextV1;
  connection: ConnectionState;
  workspaceTitle: string;
  navigationOpen: boolean;
  showNavigation: boolean;
  accountOpen: boolean;
  accountToggleRef: RefObject<HTMLButtonElement | null>;
  accountMenuRef: RefObject<HTMLElement | null>;
  onToggleNavigation: () => void;
  onToggleAccount: () => void;
  onSignOut: () => Promise<void>;
}) {
  const role = authorityLabel(context.organization.roles, context.platformRoles);
  return <>
    <div className="product-header-context" aria-label="Current workspace context">
      <span className="product-header-organization" title={context.organization.name}>{context.organization.name}</span>
      <svg className="product-header-separator" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
      <span id="product-title" className="product-header-title">{workspaceTitle}</span>
    </div>
    <div className="header-actions product-header-actions">
      {showNavigation ? <button className="workspace-navigation-toggle header-icon-button" type="button" aria-expanded={navigationOpen}
        aria-controls="workspace-navigation" aria-label={navigationOpen ? "Close workspaces" : "Open workspaces"} onClick={onToggleNavigation}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>Workspaces</span>
      </button> : null}
      <ConnectionIndicator state={connection} />
      <ThemeToggle />
      <button ref={accountToggleRef} className="account-context-toggle" type="button" aria-expanded={accountOpen}
        aria-haspopup="dialog" aria-controls="account-context-menu"
        aria-label={`${accountOpen ? "Close" : "Open"} account menu for ${context.principal.displayName} — ${role}`} onClick={onToggleAccount}>
        <span className="account-role-label">{role}</span>
        <svg className="account-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
      </button>
      {accountOpen ? <section ref={accountMenuRef} id="account-context-menu" className="account-context-menu" role="dialog"
        aria-labelledby="account-menu-title" tabIndex={-1}>
        <AccessContext context={context} titleId="account-menu-title" onSignOut={onSignOut} />
      </section> : null}
    </div>
  </>;
}

function ProductEntry() {
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [context, setContext] = useState<ProductShellContextV1 | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLElement>(null);
  const accountToggleRef = useRef<HTMLButtonElement>(null);
  const administration = /^\/admin\/(?:members|plugins|deployment|data-policy|identity)\/?$/u.test(window.location.pathname);
  const researchReporting = /^\/research\/reports\/?$/u.test(window.location.pathname);
  const platform = /^\/platform\/(?:organizations(?:\/[0-9a-f-]{36})?|administrators)\/?$/iu.test(window.location.pathname);
  const platformAdministrators = /^\/platform\/administrators\/?$/iu.test(window.location.pathname);

  const load = useCallback(async () => {
    setConnection("loading");
    setUnauthenticated(false);
    try {
      const next = await api<ProductShellContextV1>("/v1/product-context");
      setContext(next);
      setConnection("online");
    } catch (cause) {
      setContext(null);
      if (cause instanceof ApiError && cause.status === 401) {
        setUnauthenticated(true);
        setConnection("unauthorized");
      } else if (!navigator.onLine || cause instanceof TypeError) {
        setConnection("offline");
      } else {
        setConnection("error");
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const offline = () => setConnection("offline");
    const online = () => void load();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [load]);
  useEffect(() => {
    if (!accountOpen) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || accountMenuRef.current?.contains(event.target) || accountToggleRef.current?.contains(event.target)) return;
      setAccountOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      requestAnimationFrame(() => accountToggleRef.current?.focus());
    };
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [accountOpen]);

  const signOut = async () => {
    try {
      await api<{ signedOut: true }>("/v1/auth/logout", { method: "POST", body: "{}" });
      setContext(null);
      setUnauthenticated(true);
      setConnection("unauthorized");
    } catch {
      setConnection("error");
    }
  };

  const toggleAccountContext = () => {
    if (accountOpen) {
      setAccountOpen(false);
      return;
    }
    setNavigationOpen(false);
    setAccountOpen(true);
    requestAnimationFrame(() => accountMenuRef.current?.focus());
  };

  const closeAccountContext = (returnFocus = false) => {
    setAccountOpen(false);
    if (returnFocus) requestAnimationFrame(() => accountToggleRef.current?.focus());
  };

  const requestedWorkspace = new URLSearchParams(window.location.search).get("workspace");
  const releaseOrSessionDetail = /^\/(?:releases|sessions)\/[0-9a-f-]{36}$/iu.test(window.location.pathname);
  const hashWorkspace = window.location.hash === "#participant-sessions-title" ? "participant" :
    window.location.hash === "#release-catalog" || window.location.hash === "#session-catalog" ? "lifecycle" : null;
  const canUseProjects = context?.destinations.includes("studio") ?? false;
  const canUseLifecycle = context?.destinations.includes("operations") ?? false;
  const canUsePlatform = context?.destinations.includes("platform") ?? false;
  const canUseResearch = context?.organization.roles.includes("research_analyst") ?? false;
  const lifecycleTitle = context?.organization.roles.some((role) => role === "admin" || role === "operator") ? "Releases and Sessions" : "Releases";
  const defaultWorkspace = canUseProjects ? "projects" : canUseLifecycle ? "lifecycle" : canUsePlatform ? "platform" : canUseResearch ? "research" : "participant";
  const workspace = platform ? "platform" : administration ? "administration" : researchReporting ? "research" : releaseOrSessionDetail ? "lifecycle" :
    requestedWorkspace === "projects" && canUseProjects ? "projects" :
      requestedWorkspace === "lifecycle" && canUseLifecycle ? "lifecycle" :
        requestedWorkspace === "participant" ? "participant" : hashWorkspace ?? defaultWorkspace;
  const workspaceTitle = workspace === "projects" ? "Projects" : workspace === "lifecycle" ? lifecycleTitle :
    workspace === "participant" ? "Your Sessions" : workspace === "administration" ? "Administration" :
      workspace === "platform" ? "Platform control plane" : "Research reports";

  if (connection === "loading") return <EntryLoadingState />;
  if (unauthenticated) return <EntryLanding />;

  return <Shell connection={connection} bounded headerContent={context === null ? undefined : <ProductHeader context={context} connection={connection}
    workspaceTitle={workspaceTitle} navigationOpen={navigationOpen} showNavigation={true} accountOpen={accountOpen} accountToggleRef={accountToggleRef}
    accountMenuRef={accountMenuRef} onToggleNavigation={() => { closeAccountContext(); setNavigationOpen((open) => !open); }}
    onToggleAccount={toggleAccountContext} onSignOut={async () => { closeAccountContext(); await signOut(); }} />}>
    <main id="main-content" className="product-shell" data-workspace={workspace} tabIndex={-1} aria-labelledby={context === null ? undefined : "product-title"}>
      {!unauthenticated && connection === "offline" ? <section className="workspace-section shell-state teludens-state" data-state="offline">
        <p className="eyebrow">Offline</p>{context === null ? <h1>Account context is unavailable</h1> : <h2>Account context is unavailable</h2>}<p>No protected workspace data is shown while Plenum is disconnected.</p>
        <button className="btn-secondary" type="button" onClick={() => void load()}>Retry connection</button>
      </section> : null}
      {!unauthenticated && connection === "error" ? <section className="workspace-section shell-state teludens-state" data-state="error">
        <p className="eyebrow">Unable to open Plenum</p>{context === null ? <h1>Account context did not load</h1> : <h2>Account context did not load</h2>}<p>Retry safely. No Project or Session was changed.</p>
        <button className="btn-secondary" type="button" onClick={() => void load()}>Retry</button>
      </section> : null}
      {context === null ? null : <div className={`shell-grid${workspace === "participant" ? " participant-shell-grid" : ""}`} data-density={workspace === "participant" ? "standard" : "operations"}>
        <nav id="workspace-navigation" className={`shell-navigation teludens-node${navigationOpen ? " is-open" : ""}`} aria-label="Workspaces">
                    <h2 className="visually-hidden">Workspaces</h2>
                    <ul>
            {canUseProjects ? <li><a aria-current={workspace === "projects" ? "page" : undefined} href="/?workspace=projects"><WorkspaceIcon name="projects" />Projects<span>Govern designs and reusable templates</span></a></li> : null}
            {canUseLifecycle ? <li><a aria-current={workspace === "lifecycle" ? "page" : undefined} href="/?workspace=lifecycle"><WorkspaceIcon name="lifecycle" />{lifecycleTitle}<span>Publish, configure, and monitor delivery</span></a></li> : null}
            <li><a aria-current={workspace === "participant" ? "page" : undefined} href="/?workspace=participant"><WorkspaceIcon name="sessions" />Your Sessions<span>Enter an invited or assigned Session</span></a></li>
            {canUseProjects ? <li><a href="/studio/"><WorkspaceIcon name="editor" />Project editor<span>Open the focused authoring workspace</span></a></li> : null}
            {context.organization.roles.some((role) => role === "admin" || role === "publisher") ? <li><a aria-current={administration ? "page" : undefined} href={context.organization.roles.includes("admin") ? "/admin/members" : "/admin/plugins"}><WorkspaceIcon name="administration" />Administration<span>Roles, Plugins, policy, and deployment posture</span></a></li> : null}
            {canUsePlatform ? <li><a aria-current={workspace === "platform" ? "page" : undefined} href="/platform/organizations"><WorkspaceIcon name="platform" />Platform control plane<span>Provision and govern Organization access</span></a></li> : null}
            {context.organization.roles.includes("research_analyst") ? <li><a aria-current={workspace === "research" ? "page" : undefined} href="/research/reports"><WorkspaceIcon name="research" />Research reports<span>Consent-filtered evidence and provenance</span></a></li> : null}
          </ul>
        </nav>
        <div className={`product-workspaces${workspace === "participant" ? " participant-product-workspaces" : ""}`} aria-labelledby="product-title">
          {workspace === "projects" || workspace === "lifecycle" && !releaseOrSessionDetail ? <h1>{workspaceTitle}</h1> : null}
          {workspace === "platform" ? canUsePlatform ? platformAdministrators ? <PlatformAdministratorsPortal /> : <PlatformOrganizationsPortal /> : <section className="workspace-section portal-state teludens-state" data-state="unauthorized">
            <h1>Platform authority unavailable</h1><p>Active Plenum Platform Administrator authority is required. Organization administration does not grant this access.</p></section> :
            administration ? <AdministrationPortal organizationId={context.organization.id} roles={context.organization.roles} /> : workspace === "research" ?
            context.organization.roles.includes("research_analyst") ? <ResearchReportingPortal /> :
              <section className="workspace-section portal-state teludens-state" data-state="unauthorized"><p className="eyebrow">Least privilege</p>
                <h1>Research reporting access unavailable</h1><p>An active Research Analyst Organization Role and project-scoped Research Access Grant are required. Protected research data was not loaded.</p></section> :
            workspace === "projects" ? <ProjectPortal /> : workspace === "lifecycle" ?
              <LifecyclePortal /> : <ParticipantPortal displayName={context.principal.displayName} />}
        </div>
      </div>}
    </main>
  </Shell>;
}

async function submitQueuedCommand(sessionId: string, command: CommandEnvelopeV1): Promise<CommandReceiptV1> {
  try {
    return await api<CommandReceiptV1>(`/v1/sessions/${sessionId}/commands/${command.commandId}`);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
  }
  const response = await fetch(`/v1/sessions/${sessionId}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command)
  });
  const body: unknown = await response.json();
  if (isCommandReceipt(body)) return body;
  if (typeof body === "object" && body !== null && "error" in body) {
    throw new ApiError(response.status, body as ErrorEnvelopeV1);
  }
  throw new Error(`Command returned an invalid response with status ${response.status}`);
}

async function reconcileOfflineOutbox(sessionId: string, outbox: OfflineOutboxV1): Promise<{
  outbox: OfflineOutboxV1;
  accepted: number;
  rejected: number;
  reconciliation: number;
}> {
  let current = outbox;
  let accepted = 0;
  let rejected = 0;
  let reconciliation = 0;
  for (const entry of orderedOfflineCommands(outbox.entries.filter(({ status }) =>
    status === "local_pending" || status === "received"))) {
    const receipt = await submitQueuedCommand(sessionId, entry.command);
    current = recordOfflineReceipt(current, receipt);
    if (receipt.status === "accepted") {
      accepted += 1;
      current = { ...current, entries: current.entries.filter(({ command }) => command.commandId !== receipt.commandId) };
    } else if (receipt.status === "rejected") rejected += 1;
    else if (receipt.status === "needs_reconciliation") reconciliation += 1;
  }
  return { outbox: current, accepted, rejected, reconciliation };
}

function OfflineDraftEditor({ entry, save }: { entry: OfflineCommandV1; save(payload: JsonObject): Promise<void> }) {
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("draft");
    try {
      const payload: unknown = JSON.parse(String(value));
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new Error("object required");
      setError("");
      void save(payload as JsonObject);
    } catch {
      setError("Draft data must be a JSON object.");
    }
  };
  return <form className="offline-draft" onSubmit={submit}>
    <label htmlFor={`offline-draft-${entry.command.commandId}`}>Editable local draft</label>
    <textarea id={`offline-draft-${entry.command.commandId}`} name="draft" rows={6}
      defaultValue={JSON.stringify(entry.draftPayload, null, 2)} aria-describedby={`offline-error-${entry.command.commandId}`} />
    <p id={`offline-error-${entry.command.commandId}`} className="field-error">{error}</p>
    <button className="btn-secondary" type="submit">Save draft on this device</button>
  </form>;
}

function OfflineOutboxPanel({ outbox, retry, saveDraft }: {
  outbox: OfflineOutboxV1;
  retry(): void;
  saveDraft(commandId: string, payload: JsonObject): Promise<void>;
}) {
  if (outbox.entries.length === 0) return null;
  const pending = outbox.entries.some(({ status }) => status === "local_pending" || status === "received");
  return <section className="status-panel status-warning offline-outbox" aria-labelledby="offline-outbox-title">
    <div>
      <h2 id="offline-outbox-title">Offline Outbox</h2>
      <p><code>local_pending</code> means saved on this device, not submitted.</p>
    </div>
    <ol className="offline-command-list">
      {outbox.entries.map((entry) => <li key={entry.command.commandId}>
        <div className="card-heading">
          <strong>{entry.command.operationType}</strong>
          <span className={statusClass(entry.status)}>{displayStatus(entry.status)}</span>
        </div>
        {entry.receipt?.message === null || entry.receipt?.message === undefined ? null : <p>{entry.receipt.message}</p>}
        {entry.status === "rejected" || entry.status === "needs_reconciliation"
          ? <OfflineDraftEditor entry={entry} save={(payload) => saveDraft(entry.command.commandId, payload)} />
          : null}
      </li>)}
    </ol>
    {pending ? <button className="btn-secondary" type="button" onClick={retry}>Reconcile with Session Authority</button> : null}
  </section>;
}

type SendInformation = (operationType: string, aggregateId: string, expectedVersion: number, payload: JsonObject) => Promise<CommandReceiptV1 | null>;

function EffectProposalReview({ proposals, disabled, decide }: {
  proposals: EffectProposalV1[];
  disabled: boolean;
  decide(proposal: EffectProposalV1, decision: "approve" | "reject" | "return", reason: string): void;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (proposals.length === 0) return null;
  return <section aria-labelledby="effect-proposals-title">
    <div className="section-heading"><h2 id="effect-proposals-title">Effect Proposals</h2></div>
    <p className="hint">Plugin output is staged only. Authoritative state changes only after an approved Command receives a server receipt.</p>
    <div className="card-grid">{proposals.map((proposal, index) => {
      const reason = reasons[proposal.id] ?? "";
      return <article className="card effect-proposal" key={proposal.id} aria-labelledby={`effect-${proposal.id}`}>
        <div className="card-heading"><h3 id={`effect-${proposal.id}`}>{friendlyReference(proposal.targetStateVariableId, `Proposed state change ${index + 1}`)}</h3>
          <span className={statusClass(proposal.status)}>{displayStatus(proposal.status)}</span></div>
        <dl className="metadata"><div><dt>Operation</dt><dd>{proposal.operation}</dd></div><div><dt>Proposed value</dt><dd><code>{JSON.stringify(proposal.value)}</code></dd></div></dl>
        <p>{proposal.rationale}</p>
        <details className="provenance-disclosure"><summary>Provenance</summary><dl className="proposal-provenance">
          <div><dt>State reference</dt><dd><code>{proposal.targetStateVariableId}</code></dd></div>
          <div><dt>Plugin digest</dt><dd><code>{proposal.pluginDigest}</code></dd></div>
          <div><dt>Input digest</dt><dd><code>{proposal.inputDigest}</code></dd></div>
          <div><dt>Proposal hash</dt><dd><code>{proposal.proposalHash}</code></dd></div>
        </dl></details>
        {proposal.status !== "in_review" ? null : <>
          <div className="field"><label htmlFor={`reason-${proposal.id}`}>Decision reason</label>
            <textarea id={`reason-${proposal.id}`} value={reason} maxLength={2000} disabled={disabled}
              onChange={(event) => setReasons((current) => ({ ...current, [proposal.id]: event.target.value }))} />
            <p className="hint">Required for approve, reject, or return.</p></div>
          <div className="actions" aria-label={`Decision for ${proposal.targetStateVariableId}`}>
            <button className="btn-primary" type="button" disabled={disabled || reason.trim().length === 0} onClick={() => decide(proposal, "approve", reason.trim())}>Approve effect</button>
            <button className="btn-secondary" type="button" disabled={disabled || reason.trim().length === 0} onClick={() => decide(proposal, "return", reason.trim())}>Return for review</button>
            <button className="btn-secondary" type="button" disabled={disabled || reason.trim().length === 0} onClick={() => decide(proposal, "reject", reason.trim())}>Reject effect</button>
          </div>
        </>}
      </article>;
    })}</div>
  </section>;
}

function messageSummary(message: RuntimeMessageV1): string {
  for (const key of ["text", "body", "title"]) {
    const value = message.content[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return message.operationType.replaceAll("_", " ").replace("message.", "");
}

function MessageInbox({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [sourceId, setSourceId] = useState("");
  const routes = Array.isArray(module.configuration.sendRoutes) ? module.configuration.sendRoutes.flatMap((item) =>
    typeof item === "object" && item !== null && !Array.isArray(item) && typeof item.routeId === "string" && typeof item.label === "string"
      ? [{ routeId: item.routeId, label: item.label }] : []) : [];
  const types = Array.isArray(module.configuration.messageTypes) ? module.configuration.messageTypes.filter((item): item is string => typeof item === "string") : [];
  const messageType = types.includes(selectedType) ? selectedType : types[0];
  const selectedRecipient = routes.find((route) => route.routeId === selectedRoute) ?? routes[0];
  const channelIds = Array.isArray(module.configuration.channelIds)
    ? module.configuration.channelIds.filter((id): id is string => typeof id === "string") : [];
  const routeId = selectedRecipient?.routeId ?? (typeof module.configuration.sendRouteId === "string" ? module.configuration.sendRouteId : null);
  const sources = Array.isArray(module.configuration.sourceArtifactTypeKeys) ? projection.artifacts.filter((artifact) =>
    (module.configuration.sourceArtifactTypeKeys as unknown[]).includes(artifact.artifactTypeKey)) : [];
  const messages = projection.messages.filter((message) => channelIds.includes(message.channelId)).slice().reverse();
  const externalUrl = typeof module.configuration.externalUrl === "string" && module.configuration.externalUrl.startsWith("https://") ? module.configuration.externalUrl : null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (routeId === null || value.length === 0 || sending) return;
    setSending(true);
    setOutcome("Sending message…");
    try {
      const receipt = await send("message.send", crypto.randomUUID(), 0, { routeId, content: { text: value,
        ...(messageType === undefined ? {} : { type: messageType }),
        ...(selectedRecipient === undefined ? {} : { recipientLabel: selectedRecipient.label }),
        ...(sourceId === "" ? {} : { sourceArtifactId: sourceId }) } });
      if (receipt?.status === "accepted") { setText(""); setSourceId(""); setOutcome("Message sent."); }
      else setOutcome("Message was not confirmed. Your text has been kept.");
    } finally { setSending(false); }
  };
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><h2 id={`${module.id}-heading`} className={projection.navigation?.items.some((item) => item.moduleId === module.id && item.label === module.title) ? "visually-hidden" : undefined}>{module.title}</h2></div>
    {externalUrl === null ? null : <p><a className="btn-secondary link-button" href={externalUrl} target="_blank" rel="noopener noreferrer">Open {module.title} website</a></p>}
    {module.mode !== "write" || routeId === null ? null : <form className="card" onSubmit={submit}>
      {routes.length === 0 ? null : <div className="field"><label htmlFor={`${module.id}-recipient`}>Recipient</label>
        <select id={`${module.id}-recipient`} value={routeId} disabled={disabled || sending} onChange={(event) => setSelectedRoute(event.target.value)}>
          {routes.map((route) => <option key={route.routeId} value={route.routeId}>{route.label}</option>)}
        </select></div>}
      {types.length === 0 ? null : <div className="field"><label htmlFor={`${module.id}-type`}>Type</label>
        <select id={`${module.id}-type`} value={messageType} disabled={disabled || sending} onChange={(event) => setSelectedType(event.target.value)}>
          {types.map((type) => <option key={type} value={type}>{type}</option>)}
        </select></div>}
      {Array.isArray(module.configuration.sourceArtifactTypeKeys) ? <div className="field"><label htmlFor={`${module.id}-source`}>Captured observation</label>
        <select id={`${module.id}-source`} value={sourceId} disabled={disabled || sending} onChange={(event) => {
          setSourceId(event.target.value);
          const source = sources.find((source) => source.id === event.target.value);
          if (source !== undefined) setText(source.form.fields.flatMap((field) => {
            const value = source.payload[field.key];
            if (value === undefined || value === "") return [];
            const label = (value: unknown) => field.options?.find((option) => option.value === value)?.label ?? String(value);
            return [`${field.label}: ${Array.isArray(value) ? value.map(label).join(", ") : label(value)}`];
          }).join("\n"));
        }}><option value="">Write a new update</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.title} — version {source.version}</option>)}</select>
        <p className="hint">Review the captured text below before publishing it to the selected audience.</p>
      </div> : null}
      <div className="field"><label htmlFor={`${module.id}-text`}>Message</label>
        <textarea id={`${module.id}-text`} rows={3} required value={text} disabled={disabled || sending}
          onChange={(event) => setText(event.target.value)} /></div>
      <button className="btn-primary" type="submit" disabled={disabled || sending || text.trim().length === 0}>{typeof module.configuration.submitLabel === "string" ? module.configuration.submitLabel : "Send Message"}</button>
      <p role="status">{outcome}</p>
    </form>}
    {typeof module.configuration.historyLabel === "string" ? <h3>{module.configuration.historyLabel}</h3> : null}
    {messages.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <ol className="event-list">
      {messages.map((message) => <li key={message.id}><span>
        {typeof message.content.type === "string" ? <strong>{message.content.type} · </strong> : null}
        {typeof message.content.recipientLabel === "string" ? <strong>{message.content.recipientLabel} · </strong> : null}{messageSummary(message)}</span>
        <time dateTime={message.sentAt}>{formatDate(message.sentAt)}</time></li>)}
    </ol>}
  </section>;
}

function InjectCard({ inject, artifacts, disabled, send }: { inject: RuntimeInjectV1; artifacts: RuntimeArtifactV1[]; disabled: boolean; send: SendInformation }) {
  const [artifactId, setArtifactId] = useState("");
  const responses = artifacts.filter((artifact) => artifact.artifactTypeKey === inject.responseArtifactTypeKey &&
    (inject.governingReleaseId === undefined || artifact.governingReleaseId === inject.governingReleaseId));
  const selectedResponse = responses.some(({ id }) => id === artifactId);
  const acknowledgementRequired = inject.acknowledgementRequired ?? true;
  const body = typeof inject.content.body === "string" ? inject.content.body : "No details were provided.";
  return <article className="card" aria-labelledby={`inject-${inject.id}`}>
    <div className="card-heading"><h3 id={`inject-${inject.id}`}>{inject.title}</h3><span className={statusClass(inject.state)}>{displayStatus(inject.state)}</span></div>
    <p>{body}</p>
    {inject.recipientComplete === true && <p className="hint">Your required steps are complete.</p>}
    {inject.state !== "closed" && acknowledgementRequired && inject.acknowledgedAt === null ? <button className="btn-primary" type="button" disabled={disabled}
      onClick={() => send("inject.acknowledge", inject.id, inject.version, {})}>Acknowledge</button> : null}
    {inject.state === "closed" || inject.requiredResponseArtifactTypeId === null || (acknowledgementRequired && inject.acknowledgedAt === null) || inject.respondedAt !== null ? null : <form onSubmit={(event) => {
      event.preventDefault();
      if (selectedResponse) send("inject.respond", inject.id, inject.version, { artifactId });
    }}>
      <div className="field"><label htmlFor={`inject-${inject.id}-artifact`}>Response record</label>
        <select id={`inject-${inject.id}-artifact`} required value={artifactId} disabled={disabled}
          onChange={(event) => setArtifactId(event.target.value)}><option value="">Choose a response record</option>
          {responses.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.title} · {artifact.stateLabel} · version {artifact.version}</option>)}
        </select></div>
      {responses.length === 0 && <p className="hint">Create a record of the required type in your workspace before responding.</p>}
      <button className="btn-primary" type="submit" disabled={disabled || !selectedResponse}>Submit response</button>
    </form>}
  </article>;
}

function InjectInbox({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><h2 id={`${module.id}-heading`} className={projection.navigation?.items.some((item) => item.moduleId === module.id && item.label === module.title) ? "visually-hidden" : undefined}>{module.title}</h2></div>
    {projection.injects.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <div className="card-grid">
      {projection.injects.map((inject) => <InjectCard key={inject.id} inject={inject} artifacts={projection.artifacts} disabled={disabled || module.mode !== "write"} send={send} />)}
    </div>}
  </section>;
}

function ProposalThreadCard({ messages, projection, disabled, send, readOnly }: {
  messages: RuntimeMessageV1[]; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
  readOnly: boolean;
}) {
  const [text, setText] = useState("");
  const latest = messages.at(-1);
  if (latest?.threadId === null || latest === undefined) return null;
  const sourceTeam = typeof latest.content.sourceTeam === "string" ? latest.content.sourceTeam : null;
  const recipientTeam = typeof latest.content.recipientTeam === "string" ? latest.content.recipientTeam : null;
  const side = projection.activeTeamId === sourceTeam ? "source" : projection.activeTeamId === recipientTeam ? "recipient" : null;
  const version = latest.threadVersion ?? 0;
  const submitText = (operationType: string) => {
    const value = text.trim();
    if (value.length === 0) return;
    send(operationType, latest.threadId!, version, { content: { text: value } });
    setText("");
  };
  return <article className="card" aria-labelledby={`thread-${latest.threadId}`}>
    <div className="card-heading"><h3 id={`thread-${latest.threadId}`}>{sourceTeam ?? "Source"} to {recipientTeam ?? "recipient"}</h3>
      <span className="badge badge-state">{latest.threadState ?? "open"}</span></div>
    <ol className="event-list">{messages.map((message) => <li key={message.id}>
      <span>{messageSummary(message)}{message.approvedAt === null ? " (awaiting Control approval)" : ""}</span>
      <time dateTime={message.sentAt}>{formatDate(message.sentAt)}</time>
    </li>)}</ol>
    {readOnly || side === null || latest.threadState === "closed" ? null : <>
      {latest.threadState === "open" ? <div className="field"><label htmlFor={`thread-${latest.threadId}-text`}>Negotiation message</label>
        <textarea id={`thread-${latest.threadId}-text`} rows={3} value={text} disabled={disabled}
          onChange={(event) => setText(event.target.value)} /></div> : null}
      <div className="actions">
        {side === "recipient" && latest.threadState === "open" ? <>
          <button className="btn-primary" type="button" disabled={disabled} onClick={() => send("message.proposal_accept", latest.threadId!, version, { content: {} })}>Accept</button>
          <button className="btn-secondary" type="button" disabled={disabled} onClick={() => send("message.proposal_reject", latest.threadId!, version, { content: {} })}>Not Interested</button>
          <button className="btn-secondary" type="button" disabled={disabled || text.trim().length === 0} onClick={() => submitText("message.proposal_negotiate")}>Negotiate</button>
        </> : null}
        {side === "source" && latest.threadState === "open" ? <button className="btn-primary" type="button" disabled={disabled || text.trim().length === 0}
          onClick={() => submitText("message.proposal_reply")}>Reply with next round</button> : null}
        <button className="btn-secondary" type="button" disabled={disabled}
          onClick={() => send(`message.proposal_close_${side}`, latest.threadId!, version, { content: {} })}>Close thread</button>
      </div>
    </>}
  </article>;
}

function ProposalThreads({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  const channelId = typeof module.configuration.channelId === "string" ? module.configuration.channelId : "";
  const actorMode = module.configuration.actorMode;
  const messages = projection.messages.filter((message) => message.channelId === channelId && message.threadId !== null);
  const threads = [...new Set(messages.map(({ threadId }) => threadId!))].map((threadId) =>
    messages.filter((message) => message.threadId === threadId));
  const openable = actorMode === "custodian" ? projection.artifacts.flatMap((artifact) => {
    if (artifact.state !== "recipient_threads") return [];
    const teams = Array.isArray(artifact.payload.recipientTeams)
      ? artifact.payload.recipientTeams.filter((team): team is string => typeof team === "string") : [];
    return teams.filter((team) => !messages.some((message) => message.content.sourceArtifactId === artifact.id && message.content.recipientTeam === team))
      .map((team) => ({ artifact, team }));
  }) : [];
  const pending = actorMode === "custodian" ? messages.filter((message) => message.approvedAt === null) : [];
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><h2 id={`${module.id}-heading`} className={projection.navigation?.items.some((item) => item.moduleId === module.id && item.label === module.title) ? "visually-hidden" : undefined}>{module.title}</h2></div>
    {openable.length === 0 ? null : <div className="card"><h3>Open approved recipient threads</h3><div className="actions">
      {openable.map(({ artifact, team }) => <button key={`${artifact.id}-${team}`} className="btn-secondary" type="button" disabled={disabled}
        onClick={() => send("message.proposal_forward", crypto.randomUUID(), 0, { sourceArtifactId: artifact.id, recipientTeamId: team })}>
        {artifact.title}: forward to {team}</button>)}
    </div></div>}
    {pending.length === 0 ? null : <div className="card"><h3>Rounds awaiting approval</h3><div className="actions">
      {pending.map((message) => <button key={message.id} className="btn-primary" type="button" disabled={disabled}
        onClick={() => send("message.proposal_approve_round", message.threadId!, message.threadVersion ?? 0, { messageId: message.id })}>
        Approve {messageSummary(message)}</button>)}
    </div></div>}
    {threads.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <div className="card-grid">
      {threads.map((thread) => <ProposalThreadCard key={thread[0]?.threadId} messages={thread} projection={projection} disabled={disabled} send={send} readOnly={module.mode !== "write"} />)}
    </div>}
  </section>;
}

type SendPoll = (operationType: string, poll: RuntimePollV1, payload: JsonObject) => void;

function PollCard({ poll, disabled, send }: { poll: RuntimePollV1; disabled: boolean; send: SendPoll }) {
  const [selected, setSelected] = useState<string[]>([]);
  const multiple = poll.pollType === "multiple_choice";
  const choose = (optionId: string, checked: boolean) => setSelected(multiple
    ? checked ? [...selected, optionId] : selected.filter((id) => id !== optionId)
    : [optionId]);
  const valid = multiple ? selected.length >= Number(poll.minSelections) && selected.length <= Number(poll.maxSelections) : selected.length === 1;
  const result = poll.tally;
  return <article className="card poll-card" aria-labelledby={`poll-${poll.id}`}>
    <div className="card-heading"><h3 id={`poll-${poll.id}`}>{poll.question}</h3><span className={statusClass(poll.status)}>{displayStatus(poll.status)}</span></div>
    {poll.deadlineAt === null ? null : <p className="hint">Ballots close <time dateTime={poll.deadlineAt}>{formatDate(poll.deadlineAt)}</time>.</p>}
    {poll.status === "open" && poll.eligible && !poll.hasVoted ? <form onSubmit={(event) => {
      event.preventDefault();
      if (valid && poll.ballotCapability !== null) send("ballot.cast", poll, {
        pollDefinitionRevision: poll.definitionRevision, ballotCapability: poll.ballotCapability, optionIds: selected
      });
    }}>
      <fieldset disabled={disabled}><legend>{multiple ? `Choose ${poll.minSelections} to ${poll.maxSelections} options` : "Choose one option"}</legend>
        {poll.options.map((option) => <label className="choice" key={option.id}>
          <input type={multiple ? "checkbox" : "radio"} name={`poll-${poll.id}`} value={option.id}
            checked={selected.includes(option.id)} onChange={(event) => choose(option.id, event.target.checked)} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
      <button className="btn-primary" type="submit" disabled={disabled || !valid}>Cast Ballot</button>
    </form> : null}
    {poll.hasVoted && poll.receipt !== null ? <p className="status-success" role="status">Ballot accepted at <time dateTime={poll.receipt.acceptedAt}>{formatDate(poll.receipt.acceptedAt)}</time>. Receipt revision {poll.receipt.ballotRevision}.</p> : null}
    {!poll.eligible && poll.status === "open" ? <p className="hint">Your active Seat Assignment is not in this Electorate.</p> : null}
    {result === null ? null : <section aria-labelledby={`poll-${poll.id}-result`}><h4 id={`poll-${poll.id}-result`}>{poll.certification === null ? "Unofficial tally" : "Certified result"}</h4>
      <dl className="poll-results">{poll.options.map((option) => <div key={option.id}><dt>{option.label}</dt><dd>{result.counts[option.id] ?? 0}</dd></div>)}</dl>
      <p>{result.quorumMet ? "Quorum met" : "Quorum not met"} · {result.passed ? "Passed" : "Not passed"}</p>
      {poll.certification === null ? null : <><p className="hint">Certified {formatDate(poll.certification.certifiedAt)}</p>
        <details className="provenance-disclosure"><summary>Certification provenance</summary><code>{poll.certification.resultSha256}</code></details></>}
    </section>}
    {!poll.canManage || !["open", "closed", "tallied"].includes(poll.status) ? null : <div className="actions" role="group" aria-label="Poll management">
      {poll.status === "open" ? <button className="btn-secondary" type="button" disabled={disabled} onClick={() => send("poll.close", poll, {})}>Close Poll</button> : null}
      {poll.status === "closed" ? <button className="btn-secondary" type="button" disabled={disabled} onClick={() => send("poll.tally", poll, {})}>Compute Tally</button> : null}
      {poll.status === "tallied" && result !== null ? <button className="btn-primary" type="button" disabled={disabled} onClick={() => send("poll.certify", poll, { resultSha256: result.resultSha256 })}>Certify result</button> : null}
    </div>}
  </article>;
}

function RuntimeView() {
  const id = sessionId();
  const requestedRole = new URLSearchParams(window.location.search).get("role");
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [deviceId, setDeviceId] = useState<string | null>(() => localStorage.getItem(DEVICE_STORAGE_KEY));
  const [bootstrap, setBootstrap] = useState<SyncBootstrapV1 | null>(null);
  const [outbox, setOutbox] = useState<OfflineOutboxV1 | null>(null);
  const [projection, setProjection] = useState<RuntimeProjectionV1 | null>(null);
  const [effectProposals, setEffectProposals] = useState<EffectProposalV1[]>([]);
  const [adjudications, setAdjudications] = useState<AdjudicationRequestV1[]>([]);
  const [adjudicationOptions, setAdjudicationOptions] = useState<AdjudicationOptionV1[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toasts, notify: setNotice, dismiss: dismissToast, hold: holdToast } = useToasts();
  const [sidebarPreference, setSidebarPreference] = useState<"auto" | "open" | "closed">("auto");
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const submissionInFlight = useRef(false);
  const wideViewport = useWideViewport();
  const [activeNavigationItemId, setActiveNavigationItemId] = useState<string | null>(null);
  const main = useRef<HTMLElement>(null);
  const loadVersion = useRef(0);
  const scopeVersion = useRef(0);
  const latest = useRef({ bootstrap, outbox, projection });
  latest.current = { bootstrap, outbox, projection };
  const pending = outbox?.entries.some(({ status }) => status === "local_pending" || status === "received") === true;
  const submitting = posting || (connection === "online" && pending);

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++loadVersion.current;
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection((current) => current === "online" ? current : "loading");
    setError(null);
    try {
      const registered = deviceId === null ? await api<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}", signal: signal ?? null }) : { deviceId };
      if (version !== loadVersion.current || signal?.aborted) return;
      setDeviceId(registered.deviceId);
      localStorage.setItem(DEVICE_STORAGE_KEY, registered.deviceId);
      const headers = { "x-device-id": registered.deviceId };
      const request = { headers, signal: signal ?? null };
      const roleQuery = requestedRole === null ? "" : `?activeSessionRoleId=${encodeURIComponent(requestedRole)}`;
      const [nextBootstrap, initialProjection, proposalResponse, adjudicationResponse] = await Promise.all([
        api<SyncBootstrapV1>(`/v1/sessions/${id}/sync/bootstrap${roleQuery}`, request),
        api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection${roleQuery}`, request),
        api<{ proposals: EffectProposalV1[] }>(`/v1/sessions/${id}/effect-proposals`, request),
        api<{ adjudications: AdjudicationRequestV1[]; options?: AdjudicationOptionV1[] }>(`/v1/sessions/${id}/adjudications${roleQuery}`, request)
      ]);
      if (version !== loadVersion.current || signal?.aborted) return;
      const previous = await offlineStore.load(id, registered.deviceId);
      if (version !== loadVersion.current || signal?.aborted) return;
      const sameScope = previous !== null &&
        previous.bootstrap.participantId === nextBootstrap.participantId &&
        previous.bootstrap.activeSessionRoleId === nextBootstrap.activeSessionRoleId;
      let nextOutbox = sameScope ? {
        ...previous.outbox,
        authorityEpoch: nextBootstrap.authorityEpoch,
        accessRevision: nextBootstrap.accessRevision,
        credentialExpiresAt: nextBootstrap.credentialExpiresAt
      } : createOfflineOutbox(nextBootstrap);
      let nextProjection = initialProjection;
      const unresolved = nextOutbox.entries.some(({ status }) => status === "local_pending" || status === "received");
      if (unresolved) {
        const reconciled = await reconcileOfflineOutbox(id, nextOutbox);
        nextOutbox = reconciled.outbox;
        if (reconciled.accepted > 0) {
          nextProjection = await api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection${roleQuery}`, { headers });
        }
        const outcomes = [
          reconciled.accepted === 0 ? "" : `${reconciled.accepted} accepted`,
          reconciled.rejected === 0 ? "" : `${reconciled.rejected} rejected`,
          reconciled.reconciliation === 0 ? "" : `${reconciled.reconciliation} need reconciliation`
        ].filter(Boolean).join(", ");
        if (outcomes.length > 0) setNotice(`Reconnect complete: ${outcomes}.`,
          reconciled.rejected > 0 || reconciled.reconciliation > 0 ? "caution" : "success");
      }
      if (version !== loadVersion.current || signal?.aborted) return;
      await offlineStore.save({
        bootstrap: nextBootstrap,
        projection: minimizeOfflineProjection(nextProjection),
        outbox: nextOutbox
      });
      if (version !== loadVersion.current || signal?.aborted) return;
      setBootstrap(nextBootstrap);
      setOutbox(nextOutbox);
      setProjection(nextProjection);
      setEffectProposals(proposalResponse.proposals);
      setAdjudications(adjudicationResponse.adjudications);
      setAdjudicationOptions(adjudicationResponse.options ?? []);
      setConnection("online");
    } catch (cause) {
      if (version !== loadVersion.current || signal?.aborted) return;
      if (signal) throw cause;
      if (cause instanceof ApiError && clearsOfflineData(cause) && deviceId !== null) {
        await offlineStore.clear(id, deviceId);
        if (version !== loadVersion.current) return;
        setBootstrap(null);
        setOutbox(null);
        setProjection(null);
        if (cause.envelope.error.code === "DEVICE_NOT_REGISTERED") {
          localStorage.removeItem(DEVICE_STORAGE_KEY);
          setDeviceId(null);
        }
        setConnection("error");
        setError(`${cause.message} Protected offline data was cleared.`);
        return;
      }
      if (deviceId !== null) {
        let cached: Awaited<ReturnType<typeof offlineStore.load>>;
        try {
          cached = await offlineStore.load(id, deviceId);
        } catch (storageError) {
          if (version !== loadVersion.current) return;
          setConnection("error");
          setError(storageError instanceof Error ? storageError.message : "Protected offline data could not be read.");
          return;
        }
        if (version !== loadVersion.current) return;
        if (cached !== null && Date.parse(cached.bootstrap.credentialExpiresAt) <= Date.now()) {
          await offlineStore.save({ ...cached, projection: null });
          if (version !== loadVersion.current) return;
          setBootstrap(cached.bootstrap);
          setOutbox(cached.outbox);
          setProjection(null);
          setConnection("error");
          setError("The offline credential expired. Local drafts were retained, but cached Session data and submission are unavailable until re-authentication.");
          return;
        }
        if (cached !== null && cached.projection !== null && !(cause instanceof ApiError && cause.envelope.error.code === "AUTH_EXPIRED")) {
          setBootstrap(cached.bootstrap);
          setOutbox(cached.outbox);
          setProjection(cached.projection);
          setEffectProposals([]);
          setAdjudications([]);
          setAdjudicationOptions([]);
          setConnection("offline");
          setNotice("Using the protected offline view. Local pending work is not submitted.", "caution");
          return;
        }
        if (cached !== null) setOutbox(cached.outbox);
      }
      setConnection(navigator.onLine ? "error" : "offline");
      setError(cause instanceof Error ? cause.message : "The Runtime could not be loaded.");
    }
  }, [deviceId, id, requestedRole]);

  useEffect(() => {
    void load();
    return () => { loadVersion.current++; scopeVersion.current++; };
  }, [id, requestedRole]); // Initial load owns device registration.
  const stageClock = useStageClock(projection?.currentStageStatus ?? null, projection?.stageRemainingSeconds ?? null,
    projection?.stageDeadlineAt ?? null);
  useEffect(() => {
    if (projection === null) return;
    setActiveNavigationItemId(projection.navigation.defaultItemId ?? projection.navigation.items[0]?.id ?? null);
  }, [projection?.interfaceProfileId, projection?.navigation.defaultItemId]);
  useEffect(() => {
    const offline = () => {
      loadVersion.current++; scopeVersion.current++; setConnection("offline");
    };
    const online = () => { setNotice("Connection restored. Refreshing authoritative state.", "success"); void load(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [load]);

  useEffect(() => {
    if (id === null || deviceId === null || bootstrap === null || connection === "offline") return;
    const scope = scopeVersion.current;
    const headers = { "x-device-id": deviceId };
    const roleQuery = requestedRole === null ? "" : `activeSessionRoleId=${encodeURIComponent(requestedRole)}&`;
    const current = (signal: AbortSignal, version: number) => !signal.aborted && scope === scopeVersion.current && version === loadVersion.current;
    return subscribeRuntime({
      snapshot: signal => api<SyncSnapshotV1>(`/v1/sessions/${id}/sync/snapshot?${roleQuery}`, { headers, signal }),
      deltas: async (cursor, transport, signal) => {
        const path = `/v1/sessions/${id}/sync/${transport === "sse" ? "stream" : "deltas"}?${roleQuery}cursor=${encodeURIComponent(cursor)}`;
        if (transport === "polling") return api<SyncDeltasV1>(path, { headers, signal });
        const response = await fetch(path, { headers, signal });
        if (!response.ok) throw new ApiError(response.status, await response.json() as ErrorEnvelopeV1);
        return decodeRuntimeSse(await response.text());
      },
      refresh: async (deltas, signal) => {
        if (submissionInFlight.current) throw new Error("A Command is still being reconciled");
        if (deltas === null) { await load(signal); return; }
        if (deltas.some(delta => delta.eventType === "release.activated")) { await load(signal); return; }
        const version = loadVersion.current;
        const types = deltas.map(delta => delta.eventType);
        const readRuntime = types.some(type => !type.startsWith("effect_proposal.") && !type.startsWith("adjudication.") ||
          type === "effect_proposal.applied" || type === "adjudication.published");
        const [view, proposals, adjudications] = await Promise.all([
          readRuntime ? api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection?${roleQuery}`, { headers, signal }) : null,
          types.some(type => type.startsWith("effect_proposal.")) ? api<{ proposals: EffectProposalV1[] }>(`/v1/sessions/${id}/effect-proposals`, { headers, signal }) : null,
          types.some(type => type.startsWith("adjudication.")) ? api<{ adjudications: AdjudicationRequestV1[]; options?: AdjudicationOptionV1[] }>(`/v1/sessions/${id}/adjudications?${roleQuery}`, { headers, signal }) : null
        ]);
        if (!current(signal, version) || submissionInFlight.current) throw new DOMException("Runtime refresh superseded", "AbortError");
        const cache = latest.current;
        if (view && cache.bootstrap && cache.outbox) {
          await offlineStore.save({ bootstrap: cache.bootstrap, outbox: cache.outbox, projection: minimizeOfflineProjection(view) }, true);
          if (!current(signal, version)) return;
          setProjection(view);
        }
        if (proposals) setEffectProposals(proposals.proposals);
        if (adjudications) { setAdjudications(adjudications.adjudications); setAdjudicationOptions(adjudications.options ?? []); }
      },
      error: cause => {
        if (scope !== scopeVersion.current) return "stop";
        if (cause instanceof ApiError && cause.envelope.error.code === "SYNC_CURSOR_EXPIRED") {
          loadVersion.current++;
          setProjection(null); setEffectProposals([]); setAdjudications([]); setAdjudicationOptions([]);
          const cache = latest.current;
          if (cache.bootstrap && cache.outbox) void offlineStore.save({ bootstrap: cache.bootstrap, outbox: cache.outbox, projection: null }, true)
            .catch(() => setError("The protected offline projection could not be cleared."));
          return "snapshot";
        }
        if (cause instanceof ApiError && (clearsOfflineData(cause) || ["AUTH_EXPIRED", "UNAUTHENTICATED"].includes(cause.envelope.error.code))) {
          loadVersion.current++; scopeVersion.current++;
          setBootstrap(null); setProjection(null); setEffectProposals([]); setAdjudications([]); setAdjudicationOptions([]);
          const cache = latest.current;
          if (clearsOfflineData(cause)) {
            setOutbox(null);
            void offlineStore.clear(id, deviceId).catch(() => setError("Protected device storage could not be cleared."));
          } else if (cache.bootstrap && cache.outbox) {
            void offlineStore.save({ bootstrap: cache.bootstrap, outbox: cache.outbox, projection: null }, true)
              .catch(() => setError("The protected offline projection could not be cleared."));
          }
          setConnection("error"); setError(`${cause.message} Protected Session data was cleared.`);
          return "stop";
        }
        return "retry";
      },
      connectivity: state => {
        if (scope === scopeVersion.current) setConnection(state === "live" ? "online" : "reconnecting");
      }
    });
  }, [id, deviceId, requestedRole, bootstrap?.participantId, connection === "offline"]);

  const post = async (command: CommandEnvelopeV1): Promise<CommandReceiptV1 | null> => {
    if (id === null || bootstrap === null || outbox === null || projection === null || submissionInFlight.current) return null;
    submissionInFlight.current = true;
    const scope = scopeVersion.current;
    const version = ++loadVersion.current;
    const current = () => scope === scopeVersion.current && version === loadVersion.current;
    setPosting(true);
    try {
      const queueable = canQueueOffline(command, bootstrap);
      if (!queueable && !navigator.onLine) {
        setConnection("offline");
        setNotice("This operation requires the live Session Authority and was not queued.", "caution");
        return null;
      }
      let storedOutbox = outbox;
      if (queueable) {
        storedOutbox = enqueueOfflineCommand(outbox, command, new Date().toISOString());
        try {
          await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: storedOutbox });
        } catch (cause) {
          if (!current()) return null;
          setNotice(cause instanceof Error
            ? `The Command was not queued because protected device storage failed: ${cause.message}`
            : "The Command was not queued because protected device storage failed.", "error");
          return null;
        }
        if (!current()) return null;
        setOutbox(storedOutbox);
        setNotice("Saved on this device as local pending. It has not been submitted.", "info");
        if (!navigator.onLine) { setConnection("offline"); return null; }
      } else setNotice("Submitting a live-only operation. It will not enter the Offline Outbox.", "progress");
      try {
        const response = await fetch(`/v1/sessions/${id}/commands`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command)
        });
        const body: unknown = await response.json();
        if (!current()) return null;
        if (!isCommandReceipt(body)) {
          if (typeof body === "object" && body !== null && "error" in body) {
            throw new ApiError(response.status, body as ErrorEnvelopeV1);
          }
          throw new Error(`Command returned an invalid response with status ${response.status}`);
        }
        if (queueable) {
          let resolved = recordOfflineReceipt(storedOutbox, body);
          if (body.status === "accepted") {
            resolved = { ...resolved, entries: resolved.entries.filter(({ command: queued }) => queued.commandId !== body.commandId) };
          }
          await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: resolved });
          if (!current()) return null;
          setOutbox(resolved);
        }
        if (body.status === "accepted") setNotice(body.replayed ? "The original server receipt was recovered." : "The server accepted the Command.", "success");
        else if (body.status === "needs_reconciliation") setNotice(`Authoritative state changed: ${body.message ?? body.errorCode}. Your local draft was kept.`, "caution");
        else setNotice(`Command refused: ${body.message ?? body.errorCode}. Your local draft was kept.`, "error");
        await load();
        requestAnimationFrame(() => main.current?.focus());
        return body;
      } catch (cause) {
        if (!current()) return null;
        if (cause instanceof ApiError) {
          if (clearsOfflineData(cause)) {
            await offlineStore.clear(id, bootstrap.deviceId);
            if (!current()) return null;
            setBootstrap(null);
            setOutbox(null);
            setProjection(null);
          }
          setConnection("error");
          setNotice(`Command failed: ${cause.message}`, "error");
          return null;
        }
        setConnection(navigator.onLine ? "error" : "offline");
        setNotice(queueable ? "Delivery acknowledgement was lost. This Command is still local pending, not accepted."
          : "The live-only operation failed without acknowledgement and was not queued.", queueable ? "caution" : "error");
        return null;
      }
    } finally { submissionInFlight.current = false; setPosting(false); }
  };

  const send = async (action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string): Promise<CommandReceiptV1 | null> => {
    if (projection === null || deviceId === null) return null;
    const command: CommandEnvelopeV1 = {
      commandId: crypto.randomUUID(),
      deviceId,
      operationType: action.operationType,
      aggregateId: artifact?.id ?? crypto.randomUUID(),
      expectedAggregateVersion: artifact?.version ?? 0,
      governingReleaseId: artifact?.governingReleaseId ?? projection.releaseId,
      activeSessionRoleId: projection.activeSessionRoleId,
      deviceObservedAt: new Date().toISOString(),
      payload: {
        ...(artifactTypeKey === undefined ? {} : { artifactTypeKey }),
        ...(content === undefined ? {} : { content })
      }
    };
    return post(command);
  };

  const sendInformation: SendInformation = async (operationType, aggregateId, expectedAggregateVersion, payload) => {
    if (projection === null || deviceId === null) return null;
    const publication = operationType === "adjudication.publish";
    if (publication && !navigator.onLine) {
      setConnection("offline");
      setNotice("Adjudication publication requires the live Session Authority and was not queued.", "caution");
      return null;
    }
    return post({
      commandId: crypto.randomUUID(), deviceId, operationType, aggregateId, expectedAggregateVersion,
      governingReleaseId: operationType.startsWith("inject.") ? projection.injects.find(({ id }) => id === aggregateId)?.governingReleaseId ?? projection.releaseId : projection.releaseId,
      activeSessionRoleId: projection.activeSessionRoleId,
      deviceObservedAt: new Date().toISOString(), payload
    });
  };

  const sendPoll: SendPoll = (operationType, poll, payload) => {
    if (projection === null || deviceId === null) return;
    if (operationType.startsWith("poll.") && !navigator.onLine) {
      setConnection("offline");
      setNotice("Poll management requires the live Session Authority and was not queued.", "caution");
      return;
    }
    void post({ commandId: crypto.randomUUID(), deviceId, operationType, aggregateId: poll.id,
      expectedAggregateVersion: poll.version, governingReleaseId: poll.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(), payload });
  };

  const sendVoice = async (channel: RuntimeVoiceChannelV1, operationType: string,
    payload: JsonObject = {}): Promise<CommandReceiptV1 | null> => {
    if (projection === null || deviceId === null || !navigator.onLine) {
      setConnection("offline"); setNotice("Voice needs the live Session Authority and was not queued.", "caution"); return null;
    }
    const receipt = await post({ commandId: crypto.randomUUID(), deviceId, operationType,
      aggregateId: channel.id, expectedAggregateVersion: channel.version, governingReleaseId: channel.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(), payload });
    return receipt;
  };

  const sendFloor = async (channel: RuntimeVoiceChannelV1, action: "request" | "renew" | "release",
    body: Record<string, unknown>): Promise<FloorLeaseV1> => {
    if (id === null || deviceId === null || !navigator.onLine) throw new Error("Floor operations require a live connection");
    const path = action === "request" ? "floor-requests" : `floor-requests/${String(body.requestId)}/${action}`;
    const requestBody = action === "request" ? body : { ...body, requestId: undefined };
    return api<FloorLeaseV1>(`/v1/sessions/${id}/voice-channels/${channel.id}/${path}`,
      { method: "POST", headers: { "x-device-id": deviceId }, body: JSON.stringify(requestBody) });
  };

  const decideEffect = async (proposal: EffectProposalV1, decision: "approve" | "reject" | "return", reason: string) => {
    if (id === null || projection === null || deviceId === null) return;
    if (!navigator.onLine) { setConnection("offline"); setNotice("Approval Decisions require a live Session Authority and were not queued.", "caution"); return; }
    setNotice("Submitting the Approval Decision to the Session Authority.", "progress");
    try {
      const response = await fetch(`/v1/sessions/${id}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        commandId: crypto.randomUUID(), deviceId, operationType: `effect_proposal.${decision}`, aggregateId: proposal.id,
        expectedAggregateVersion: proposal.version, governingReleaseId: proposal.governingReleaseId,
        activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(),
        payload: { proposalHash: proposal.proposalHash, reason }
      } satisfies CommandEnvelopeV1) });
      const receipt: unknown = await response.json();
      if (!isCommandReceipt(receipt)) throw new Error(`Approval Decision returned an invalid response with status ${response.status}`);
      setNotice(receipt.status === "accepted" ? "The server accepted the Command." : receipt.message ?? "The Approval Decision was not accepted.",
        receipt.status === "accepted" ? "success" : "error");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? `Approval Decision was not queued: ${cause.message}` : "Approval Decision was not queued.", "error");
      await load();
    }
  };

  const retryPending = async () => {
    setNotice("Checking original receipts before ordered reconnect.", "progress");
    await load();
  };

  const saveOfflineDraft = async (commandId: string, payload: JsonObject) => {
    if (bootstrap === null || projection === null || outbox === null) return;
    const updated = updateOfflineDraft(outbox, commandId, payload);
    await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: updated });
    setOutbox(updated);
    setNotice("The revised draft is saved on this device. It has not been submitted.", "info");
  };

  if (projection === null) {
    const connecting = connection === "loading" || connection === "reconnecting";
    return <StatePage connection={connection} title={connecting ? "Connecting to Runtime" : connection === "offline" ? "Runtime offline" : "Runtime unavailable"}
      message={connecting ? "Resolving your authorized Session view." : error ?? "Reconnect and try again."}
      {...(connecting ? {} : { retry: () => void load() })} />;
  }
  const roleContextLabel = projection.activeTeamLabel === null ? projection.activeSessionRoleLabel
    : `${projection.activeTeamLabel} · ${projection.activeSessionRoleLabel}`;
  const sessionTitle = projection.sessionTitle ?? projection.simulationTitle ?? "Session workspace";
  const moduleById = new Map(projection.modules.map((module) => [module.id, module]));
  const regions = projection.regions === undefined || projection.regions.length === 0
    ? [{ id: "main", moduleIds: projection.modules.map((module) => module.id) }]
    : projection.regions;
  const activeNavigationItem = projection.navigation.items.find((item) => item.id === activeNavigationItemId)
    ?? projection.navigation.items.find((item) => item.id === projection.navigation.defaultItemId)
    ?? projection.navigation.items[0];
  const visibleRegions = projection.layout === "workspace_tabs" && activeNavigationItem?.regionId !== undefined
    ? regions.filter((region) => region.id === activeNavigationItem.regionId)
    : regions;
  const visibleModules = visibleRegions.flatMap((region) => region.moduleIds.map((moduleId) => moduleById.get(moduleId)))
    .filter((module): module is RuntimeModuleV1 => module !== undefined);
  const sidebarVisible = sidebarPreference === "auto" ? wideViewport : sidebarPreference === "open";
  const moduleCount = (module: RuntimeModuleV1): RuntimeSidebarItem["count"] => {
    if (module.type === "task_list") return { value: moduleArtifacts(module, projection.artifacts).length, emphasis: false, label: "records" };
    if (module.type === "inject_inbox") return {
      value: projection.injects.filter((inject) => inject.state === "released").length, emphasis: true, label: "awaiting acknowledgement"
    };
    if (module.type === "message_inbox") {
      const channelIds = Array.isArray(module.configuration.channelIds)
        ? module.configuration.channelIds.filter((channelId): channelId is string => typeof channelId === "string") : [];
      return {
        value: projection.messages.filter((message) => channelIds.includes(message.channelId) && message.deliveryState !== "read").length,
        emphasis: true, label: "unread"
      };
    }
    return undefined;
  };
  const showModule = (moduleId: string) => {
    const item = projection.navigation.items.find((candidate) => candidate.moduleId === moduleId ||
      (candidate.regionId !== undefined && regions.find((region) => region.id === candidate.regionId)?.moduleIds.includes(moduleId)));
    if (projection.layout === "workspace_tabs" && item !== undefined) setActiveNavigationItemId(item.id);
    if (!wideViewport) setSidebarPreference("auto");
    requestAnimationFrame(() => document.getElementById(`runtime-module-${moduleId}`)?.scrollIntoView({ block: "start" }));
  };
  const selectNavigationItem = (itemId: string, moduleId: string) => {
    setActiveNavigationItemId(itemId);
    if (!wideViewport) setSidebarPreference("auto");
    requestAnimationFrame(() => {
      if (projection.layout === "workspace_tabs") main.current?.scrollTo({ top: 0 });
      else document.getElementById(`runtime-module-${moduleId}`)?.scrollIntoView({ block: "start" });
    });
  };
  const inboxModules = projection.modules.filter((module) => module.configuration.placement !== "header" && (module.type === "message_inbox" || module.type === "inject_inbox"));
  const unreadCount = inboxModules.reduce((total, module) => total + (moduleCount(module)?.value ?? 0), 0);
  const firstUnread = inboxModules.find((module) => (moduleCount(module)?.value ?? 0) > 0) ?? inboxModules[0];
  /*
   * Review, Deck and Present are views of the same records. When the role has a presentation view, the page band
   * repeats those destinations as one switch so moving between them never needs the sidebar. Labels stay authored.
   */
  const navigationEntries = projection.navigation.items.map((item) => ({ item, module: moduleById.get(item.moduleId) }));
  const presentEntry = navigationEntries.find(({ module }) => module?.type === "artifact_presentation");
  const reviewEntries = navigationEntries.filter(({ module }) => module?.type === "task_list" && module.configuration.presentation === "review");
  const deckEntry = navigationEntries.find(({ module }) => module?.type === "slide_deck");
  const activeReview = reviewEntries.find(({ item }) => item.id === activeNavigationItem?.id) ?? reviewEntries[0];
  const recordViewEntries = [activeReview, deckEntry].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  const recordViews = presentEntry === undefined || activeReview === undefined
    || ![...recordViewEntries, presentEntry].some(({ item }) => item.id === activeNavigationItem?.id) ? null : {
      views: recordViewEntries.map(({ item }) => item), present: presentEntry.item
    };
  const sidebarSections: RuntimeSidebarSection[] = [];
  for (const item of projection.navigation.items) {
    const module = moduleById.get(item.moduleId);
    const label = typeof module?.configuration.navigationSection === "string" ? module.configuration.navigationSection : projection.activeSessionRoleLabel;
    let section = sidebarSections.find((section) => section.label === label);
    if (section === undefined) {
      section = { id: `pages-${sidebarSections.length}`, label, navigationLabel: module?.configuration.navigationSection === undefined ? "Runtime modules" : `${label} navigation`, items: [] };
      sidebarSections.push(section);
    }
    section.items.push({
      id: item.id, label: item.label, href: `#runtime-module-${item.moduleId}`, current: item.id === activeNavigationItem?.id,
      icon: runtimeIconName(module?.configuration.navigationIcon, RUNTIME_MODULE_ICONS[module?.type ?? "session_status"]),
      count: moduleById.has(item.moduleId) ? moduleCount(moduleById.get(item.moduleId)!) : undefined,
      onSelect: () => selectNavigationItem(item.id, item.moduleId)
    });
  }
  if (projection.layout !== "workspace_tabs" && visibleModules.length > 1) sidebarSections.push({
    id: "on-this-page", label: "On this page", navigationLabel: "On this page",
    items: visibleModules.map((module) => ({
      id: module.id, label: module.title, href: `#runtime-module-${module.id}`, current: false,
      icon: RUNTIME_MODULE_ICONS[module.type], count: moduleCount(module), onSelect: () => showModule(module.id)
    }))
  });
  const activeSeat = projection.roleContexts.find((role) => role.sessionRoleId === projection.activeSessionRoleId);
  const roleSwitchUnavailable = pending || connection !== "online";
  const downloadArtifact = async (artifactId: string, format: "json" | "csv" | "pdf") => {
    if (!navigator.onLine) throw new Error("Export requires a live connection.");
    const response = await fetch(`/v1/sessions/${id}/runtime-artifacts/${artifactId}/export?format=${format}&activeSessionRoleId=${encodeURIComponent(projection.activeSessionRoleId)}`,
      { credentials: "same-origin", headers: { "x-device-id": deviceId! } });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error?.message ?? "The record export is unavailable."); }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
    link.href = url; link.download = format === "csv" ? "record-tables.zip" : `record.${format}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const renderRuntimeModule = (module: RuntimeModuleV1): ReactNode => {
    if (module.type === "session_timeline") return <SessionTimeline firstPage={projection.timeline} online={connection === "online"}
      loadOlder={async (before) => {
        const page = await api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection?activeSessionRoleId=${encodeURIComponent(projection.activeSessionRoleId)}&timelineBefore=${before}`,
          { headers: { "x-device-id": deviceId! } });
        if (page.timeline === undefined) throw new Error("Timeline unavailable");
        return page.timeline;
      }} />;
    if (module.type === "artifact_form") return <section id={`runtime-module-${module.id}`} aria-label={module.title}>
      {module.configuration.presentation === "capture" ? null : <div className="section-heading"><h2 className={module.title === activeNavigationItem?.label ? "visually-hidden" : undefined}>{module.title}</h2></div>}
      {moduleArtifacts(module, projection.createTasks).length === 0 ? <p className="empty-state">{module.emptyStateText}</p>
        : <div className="card-grid">{moduleArtifacts(module, projection.createTasks).map((task) => <CreateTask key={createTaskKey(task)} task={task}
            disabled={submitting} send={send} compact={module.configuration.presentation === "capture"}
            submitLabel={typeof module.configuration.submitLabel === "string" ? module.configuration.submitLabel : "Save draft"} />)}</div>}
    </section>;
    if (module.type === "task_list" && module.configuration.presentation === "history") return <RevisionHistory
      key={`${projection.sessionId}:${projection.activeSessionRoleId}`} module={module} artifacts={projection.artifacts}
      active={visibleModules.includes(module)} online={connection === "online"} load={(artifactId, before) => api<RuntimeArtifactHistoryV1>(
        `/v1/sessions/${id}/runtime-artifacts/${artifactId}/history?activeSessionRoleId=${encodeURIComponent(projection.activeSessionRoleId)}${before === undefined ? "" : `&beforeVersion=${before}`}`,
        { headers: { "x-device-id": deviceId! } })} />;
    if (module.type === "task_list") return <ArtifactWorkspace module={module} artifacts={projection.artifacts}
      renderArtifact={(artifact, navigation) => <div key={`${artifact.id}:${projection.activeSessionRoleId}`}><ArtifactCard key={`${artifact.id}-${artifact.version}`} artifact={module.mode === "read" ? { ...artifact, actions: [] } : artifact} disabled={submitting} send={send} download={(format) => downloadArtifact(artifact.id, format)} navigation={navigation} />
        {artifact.form.attachments && id && deviceId ? <FormAttachments artifact={artifact} sessionId={id} deviceId={deviceId} activeSessionRoleId={projection.activeSessionRoleId}
          disabled={submitting || connection !== "online"} readOnly={module.mode !== "write"} onChanged={load} /> : null}</div>} />;
    if (module.type === "message_inbox") return <div id={`runtime-module-${module.id}`}><MessageInbox module={module} projection={projection}
      disabled={submitting} send={sendInformation} /></div>;
    if (module.type === "proposal_thread") return <div id={`runtime-module-${module.id}`}><ProposalThreads module={module} projection={projection}
      disabled={submitting} send={sendInformation} /></div>;
    if (module.type === "inject_inbox") return <div id={`runtime-module-${module.id}`}><InjectInbox module={module} projection={projection}
      disabled={submitting} send={sendInformation} /></div>;
    if (module.type === "session_status" && module.mode === "write") return <SessionSettings module={module} projection={projection} openModule={showModule}
      controls={<StageControls module={module} stage={{ label: projection.currentStageLabel, status: projection.currentStageId === null ? null : projection.currentStageStatus, clock: stageClock }} disabled={submitting || connection !== "online"}
        send={(operation, version, payload) => { if (id !== null) sendInformation(operation, id, version, payload); }} />} />;
    if (module.type === "session_status") return <section className="workspace-section curated-runtime-module" id={`runtime-module-${module.id}`}
      aria-labelledby={`runtime-module-${module.id}-title`}>
      <h2 id={`runtime-module-${module.id}-title`} className={module.title === activeNavigationItem?.label ? "visually-hidden" : undefined}>{module.title}</h2>
      <dl className="runtime-status-list">
        <div><dt>Session</dt><dd>{friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
        <div><dt>Stage</dt><dd>{projection.currentStageLabel ?? "Not started"} ({friendlyReference(projection.currentStageStatus, "Not started")})</dd></div>
        <div><dt>Role</dt><dd>{projection.activeSessionRoleLabel}</dd></div>
      </dl>
      <StageControls module={module} stage={{ label: projection.currentStageLabel, status: projection.currentStageId === null ? null : projection.currentStageStatus, clock: stageClock }} disabled={submitting || connection !== "online"}
        send={(operation, version, payload) => { if (id !== null) sendInformation(operation, id, version, payload); }} />
    </section>;
    if (module.type === "artifact_presentation") return <ArtifactWorkspace module={module}
      artifacts={projection.artifacts.filter((artifact) => !Array.isArray(module.configuration.artifactStatuses) || module.configuration.artifactStatuses.includes(artifact.state))}
      renderArtifact={(artifact, navigation) => <article className="card artifact" aria-labelledby={`artifact-${artifact.id}`}>
        <ArtifactHeading artifact={artifact} headingLevel={2} navigation={navigation} />
        <ArtifactContent form={artifact.form} payload={artifact.payload} /></article>} />;
    if (module.type === "resource_library") {
      const configuredIds = Array.isArray(module.configuration.resourceIds)
        ? module.configuration.resourceIds.filter((resourceId): resourceId is string => typeof resourceId === "string") : [];
      const resources = projection.resources.filter((resource) => configuredIds.includes(resource.id));
      return <section className="workspace-section curated-runtime-module runtime-resource-library" id={`runtime-module-${module.id}`}
        aria-labelledby={`runtime-module-${module.id}-title`}>
        <h2 id={`runtime-module-${module.id}-title`} className={module.title === activeNavigationItem?.label ? "visually-hidden" : undefined}>{module.title}</h2>
        {resources.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <ul className="runtime-resource-list">
          {resources.map((resource) => {
            const resourceUrl = id === null || deviceId === null ? null
              : `/v1/sessions/${id}/runtime-resources/${encodeURIComponent(resource.id)}?deviceId=${encodeURIComponent(deviceId)}&activeSessionRoleId=${encodeURIComponent(projection.activeSessionRoleId)}`;
            return <li key={resource.id}>
              <div><strong>{resource.name}</strong><span>{resource.type.replaceAll("_", " ")} · {resource.mediaType}</span>
                {resource.altText === undefined ? null : <p>{resource.altText}</p>}</div>
              {resourceUrl === null ? <span className="hint">Available while connected</span>
                : <a className="btn-secondary link-button" href={resourceUrl} target="_blank" rel="noreferrer">Open resource</a>}
            </li>;
          })}
        </ul>}
      </section>;
    }
    const releaseResourceId = typeof module.configuration.releaseResourceId === "string"
      ? module.configuration.releaseResourceId : null;
    const resourceUrl = id === null || deviceId === null || releaseResourceId === null ? null
      : `/v1/sessions/${id}/runtime-resources/${encodeURIComponent(releaseResourceId)}?deviceId=${encodeURIComponent(deviceId)}&activeSessionRoleId=${encodeURIComponent(projection.activeSessionRoleId)}`;
    return <section className="workspace-section curated-runtime-module runtime-deck-module" id={`runtime-module-${module.id}`}
      aria-labelledby={`runtime-module-${module.id}-title`}>
      <h2 id={`runtime-module-${module.id}-title`} className={module.title === activeNavigationItem?.label ? "visually-hidden" : undefined}>{module.title}</h2>
      {resourceUrl === null ? <p className="empty-state">{module.emptyStateText}</p> : <iframe
        className="runtime-deck-frame" src={resourceUrl} title={module.title} loading="lazy" sandbox="allow-scripts" allowFullScreen />}
    </section>;
  };
  const primaryModule = moduleById.get(activeNavigationItem?.moduleId ?? "");
  const composers = visibleModules.filter((module) => module.configuration.presentation === "composer");
  const broadcastModules = projection.modules.filter((module) => module.configuration.placement === "header");
  return <LocalDraftContext.Provider value={bootstrap === null || deviceId === null || id === null ? null : {
    store: offlineStore, sessionId: id, deviceId, scope: JSON.stringify([bootstrap.participantId, bootstrap.activeSessionRoleId,
      bootstrap.seatAssignmentIds.slice().sort(), bootstrap.accessRevision, projection.releaseId, projection.currentStageId])
  }}><div className="app-frame app-frame-bounded runtime-frame" data-sidebar={sidebarVisible ? "open" : "closed"}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {sidebarVisible ? <a className="skip-link" href="#runtime-navigation">Skip to workspace navigation</a> : null}
    <RuntimeHeader sessionTitle={sessionTitle}
      sessionMenu={() => <div className="runtime-menu-body">
        <p className="runtime-menu-title">{sessionTitle}</p>
        <dl className="runtime-menu-facts">
          <div><dt>Simulation</dt><dd>{projection.simulationTitle ?? projection.releaseLabel}</dd></div>
          <div><dt>Release</dt><dd>{projection.releaseLabel}</dd></div>
          <div><dt>Session</dt><dd>{friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
        </dl>
        <a className="runtime-menu-link" href="/?workspace=participant"><RuntimeIcon name="list" />All your Sessions</a>
      </div>}
      stage={{ label: projection.currentStageLabel, status: projection.currentStageId === null ? null : projection.currentStageStatus, clock: stageClock }}
      connection={{ state: connection, label: connectionLabel(connection) }}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
      notifications={firstUnread === undefined ? null : {
        count: unreadCount,
        label: unreadCount === 0 ? "Injects: nothing new" : `Injects: ${unreadCount} new`,
        onOpen: () => showModule(firstUnread.id)
      }}
      themeToggle={<ThemeToggle />}
      communicationTools={<>
        {broadcastModules.length === 0 ? null : <SessionTool label="Control Broadcast" icon="broadcast"
          count={broadcastModules.reduce((total, module) => total + (moduleCount(module)?.value ?? 0), 0)}>
          {broadcastModules.map((module) => <div key={module.id}>{renderRuntimeModule(module)}</div>)}
        </SessionTool>}
        {projection.voiceChannels.length === 0 || id === null || deviceId === null ? null : <SessionTool label="Voice channels" icon="voice">
          <p className="hint">Closing this panel keeps your voice connection active. Use Leave voice to disconnect.</p>
          <VoiceControls projection={projection} online={connection === "online"} disabled={submitting} command={sendVoice} floor={sendFloor} notice={setNotice} />
        </SessionTool>}
      </>}
      roleLabel={projection.activeSessionRoleLabel}
      roleMenu={(close) => <div className="runtime-menu-body">
        <p className="runtime-menu-title">{roleContextLabel}</p>
        <p className="runtime-menu-meta">{activeSeat === undefined ? "Active role context" : `Seat: ${activeSeat.seatLabel}`}</p>
        {projection.roleContexts.length > 1 ? <div className="runtime-menu-group" role="group" aria-labelledby="runtime-role-switch-title">
          <h2 id="runtime-role-switch-title">Switch role</h2>
          {roleSwitchUnavailable ? <p className="runtime-menu-meta">Switching is available when connected and nothing is pending.</p> : null}
          <ul>{projection.roleContexts.map((role) => {
            const label = role.teamLabel === null ? role.sessionRoleLabel : `${role.teamLabel} ${role.sessionRoleLabel}`;
            const current = role.sessionRoleId === projection.activeSessionRoleId;
            return <li key={`${role.seatLabel}:${role.sessionRoleId}`}><button className="runtime-menu-link" type="button"
              aria-current={current ? "true" : undefined} disabled={current || roleSwitchUnavailable}
              onClick={() => { close(); navigateWithLoader(role.runtimeUrl); }}>{label}{current ? <span className="runtime-menu-meta"> · current</span> : null}</button></li>;
          })}</ul>
        </div> : null}
        <a className="runtime-menu-link runtime-menu-exit" href="/"><RuntimeIcon name="exit" />Exit Session</a>
      </div>} />
    <div className="runtime-body">
      {sidebarVisible ? <RuntimeSidebar id="runtime-navigation" sections={sidebarSections}
        onHide={() => setSidebarPreference(wideViewport ? "closed" : "auto")}
        startHere={<>
          <p>You are working as <strong>{roleContextLabel}</strong>. Use the sections above to move between your work.</p>
          <dl className="runtime-status-list">
            <div><dt>Session</dt><dd>{sessionTitle}</dd></div>
            <div><dt>Stage</dt><dd>{projection.currentStageLabel ?? "Not started"} ({friendlyReference(projection.currentStageStatus, "Not started")})</dd></div>
            <div><dt>Role</dt><dd>{roleContextLabel}</dd></div>
            <div><dt>Connection</dt><dd>{connectionLabel(connection)}</dd></div>
          </dl>
          <p>Saved work, arrivals and Stage changes appear as brief notices at the bottom of the screen.</p>
        </>} /> : null}
      <main id="main-content" className={`runtime-main participant-runtime-workspace layout-${projection.layout}`} ref={main} tabIndex={0}
        aria-labelledby="runtime-title">
        <RuntimePageHeader titleId="runtime-title"
          eyebrow={projection.activeTeamLabel === null ? projection.activeSessionRoleLabel : `${projection.activeSessionRoleLabel} · ${projection.activeTeamLabel}`}
          title={primaryModule?.title ?? activeNavigationItem?.label ?? sessionTitle}
          description={<p>{typeof primaryModule?.configuration.description === "string" ? primaryModule.configuration.description
            : `${sessionTitle} · ${projection.currentStageLabel ?? "No Stage running"}`}</p>}
          actions={<>{recordViews === null ? null : <>
            <nav className="runtime-view-switch" aria-label="Record views"><ul>{recordViews.views.map((view) => <li key={view.id}>
              <a href={`#runtime-module-${view.moduleId}`} aria-current={view.id === activeNavigationItem?.id ? "page" : undefined}
                onClick={(event) => { event.preventDefault(); selectNavigationItem(view.id, view.moduleId); }}>{view.label}</a></li>)}</ul></nav>
            <a className="btn-primary runtime-page-tool" href={`#runtime-module-${recordViews.present.moduleId}`}
              aria-current={recordViews.present.id === activeNavigationItem?.id ? "page" : undefined}
              onClick={(event) => { event.preventDefault(); selectNavigationItem(recordViews.present.id, recordViews.present.moduleId); }}>
              <RuntimeIcon name="presentation" />{recordViews.present.label}</a></>}
            {composers.map((module, index) => <SessionTool key={module.id} label={module.title} icon="edit" text
              secondary={recordViews !== null || index < composers.length - 1}>
            <CreateWorkspace tasks={moduleArtifacts(module, projection.createTasks)} disabled={submitting} send={send} />
            {toasts.length === 0 ? null : <p className="runtime-form-feedback" role="status">{toasts.at(-1)?.message}</p>}
          </SessionTool>)}</>}
          navigationToggle={sidebarVisible && wideViewport ? undefined : <RuntimeNavigationToggle controls="runtime-navigation" expanded={sidebarVisible}
            onToggle={() => setSidebarPreference(sidebarVisible ? (wideViewport ? "closed" : "auto") : (wideViewport ? "auto" : "open"))} />} />
        <div className="runtime-page-body">
          {outbox === null ? null : <OfflineOutboxPanel outbox={outbox} retry={() => void retryPending()} saveDraft={saveOfflineDraft} />}
          <div className="runtime-regions">
            {regions.filter((region) => region.moduleIds.some((moduleId) => moduleById.get(moduleId)?.configuration.placement !== "header")).map((region) => <div
              hidden={!visibleRegions.includes(region)} className={`runtime-region runtime-region-${region.id}`} data-region-id={region.id} key={region.id}>
              {region.moduleIds.map((moduleId) => moduleById.get(moduleId)).filter((module): module is RuntimeModuleV1 => module !== undefined)
                .filter((module) => module.configuration.presentation !== "composer" && module.configuration.placement !== "header")
                .map((module) => <div className="runtime-region-module" key={module.id}>{renderRuntimeModule(module)}</div>)}
            </div>)}
          </div>
          {projection.polls.length === 0 ? null : <section aria-labelledby="polls-heading">
            <div className="section-heading"><h2 id="polls-heading">Polls</h2></div>
            <div className="card-grid">{projection.polls.map((poll) => <PollCard key={poll.id} poll={poll} disabled={submitting} send={sendPoll} />)}</div>
          </section>}
          <EffectProposalReview proposals={effectProposals} disabled={submitting} decide={(proposal, decision, reason) => void decideEffect(proposal, decision, reason)} />
          <AdjudicationReview adjudications={adjudications} options={adjudicationOptions} disabled={submitting} send={sendInformation} />
        </div>
      </main>
    </div>
    <ToastRegion toasts={toasts} dismiss={dismissToast} hold={holdToast} />
  </div></LocalDraftContext.Provider>;
}

function OperatorView() {
  const id = sessionId();
  const operationView = window.location.pathname.match(/^\/admin\/sessions\/[0-9a-f-]{36}\/(reports|replay|archive)$/iu)?.[1] ?? null;
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [projection, setProjection] = useState<OperatorProjectionV1 | null>(null);
  const [readiness, setReadiness] = useState<ReadinessProjectionV1 | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState("");
  const [reportPreview, setReportPreview] = useState<{
    capturedHistoryLabel?: string; reconstructedNarrativeLabel?: string; reconstructedNarrativeIsTranscript?: boolean;
    observations?: Array<{ elementId?: string; eventType?: string; recordedAt?: string; sourceReferences?: string[] }>;
    derivedMetrics?: Array<{ metricKey?: string; value?: number; sourceReferences?: string[] }>;
  } | null>(null);
  const [reportArtifacts, setReportArtifacts] = useState<Array<{ artifactId: string; filename: string; sha256: string; format: string;
    createdAt: string; purgedAt: string | null; manifest: JsonObject }>>([]);
  const [replayResult, setReplayResult] = useState<{ matched: boolean; comparedEvents: number; manifestDigest: string;
    divergences: Array<{ code?: string; sequence?: number | null; recordedDigest?: string | null; replayedDigest?: string | null }> } | null>(null);
  const [replayCapability, setReplayCapability] = useState<ReplayCapabilityV1 | null>(null);
  const [replayAvailabilityError, setReplayAvailabilityError] = useState<string | null>(null);
  const [replayCheck, setReplayCheck] = useState(0);
  const replayGeneration = useRef(0);
  useEffect(() => {
    const generation = ++replayGeneration.current;
    setReplayCapability(null); setReplayAvailabilityError(null); setReplayResult(null);
    if (id === null || operationView !== "replay") return;
    const controller = new AbortController();
    void api<ReplayCapabilityV1>(`/v1/sessions/${id}/replay`, { signal: controller.signal }).then((capability) => {
      if (generation === replayGeneration.current) setReplayCapability(capability);
    }).catch((cause: unknown) => {
      if (generation === replayGeneration.current) setReplayAvailabilityError(cause instanceof Error ? cause.message : "The availability check failed.");
    });
    return () => { ++replayGeneration.current; controller.abort(); };
  }, [id, operationView, replayCheck]);
  const [retentionStatus, setRetentionStatus] = useState<{ organizationLegalHoldActive: boolean;
    policies: Array<{ id: string; key: string; version: number; periodDays: number; expiryAction: string; scopeType: string }>;
    consequences: string[] } | null>(null);
  const load = useCallback(async () => {
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection("loading");
    try {
      const registered = deviceId === null ? await api<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" }) : { deviceId };
      setDeviceId(registered.deviceId);
      const [nextProjection, nextReadiness] = await Promise.all([
        api<OperatorProjectionV1>(`/v1/operator/sessions/${id}`),
        api<ReadinessProjectionV1>(`/v1/sessions/${id}/readiness`).catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.envelope.error.code === "INVALID_TRANSITION") return null;
          throw cause;
        })
      ]);
      setProjection(nextProjection); setReadiness(nextReadiness);
      setConnection("online"); setError(null);
    } catch (cause) { setConnection(navigator.onLine ? "error" : "offline"); setError(cause instanceof Error ? cause.message : "Operator view unavailable."); }
  }, [deviceId, id]);
  useEffect(() => { void load(); }, [load]);
  const loadOperationContext = useCallback(async () => {
    if (id === null) return;
    if (operationView === "reports") {
      const result = await api<{ artifacts: typeof reportArtifacts }>(`/v1/sessions/${id}/reports`);
      setReportArtifacts(result.artifacts);
    }
    if (operationView === "archive") setRetentionStatus(await api(`/v1/sessions/${id}/retention-status`));
  }, [id, operationView]);
  useEffect(() => { void loadOperationContext().catch((cause: unknown) =>
    setOperationNotice(cause instanceof Error ? cause.message : "Operation context did not load.")); }, [loadOperationContext]);
  const operatorStageClock = useStageClock(projection?.stage?.status ?? null, projection?.stage?.remainingSeconds ?? null, null);
  const [operatorSidebarPreference, setOperatorSidebarPreference] = useState<"auto" | "open" | "closed">("auto");
  const operatorWideViewport = useWideViewport();
  const [operatorAnchor, setOperatorAnchor] = useState(window.location.hash);
  useEffect(() => { const update = () => setOperatorAnchor(window.location.hash); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  if (projection === null) return <StatePage connection={connection} title={connection === "loading" ? "Loading operator view" : "Access denied"}
    message={connection === "loading" ? "Reading authoritative Session state." : error ?? "This view is unavailable."}
    {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  const states = Object.entries(projection.artifactsByState);
  const staffingRoleIds = readiness === null ? [] : [...new Set(readiness.staffing.seats.flatMap((seat) => seat.sessionRoleIds))];
  const staffingRoleLabel = (id: string, fallback: string) => readiness?.staffing.sessionRoles?.find((role) => role.id === id)?.name ?? friendlyReference(id, fallback);
  const send = async (path: string, operationType: string, payload: JsonObject = {}, aggregateId = id,
    expectedAggregateVersion = readiness?.assignmentVersion ?? 0) => {
    if (id === null || deviceId === null || pending || aggregateId === null) return null;
    setPending(true); setNotice("Submitting authoritative Session change.");
    try {
      const result = await api<CommandReceiptV1 | { receipt: CommandReceiptV1; invitationToken: string | null }>(path, { method: "POST", body: JSON.stringify({
        commandId: crypto.randomUUID(), deviceId, operationType, aggregateId,
        expectedAggregateVersion, governingReleaseId: projection.releaseId, payload
      }) });
      const receipt = "receipt" in result ? result.receipt : result;
      setNotice(receipt.status === "accepted" ? "Authoritative Session state updated." : receipt.message ?? "The change was not accepted.");
      await load();
      return result;
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Session change failed."); }
    finally { setPending(false); }
    return null;
  };
  const retryDeadLetter = async (outboxId: string, attempts: number) => {
    if (id === null) return;
    const result = await send(`/v1/operator/sessions/${id}/dead-letters/${outboxId}/retry`, "delivery.retry",
      { reason: "Retry dead-lettered Runtime delivery", confirmed: true }, outboxId, attempts);
    const receipt = result === null ? null : "receipt" in result ? result.receipt : result;
    if (receipt?.status === "accepted") setNotice("Delivery returned to the pending queue.");
  };
  const generateReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (id === null || pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setOperationNotice("Generating the authorized report.");
    try {
      const response = await fetch(`/v1/sessions/${id}/reports`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), reportKind: String(data.get("reportKind")),
          format: String(data.get("format")) }) });
      if (!response.ok) {
        const body = await response.json() as ErrorEnvelopeV1;
        throw new Error(body.error.message);
      }
      const blob = await response.blob();
      if (String(data.get("format")) === "json") {
        setReportPreview(JSON.parse(await blob.text()) as NonNullable<typeof reportPreview>);
      } else setReportPreview(null);
      const blobUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = blobUrl; download.download = `plenum-session-${id}-report.${String(data.get("format"))}`; download.click();
      URL.revokeObjectURL(blobUrl);
      await loadOperationContext();
      setOperationNotice(String(data.get("format")) === "json" ? "Report generated, downloaded, and opened for source-trace inspection." : "Report generated and downloaded.");
    } catch (cause) { setOperationNotice(cause instanceof Error ? cause.message : "The report could not be generated."); }
    finally { setPending(false); }
  };
  const runReplay = async () => {
    if (id === null || pending || replayCapability?.available !== true) return;
    const generation = replayGeneration.current;
    setReplayResult(null); setPending(true); setOperationNotice("Reconstructing Session history from pinned inputs.");
    try {
      const result = await api<NonNullable<typeof replayResult>>(`/v1/sessions/${id}/replay`, { method: "POST", body: "{}" });
      if (generation !== replayGeneration.current) return;
      setReplayResult(result);
      setOperationNotice(result.matched ? `Replay matched across ${result.comparedEvents} Evidence Events.` : `Replay completed with ${result.divergences.length} divergence${result.divergences.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      if (generation !== replayGeneration.current) return;
      setOperationNotice(cause instanceof Error ? cause.message : "Replay is unavailable.");
      if (cause instanceof ApiError && cause.envelope.error.code === "CAPABILITY_UNAVAILABLE") setReplayCheck(value => value + 1);
    }
    finally { if (generation === replayGeneration.current) setPending(false); }
  };
  const consoleBase = `/admin/sessions/${projection.sessionId}`;
  const operatorSidebarVisible = operatorSidebarPreference === "auto" ? operatorWideViewport : operatorSidebarPreference === "open";
  const operatorPageTitle = operationView === "reports" ? "Reports" : operationView === "replay" ? "Replay" : operationView === "archive" ? "Archive" : "Session control";
  const operatorSections: RuntimeSidebarSection[] = [
    { id: "main", label: "Main", navigationLabel: "Session operations", items: [
      { id: "dashboard", label: "Session control", icon: "dashboard", href: consoleBase, current: operationView === null && operatorAnchor !== "#staffing" },
      { id: "staffing", label: "Staffing", icon: "participants", href: `${consoleBase}#staffing`, current: operationView === null && operatorAnchor === "#staffing" },
      { id: "runtime", label: "Participant runtime", icon: "runtime", href: `/sessions/${projection.sessionId}/runtime`, current: false }
    ] satisfies RuntimeSidebarItem[] },
    { id: "data", label: "Data", navigationLabel: "Session data", items: [
      { id: "reports", label: "Reports", icon: "export", href: `${consoleBase}/reports`, current: operationView === "reports" },
      { id: "replay", label: "Replay", icon: "replay", href: `${consoleBase}/replay`, current: operationView === "replay" }
    ] satisfies RuntimeSidebarItem[] },
    { id: "records", label: "Records", navigationLabel: "Session records", items: [
      { id: "archive", label: "Archive", icon: "archive", href: `${consoleBase}/archive`, current: operationView === "archive" },
      { id: "detail", label: "Session detail", icon: "detail", href: `/sessions/${projection.sessionId}`, current: false }
    ] satisfies RuntimeSidebarItem[] }
  ];
  const staffing = <>      {readiness === null ? null : <section id="staffing" aria-labelledby="staffing-title">
        <div className="section-heading"><h2 id="staffing-title">Session staffing</h2></div>
        <div className="card-grid">
          <article className="card"><h3>Issue invitation</h3>
            <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              const personId = String(data.get("personId") ?? "").trim(), seatId = String(data.get("seatId") ?? "");
              const payload: JsonObject = { expiresInHours: 24 };
              if (personId !== "") payload.recipientPersonId = personId;
              if (seatId !== "") payload.seatId = seatId;
              void send(`/v1/sessions/${id}/invitations`, "invitation.issue", payload, crypto.randomUUID(), 0)
                .then((result) => setInvitationToken(result !== null && "invitationToken" in result ? result.invitationToken : null)); }}>
              <details className="provenance-disclosure"><summary>Reserve for a directory person</summary>
                <StaffingPersonPicker sessionId={id!} staffing={readiness.staffing} /></details>
              <div className="field"><label htmlFor="invite-seat">Reserved Seat <span className="hint">(optional)</span></label>
                <select id="invite-seat" name="seatId"><option value="">Any eligible Seat</option>
                  {readiness.staffing.seats.map((item, index) => <option key={item.seatId} value={item.seatId}>{item.label ?? friendlyReference(item.seatId, `Seat ${index + 1}`)}</option>)}</select></div>
              <button className="btn-primary" type="submit" disabled={pending}>Issue invitation</button>
            </form>
            {invitationToken === null ? null : <p className="credential" role="status">Copy this one-time token now: <code>{invitationToken}</code></p>}
          </article>
          <article className="card"><h3>Assign participant</h3><p>Choose an active Organization member and their intended Seat and Session Role.</p>
            <details className="provenance-disclosure"><summary>Open direct assignment form</summary><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              void send(`/v1/sessions/${id}/participants`, "participant.assign", {
                personId: String(data.get("personId")), seatId: String(data.get("seatId")), sessionRoleId: String(data.get("sessionRoleId"))
              }, crypto.randomUUID()); }}>
              <StaffingPersonPicker sessionId={id!} staffing={readiness.staffing} required />
              <div className="field"><label htmlFor="assign-seat">Seat</label><select id="assign-seat" name="seatId" required defaultValue=""><option value="" disabled>Select a Seat</option>
                {readiness.staffing.seats.map((item, index) => <option key={item.seatId} value={item.seatId}>{item.label ?? friendlyReference(item.seatId, `Seat ${index + 1}`)}</option>)}</select></div>
              <div className="field"><label htmlFor="assign-role">Session Role</label><select id="assign-role" name="sessionRoleId" required defaultValue=""><option value="" disabled>Select a Session Role</option>
                  {staffingRoleIds.map((sessionRoleReference, index) => <option key={sessionRoleReference} value={sessionRoleReference}>{staffingRoleLabel(sessionRoleReference, `Role ${index + 1}`)}</option>)}</select></div>
              <button className="btn-primary" type="submit" disabled={pending}>Assign Seat</button>
            </form></details>
          </article>
        </div>
        <h3>Seat occupancy</h3>
        <ul className="readiness-list">{readiness.staffing.seats.map((item, index) => <li key={item.seatId}><span><strong>{item.label ?? friendlyReference(item.seatId, `Seat ${index + 1}`)}</strong></span>
          <span>{item.occupied} occupied · {item.maximum === null ? "No capacity limit" : `Capacity ${item.maximum}`} · {item.minimum} required</span></li>)}</ul>
        <h3>Waiting room</h3>
        {readiness.staffing.joinRequests.length === 0 ? <p className="empty-state">No pending join requests.</p> : <ul className="readiness-list">
          {readiness.staffing.joinRequests.map((item, index) => <li key={`${item.personId}-${item.submittedAt}`}><span><strong>{readiness.staffing.people?.find((person) => person.personId === item.personId)?.displayName ?? `Join request ${index + 1}`}</strong> · {displayStatus(item.status)}{item.requestedSeatId === null ? "" : ` · ${readiness.staffing.seats.find((seat) => seat.seatId === item.requestedSeatId)?.label ?? "Requested Seat"}`}</span>
            <span className="actions"><button className="btn-primary" type="button" disabled={pending}
              onClick={() => void send(`/v1/sessions/${id}/join-requests/${item.personId}/admit`, "participant.admit", {}, item.personId, 0)}>Admit</button>
              <button className="btn-secondary" type="button" disabled={pending}
                onClick={() => void send(`/v1/sessions/${id}/join-requests/${item.personId}/reject`, "participant.reject", {}, item.personId, 0)}>Reject</button></span></li>)}</ul>}
        <h3>Roster review</h3>
        {readiness.staffing.rosterReview.length === 0 ? <p className="empty-state">No ambiguous roster rows.</p> : <ul className="readiness-list">
          {readiness.staffing.rosterReview.map((item) => <li key={item.rowId}><span><strong>Row {item.rowNumber}</strong> · {readiness.staffing.people?.find((person) => person.personId === item.personId)?.displayName ?? "Person needs review"} · {readiness.staffing.seats.find((seat) => seat.seatId === item.seatId)?.label ?? "Seat needs review"}</span>
            <span>{item.reasons.map(displayStatus).join(", ")}</span></li>)}</ul>}
        <h3>Active assignments</h3>
        {readiness.staffing.assignments.length === 0 ? <p className="empty-state">No active Seat Assignments.</p> : <ul className="readiness-list">
          {readiness.staffing.assignments.map((item, assignmentIndex) => <li key={item.seatAssignmentId}><span><strong>{readiness.staffing.seats.find((seat) => seat.seatId === item.seatId)?.label ?? friendlyReference(item.seatId, `Seat ${assignmentIndex + 1}`)}</strong> · {staffingRoleLabel(item.sessionRoleId, "Assigned role")}</span>
            <details className="provenance-disclosure"><summary>Assignment details and reassignment</summary><p>Technical references: <code>{item.personId} · {item.seatAssignmentId}</code></p><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              void send(`/v1/sessions/${id}/seat-assignments/${item.seatAssignmentId}/reassign`, "participant.reassign", {
                previousSeatAssignmentId: item.seatAssignmentId, newSeatId: String(data.get("seatId")),
                newSessionRoleId: String(data.get("sessionRoleId")), reason: String(data.get("reason")),
                exposureAcknowledged: data.get("exposureAcknowledged") === "on"
              }, item.participantId, item.accessRevision); }}>
              <div className="field"><label htmlFor={`reassign-seat-${item.seatAssignmentId}`}>Destination Seat</label><select id={`reassign-seat-${item.seatAssignmentId}`} name="seatId" required defaultValue=""><option value="" disabled>Select a Seat</option>
                {readiness.staffing.seats.map((seat, index) => <option key={seat.seatId} value={seat.seatId}>{seat.label ?? friendlyReference(seat.seatId, `Seat ${index + 1}`)}</option>)}</select></div>
              <div className="field"><label htmlFor={`reassign-role-${item.seatAssignmentId}`}>Session Role</label><select id={`reassign-role-${item.seatAssignmentId}`} name="sessionRoleId" required defaultValue=""><option value="" disabled>Select a Session Role</option>
                {staffingRoleIds.map((sessionRoleReference, index) => <option key={sessionRoleReference} value={sessionRoleReference}>{staffingRoleLabel(sessionRoleReference, `Role ${index + 1}`)}</option>)}</select></div>
              <div className="field"><label htmlFor={`reassign-reason-${item.seatAssignmentId}`}>Reason</label><input id={`reassign-reason-${item.seatAssignmentId}`} name="reason" required minLength={3} maxLength={500} /></div>
              <label className="choice"><input name="exposureAcknowledged" type="checkbox" /> I acknowledge that previously viewed information cannot be withdrawn.</label>
              <button className="btn-primary" type="submit" disabled={pending}>Reassign</button>
            </form></details></li>)}</ul>}
      </section>}
</>;
  const reports = <>      {operationView === "reports" ? <section className="workspace-section operation-panel" aria-labelledby="reports-title">
        <h2 id="reports-title">Generate a Session report</h2>
        <form onSubmit={(event) => void generateReport(event)}>
          <div className="field"><label htmlFor="report-kind">Report</label><select id="report-kind" name="reportKind" defaultValue="after_action">
            <option value="after_action">After action</option><option value="session_archive">Session archive</option>
            <option value="control">Control</option><option value="team">Team</option>
          </select></div>
          <div className="field"><label htmlFor="report-format">Format</label><select id="report-format" name="format" defaultValue="json">
            <option value="json">JSON</option><option value="csv">CSV</option><option value="html">HTML</option><option value="pdf">PDF</option><option value="zip">ZIP</option>
          </select></div>
          <button className="btn-primary" type="submit" disabled={pending}>Generate and download</button>
        </form>
        <p className="hint">Choose JSON to inspect element-level source traces here. PDF output paginates automatically when Captured History exceeds one page.</p>
        {reportPreview === null ? null : <section className="report-trace" aria-labelledby="report-trace-title">
          <h3 id="report-trace-title">Report source trace</h3>
          <p><strong>{reportPreview.capturedHistoryLabel ?? "Captured History"}</strong> is authoritative captured evidence.
            <strong> {reportPreview.reconstructedNarrativeLabel ?? "Reconstructed Narrative"}</strong> is analytical context and is not a transcript.</p>
          <dl className="provenance-grid"><div><dt>Captured observations</dt><dd>{reportPreview.observations?.length ?? 0}</dd></div>
            <div><dt>Derived metrics</dt><dd>{reportPreview.derivedMetrics?.length ?? 0}</dd></div></dl>
          <ol className="trace-list">{reportPreview.observations?.slice(0, 20).map((item, index) => <li key={item.elementId ?? index}>
            <span><strong>{item.eventType ?? "Evidence Event"}</strong>{item.recordedAt === undefined ? "" : ` · ${formatDate(item.recordedAt)}`}</span>
            <details className="provenance-disclosure"><summary>Source references</summary><code>{item.sourceReferences?.join(", ") ?? "No source reference"}</code></details></li>)}</ol>
        </section>}
        <section aria-labelledby="report-history-title"><h3 id="report-history-title">Generated artifacts</h3>
          {reportArtifacts.length === 0 ? <p className="empty-state">No reports have been generated for this Session.</p> : <ul className="administration-list compact">
            {reportArtifacts.map((artifact) => <li key={artifact.artifactId}><span><strong>{reportFileLabel(artifact.filename)}</strong> · {formatDate(artifact.createdAt)}</span>
              <details className="provenance-disclosure"><summary>Technical provenance</summary><p>{artifact.filename}</p><code>{artifact.sha256}</code></details>
              {artifact.purgedAt === null ? <a className="btn-secondary link-button" href={`/v1/report-artifacts/${artifact.artifactId}`}>Download report</a> : <span>Purged under retention policy</span>}</li>)}</ul>}
        </section>
      </section> : null}
</>;
  const content = <>      {operationView === null ? null : <p className="live-region" role="status" aria-live="polite">{operationNotice}</p>}
      {reports}
      {operationView === "replay" ? <section className="workspace-section operation-panel" aria-labelledby="replay-title">
        <h2 id="replay-title">Replay Session evidence</h2>
        <p>Deterministic Replay reconstructs history from pinned inputs and compares it with Captured History without changing Session state.</p>
        {replayAvailabilityError !== null ? <div className="status-notice" role="status">
          <p>Replay availability could not be verified. {replayAvailabilityError}</p>
          <button className="btn-secondary" type="button" onClick={() => setReplayCheck(value => value + 1)}>Check Replay availability again</button>
        </div> : replayCapability === null ? <p role="status">Checking Replay availability.</p> : <div className="status-notice" role="status">
          <p>{replayCapability.message}</p>
          {!replayCapability.available ? <a href={`${consoleBase}/reports`}>View captured history in Reports</a> : null}
        </div>}
        {replayCapability?.available === true ? <button className="btn-primary" type="button" disabled={pending} onClick={() => void runReplay()}>Run replay</button> : null}
        {replayResult === null ? null : <div className="replay-result">
          <div className={`status-notice ${replayResult.matched ? "status-success" : "status-warning"}`} role="status">
            <strong>{replayResult.matched ? "Matched" : "Divergence detected"}</strong> · {replayResult.comparedEvents} compared Evidence Events
          </div>
          <dl className="provenance-grid"><div><dt>Compared events</dt><dd>{replayResult.comparedEvents}</dd></div>
            <div><dt>Reconstructed Narrative</dt><dd>Deterministic comparison only; never represented as a transcript</dd></div></dl>
          <details className="provenance-disclosure"><summary>Replay manifest digest</summary><code>{replayResult.manifestDigest}</code></details>
          {replayResult.divergences.length === 0 ? <p>No differences were found between captured and replayed history.</p> : <table className="data-table">
            <caption>Machine-readable replay differences</caption><thead><tr><th scope="col">Difference</th><th scope="col">Sequence</th><th scope="col">Captured digest</th><th scope="col">Replayed digest</th></tr></thead>
            <tbody>{replayResult.divergences.map((item, index) => <tr key={`${item.code}-${item.sequence}-${index}`}><td>{item.code ?? "difference"}</td><td>{item.sequence ?? "—"}</td>
              <td><code>{item.recordedDigest ?? "—"}</code></td><td><code>{item.replayedDigest ?? "—"}</code></td></tr>)}</tbody></table>}
        </div>}
      </section> : null}
      {operationView === "archive" ? <section className="workspace-section operation-panel" aria-labelledby="archive-title">
        <h2 id="archive-title">Archive Session</h2>
        <p>Archiving preserves immutable Release and Evidence history while removing this Session from active operations.</p>
        {retentionStatus === null ? <PlenumLoader label="Loading retention consequences" /> : <div className="retention-impact">
          {retentionStatus.organizationLegalHoldActive ? <p className="status-notice"><strong>Active legal hold:</strong> matching purge remains blocked after archive.</p> : null}
          <ul>{retentionStatus.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul>
          <h3>Applicable retention policies</h3>{retentionStatus.policies.length === 0 ? <p className="empty-state">No Organization or Session-specific retention policy is recorded.</p> :
            <ul className="administration-list compact">{retentionStatus.policies.map((policy) => <li key={policy.id}><strong>{policy.key} v{policy.version}</strong><span>{plural(policy.periodDays, "day")} · {displayStatus(policy.expiryAction)}</span></li>)}</ul>}
        </div>}
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
          void send(`/v1/sessions/${projection.sessionId}/archive`, "session.archive", { reason: String(data.get("reason")) }, projection.sessionId, 0); }}>
          <div className="field"><label htmlFor="archive-reason">Archive reason</label><input id="archive-reason" name="reason" required minLength={3} maxLength={500} /></div>
          <label className="choice"><input name="confirmed" type="checkbox" required /> I understand this removes the Session from active operations.</label>
          <button className="btn-primary" type="submit" disabled={pending || projection.sessionStatus === "archived"}>{projection.sessionStatus === "archived" ? "Session archived" : "Confirm archive"}</button>
        </form>
      </section> : null}
      {operationView === null ? <>
      <p className="hint">{projection.connectedParticipantCount} of {plural(projection.participantCount, "Participant")} connected; {projection.occupiedSeatCount} of {plural(projection.totalSeatCount, "Seat")} occupied; {plural(projection.activeTasks.length, "active task")}</p>
      {projection.warnings.length === 0 ? null : <section className="workspace-section operation-panel" aria-labelledby="warning-title">
        <h2 id="warning-title">Operational warnings</h2>
        <ul className="status-list">{projection.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>}
      <section className="workspace-section operation-panel" aria-labelledby="lifecycle-control-title">
        <h2 id="lifecycle-control-title" className="visually-hidden">Session control</h2><details className="provenance-disclosure"><summary>Technical provenance</summary><p>Lifecycle version {projection.sessionVersion}</p></details>
        <p>The preview below names the requested transition. Plenum records the confirmed reason, before/after state, actor, Release, and server time.</p>
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
          const operation = String(data.get("operation"));
          void send(`/v1/operator/sessions/${projection.sessionId}/lifecycle`, operation,
            { reason: String(data.get("reason")), confirmed: data.get("confirmed") === "on" }, projection.sessionId, projection.sessionVersion); }}>
          <div className="field"><label htmlFor="session-control-operation">Next valid action</label><select id="session-control-operation" name="operation" required defaultValue="">
            <option value="" disabled>Select an action</option>
            {projection.sessionStatus === "open" ? <option value="session.start">Start Session: open → active</option> : null}
            {projection.sessionStatus === "active" ? <><option value="session.pause">Pause Session: active → paused</option><option value="session.complete">Complete Session: active → completed</option></> : null}
            {projection.sessionStatus === "paused" ? <><option value="session.resume">Resume Session: paused → active</option><option value="session.complete">Complete Session: paused → completed</option></> : null}
            {projection.sessionStatus === "completed" ? <option value="session.lock">Lock Session: completed → locked</option> : null}
          </select></div>
          <div className="field"><label htmlFor="session-control-reason">Reason</label><input id="session-control-reason" name="reason" required minLength={3} maxLength={500} /></div>
          <label className="choice"><input name="confirmed" type="checkbox" required /> Confirm this authoritative lifecycle change.</label>
          <button className="btn-primary" type="submit" disabled={pending || !["open","active","paused","completed"].includes(projection.sessionStatus)}>Apply Session control</button>
        </form>
      </section>
      {projection.stage === null ? null : <section className="workspace-section operation-panel" aria-labelledby="stage-control-title">
        <h2 id="stage-control-title">{projection.stage.label}</h2>
        <p className="operator-stage-status">Status: <strong>{displayStatus(projection.stage.status)}</strong></p>
        <dl className="operator-stage-facts">
          <div><dt>Time remaining</dt><dd className="operator-stage-clock">{projection.stage.remainingSeconds === null ? "Untimed" : operatorStageClock ?? formatStageClock(projection.stage.remainingSeconds)}</dd></div>
          <div><dt>Elapsed</dt><dd>{formatStageClock(projection.stage.elapsedSeconds)}</dd></div>
          <div><dt>Time added</dt><dd>{projection.stage.extensionSeconds === 0 ? "None" : formatStageClock(projection.stage.extensionSeconds)}</dd></div>
        </dl>
        <details className="provenance-disclosure"><summary>Technical provenance</summary><p>Stage version {projection.stage.version}</p></details>
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const operation = String(data.get("operation"));
          const payload: JsonObject = { reason: String(data.get("reason")), confirmed: data.get("confirmed") === "on" };
          const target = String(data.get("targetStageId") ?? ""); if (target !== "") payload.targetStageId = target;
          if (operation === "stage.extend") {
            try { payload.seconds = extensionSeconds(String(data.get("minutes"))); }
            catch (cause) { setOperationNotice(cause instanceof Error ? cause.message : "Check the additional minutes."); return; }
          }
          void send(`/v1/operator/sessions/${projection.sessionId}/stage`, operation, payload, projection.sessionId, projection.stage?.version ?? 0); }}>
          <div className="field"><label htmlFor="stage-control-operation">Stage action</label><select id="stage-control-operation" name="operation" required defaultValue="">
            <option value="" disabled>Select an action</option>
            {projection.stage.status === "not_started" && projection.stage.controls.allowStart ? <option value="stage.start">Start Stage</option> : null}
            {projection.stage.status === "active" ? <option value="stage.pause">Pause timer</option> : null}
            {projection.stage.status === "paused" ? <option value="stage.resume">Resume timer</option> : null}
            {projection.stage.controls.allowExtend && ["active","paused"].includes(projection.stage.status) ? <option value="stage.extend">Extend timer</option> : null}
            {projection.stage.controls.allowEnd && projection.stage.status !== "not_started" ? <option value="stage.end">End Stage</option> : null}
            {projection.stage.controls.allowReopen && projection.stage.status === "completed" ? <option value="stage.reopen">Reopen Stage</option> : null}
            {projection.stage.transitions.map((transition) => <option key={transition.targetStageId} value={projection.stage?.controls.allowSkip ? "stage.skip" : "stage.advance"}>
              {projection.stage?.controls.allowSkip ? "Skip/advance" : "Advance"} to {transition.label}</option>)}
          </select></div>
          <div className="field"><label htmlFor="stage-target">Transition target</label><select id="stage-target" name="targetStageId" defaultValue=""><option value="">No target</option>
            {projection.stage.transitions.map((transition) => <option key={transition.targetStageId} value={transition.targetStageId}>{transition.label}</option>)}</select></div>
          <div className="field"><label htmlFor="stage-extension">Additional minutes</label><input id="stage-extension" name="minutes" type="number" min={1} step={1} defaultValue={5} /></div>
          <div className="field"><label htmlFor="stage-control-reason">Reason</label><input id="stage-control-reason" name="reason" required minLength={3} maxLength={500} /></div>
          <label className="choice"><input name="confirmed" type="checkbox" required /> Confirm the previewed Stage intervention.</label>
          <button className="btn-primary" type="submit" disabled={pending || !["active","paused"].includes(projection.sessionStatus)}>Apply Stage control</button>
        </form>
      </section>}
      <section aria-labelledby="inject-queue-title"><div className="section-heading"><h2 id="inject-queue-title">Injects</h2></div>
        {projection.injectQueue.length === 0 ? <p className="empty-state">No Inject Definitions are configured.</p> : <ul className="readiness-list">{projection.injectQueue.map((item) => <li className="inject-queue-item" key={item.definitionId}>
          <span><strong>{item.title}</strong> · {displayStatus(item.state)} · {displayStatus(item.releaseMode)}{item.scheduledAt === null ? "" : ` · ${formatDate(item.scheduledAt)}`}</span>
          {item.releaseMode === "manual" && item.id === null ? <button className="btn-secondary" type="button" disabled={pending}
            onClick={() => void send(`/v1/operator/sessions/${projection.sessionId}/inject`, "inject.release",
              { injectDefinitionId: item.definitionId, reason: `Release ${item.title}`, confirmed: true }, crypto.randomUUID(), 0)}>Release Inject</button> : null}
          {item.id !== null && !["cancelled","closed","expired"].includes(item.state) ? <button className="btn-secondary" type="button" disabled={pending}
            onClick={() => void send(`/v1/operator/sessions/${projection.sessionId}/inject`, "inject.cancel",
              { reason: `Cancel ${item.title}`, confirmed: true }, item.id, item.version)}>Cancel Inject</button> : null}
          {item.id !== null && item.state === "scheduled" && item.scheduledAt !== null ?
            <OperatorInjectSchedule key={`${item.id}:${item.version}`} title={item.title} scheduledAt={item.scheduledAt}
              disabled={pending || !["open", "active", "paused"].includes(projection.sessionStatus)}
              reschedule={(scheduledAt, reason) => {
                if (item.id) void send(`/v1/operator/sessions/${projection.sessionId}/inject`, "inject.reschedule",
                  { scheduledAt, reason, confirmed: true }, item.id, item.version);
              }} /> : null}
        </li>)}</ul>}
      </section>
      <section aria-labelledby="adjudication-queue-title"><div className="section-heading"><h2 id="adjudication-queue-title">Adjudication status</h2></div>
        {projection.adjudicationQueue.length === 0 ? <p className="empty-state">No Adjudications require action.</p> : <ul className="readiness-list">
          {projection.adjudicationQueue.map((item) => <li key={item.id}><span><strong>{displayStatus(item.status)}</strong></span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time><details className="provenance-disclosure"><summary>Technical provenance</summary><p>Version {item.version}</p></details></li>)}</ul>}
      </section>
      <section aria-labelledby="delivery-health-title">
        <div className="section-heading"><h2 id="delivery-health-title">Runtime deliveries</h2></div>
        <p>{projection.deliveryHealth.pending} pending · Needs attention: {projection.deliveryHealth.deadLettered}</p>
        {projection.deliveryHealth.deadLetters.length === 0 ? <p className="empty-state">No deliveries need attention.</p> :
          <ul className="readiness-list">{projection.deliveryHealth.deadLetters.map((item) => <li key={item.outboxId}>
            <span><strong>{displayStatus(item.eventType.replaceAll(".", " "))}</strong> · {item.attempts} failed attempts<br /><small>Queued <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></small></span>
            <button className="btn-secondary" type="button" disabled={pending} onClick={() => void retryDeadLetter(item.outboxId, item.attempts)}>
              Retry delivery
            </button>
          </li>)}</ul>}
      </section>
      {staffing}
      {readiness === null ? null : <section aria-labelledby="readiness-title">
        <div className="section-heading"><h2 id="readiness-title">Operator readiness</h2></div><details className="provenance-disclosure"><summary>Technical provenance</summary><p>Release and assignment version {readiness.assignmentVersion}</p></details>
        <div className="live-region" aria-live="polite" aria-atomic="true">{notice}</div>
        <ul className="readiness-list">
          {readiness.checks.map((check) => <li key={check.key}>
            <span><strong>{check.complete ? "Complete" : "Incomplete"}</strong> — {check.label}</span>
            {check.key === "release_current" || check.key === "required_seats" || check.key === "operator_assignment" || check.complete
              ? null : <button className="btn-secondary" type="button" disabled={pending}
                onClick={() => void send(`/v1/sessions/${id}/readiness/${encodeURIComponent(check.key)}/confirm`, "readiness.confirm", { checkKey: check.key })}>Confirm</button>}
          </li>)}
        </ul>
        <div className="actions">
          {projection.sessionStatus === "configured" ? <button className="btn-primary" type="button" disabled={pending || !readiness.ready}
            onClick={() => void send(`/v1/sessions/${id}/ready`, "session.ready")}>Mark Session ready</button> : null}
          {projection.sessionStatus === "ready" ? <button className="btn-primary" type="button" disabled={pending || !readiness.ready}
            onClick={() => void send(`/v1/sessions/${id}/open`, "session.open")}>Open Session</button> : null}
        </div>
      </section>}
      <section aria-labelledby="artifact-status-title"><h2 id="artifact-status-title">Artifact status</h2>
        {states.length === 0 ? <p className="empty-state">No Artifacts have been created.</p> : <ul className="status-list">
          {states.map(([state, count]) => <li key={state}><span>{displayStatus(state)}</span><strong>{count}</strong></li>)}</ul>}
      </section>
      <section aria-labelledby="event-title"><h2 id="event-title">Recent authoritative events</h2>
        {projection.recentEvents.length === 0 ? <p className="empty-state">No Session events recorded.</p> : <ol className="event-list">
          {projection.recentEvents.map((event, index) => <li key={`${event.type}-${event.recordedAt}-${index}`}><span>{displayStatus(event.type.replaceAll(".", " "))}</span><time dateTime={event.recordedAt}>{formatDate(event.recordedAt)}</time></li>)}</ol>}
      </section>
      </> : null}
</>;
  return <div className="app-frame app-frame-bounded runtime-frame" data-sidebar={operatorSidebarVisible ? "open" : "closed"}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {operatorSidebarVisible ? <a className="skip-link" href="#operator-navigation">Skip to Session operations</a> : null}
    <RuntimeHeader sessionTitle={projection.sessionTitle}
      sessionMenu={() => <div className="runtime-menu-body">
        <p className="runtime-menu-title">{projection.sessionTitle}</p>
        <dl className="runtime-menu-facts">
          <div><dt>Release</dt><dd>{projection.releaseLabel}</dd></div>
          <div><dt>Session</dt><dd>{friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
          <div><dt>Connected</dt><dd>{projection.connectedParticipantCount} / {projection.participantCount}</dd></div>
          <div><dt>Seats occupied</dt><dd>{projection.occupiedSeatCount} / {projection.totalSeatCount}</dd></div>
        </dl>
        <a className="runtime-menu-link" href="/?workspace=lifecycle"><RuntimeIcon name="list" />All Sessions</a>
      </div>}
      stage={{ label: projection.stage?.label ?? null, status: projection.stage?.status ?? null, clock: operatorStageClock }}
      connection={{ state: connection, label: connectionLabel(connection) }}
      refreshing={pending}
      onRefresh={() => void load()}
      notifications={null}
      themeToggle={<ThemeToggle />}
      roleLabel="Operator"
      roleMenu={() => <div className="runtime-menu-body">
        <p className="runtime-menu-title">Operator console</p>
        <p className="runtime-menu-meta">Session control without a Participant Seat.</p>
        <a className="runtime-menu-link runtime-menu-exit" href="/"><RuntimeIcon name="exit" />Exit console</a>
      </div>} />
    <div className="runtime-body">
      {operatorSidebarVisible ? <RuntimeSidebar id="operator-navigation" sections={operatorSections}
        onHide={() => setOperatorSidebarPreference(operatorWideViewport ? "closed" : "auto")}
        startHere={<section aria-labelledby="operator-context-title">
          <h2 id="operator-context-title" className="visually-hidden">Control context</h2>
          <p>Every control records your reason, the before and after state, the Release and the server time.</p>
          <dl className="runtime-status-list"><div><dt>Session</dt><dd>{friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
            <div><dt>Release</dt><dd>{projection.releaseLabel}</dd></div>
            <div><dt>Connection</dt><dd>{connectionLabel(connection)}</dd></div>
            <div><dt>Pending action</dt><dd>{pending ? "Submitting" : "None"}</dd></div></dl>
        </section>} /> : null}
      <main id="main-content" className="runtime-main operator-workspace" tabIndex={0} aria-labelledby="operator-title">
        <RuntimePageHeader titleId="operator-title" eyebrow="Operator console" title={operatorPageTitle}
          description={<p>{projection.sessionTitle} · {projection.releaseLabel} · Session {friendlyReference(projection.sessionStatus, "Unavailable")}</p>}
          navigationToggle={operatorSidebarVisible && operatorWideViewport ? undefined : <RuntimeNavigationToggle controls="operator-navigation"
            expanded={operatorSidebarVisible}
            onToggle={() => setOperatorSidebarPreference(operatorSidebarVisible ? (operatorWideViewport ? "closed" : "auto") : (operatorWideViewport ? "auto" : "open"))} />} />
      <div className="runtime-page-body">
      {content}
      </div>
      </main>
    </div>
  </div>;
}

export function App() {
  const legacySession = new URLSearchParams(window.location.search).get("sessionId");
  useEffect(() => {
    if (!["/", "/app/dashboard", "/admin/dashboard"].includes(window.location.pathname) || legacySession === null || !/^[0-9a-f-]{36}$/iu.test(legacySession)) return;
    const target = new URL(window.location.href);
    target.pathname = window.location.pathname === "/admin/dashboard" ? `/admin/sessions/${legacySession}` : `/sessions/${legacySession}/runtime`;
    target.searchParams.delete("sessionId");
    window.location.replace(target.href);
  }, [legacySession]);
  const projectDemoId = useMemo(() => window.location.pathname.match(/^\/projects\/([0-9a-f-]{36})\/demo\/?$/iu)?.[1] ?? null, []);
  const firstAdminToken = useMemo(() => window.location.pathname.match(/^\/platform\/invitations\/([A-Za-z0-9_-]{43})\/?$/u)?.[1] ?? null, []);
  const platformAdministratorToken = useMemo(() => window.location.pathname.match(/^\/platform\/administrator-invitations\/([A-Za-z0-9_-]{43})\/?$/u)?.[1] ?? null, []);
  const workforceInvitationToken = useMemo(() => window.location.pathname.match(/^\/organization\/invitations\/([A-Za-z0-9_-]{43})\/?$/u)?.[1] ?? null, []);
  const operator = useMemo(() => /^\/admin\/sessions\/[0-9a-f-]{36}(?:\/(?:reports|replay|archive))?\/?$/iu.test(window.location.pathname), []);
  const productEntry = useMemo(() => {
    const pathname = window.location.pathname;
    return pathname === "/" || /^\/(?:releases|sessions)\/[0-9a-f-]{36}$/iu.test(pathname) ||
      /^\/admin\/(?:members|identity|plugins|deployment|data-policy)\/?$/u.test(pathname) || /^\/research\/reports\/?$/u.test(pathname) ||
      /^\/platform\/(?:organizations(?:\/[0-9a-f-]{36})?|administrators)\/?$/iu.test(pathname);
  }, []);
  if (firstAdminToken !== null) return <FirstAdminInvitation token={firstAdminToken} />;
  if (platformAdministratorToken !== null) return <PlatformAdministratorInvitation token={platformAdministratorToken} />;
  if (workforceInvitationToken !== null) return <OrganizationWorkforceInvitation token={workforceInvitationToken} />;
  if (projectDemoId !== null) return <Shell connection="online" bounded headerContent={<div className="header-actions qa-demo-header-actions">
    <a className="qa-demo-back-link" href="/?workspace=projects">Projects</a>
    <strong className="qa-demo-mode-label"><span className="connection-indicator" aria-hidden="true" />QA Demo <span>Isolated Draft</span></strong>
    <ThemeToggle />
  </div>}><ProjectDemo projectId={projectDemoId} FieldEditorComponent={FieldEditor} /></Shell>;
  if (legacySession !== null && /^[0-9a-f-]{36}$/iu.test(legacySession) && ["/", "/app/dashboard", "/admin/dashboard"].includes(window.location.pathname))
    return <StatePage connection="loading" title="Opening Session" message="Opening the canonical Session workspace." />;
  if (productEntry) return <ProductEntry />;
  if (operator) return <OperatorView />;
  if (/^\/sessions\/[0-9a-f-]{36}\/runtime\/?$/iu.test(window.location.pathname)) return <RuntimeView />;
  return <Shell connection="online" headerContent={<div className="header-actions"><ThemeToggle /></div>}>
    <main id="main-content" className="state-page" tabIndex={-1} data-state="not-found">
      <h1>Page not found</h1><p>This address does not match a Plenum page.</p><a href="/">Return to Plenum</a>
    </main>
  </Shell>;
}
