import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import {
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type AdjudicationRequestV1,
  type ErrorEnvelopeV1,
  type EffectProposalV1,
  type JsonObject,
  type OperatorProjectionV1,
  type ReadinessProjectionV1,
  type RuntimeActionV1,
  type RuntimeArtifactV1,
  type RuntimeCreateTaskV1,
  type RuntimeFormV1,
  type RuntimeInjectV1,
  type RuntimeMessageV1,
  type RuntimeModuleV1,
  type RuntimePollV1,
  type RuntimeProjectionV1,
  type RuntimeVoiceChannelV1,
  type FloorLeaseV1,
  type ProductShellContextV1
} from "@plenum/event-contracts";
import type { OfflineCommandV1, OfflineOutboxV1, SyncBootstrapV1 } from "@plenum/event-contracts";
import {
  canQueueOffline,
  createOfflineOutbox,
  enqueueOfflineCommand,
  minimizeOfflineProjection,
  orderedOfflineCommands,
  recordOfflineReceipt,
  updateOfflineDraft
} from "@plenum/sync-client";
import {
  runtimeFieldConditionMatches,
  runtimeFormValue,
  setRuntimeFormValue,
  validateRuntimeFormPayload,
  type RuntimeFormDefinitionV1
} from "@plenum/simulation-schema";
import { VoiceControls } from "./voice/VoiceControls.js";
import { AdjudicationReview } from "./adjudication/AdjudicationReview.js";
import { OfflineRuntimeStore } from "./offline/storage.js";
import { ProjectPortal } from "./product/ProjectPortal.js";
import { LifecyclePortal } from "./product/LifecyclePortal.js";
import { ParticipantPortal } from "./product/ParticipantPortal.js";
import { AdministrationPortal } from "./product/AdministrationPortal.js";
import { ResearchReportingPortal } from "./product/ResearchReportingPortal.js";
import { ProjectDemo } from "./product/ProjectDemo.js";
import { PlatformOrganizationsPortal } from "./product/PlatformOrganizationsPortal.js";
import { PlatformAdministratorsPortal } from "./product/PlatformAdministratorsPortal.js";
import { navigateWithLoader, PlenumLoader } from "./PlenumLoader.js";

type ConnectionState = "loading" | "online" | "offline" | "unauthorized" | "error";

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

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("plenum.theme", theme); } catch { /* The document theme still applies when storage is unavailable. */ }
    const synchronizeTheme = (event: StorageEvent) => {
      if (event.key === "plenum.theme") setTheme(event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", synchronizeTheme);
    return () => window.removeEventListener("storage", synchronizeTheme);
  }, [theme]);
  const nextTheme = theme === "light" ? "dark" : "light";
  return <button className="btn-secondary theme-toggle" type="button"
    aria-label={`Theme: ${theme}. Use ${nextTheme} theme`} title={`Use ${nextTheme} theme`}
    onClick={() => setTheme(nextTheme)}>
    {theme === "light" ? <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg> : <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
    </svg>}
  </button>;
}

function Shell({ connection, children, bounded = false, entry = false, entryLoading = false, entryTransitioning = false, onEntry, brandContent, headerContent }: {
  connection: ConnectionState; children: ReactNode; bounded?: boolean; entry?: boolean; entryLoading?: boolean;
  entryTransitioning?: boolean;
  onEntry?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
  brandContent?: ReactNode;
  headerContent?: ReactNode;
}) {
  return <div className={`app-frame${bounded ? " app-frame-bounded" : ""}${entry ? " app-frame-entry" : ""}${entryTransitioning ? " is-transitioning" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      {brandContent ?? <BrandWordmark />}
      {entry ? <div className="header-actions entry-header-actions">
        {entryLoading ? null : <>
          <a className="entry-header-sign-in" href="#about">About</a>
          <a className="entry-header-sign-in" href="/auth/login?returnTo=%2F" onClick={onEntry}>Sign In</a>
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
  return <Shell connection="unauthorized" entry entryTransitioning={transitioning} onEntry={beginEntry}>
    <main id="main-content" className="entry-landing" tabIndex={-1}>
      <section id="about" className="entry-introduction" aria-labelledby="entry-title">
        <h1 id="entry-title">What happens next?</h1>
        <p>Design, deliver and audit governed simulations.</p>
        <a className="entry-primary-action" href="/auth/login?returnTo=%2F" onClick={beginEntry}>
          <span>Enter Plenum</span>
          <svg className="entry-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 18 18 6M10 6h8v8" />
          </svg>
        </a>
      </section>
      <p className="entry-assurance">Organization sign-in · Plenum never handles your password.</p>
    </main>
    {transitioning ? <EntryTransition label="Resolving next state" /> : null}
  </Shell>;
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
      {connection === "loading" ? <><h1 className="visually-hidden">{title}</h1><PlenumLoader label={message} overlay /></> : <section className="card state-card">
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
  const role = workspaceTitle === "Platform control plane" && context.platformRoles.includes("platform_administrator")
    ? "Platform Administrator" : friendlyReference(context.organization.roles[0] ?? "", "Participant");
  return <>
    <div className="product-header-context" aria-label="Current workspace context">
      <span className="product-header-organization" title={context.organization.name}>{context.organization.name}</span>
      <svg className="product-header-separator" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
      <h1 id="product-title" className="product-header-title">{workspaceTitle}</h1>
    </div>
    <div className="header-actions product-header-actions">
      {showNavigation ? <button className="workspace-navigation-toggle header-icon-button" type="button" aria-expanded={navigationOpen}
        aria-controls="workspace-navigation" aria-label={navigationOpen ? "Close workspaces" : "Open workspaces"} onClick={onToggleNavigation}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
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
  const defaultWorkspace = canUseProjects ? "projects" : canUseLifecycle ? "lifecycle" : "participant";
  const workspace = platform ? "platform" : administration ? "administration" : researchReporting ? "research" : releaseOrSessionDetail ? "lifecycle" :
    requestedWorkspace === "projects" && canUseProjects ? "projects" :
      requestedWorkspace === "lifecycle" && canUseLifecycle ? "lifecycle" :
        requestedWorkspace === "participant" ? "participant" : hashWorkspace ?? defaultWorkspace;
  const workspaceTitle = workspace === "projects" ? "Projects" : workspace === "lifecycle" ? "Releases and Sessions" :
    workspace === "participant" ? "Your Sessions" : workspace === "administration" ? "Administration" :
      workspace === "platform" ? "Platform control plane" : "Research reports";

  if (connection === "loading") return <EntryLoadingState />;
  if (unauthenticated) return <EntryLanding />;

  return <Shell connection={connection} bounded headerContent={context === null ? undefined : <ProductHeader context={context} connection={connection}
    workspaceTitle={workspaceTitle} navigationOpen={navigationOpen} showNavigation={workspace !== "participant"} accountOpen={accountOpen} accountToggleRef={accountToggleRef}
    accountMenuRef={accountMenuRef} onToggleNavigation={() => { closeAccountContext(); setNavigationOpen((open) => !open); }}
    onToggleAccount={toggleAccountContext} onSignOut={async () => { closeAccountContext(); await signOut(); }} />}>
    <main id="main-content" className="product-shell" data-workspace={workspace} tabIndex={-1} aria-labelledby={context === null ? undefined : "product-title"}>
      {!unauthenticated && connection === "offline" ? <section className="card shell-state teludens-state" data-state="offline">
        <p className="eyebrow">Offline</p><h2>Account context is unavailable</h2><p>No protected workspace data is shown while Plenum is disconnected.</p>
        <button className="btn-secondary" type="button" onClick={() => void load()}>Retry connection</button>
      </section> : null}
      {!unauthenticated && connection === "error" ? <section className="card shell-state teludens-state" data-state="error">
        <p className="eyebrow">Unable to open Plenum</p><h2>Account context did not load</h2><p>Retry safely. No Project or Session was changed.</p>
        <button className="btn-secondary" type="button" onClick={() => void load()}>Retry</button>
      </section> : null}
      {context === null ? null : <div className={`shell-grid${workspace === "participant" ? " participant-shell-grid" : ""}`} data-density="standard">
        {workspace === "participant" ? null : <nav id="workspace-navigation" className={`shell-navigation teludens-node${navigationOpen ? " is-open" : ""}`} aria-labelledby="navigation-title">
          <p className="eyebrow">Lifecycle</p><h2 id="navigation-title">Workspaces</h2>
          <ul>
            {canUseProjects ? <li><a aria-current={workspace === "projects" ? "page" : undefined} href="/?workspace=projects">Projects<span>Govern designs and reusable templates</span></a></li> : null}
            {canUseLifecycle ? <li><a aria-current={workspace === "lifecycle" ? "page" : undefined} href="/?workspace=lifecycle">Releases and Sessions<span>Publish, configure, and monitor delivery</span></a></li> : null}
            <li><a href="/?workspace=participant">Your Sessions<span>Enter an invited or assigned Session</span></a></li>
            {canUseProjects ? <li><a href="/studio/">Project editor<span>Open the focused authoring workspace</span></a></li> : null}
            {context.organization.roles.some((role) => role === "admin" || role === "publisher") ? <li><a aria-current={administration ? "page" : undefined} href="/admin/plugins">Administration<span>Roles, Plugins, policy, and deployment posture</span></a></li> : null}
            {canUsePlatform ? <li><a aria-current={platform ? "page" : undefined} href="/platform/organizations">Platform control plane<span>Provision and govern Organization access</span></a></li> : null}
            {context.organization.roles.includes("research_analyst") ? <li><a aria-current={researchReporting ? "page" : undefined} href="/research/reports">Research reports<span>Consent-filtered evidence and provenance</span></a></li> : null}
          </ul>
        </nav>}
        <div className={`product-workspaces${workspace === "participant" ? " participant-product-workspaces" : ""}`} aria-labelledby="product-title">
          {platform ? canUsePlatform ? platformAdministrators ? <PlatformAdministratorsPortal /> : <PlatformOrganizationsPortal /> : <section className="card portal-state teludens-state" data-state="unauthorized">
            <h2>Platform authority unavailable</h2><p>Active Plenum Platform Administrator authority is required. Organization administration does not grant this access.</p></section> :
            administration ? <AdministrationPortal organizationId={context.organization.id} roles={context.organization.roles} /> : researchReporting ?
            context.organization.roles.includes("research_analyst") ? <ResearchReportingPortal /> :
              <section className="card portal-state teludens-state" data-state="unauthorized"><p className="eyebrow">Least privilege</p>
                <h2>Research reporting access unavailable</h2><p>An active Research Analyst Organization Role and project-scoped Research Access Grant are required. Protected research data was not loaded.</p></section> :
            workspace === "projects" ? <ProjectPortal /> : workspace === "lifecycle" ?
              <LifecyclePortal isAdmin={context.organization.roles.includes("admin")} /> : <ParticipantPortal displayName={context.principal.displayName} />}
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
          <span className="badge badge-state">{entry.status.replaceAll("_", " ")}</span>
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

type FieldEditorProps = {
  form: RuntimeFormV1;
  initial?: JsonObject;
  disabled: boolean;
  onSubmit(payload: JsonObject): void;
  submitLabel: string;
};

function FieldEditor(props: FieldEditorProps) {
  return props.form.sections.some((section) => section.repeatable === true)
    ? <RepeatableFieldEditor {...props} />
    : <FlatFieldEditor {...props} />;
}

function FlatFieldEditor({ form, initial, disabled, onSubmit, submitLabel }: FieldEditorProps) {
  const idPrefix = useId().replaceAll(":", "");
  const [values, setValues] = useState<Record<string, string | string[] | number>>(() => Object.fromEntries(
    form.fields.map((field) => {
      const value = runtimeFormValue(initial ?? {}, field.key);
      const supported = typeof value === "string" || typeof value === "number" ||
        (Array.isArray(value) && value.every((item) => typeof item === "string"));
      return [field.key, supported ? value : field.type === "multi_select" || field.type === "artifact_reference" ? [] : ""];
    })
  ));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const payload = (): JsonObject => {
    const result: JsonObject = {};
    for (const field of form.fields) {
      const value = values[field.key];
      setRuntimeFormValue(result, field.key, field.type === "number" && value !== "" ? Number(value) : value);
    }
    return result;
  };
  const canonicalForm = (): RuntimeFormDefinitionV1 => ({
    ...form,
    sections: form.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({
      ...field, id: `${form.id}-${field.key}`, type: field.type === "text" ? "short_text" : field.type
    })) }))
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = payload();
    const nextErrors = Object.fromEntries(validateRuntimeFormPayload(canonicalForm(), content).map((issue) => [issue.field, issue.message]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(content);
  };
  return <form onSubmit={submit} noValidate>
    {form.sections.map((section) => <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.fields.filter((field) => runtimeFieldConditionMatches(field.visibleWhen, payload())).map((field) => {
      const id = `${idPrefix}-${form.id}-${field.key}`;
      const error = errors[field.key];
      const required = field.required || (field.requiredWhen !== undefined && runtimeFieldConditionMatches(field.requiredWhen, payload()));
      const describedBy = [field.helpText === undefined ? null : `${id}-help`, error === undefined ? null : `${id}-error`]
        .filter(Boolean).join(" ") || undefined;
      return <div className="field" key={field.key}>
        <label htmlFor={id}>{field.label}{required ? <span aria-hidden="true"> *</span> : null}</label>
        {field.type === "long_text"
          ? <textarea id={id} name={field.key} rows={4} value={typeof values[field.key] === "string" ? values[field.key] : ""} disabled={disabled || field.readOnly === true}
              required={required} aria-invalid={error !== undefined} aria-describedby={describedBy}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
          : field.type === "single_select"
            ? <select id={id} name={field.key} value={typeof values[field.key] === "string" ? values[field.key] : ""} disabled={disabled || field.readOnly === true}
                required={required} aria-invalid={error !== undefined} aria-describedby={describedBy}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}>
                <option value="">Select an option</option>
                {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            : field.type === "multi_select" || field.type === "artifact_reference"
              ? <select id={id} name={field.key} multiple value={Array.isArray(values[field.key]) ? values[field.key] : []}
                  disabled={disabled || field.readOnly === true} required={required} aria-invalid={error !== undefined} aria-describedby={describedBy}
                  onChange={(event) => setValues({ ...values, [field.key]: [...event.target.selectedOptions].map((option) => option.value) })}>
                  {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              : <input id={id} name={field.key} type={field.type === "number" ? "number" : "text"}
              value={typeof values[field.key] === "string" || typeof values[field.key] === "number" ? values[field.key] : ""} disabled={disabled || field.readOnly === true}
              required={required} min={field.validation?.min} max={field.validation?.max} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength}
              aria-invalid={error !== undefined} aria-describedby={describedBy}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />}
        {field.helpText === undefined ? null : <p id={`${id}-help`} className="hint">{field.helpText}</p>}
        {error === undefined ? null : <p id={`${id}-error`} className="field-error" role="alert">Error: {error}</p>}
      </div>;
    })}</fieldset>)}
    <button className="btn-primary" type="submit" disabled={disabled}>{submitLabel}</button>
  </form>;
}

function RepeatableFieldEditor({ form, initial, disabled, onSubmit, submitLabel }: FieldEditorProps) {
  const idPrefix = useId().replaceAll(":", "");
  const blankItem = (section: RuntimeFormV1["sections"][number]): JsonObject => Object.fromEntries(
    section.fields.map((field) => [field.key, field.type === "multi_select" || field.type === "artifact_reference" ? [] : ""])
  ) as JsonObject;
  const [values, setValues] = useState<JsonObject>(() => {
    const result = structuredClone(initial ?? {}) as JsonObject;
    for (const section of form.sections) {
      if (section.repeatable === true) {
        if (!Array.isArray(result[section.id])) result[section.id] = Array.from({ length: section.minItems ?? 0 }, () => blankItem(section));
      } else {
        for (const field of section.fields) {
          if (runtimeFormValue(result, field.key) === undefined) setRuntimeFormValue(result, field.key, field.type === "multi_select" || field.type === "artifact_reference" ? [] : "");
        }
      }
    }
    return result;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setValue = (path: string, value: unknown) => {
    const next = structuredClone(values) as JsonObject;
    setRuntimeFormValue(next, path, value);
    setValues(next);
  };
  const content = (): JsonObject => {
    const result = structuredClone(values) as JsonObject;
    for (const section of form.sections) {
      const entries = section.repeatable === true && Array.isArray(result[section.id])
        ? result[section.id] as JsonObject[] : [result];
      entries.forEach((entry) => section.fields.filter((field) => field.type === "number").forEach((field) => {
        const value = runtimeFormValue(entry, field.key);
        if (value !== "") setRuntimeFormValue(entry, field.key, Number(value));
      }));
    }
    return result;
  };
  const canonicalForm = (): RuntimeFormDefinitionV1 => ({
    ...form,
    sections: form.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({
      ...field, id: `${form.id}-${section.id}-${field.key}`, type: field.type === "text" ? "short_text" : field.type
    })) }))
  });
  const renderField = (field: RuntimeFormV1["fields"][number], context: JsonObject, path: string, id: string) => {
    if (!runtimeFieldConditionMatches(field.visibleWhen, context)) return null;
    const value = runtimeFormValue(values, path);
    const error = errors[path];
    const required = field.required || (field.requiredWhen !== undefined && runtimeFieldConditionMatches(field.requiredWhen, context));
    const describedBy = [field.helpText === undefined ? null : `${id}-help`, error === undefined ? null : `${id}-error`].filter(Boolean).join(" ") || undefined;
    const common = { disabled: disabled || field.readOnly === true, required, "aria-invalid": error !== undefined, "aria-describedby": describedBy };
    return <div className="field" key={path}>
      <label htmlFor={id}>{field.label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      {field.type === "long_text" ? <textarea {...common} id={id} name={path} rows={4} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(path, event.target.value)} />
        : field.type === "single_select" ? <select {...common} id={id} name={path} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(path, event.target.value)}>
            <option value="">Select an option</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        : field.type === "multi_select" || field.type === "artifact_reference" ? <select {...common} id={id} name={path} multiple value={Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []}
            onChange={(event) => setValue(path, [...event.target.selectedOptions].map((option) => option.value))}>
            {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        : <input {...common} id={id} name={path} type={field.type === "number" ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""}
            min={field.validation?.min} max={field.validation?.max} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength}
            onChange={(event) => setValue(path, event.target.value)} />}
      {field.helpText === undefined ? null : <p id={`${id}-help`} className="hint">{field.helpText}</p>}
      {error === undefined ? null : <p id={`${id}-error`} className="field-error" role="alert">Error: {error}</p>}
    </div>;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = content();
    const nextErrors = Object.fromEntries(validateRuntimeFormPayload(canonicalForm(), payload).map((issue) => [issue.field, issue.message]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(payload);
  };
  return <form onSubmit={submit} noValidate>
    {form.sections.map((section) => section.repeatable === true ? <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.description === undefined ? null : <p className="hint">{section.description}</p>}
      {(Array.isArray(values[section.id]) ? values[section.id] as JsonObject[] : []).map((entry, index) => <fieldset className="repeatable-item" key={index}>
        <legend>{section.itemLabel ?? "Item"} {index + 1}</legend>
        {section.fields.map((field) => renderField(field, entry, `${section.id}.${index}.${field.key}`, `${idPrefix}-${form.id}-${section.id}-${index}-${field.key.replaceAll(".", "-")}`))}
        <button className="btn-secondary" type="button" disabled={disabled || (values[section.id] as JsonObject[]).length <= (section.minItems ?? 0)} onClick={() => {
          const entries = [...(values[section.id] as JsonObject[])]; entries.splice(index, 1); setValues({ ...values, [section.id]: entries });
        }}>Remove {section.itemLabel ?? "item"}</button>
      </fieldset>)}
      <button className="btn-secondary" type="button" disabled={disabled || (section.maxItems !== undefined && (values[section.id] as JsonObject[]).length >= section.maxItems)} onClick={() => {
        setValues({ ...values, [section.id]: [...(values[section.id] as JsonObject[]), blankItem(section)] });
      }}>Add {section.itemLabel ?? "item"}</button>
      {errors[section.id] === undefined ? null : <p className="field-error" role="alert">Error: {errors[section.id]}</p>}
    </fieldset> : <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.description === undefined ? null : <p className="hint">{section.description}</p>}
      {section.fields.map((field) => renderField(field, values, field.key, `${idPrefix}-${form.id}-${field.key.replaceAll(".", "-")}`))}
    </fieldset>)}
    <button className="btn-primary" type="submit" disabled={disabled}>{submitLabel}</button>
  </form>;
}

function CreateTask({ task, disabled, send }: {
  task: RuntimeCreateTaskV1; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string): void;
}) {
  return <section className="card" aria-labelledby={`create-${task.artifactTypeKey}`}>
    <h2 id={`create-${task.artifactTypeKey}`}>{task.title}</h2>
    <FieldEditor form={task.form} disabled={disabled} submitLabel="Save draft"
      onSubmit={(content) => send(task.action, null, content, task.artifactTypeKey)} />
  </section>;
}

function DisplayFields({ fields, payload }: { fields: RuntimeFormV1["fields"]; payload: JsonObject }) {
  return <dl className="artifact-content">{fields.map((field) => {
    const value = runtimeFormValue(payload, field.key);
    const display = Array.isArray(value) ? value.join(", ") : String(value ?? "Not provided");
    return <div key={field.key}><dt>{field.label}</dt><dd>{display || "Not provided"}</dd></div>;
  })}</dl>;
}

function ArtifactContent({ form, payload }: { form: RuntimeFormV1; payload: JsonObject }) {
  return <div className="artifact-sections">{form.sections.map((section) => {
    if (section.repeatable !== true) return <DisplayFields key={section.id} fields={section.fields} payload={payload} />;
    const entries = Array.isArray(payload[section.id]) ? payload[section.id] as JsonObject[] : [];
    return <section key={section.id} aria-labelledby={`${form.id}-${section.id}-content`}>
      {section.title === undefined ? null : <h4 id={`${form.id}-${section.id}-content`}>{section.title}</h4>}
      {entries.length === 0 ? <p>Not provided</p> : entries.map((entry, index) => <section className="repeatable-item" key={index}>
        <h5>{section.itemLabel ?? "Item"} {index + 1}</h5>
        <DisplayFields fields={section.fields} payload={entry} />
      </section>)}
    </section>;
  })}</div>;
}

function ArtifactCard({ artifact, disabled, send }: {
  artifact: RuntimeArtifactV1; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1, content?: JsonObject): void;
}) {
  const edit = artifact.actions.find((action) => action.requiresForm);
  const actions = artifact.actions.filter((action) => !action.requiresForm);
  const { rules: _rules, ...formWithoutRules } = artifact.form;
  const editForm = edit?.editableFieldKeys === undefined ? artifact.form : {
    ...formWithoutRules,
    fields: artifact.form.fields.filter((field) => edit.editableFieldKeys?.includes(field.key)),
    sections: artifact.form.sections.map((section) => ({
      ...section, fields: section.fields.filter((field) => edit.editableFieldKeys?.includes(field.key))
    })).filter((section) => section.fields.length > 0)
  };
  return <article className="card artifact" aria-labelledby={`artifact-${artifact.id}`}>
    <div className="card-heading">
      <div>
        <h3 id={`artifact-${artifact.id}`}>{artifact.title}</h3>
      </div>
      <span className="badge badge-state">{artifact.stateLabel}</span>
    </div>
    <dl className="metadata"><div><dt>Version</dt><dd>{artifact.version}</dd></div><div><dt>Form</dt><dd>{artifact.form.formVersion}</dd></div></dl>
    {edit === undefined ? <ArtifactContent form={artifact.form} payload={artifact.payload} />
      : <FieldEditor form={editForm} initial={artifact.payload} disabled={disabled} submitLabel={edit.label}
          onSubmit={(content) => send(edit, artifact, content)} />}
    {actions.length === 0 ? null : <div className="actions" aria-label={`${artifact.title} workflow actions`}>
      {actions.map((action, index) => <button key={action.operationType}
        className={index === 0 ? "btn-primary" : "btn-secondary"} type="button" disabled={disabled}
        onClick={() => send(action, artifact)}>{action.label}</button>)}
    </div>}
  </article>;
}

type SendInformation = (operationType: string, aggregateId: string, expectedVersion: number, payload: JsonObject) => void;

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
    <div className="card-grid">{proposals.map((proposal) => {
      const reason = reasons[proposal.id] ?? "";
      return <article className="card effect-proposal" key={proposal.id} aria-labelledby={`effect-${proposal.id}`}>
        <div className="card-heading"><h3 id={`effect-${proposal.id}`}>{proposal.targetStateVariableId.replaceAll("_", " ")}</h3>
          <span className="badge badge-state">{proposal.status.replaceAll("_", " ")}</span></div>
        <dl className="metadata"><div><dt>Operation</dt><dd>{proposal.operation}</dd></div><div><dt>Proposed value</dt><dd><code>{JSON.stringify(proposal.value)}</code></dd></div></dl>
        <p>{proposal.rationale}</p>
        <details><summary>Provenance</summary><dl className="proposal-provenance">
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
  const channelIds = Array.isArray(module.configuration.channelIds)
    ? module.configuration.channelIds.filter((id): id is string => typeof id === "string") : [];
  const routeId = typeof module.configuration.sendRouteId === "string" ? module.configuration.sendRouteId : null;
  const messages = projection.messages.filter((message) => channelIds.includes(message.channelId));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (routeId === null || value.length === 0) return;
    send("message.send", crypto.randomUUID(), 0, { routeId, content: { text: value } });
    setText("");
  };
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><h2 id={`${module.id}-heading`}>{module.title}</h2></div>
    {module.mode !== "write" || routeId === null ? null : <form className="card" onSubmit={submit}>
      <div className="field"><label htmlFor={`${module.id}-text`}>Message</label>
        <textarea id={`${module.id}-text`} rows={3} required value={text} disabled={disabled}
          onChange={(event) => setText(event.target.value)} /></div>
      <button className="btn-primary" type="submit" disabled={disabled || text.trim().length === 0}>Send Message</button>
    </form>}
    {messages.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <ol className="event-list">
      {messages.map((message) => <li key={message.id}><span>{messageSummary(message)}</span>
        <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString()}</time></li>)}
    </ol>}
  </section>;
}

function InjectCard({ inject, disabled, send }: { inject: RuntimeInjectV1; disabled: boolean; send: SendInformation }) {
  const [artifactId, setArtifactId] = useState("");
  const body = typeof inject.content.body === "string" ? inject.content.body : "No details were provided.";
  return <article className="card" aria-labelledby={`inject-${inject.id}`}>
    <div className="card-heading"><h3 id={`inject-${inject.id}`}>{inject.title}</h3><span className="badge badge-state">{inject.state}</span></div>
    <p>{body}</p>
    {inject.acknowledgedAt === null ? <button className="btn-primary" type="button" disabled={disabled}
      onClick={() => send("inject.acknowledge", inject.id, inject.version, {})}>Acknowledge</button> : null}
    {inject.requiredResponseArtifactTypeId === null || inject.acknowledgedAt === null || inject.respondedAt !== null ? null : <form onSubmit={(event) => {
      event.preventDefault();
      if (artifactId.trim().length > 0) send("inject.respond", inject.id, inject.version, { artifactId: artifactId.trim() });
    }}>
      <div className="field"><label htmlFor={`inject-${inject.id}-artifact`}>Response Artifact ID</label>
        <input id={`inject-${inject.id}-artifact`} required value={artifactId} disabled={disabled}
          onChange={(event) => setArtifactId(event.target.value)} /></div>
      <button className="btn-primary" type="submit" disabled={disabled || artifactId.trim().length === 0}>Submit response</button>
    </form>}
  </article>;
}

function InjectInbox({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><h2 id={`${module.id}-heading`}>{module.title}</h2></div>
    {projection.injects.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <div className="card-grid">
      {projection.injects.map((inject) => <InjectCard key={inject.id} inject={inject} disabled={disabled} send={send} />)}
    </div>}
  </section>;
}

function ProposalThreadCard({ messages, projection, disabled, send }: {
  messages: RuntimeMessageV1[]; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
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
      <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString()}</time>
    </li>)}</ol>
    {side === null || latest.threadState === "closed" ? null : <>
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
    <div className="section-heading"><h2 id={`${module.id}-heading`}>{module.title}</h2></div>
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
      {threads.map((thread) => <ProposalThreadCard key={thread[0]?.threadId} messages={thread} projection={projection} disabled={disabled} send={send} />)}
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
    <div className="card-heading"><h3 id={`poll-${poll.id}`}>{poll.question}</h3><span className="badge badge-state">{poll.status}</span></div>
    {poll.deadlineAt === null ? null : <p className="hint">Ballots close <time dateTime={poll.deadlineAt}>{new Date(poll.deadlineAt).toLocaleString()}</time>.</p>}
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
    {poll.hasVoted && poll.receipt !== null ? <p className="status-success" role="status">Ballot accepted at <time dateTime={poll.receipt.acceptedAt}>{new Date(poll.receipt.acceptedAt).toLocaleString()}</time>. Receipt revision {poll.receipt.ballotRevision}.</p> : null}
    {!poll.eligible && poll.status === "open" ? <p className="hint">Your active Seat Assignment is not in this Electorate.</p> : null}
    {result === null ? null : <section aria-labelledby={`poll-${poll.id}-result`}><h4 id={`poll-${poll.id}-result`}>{poll.certification === null ? "Unofficial tally" : "Certified result"}</h4>
      <dl className="poll-results">{poll.options.map((option) => <div key={option.id}><dt>{option.label}</dt><dd>{result.counts[option.id] ?? 0}</dd></div>)}</dl>
      <p>{result.quorumMet ? "Quorum met" : "Quorum not met"} · {result.passed ? "Passed" : "Not passed"}</p>
      {poll.certification === null ? null : <p className="hint">Certified {new Date(poll.certification.certifiedAt).toLocaleString()} · result <code>{poll.certification.resultSha256.slice(0, 12)}</code></p>}
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [activeNavigationItemId, setActiveNavigationItemId] = useState<string | null>(null);
  const main = useRef<HTMLElement>(null);
  const loadVersion = useRef(0);
  const pending = outbox?.entries.some(({ status }) => status === "local_pending" || status === "received") === true;
  const submitting = connection === "online" && pending;

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection((current) => current === "online" ? current : "loading");
    setError(null);
    try {
      const registered = deviceId === null ? await api<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" }) : { deviceId };
      if (version !== loadVersion.current) return;
      setDeviceId(registered.deviceId);
      localStorage.setItem(DEVICE_STORAGE_KEY, registered.deviceId);
      const headers = { "x-device-id": registered.deviceId };
      const roleQuery = requestedRole === null ? "" : `?activeSessionRoleId=${encodeURIComponent(requestedRole)}`;
      const [nextBootstrap, initialProjection, proposalResponse, adjudicationResponse] = await Promise.all([
        api<SyncBootstrapV1>(`/v1/sessions/${id}/sync/bootstrap${roleQuery}`, { headers }),
        api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection${roleQuery}`, { headers }),
        api<{ proposals: EffectProposalV1[] }>(`/v1/sessions/${id}/effect-proposals`, { headers }),
        api<{ adjudications: AdjudicationRequestV1[] }>(`/v1/sessions/${id}/adjudications`, { headers })
      ]);
      if (version !== loadVersion.current) return;
      const previous = await offlineStore.load(id, registered.deviceId);
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
        if (outcomes.length > 0) setNotice(`Reconnect complete: ${outcomes}.`);
      }
      await offlineStore.save({
        bootstrap: nextBootstrap,
        projection: minimizeOfflineProjection(nextProjection),
        outbox: nextOutbox
      });
      if (version !== loadVersion.current) return;
      setBootstrap(nextBootstrap);
      setOutbox(nextOutbox);
      setProjection(nextProjection);
      setEffectProposals(proposalResponse.proposals);
      setAdjudications(adjudicationResponse.adjudications);
      setConnection("online");
    } catch (cause) {
      if (version !== loadVersion.current) return;
      if (cause instanceof ApiError && clearsOfflineData(cause) && deviceId !== null) {
        await offlineStore.clear(id, deviceId);
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
          setConnection("error");
          setError(storageError instanceof Error ? storageError.message : "Protected offline data could not be read.");
          return;
        }
        if (cached !== null && Date.parse(cached.bootstrap.credentialExpiresAt) <= Date.now()) {
          await offlineStore.save({ ...cached, projection: null });
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
          setConnection("offline");
          setNotice("Using the protected offline view. Local pending work is not submitted.");
          return;
        }
        if (cached !== null) setOutbox(cached.outbox);
      }
      setConnection(navigator.onLine ? "error" : "offline");
      setError(cause instanceof Error ? cause.message : "The Runtime could not be loaded.");
    }
  }, [deviceId, id, requestedRole]);

  useEffect(() => { void load(); }, []); // Initial load owns device registration.
  useEffect(() => {
    if (projection === null) return;
    setActiveNavigationItemId(projection.navigation.defaultItemId ?? projection.navigation.items[0]?.id ?? null);
  }, [projection?.interfaceProfileId, projection?.navigation.defaultItemId]);
  useEffect(() => {
    const offline = () => setConnection("offline");
    const online = () => { setNotice("Connection restored. Refreshing authoritative state."); void load(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [load]);

  const post = async (command: CommandEnvelopeV1): Promise<CommandReceiptV1 | null> => {
    if (id === null || bootstrap === null || outbox === null || projection === null) return null;
    const queueable = canQueueOffline(command, bootstrap);
    if (!queueable && !navigator.onLine) {
      setConnection("offline");
      setNotice("This operation requires the live Session Authority and was not queued.");
      return null;
    }
    let storedOutbox = outbox;
    if (queueable) {
      storedOutbox = enqueueOfflineCommand(outbox, command, new Date().toISOString());
      try {
        await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: storedOutbox });
      } catch (cause) {
        setNotice(cause instanceof Error
          ? `The Command was not queued because protected device storage failed: ${cause.message}`
          : "The Command was not queued because protected device storage failed.");
        return null;
      }
      setOutbox(storedOutbox);
      setNotice("Saved on this device as local pending. It has not been submitted.");
      if (!navigator.onLine) { setConnection("offline"); return null; }
    } else setNotice("Submitting a live-only operation. It will not enter the Offline Outbox.");
    try {
      const response = await fetch(`/v1/sessions/${id}/commands`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command)
      });
      const body: unknown = await response.json();
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
        setOutbox(resolved);
      }
      if (body.status === "accepted") setNotice(body.replayed ? "The original server receipt was recovered." : "The server accepted the Command.");
      else setNotice(body.status === "needs_reconciliation"
        ? `Authoritative state changed: ${body.message ?? body.errorCode}. Your local draft was kept.`
        : `Command refused: ${body.message ?? body.errorCode}. Your local draft was kept.`);
      await load();
      requestAnimationFrame(() => main.current?.focus());
      return body;
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (clearsOfflineData(cause)) {
          await offlineStore.clear(id, bootstrap.deviceId);
          setBootstrap(null);
          setOutbox(null);
          setProjection(null);
        }
        setConnection("error");
        setNotice(`Command failed: ${cause.message}`);
        return null;
      }
      setConnection(navigator.onLine ? "error" : "offline");
      setNotice(queueable ? "Delivery acknowledgement was lost. This Command is still local pending, not accepted."
        : "The live-only operation failed without acknowledgement and was not queued.");
      return null;
    }
  };

  const send = (action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string) => {
    if (projection === null || deviceId === null) return;
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
    void post(command);
  };

  const sendInformation: SendInformation = (operationType, aggregateId, expectedAggregateVersion, payload) => {
    if (projection === null || deviceId === null) return;
    const publication = operationType === "adjudication.publish";
    if (publication && !navigator.onLine) {
      setConnection("offline");
      setNotice("Adjudication publication requires the live Session Authority and was not queued.");
      return;
    }
    void post({
      commandId: crypto.randomUUID(), deviceId, operationType, aggregateId, expectedAggregateVersion,
      governingReleaseId: projection.releaseId, activeSessionRoleId: projection.activeSessionRoleId,
      deviceObservedAt: new Date().toISOString(), payload
    });
  };

  const sendPoll: SendPoll = (operationType, poll, payload) => {
    if (projection === null || deviceId === null) return;
    if (operationType.startsWith("poll.") && !navigator.onLine) {
      setConnection("offline");
      setNotice("Poll management requires the live Session Authority and was not queued.");
      return;
    }
    void post({ commandId: crypto.randomUUID(), deviceId, operationType, aggregateId: poll.id,
      expectedAggregateVersion: poll.version, governingReleaseId: poll.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(), payload });
  };

  const sendVoice = async (channel: RuntimeVoiceChannelV1, operationType: string,
    payload: JsonObject = {}): Promise<CommandReceiptV1 | null> => {
    if (projection === null || deviceId === null || !navigator.onLine) {
      setConnection("offline"); setNotice("Voice needs the live Session Authority and was not queued."); return null;
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
    if (!navigator.onLine) { setConnection("offline"); setNotice("Approval Decisions require a live Session Authority and were not queued."); return; }
    setNotice("Submitting the Approval Decision to the Session Authority.");
    try {
      const response = await fetch(`/v1/sessions/${id}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        commandId: crypto.randomUUID(), deviceId, operationType: `effect_proposal.${decision}`, aggregateId: proposal.id,
        expectedAggregateVersion: proposal.version, governingReleaseId: proposal.governingReleaseId,
        activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(),
        payload: { proposalHash: proposal.proposalHash, reason }
      } satisfies CommandEnvelopeV1) });
      const receipt: unknown = await response.json();
      if (!isCommandReceipt(receipt)) throw new Error(`Approval Decision returned an invalid response with status ${response.status}`);
      setNotice(receipt.status === "accepted" ? "The server accepted the Command." : receipt.message ?? "The Approval Decision was not accepted.");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? `Approval Decision was not queued: ${cause.message}` : "Approval Decision was not queued.");
      await load();
    }
  };

  const retryPending = async () => {
    setNotice("Checking original receipts before ordered reconnect.");
    await load();
  };

  const saveOfflineDraft = async (commandId: string, payload: JsonObject) => {
    if (bootstrap === null || projection === null || outbox === null) return;
    const updated = updateOfflineDraft(outbox, commandId, payload);
    await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: updated });
    setOutbox(updated);
    setNotice("The revised draft is saved on this device. It has not been submitted.");
  };

  if (projection === null) {
    return <StatePage connection={connection} title={connection === "loading" ? "Loading Runtime" : connection === "offline" ? "Runtime offline" : "Runtime unavailable"}
      message={connection === "loading" ? "Resolving your authorized Session view." : error ?? "Reconnect and try again."}
      {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  }
  const roleContextLabel = projection.activeTeamLabel === null ? projection.activeSessionRoleLabel
    : `${projection.activeTeamLabel} · ${projection.activeSessionRoleLabel}`;
  const workspaceTitle = projection.sessionTitle ?? projection.simulationTitle ?? "Session workspace";
  const remainingTime = projection.stageRemainingSeconds === null ? null
    : `${String(Math.floor(projection.stageRemainingSeconds / 60)).padStart(2, "0")}:${String(projection.stageRemainingSeconds % 60).padStart(2, "0")}`;
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
  const renderRuntimeModule = (module: RuntimeModuleV1): ReactNode => {
    if (module.type === "artifact_form") return <section id={`runtime-module-${module.id}`} aria-labelledby={`runtime-module-${module.id}-title`}>
      <div className="section-heading"><h2 id={`runtime-module-${module.id}-title`}>{module.title}</h2></div>
      {projection.createTasks.length === 0 ? <p className="empty-state">{module.emptyStateText}</p>
        : <div className="card-grid">{projection.createTasks.map((task) => <CreateTask key={task.artifactTypeKey} task={task}
            disabled={submitting} send={send} />)}</div>}
    </section>;
    if (module.type === "task_list") return <section id={`runtime-module-${module.id}`} aria-labelledby={`runtime-module-${module.id}-title`}>
      <div className="section-heading"><h2 id={`runtime-module-${module.id}-title`}>{module.title}</h2></div>
      {projection.artifacts.length === 0 ? <p className="empty-state">{module.emptyStateText}</p>
        : <div className="card-grid">{projection.artifacts.map((artifact) => <ArtifactCard key={artifact.id}
            artifact={artifact} disabled={submitting} send={send} />)}</div>}
    </section>;
    if (module.type === "message_inbox") return <div id={`runtime-module-${module.id}`}><MessageInbox module={module} projection={projection}
      disabled={submitting} send={sendInformation} /></div>;
    if (module.type === "proposal_thread") return <div id={`runtime-module-${module.id}`}><ProposalThreads module={module} projection={projection}
      disabled={submitting} send={sendInformation} /></div>;
    if (module.type === "inject_inbox") return <div id={`runtime-module-${module.id}`}><InjectInbox module={module} projection={projection}
      disabled={submitting} send={sendInformation} /></div>;
    if (module.type === "session_status") return <section className="card curated-runtime-module" id={`runtime-module-${module.id}`}
      aria-labelledby={`runtime-module-${module.id}-title`}>
      <h2 id={`runtime-module-${module.id}-title`}>{module.title}</h2>
      <dl className="runtime-status-list">
        <div><dt>Session</dt><dd>{friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
        <div><dt>Stage</dt><dd>{projection.currentStageLabel ?? "Not started"} ({friendlyReference(projection.currentStageStatus, "Not started")})</dd></div>
        <div><dt>Role</dt><dd>{projection.activeSessionRoleLabel}</dd></div>
      </dl>
    </section>;
    if (module.type === "artifact_presentation") return <section className="card curated-runtime-module runtime-presentation-module"
      id={`runtime-module-${module.id}`} aria-labelledby={`runtime-module-${module.id}-title`}>
      <h2 id={`runtime-module-${module.id}-title`}>{module.title}</h2>
      {projection.artifacts.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <ul className="presentation-artifact-list">
        {projection.artifacts.map((artifact) => <li key={artifact.id}><strong>{artifact.title}</strong><span>{artifact.stateLabel}</span></li>)}
      </ul>}
    </section>;
    if (module.type === "resource_library") {
      const configuredIds = Array.isArray(module.configuration.resourceIds)
        ? module.configuration.resourceIds.filter((resourceId): resourceId is string => typeof resourceId === "string") : [];
      const resources = projection.resources.filter((resource) => configuredIds.includes(resource.id));
      return <section className="card curated-runtime-module runtime-resource-library" id={`runtime-module-${module.id}`}
        aria-labelledby={`runtime-module-${module.id}-title`}>
        <h2 id={`runtime-module-${module.id}-title`}>{module.title}</h2>
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
    return <section className="card curated-runtime-module runtime-deck-module" id={`runtime-module-${module.id}`}
      aria-labelledby={`runtime-module-${module.id}-title`}>
      <h2 id={`runtime-module-${module.id}-title`}>{module.title}</h2>
      {resourceUrl === null ? <p className="empty-state">{module.emptyStateText}</p> : <iframe
        className="runtime-deck-frame" src={resourceUrl} title={module.title} loading="lazy" sandbox="allow-scripts" allowFullScreen />}
    </section>;
  };
  return <Shell connection={connection}
    brandContent={<a className="runtime-product-brand" href="/" title="Leave Session">
      <strong>{projection.simulationTitle ?? projection.releaseLabel}</strong><span>{projection.releaseLabel}</span>
    </a>}
    headerContent={<div className="header-actions runtime-header-actions">
      <div className="runtime-stage-summary"><span>{projection.currentStageLabel ?? "Session workspace"}</span>
        <strong>{remainingTime ?? friendlyReference(projection.currentStageStatus, "Not started")}</strong></div>
      <span className="runtime-connection"><ConnectionIndicator state={connection} /><span>{connectionLabel(connection)}</span></span>
      <ThemeToggle />
      <span className="runtime-role-badge">{roleContextLabel}</span>
    </div>}>
    <main id="main-content" className={`runtime-layout family-workspace participant-runtime-workspace layout-${projection.layout}`} ref={main} tabIndex={-1}>
      <div className="hero family-workspace-header">
        <p className="runtime-role-context">{roleContextLabel}</p>
        <h1 id="runtime-title">{workspaceTitle}</h1>
        <p>{projection.navigation.items[0]?.label ?? "Workspace"} · {projection.currentStageLabel ?? "Session workspace"} · Session {friendlyReference(projection.sessionStatus, "Unavailable")}</p>
      </div>
      <nav className="runtime-module-navigation family-workspace-navigation" aria-label="Runtime modules">
        <button className="runtime-navigation-toggle" type="button" aria-expanded={navigationOpen}
          aria-controls="runtime-navigation-content" onClick={() => setNavigationOpen((open) => !open)}>
          {navigationOpen ? "Close workspace navigation" : "Open workspace navigation"}
        </button>
        <div id="runtime-navigation-content" className={navigationOpen ? "runtime-navigation-content is-open" : "runtime-navigation-content"}>
          <h2>{projection.activeSessionRoleLabel}</h2><ul>
            {projection.navigation.items.map((item) => <li key={item.id}><a href={`#runtime-module-${item.moduleId}`}
              aria-current={item.id === activeNavigationItem?.id ? "page" : undefined} onClick={() => {
                setActiveNavigationItemId(item.id);
                setNavigationOpen(false);
              }}>{item.label}</a></li>)}
          </ul>
          <details className="runtime-context-disclosure"><summary>Session context</summary>
            <dl className="runtime-status-list">
              <div><dt>Session</dt><dd>{projection.sessionTitle ?? friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
              <div><dt>Status</dt><dd>{friendlyReference(projection.sessionStatus, "Unavailable")}</dd></div>
              <div><dt>Stage</dt><dd>{projection.currentStageLabel ?? "Not started"}</dd></div>
              <div><dt>Role</dt><dd>{projection.activeSessionRoleLabel}</dd></div>
              <div><dt>Connection</dt><dd>{connectionLabel(connection)}</dd></div>
            </dl>
          </details>
        </div>
      </nav>
      <div className="family-workspace-primary">
        <div className="runtime-context-actions">
          {projection.roleContexts.length > 1 ? <label>Active Role Context
            <select value={projection.activeSessionRoleId} disabled={pending || connection !== "online"} onChange={(event) => {
              const selected = projection.roleContexts.find((candidate) => candidate.sessionRoleId === event.target.value);
              if (selected !== undefined) navigateWithLoader(selected.runtimeUrl);
            }}>{projection.roleContexts.map((role) => <option value={role.sessionRoleId} key={`${role.seatLabel}:${role.sessionRoleId}`}>
              {role.teamLabel === null ? role.sessionRoleLabel : `${role.teamLabel} ${role.sessionRoleLabel}`}
            </option>)}</select>
          </label> : null}
          <a className="btn-secondary link-button" href="/">Exit Session</a>
        </div>
      <div className="live-region" aria-live="polite" aria-atomic="true">{notice}</div>
      {outbox === null ? null : <OfflineOutboxPanel outbox={outbox} retry={() => void retryPending()} saveDraft={saveOfflineDraft} />}
      <div className="runtime-regions">
        {visibleRegions.map((region) => <div className={`runtime-region runtime-region-${region.id}`} data-region-id={region.id} key={region.id}>
          {region.moduleIds.map((moduleId) => moduleById.get(moduleId)).filter((module): module is RuntimeModuleV1 => module !== undefined)
            .map((module) => <div className="runtime-region-module" key={module.id}>{renderRuntimeModule(module)}</div>)}
        </div>)}
      </div>
      {projection.polls.length === 0 ? null : <section aria-labelledby="polls-heading">
        <div className="section-heading"><h2 id="polls-heading">Polls</h2></div>
        <div className="card-grid">{projection.polls.map((poll) => <PollCard key={poll.id} poll={poll} disabled={submitting} send={sendPoll} />)}</div>
      </section>}
      {projection.voiceChannels.length === 0 || id === null || deviceId === null ? null : <VoiceControls projection={projection}
        online={connection === "online"} disabled={submitting} command={sendVoice} floor={sendFloor} notice={setNotice} />}
      <EffectProposalReview proposals={effectProposals} disabled={submitting} decide={(proposal, decision, reason) => void decideEffect(proposal, decision, reason)} />
      <AdjudicationReview adjudications={adjudications} disabled={submitting} send={sendInformation} />
      <button className="btn-secondary refresh" type="button" onClick={() => void load()}>Refresh authoritative state</button>
      </div>
    </main>
  </Shell>;
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
  if (projection === null) return <StatePage connection={connection} title={connection === "loading" ? "Loading operator view" : "Access denied"}
    message={connection === "loading" ? "Reading authoritative Session state." : error ?? "This view is unavailable."}
    {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  const states = Object.entries(projection.artifactsByState);
  const staffingRoleIds = readiness === null ? [] : [...new Set(readiness.staffing.seats.flatMap((seat) => seat.sessionRoleIds))];
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
    if (id === null || pending) return;
    setPending(true); setOperationNotice("Replaying authoritative Session evidence.");
    try {
      const result = await api<NonNullable<typeof replayResult>>(`/v1/sessions/${id}/replay`, { method: "POST", body: "{}" });
      setReplayResult(result);
      setOperationNotice(result.matched ? `Replay matched across ${result.comparedEvents} Evidence Events.` : `Replay completed with ${result.divergences.length} divergence${result.divergences.length === 1 ? "" : "s"}.`);
    } catch (cause) { setOperationNotice(cause instanceof Error ? cause.message : "Replay is unavailable."); }
    finally { setPending(false); }
  };
  return <Shell connection={connection}>
    <main id="main-content" className="runtime-layout family-workspace operator-workspace" tabIndex={-1}>
      <section className="hero family-workspace-header"><h1>Session control</h1><p><strong>{projection.sessionTitle}</strong> · {projection.releaseLabel} · Session {projection.sessionStatus}</p></section>
      <nav className="session-operation-navigation family-workspace-navigation" aria-label="Session operations">
        <a href={`/admin/sessions/${projection.sessionId}#staffing-title`}>Staffing</a>
        <a href={`/sessions/${projection.sessionId}/runtime`}>Runtime</a>
        <a href={`/admin/sessions/${projection.sessionId}/reports`}>Reports</a>
        <a href={`/admin/sessions/${projection.sessionId}/replay`}>Replay</a>
        <a href={`/admin/sessions/${projection.sessionId}/archive`}>Archive</a>
        <a href={`/sessions/${projection.sessionId}`}>Session detail</a>
      </nav>
      <aside className="family-workspace-inspector" aria-labelledby="operator-context-title">
        <h2 id="operator-context-title">Control context</h2>
        <dl className="runtime-status-list"><div><dt>Session</dt><dd>{projection.sessionStatus}</dd></div>
          <div><dt>Release</dt><dd>{projection.releaseLabel}</dd></div>
          <div><dt>Connection</dt><dd>{connection}</dd></div>
          <div><dt>Pending action</dt><dd>{pending ? "Submitting" : "None"}</dd></div></dl>
      </aside>
      <div className="family-workspace-primary">
      {operationView === null ? null : <p className="live-region" role="status" aria-live="polite">{operationNotice}</p>}
      {operationView === "reports" ? <section className="card operation-panel" aria-labelledby="reports-title">
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
            <span><strong>{item.eventType ?? "Evidence Event"}</strong>{item.recordedAt === undefined ? "" : ` · ${new Date(item.recordedAt).toLocaleString()}`}</span>
            <code>{item.sourceReferences?.join(", ") ?? "No source reference"}</code></li>)}</ol>
        </section>}
        <section aria-labelledby="report-history-title"><h3 id="report-history-title">Generated artifacts</h3>
          {reportArtifacts.length === 0 ? <p className="empty-state">No reports have been generated for this Session.</p> : <ul className="administration-list compact">
            {reportArtifacts.map((artifact) => <li key={artifact.artifactId}><span><strong>{artifact.filename}</strong> · {new Date(artifact.createdAt).toLocaleString()}</span>
              <details className="provenance-disclosure"><summary>Technical provenance</summary><code>{artifact.sha256}</code></details>
              {artifact.purgedAt === null ? <a className="btn-secondary link-button" href={`/v1/report-artifacts/${artifact.artifactId}`}>Download report</a> : <span>Purged under retention policy</span>}</li>)}</ul>}
        </section>
      </section> : null}
      {operationView === "replay" ? <section className="card operation-panel" aria-labelledby="replay-title">
        <h2 id="replay-title">Replay Session evidence</h2>
        <p>Replay compares authoritative Evidence against the configured deterministic adapter without changing Session state.</p>
        <button className="btn-primary" type="button" disabled={pending} onClick={() => void runReplay()}>Run replay</button>
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
      {operationView === "archive" ? <section className="card operation-panel" aria-labelledby="archive-title">
        <h2 id="archive-title">Archive Session</h2>
        <p>Archiving preserves immutable Release and Evidence history while removing this Session from active operations.</p>
        {retentionStatus === null ? <PlenumLoader label="Loading retention consequences" /> : <div className="retention-impact">
          {retentionStatus.organizationLegalHoldActive ? <p className="status-notice"><strong>Active legal hold:</strong> matching purge remains blocked after archive.</p> : null}
          <ul>{retentionStatus.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul>
          <h3>Applicable retention policies</h3>{retentionStatus.policies.length === 0 ? <p className="empty-state">No Organization or Session-specific retention policy is recorded.</p> :
            <ul className="administration-list compact">{retentionStatus.policies.map((policy) => <li key={policy.id}><strong>{policy.key} v{policy.version}</strong><span>{policy.periodDays} days · {policy.expiryAction}</span></li>)}</ul>}
        </div>}
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
          void send(`/v1/sessions/${projection.sessionId}/archive`, "session.archive", { reason: String(data.get("reason")) }, projection.sessionId, 0); }}>
          <div className="field"><label htmlFor="archive-reason">Archive reason</label><input id="archive-reason" name="reason" required minLength={3} maxLength={500} /></div>
          <label className="choice"><input name="confirmed" type="checkbox" required /> I understand this removes the Session from active operations.</label>
          <button className="btn-primary" type="submit" disabled={pending || projection.sessionStatus === "archived"}>{projection.sessionStatus === "archived" ? "Session archived" : "Confirm archive"}</button>
        </form>
      </section> : null}
      {operationView === null ? <>
      <section className="metric-grid" aria-label="Session summary">
        <div className="card metric"><span>Connected Participants</span><strong>{projection.connectedParticipantCount} / {projection.participantCount}</strong></div>
        <div className="card metric"><span>Occupied Seats</span><strong>{projection.occupiedSeatCount} / {projection.totalSeatCount}</strong></div>
        <div className="card metric"><span>Active tasks</span><strong>{projection.activeTasks.length}</strong></div>
      </section>
      {projection.warnings.length === 0 ? null : <section className="card operation-panel" aria-labelledby="warning-title">
        <h2 id="warning-title">Operational warnings</h2>
        <ul className="status-list">{projection.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>}
      <section className="card operation-panel" aria-labelledby="lifecycle-control-title">
        <h2 id="lifecycle-control-title">Session control</h2><p className="hint">Authoritative lifecycle version {projection.sessionVersion}</p>
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
      {projection.stage === null ? null : <section className="card operation-panel" aria-labelledby="stage-control-title">
        <h2 id="stage-control-title">{projection.stage.label}</h2><p className="hint">Server-authoritative timer · Stage version {projection.stage.version}</p>
        <p>Status: <strong>{projection.stage.status.replaceAll("_", " ")}</strong> · elapsed {projection.stage.elapsedSeconds}s
          {projection.stage.remainingSeconds === null ? " · untimed" : ` · ${projection.stage.remainingSeconds}s remaining`} · extension {projection.stage.extensionSeconds}s</p>
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const operation = String(data.get("operation"));
          const payload: JsonObject = { reason: String(data.get("reason")), confirmed: data.get("confirmed") === "on" };
          const target = String(data.get("targetStageId") ?? ""); if (target !== "") payload.targetStageId = target;
          const seconds = Number(data.get("seconds")); if (operation === "stage.extend") payload.seconds = seconds;
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
          <div className="field"><label htmlFor="stage-extension">Extension seconds</label><input id="stage-extension" name="seconds" type="number" min={1} step={1} defaultValue={300} /></div>
          <div className="field"><label htmlFor="stage-control-reason">Reason</label><input id="stage-control-reason" name="reason" required minLength={3} maxLength={500} /></div>
          <label className="choice"><input name="confirmed" type="checkbox" required /> Confirm the previewed Stage intervention.</label>
          <button className="btn-primary" type="submit" disabled={pending || !["active","paused"].includes(projection.sessionStatus)}>Apply Stage control</button>
        </form>
      </section>}
      <section aria-labelledby="inject-queue-title"><div className="section-heading"><h2 id="inject-queue-title">Injects</h2></div>
        {projection.injectQueue.length === 0 ? <p className="empty-state">No Inject Definitions are configured.</p> : <ul className="readiness-list">{projection.injectQueue.map((item) => <li key={item.definitionId}>
          <span><strong>{item.title}</strong> · {item.state} · {item.releaseMode}{item.scheduledAt === null ? "" : ` · ${new Date(item.scheduledAt).toLocaleString()}`}</span>
          {item.releaseMode === "manual" && item.id === null ? <button className="btn-secondary" type="button" disabled={pending}
            onClick={() => void send(`/v1/operator/sessions/${projection.sessionId}/inject`, "inject.release",
              { injectDefinitionId: item.definitionId, reason: `Release ${item.title}`, confirmed: true }, crypto.randomUUID(), 0)}>Release Inject</button> : null}
          {item.id !== null && !["cancelled","closed","expired"].includes(item.state) ? <button className="btn-secondary" type="button" disabled={pending}
            onClick={() => void send(`/v1/operator/sessions/${projection.sessionId}/inject`, "inject.cancel",
              { reason: `Cancel ${item.title}`, confirmed: true }, item.id, item.version)}>Cancel Inject</button> : null}
        </li>)}</ul>}
      </section>
      <section aria-labelledby="adjudication-queue-title"><div className="section-heading"><h2 id="adjudication-queue-title">Adjudications</h2></div>
        {projection.adjudicationQueue.length === 0 ? <p className="empty-state">No Adjudications require action.</p> : <ul className="readiness-list">
          {projection.adjudicationQueue.map((item) => <li key={item.id}><span><strong>{item.status}</strong> · version {item.version}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></li>)}</ul>}
      </section>
      <section aria-labelledby="delivery-health-title">
        <div className="section-heading"><h2 id="delivery-health-title">Runtime deliveries</h2></div>
        <p>{projection.deliveryHealth.pending} pending · {projection.deliveryHealth.deadLettered} dead-lettered</p>
        {projection.deliveryHealth.deadLetters.length === 0 ? <p className="empty-state">No dead-lettered deliveries.</p> :
          <ul className="readiness-list">{projection.deliveryHealth.deadLetters.map((item) => <li key={item.outboxId}>
            <span><strong>{item.eventType}</strong> · {item.attempts} failed attempts<br /><small>Queued <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></small></span>
            <button className="btn-secondary" type="button" disabled={pending} onClick={() => void retryDeadLetter(item.outboxId, item.attempts)}>
              Retry delivery
            </button>
          </li>)}</ul>}
      </section>
      {readiness === null ? null : <section aria-labelledby="staffing-title">
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
                <div className="field"><label htmlFor="invite-person">Directory person reference <span className="hint">(optional)</span></label>
                  <input id="invite-person" name="personId" type="text" autoComplete="off" /></div></details>
              <div className="field"><label htmlFor="invite-seat">Reserved Seat <span className="hint">(optional)</span></label>
                <select id="invite-seat" name="seatId"><option value="">Any eligible Seat</option>
                  {readiness.staffing.seats.map((item, index) => <option key={item.seatId} value={item.seatId}>{friendlyReference(item.seatId, `Seat ${index + 1}`)}</option>)}</select></div>
              <button className="btn-primary" type="submit" disabled={pending}>Issue invitation</button>
            </form>
            {invitationToken === null ? null : <p className="credential" role="status">Copy this one-time token now: <code>{invitationToken}</code></p>}
          </article>
          <article className="card"><h3>Assign participant</h3><p>Use direct assignment only when an authorized directory reference is available.</p>
            <details className="provenance-disclosure"><summary>Open direct assignment form</summary><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              void send(`/v1/sessions/${id}/participants`, "participant.assign", {
                personId: String(data.get("personId")), seatId: String(data.get("seatId")), sessionRoleId: String(data.get("sessionRoleId"))
              }, crypto.randomUUID()); }}>
              <div className="field"><label htmlFor="assign-person">Directory person reference</label><input id="assign-person" name="personId" type="text" required autoComplete="off" /></div>
              <div className="field"><label htmlFor="assign-seat">Seat</label><select id="assign-seat" name="seatId" required defaultValue=""><option value="" disabled>Select a Seat</option>
                {readiness.staffing.seats.map((item, index) => <option key={item.seatId} value={item.seatId}>{friendlyReference(item.seatId, `Seat ${index + 1}`)}</option>)}</select></div>
              <div className="field"><label htmlFor="assign-role">Session Role</label><select id="assign-role" name="sessionRoleId" required defaultValue=""><option value="" disabled>Select a Session Role</option>
                  {staffingRoleIds.map((sessionRoleReference, index) => <option key={sessionRoleReference} value={sessionRoleReference}>{friendlyReference(sessionRoleReference, `Role ${index + 1}`)}</option>)}</select></div>
              <button className="btn-primary" type="submit" disabled={pending}>Assign Seat</button>
            </form></details>
          </article>
        </div>
        <h3>Seat occupancy</h3>
        <ul className="readiness-list">{readiness.staffing.seats.map((item, index) => <li key={item.seatId}><span><strong>{friendlyReference(item.seatId, `Seat ${index + 1}`)}</strong></span>
          <span>{item.occupied} / {item.maximum ?? "unlimited"} occupied · minimum {item.minimum}</span></li>)}</ul>
        <h3>Waiting room</h3>
        {readiness.staffing.joinRequests.length === 0 ? <p className="empty-state">No pending join requests.</p> : <ul className="readiness-list">
          {readiness.staffing.joinRequests.map((item) => <li key={`${item.personId}-${item.submittedAt}`}><span><strong>{item.personId}</strong> · {item.status}{item.requestedSeatId === null ? "" : ` · ${item.requestedSeatId}`}</span>
            <span className="actions"><button className="btn-primary" type="button" disabled={pending}
              onClick={() => void send(`/v1/sessions/${id}/join-requests/${item.personId}/admit`, "participant.admit", {}, item.personId, 0)}>Admit</button>
              <button className="btn-secondary" type="button" disabled={pending}
                onClick={() => void send(`/v1/sessions/${id}/join-requests/${item.personId}/reject`, "participant.reject", {}, item.personId, 0)}>Reject</button></span></li>)}</ul>}
        <h3>Roster review</h3>
        {readiness.staffing.rosterReview.length === 0 ? <p className="empty-state">No ambiguous roster rows.</p> : <ul className="readiness-list">
          {readiness.staffing.rosterReview.map((item) => <li key={item.rowId}><span><strong>Row {item.rowNumber}</strong> · {item.personId ?? "Unresolved person"} · {item.seatId ?? "No Seat"}</span>
            <span>{item.reasons.join(", ")}</span></li>)}</ul>}
        <h3>Active assignments</h3>
        {readiness.staffing.assignments.length === 0 ? <p className="empty-state">No active Seat Assignments.</p> : <ul className="readiness-list">
          {readiness.staffing.assignments.map((item, assignmentIndex) => <li key={item.seatAssignmentId}><span><strong>{friendlyReference(item.seatId, `Seat ${assignmentIndex + 1}`)}</strong> · {friendlyReference(item.sessionRoleId, "Assigned role")}</span>
            <details className="provenance-disclosure"><summary>Assignment references</summary><code>{item.personId} · {item.seatAssignmentId}</code></details>
            <details><summary>Reassign</summary><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              void send(`/v1/sessions/${id}/seat-assignments/${item.seatAssignmentId}/reassign`, "participant.reassign", {
                previousSeatAssignmentId: item.seatAssignmentId, newSeatId: String(data.get("seatId")),
                newSessionRoleId: String(data.get("sessionRoleId")), reason: String(data.get("reason")),
                exposureAcknowledged: data.get("exposureAcknowledged") === "on"
              }, item.participantId, item.accessRevision); }}>
              <div className="field"><label htmlFor={`reassign-seat-${item.seatAssignmentId}`}>Destination Seat</label><select id={`reassign-seat-${item.seatAssignmentId}`} name="seatId" required defaultValue=""><option value="" disabled>Select a Seat</option>
                {readiness.staffing.seats.map((seat, index) => <option key={seat.seatId} value={seat.seatId}>{friendlyReference(seat.seatId, `Seat ${index + 1}`)}</option>)}</select></div>
              <div className="field"><label htmlFor={`reassign-role-${item.seatAssignmentId}`}>Session Role</label><select id={`reassign-role-${item.seatAssignmentId}`} name="sessionRoleId" required defaultValue=""><option value="" disabled>Select a Session Role</option>
                {staffingRoleIds.map((sessionRoleReference, index) => <option key={sessionRoleReference} value={sessionRoleReference}>{friendlyReference(sessionRoleReference, `Role ${index + 1}`)}</option>)}</select></div>
              <div className="field"><label htmlFor={`reassign-reason-${item.seatAssignmentId}`}>Reason</label><input id={`reassign-reason-${item.seatAssignmentId}`} name="reason" required minLength={3} maxLength={500} /></div>
              <label className="choice"><input name="exposureAcknowledged" type="checkbox" /> I acknowledge that previously viewed information cannot be withdrawn.</label>
              <button className="btn-primary" type="submit" disabled={pending}>Reassign</button>
            </form></details></li>)}</ul>}
      </section>}
      {readiness === null ? null : <section aria-labelledby="readiness-title">
        <div className="section-heading"><h2 id="readiness-title">Operator readiness</h2><p>Release and assignment version {readiness.assignmentVersion}</p></div>
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
          {states.map(([state, count]) => <li key={state}><span>{state.replaceAll("_", " ")}</span><strong>{count}</strong></li>)}</ul>}
      </section>
      <section aria-labelledby="event-title"><h2 id="event-title">Recent authoritative events</h2>
        {projection.recentEvents.length === 0 ? <p className="empty-state">No Session events recorded.</p> : <ol className="event-list">
          {projection.recentEvents.map((event, index) => <li key={`${event.type}-${event.recordedAt}-${index}`}><span>{event.type}</span><time dateTime={event.recordedAt}>{new Date(event.recordedAt).toLocaleString()}</time></li>)}</ol>}
      </section>
      <button className="btn-secondary refresh" type="button" onClick={() => void load()}>Refresh authoritative state</button>
      </> : null}
      </div>
    </main>
  </Shell>;
}

export function App() {
  const projectDemoId = useMemo(() => window.location.pathname.match(/^\/projects\/([0-9a-f-]{36})\/demo\/?$/iu)?.[1] ?? null, []);
  const firstAdminToken = useMemo(() => window.location.pathname.match(/^\/platform\/invitations\/([A-Za-z0-9_-]{43})\/?$/u)?.[1] ?? null, []);
  const platformAdministratorToken = useMemo(() => window.location.pathname.match(/^\/platform\/administrator-invitations\/([A-Za-z0-9_-]{43})\/?$/u)?.[1] ?? null, []);
  const workforceInvitationToken = useMemo(() => window.location.pathname.match(/^\/organization\/invitations\/([A-Za-z0-9_-]{43})\/?$/u)?.[1] ?? null, []);
  const operator = useMemo(() => window.location.pathname.startsWith("/admin/"), []);
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
  if (productEntry) return <ProductEntry />;
  return operator ? <OperatorView /> : <RuntimeView />;
}
