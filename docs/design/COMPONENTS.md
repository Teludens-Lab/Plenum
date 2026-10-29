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
