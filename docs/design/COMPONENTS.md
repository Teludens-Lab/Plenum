# Teludens component contracts

All components consume `packages/design-system/src/tokens.css`; reusable raw color, spacing, radius, and motion values are prohibited.

| Component | States | Density | Accessibility contract |
|---|---|---|---|
| Wordmark | light theme, dark theme | all | one accessible “Plenum home” link; decorative alternate image has empty alt |
| Shell header | online, loading, offline, error | focus | landmark header; status includes text; theme button has outcome label |
| Navigation Node | default, hover, focus-visible, current, unauthorized omission | standard | `nav` with heading; current destination uses `aria-current` |
| Workspace Gate | empty, selected destination | standard | actionable explanation; no inert controls |
| Account Branch | loading, ready, sign-out pending/error | standard | definition list; server-returned context only |
| State panel | loading, empty, error, unauthorized, offline | focus | heading, plain-language recovery, alert/status semantics |
| Button/link action | default, hover, focus-visible, active, disabled | inherited | semantic element, 44px minimum in focus density, visible focus |

Operations density is reserved for later expert monitoring screens; the entry shell never defaults to it.

## PS-710 additions

| Component | States | Density | Accessibility contract |
|---|---|---|---|
| Organization context | current, unavailable | standard | labeled server-owned select; sign-out instruction when another authenticated context is required |
| Project filter | active, archived, all, empty | standard | labeled search/status controls and explicit Apply action |
| Project creator | blank, Template, pending, validation, error | standard | fieldset/legend starting point; name retained after failure; Scenario checkbox disabled when unavailable and unchecked on every Template change |
| Project card | active, archived, archive-confirmation, stale | standard | textual state, owner/collaborator/Release metadata, semantic actions, inline named confirmation group |
| Template card | available, Core-Design-only, optional-Scenario | standard | descriptive copy semantics and visible Use Template action |
| Portal state | loading, empty, error, unauthorized, read-only | focus | status/alert semantics, actionable recovery, protected data omitted |

## PS-720 additions

| Component | States | Density | Accessibility contract |
|---|---|---|---|
| Release catalog card | immutable, selected, import/export pending/error | standard | visible provenance/digest; semantic stable-link and Package actions; mutation controls omitted |
| Session creator/card | blank, pending, configured, error, duplicate-retry | standard | labeled name/schedule fields; one pending action; server-confirmed stable destination |
| Lifecycle detail | loading, ready, denied, recovery error | focus | breadcrumb navigation, definition-list metadata, live status, protected data omitted on denial |
| Administration navigation | available, current, unauthorized omission | standard | descriptive stable links; `aria-current` follows the selected destination |
