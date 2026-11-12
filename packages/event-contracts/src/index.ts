/** Canonical API and event contracts owned by Contracts v1.3.1. */

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

type JsonSchemaProperty = Readonly<Record<string, unknown>>;

type ContractSchema<T extends object> = Readonly<{
  $schema: "https://json-schema.org/draft/2020-12/schema";
  $id: string;
  title: string;
  type: "object";
  additionalProperties: false;
  required: readonly (keyof T & string)[];
  properties: { readonly [K in keyof Required<T>]: JsonSchemaProperty };
}>;

export const COMMAND_ENVELOPE_CONTRACT_ID = "command-envelope-v1";
export const COMMAND_ENVELOPE_VERSION = 1;
export const EVENT_ENVELOPE_CONTRACT_ID = "event-envelope-v1";
export const EVENT_ENVELOPE_VERSION = 1;
export const ERROR_ENVELOPE_CONTRACT_ID = "error-envelope-v1";
export const ERROR_ENVELOPE_VERSION = 1;
export const COMMAND_RECEIPT_CONTRACT_ID = "command-receipt-v1";
export const DOMAIN_EVENT_CONTRACT_ID = "domain-event-v1";
export const RUNTIME_SSE_CONTRACT_ID = "runtime-sse-v1";
export const SYNC_DELTAS_CONTRACT_ID = "sync-deltas-v1";
export const SYNC_SNAPSHOT_CONTRACT_ID = "sync-snapshot-v1";
export const SYNC_BOOTSTRAP_CONTRACT_ID = "sync-bootstrap-v1";
export const OFFLINE_OUTBOX_CONTRACT_ID = "offline-outbox-v1";
export const ARTIFACT_COMMAND_CONTRACT_ID = "artifact-command-v1";
export const STAGE_COMMAND_CONTRACT_ID = "stage-command-v1";
export const INJECT_COMMAND_CONTRACT_ID = "inject-command-v1";
export const MESSAGE_COMMAND_CONTRACT_ID = "message-command-v1";
export const RUNTIME_PROJECTION_CONTRACT_ID = "runtime-projection-v1";
export const PARTICIPANT_ENTRY_CONTRACT_ID = "participant-entry-v1";
export const RUNTIME_NAVIGATION_CONTRACT_ID = "runtime-navigation-v1";
export const OPERATOR_PROJECTION_CONTRACT_ID = "operator-control-floor-v1";
export const MODEL_RUN_CONTRACT_ID = "model-run-v1";
export const EFFECT_PROPOSAL_CONTRACT_ID = "effect-proposal-v1";
export const STATE_TRANSACTION_CONTRACT_ID = "state-transaction-v1";
export const APPROVAL_DECISION_CONTRACT_ID = "approval-decision-v1";
export const POLL_COMMAND_CONTRACT_ID = "poll-command-v1";
export const BALLOT_COMMAND_CONTRACT_ID = "ballot-command-v1";
export const CERTIFICATION_CONTRACT_ID = "certification-v1";
export const VOICE_COMMAND_CONTRACT_ID = "voice-command-v1";
export const MEDIA_CREDENTIAL_CONTRACT_ID = "media-credential-v1";
export const FLOOR_LEASE_CONTRACT_ID = "floor-lease-v1";
export const STUDIO_CRDT_CONTRACT_ID = "studio-crdt-v1";
export const STUDIO_PUBLISH_CONTRACT_ID = "studio-publish-v1";
export const STUDIO_REHEARSAL_CONTRACT_ID = "studio-rehearsal-v1";
export const PUBLICATION_REVIEW_CONTRACT_ID = "publication-review-v1";
export const CORE_DESIGN_EDITOR_CONTRACT_ID = "core-design-editor-v1";
export const STUDIO_FOUNDATION_EDITOR_CONTRACT_ID = "studio-foundation-editor-v1";
export const ROLE_PREVIEW_CONTRACT_ID = "role-preview-v1";
export const PROJECT_DEMO_CONTRACT_ID = "project-demo-v1";
export const POLL_DEFINITION_CONTRACT_ID = "poll-definition-v1";
export const VOICE_DEFINITION_CONTRACT_ID = "voice-definition-v1";
export const VOICE_CONSENT_CONTRACT_ID = "voice-consent-v1";
export const SESSION_ONBOARDING_CONTRACT_ID = "session-onboarding-v1";
export const READINESS_CONTRACT_ID = "readiness-v1";
export const ADJUDICATION_REQUEST_CONTRACT_ID = "adjudication-request-v1";
export const ADJUDICATION_RECORD_CONTRACT_ID = "adjudication-record-v1";
export const ADJUDICATION_MODEL_EDITOR_CONTRACT_ID = "adjudication-model-editor-v1";
export const COMPATIBILITY_REPORT_CONTRACT_ID = "compatibility-report-v1";
export const RELEASE_ACTIVATION_CONTRACT_ID = "release-activation-v1";
export const CHECKPOINT_CONTRACT_ID = "checkpoint-v1";
export const VERIFICATION_EXPORT_CONTRACT_ID = "verification-export-v1";
export const REPORT_DEFINITION_CONTRACT_ID = "report-definition-v1";
export const RESEARCH_EXPORT_CONTRACT_ID = "research-export-v1";
export const REPLAY_DIVERGENCE_CONTRACT_ID = "replay-divergence-v1";
export const PRODUCT_SHELL_CONTRACT_ID = "product-shell-v1";
export const PROJECT_PORTAL_CONTRACT_ID = "project-portal-v1";
export const TEMPLATE_LIBRARY_CONTRACT_ID = "template-library-v1";
export const RELEASE_CATALOG_CONTRACT_ID = "release-catalog-v1";
export const SESSION_CATALOG_CONTRACT_ID = "session-catalog-v1";
export const CONTENT_LIBRARY_CONTRACT_ID = "content-library-v1";
export const UPLOAD_QUARANTINE_CONTRACT_ID = "upload-quarantine-v1";
export const OPERATIONS_ADMIN_CONTRACT_ID = "operations-admin-v1";
export const REPORT_DELIVERY_CONTRACT_ID = "report-delivery-v1";
export const PLATFORM_CONTROL_PLANE_CONTRACT_ID = "platform-control-plane-v1";
export const ORGANIZATION_WORKFORCE_CONTRACT_ID = "organization-workforce-v1";
export const OPERATIONAL_TELEMETRY_CONTRACT_ID = "operational-telemetry-v1";

export type OperationalTelemetrySeverityV1 = "info" | "warning" | "error";
export type OperationalTelemetryOutcomeV1 = "succeeded" | "failed" | "denied";

/**
 * Scrubbed operational event emitted at the HTTP boundary. It intentionally
 * excludes request bodies, credentials, addresses, user-agent strings, and
 * arbitrary exception text.
 */
export interface OperationalTelemetryEventV1 extends JsonObject {
  contractId: typeof OPERATIONAL_TELEMETRY_CONTRACT_ID;
  event: string;
  severity: OperationalTelemetrySeverityV1;
  outcome: OperationalTelemetryOutcomeV1;
  recordedAt: string;
  correlationId: string;
  traceId: string;
  deploymentId: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  sessionId?: string;
  category?: string;
}

export interface ProductShellContextV1 extends JsonObject {
  contractId: typeof PRODUCT_SHELL_CONTRACT_ID;
  principal: { id: string; displayName: string };
  organization: { id: string; name: string; roles: string[] };
  destinations: Array<"home" | "studio" | "runtime" | "operations" | "platform">;
  platformRoles: Array<"platform_administrator">;
}

export type OrganizationLifecycleStatusV1 = "pending" | "active" | "suspended" | "offboarded";
export type OrganizationDeploymentProfileV1 = "unconfigured" | "cloud" | "self_hosted" | "air_gapped";
export type OrganizationIdentityProviderProtocolV1 = "oidc" | "saml";
export type OrganizationIdentityProviderStatusV1 =
  "draft" | "preflight_passed" | "tested" | "approved" | "active" | "suspended" | "superseded";

export interface OrganizationIdentityProviderV1 extends JsonObject {
  id: string;
  version: number;
  protocol: OrganizationIdentityProviderProtocolV1;
  displayName: string;
  status: OrganizationIdentityProviderStatusV1;
  discoveryUrl: string;
  metadataUrl: string | null;
  domains: string[];
  preflightedAt: string | null;
  testedAt: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  preflightFailure: string | null;
  replacesProviderId: string | null;
}

export type OrganizationWorkforceStatusV1 = "invited" | "active" | "suspended" | "deprovisioned";

export interface OrganizationWorkforceMemberV1 extends JsonObject {
  personId: string;
  displayName: string;
  email: string | null;
  externalId: string | null;
  source: "legacy" | "invitation" | "scim";
  status: OrganizationWorkforceStatusV1;
  lifecycleVersion: number;
  roles: string[];
  roleRevision: string;
  lastScimSeenAt: string | null;
  lastAccessReviewedAt: string | null;
}

export interface OrganizationWorkforceV1 extends JsonObject {
  contractId: typeof ORGANIZATION_WORKFORCE_CONTRACT_ID;
  roles: string[];
  members: OrganizationWorkforceMemberV1[];
  invitations: Array<{
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    status: "pending" | "accepted" | "linked" | "expired" | "revoked";
    deliveryStatus: "queued" | "sent" | "delivered" | "bounced" | "failed" | "cancelled";
    expiresAt: string;
    deliveryFailure: string | null;
  }>;
  scimCredentials: Array<{
    id: string;
    label: string;
    tokenPrefix: string;
    expiresAt: string | null;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }>;
  groupMappings: Array<{
    id: string;
    groupExternalId: string;
    groupDisplayName: string;
    organizationRole: string;
    identityProviderId: string | null;
    activeMemberCount: number;
  }>;
  accessReview: {
    id: string;
    status: "open" | "completed";
    startedAt: string;
    pendingCount: number;
    items: Array<{
      id: string;
      personId: string;
      displayName: string;
      statusSnapshot: string;
      rolesSnapshot: string[];
      decision: "retain" | "suspend" | "deprovision" | null;
      decisionReason: string | null;
    }>;
  } | null;
  reconciliation: {
    staleScimMembers: number;
    entitlementConflicts: number;
    groupRemovalCandidates: number;
    reviewDue: boolean;
    failedOperations: number;
    lastRunAt: string | null;
  };
  provisioningOperations: Array<{
    id: string;
    source: "entra" | "okta" | "scim" | "invitation" | "reconciliation";
    operationType: string;
    targetRef: string;
    status: "received" | "succeeded" | "failed" | "retry_pending";
    attemptCount: number;
    errorCode: string | null;
    errorReason: string | null;
    startedAt: string;
    completedAt: string | null;
    nextRetryAt: string | null;
  }>;
}

export interface OrganizationProvisioningGateV1 extends JsonObject {
  key: "deployment_profile" | "entitlements" | "verified_domain" | "first_admin";
  label: string;
  complete: boolean;
  prerequisite: string;
}

export interface PlatformOrganizationSummaryV1 extends JsonObject {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus: OrganizationLifecycleStatusV1;
  lifecycleVersion: number;
  configurationStatus: "complete" | "needs_reconciliation";
  deploymentProfile: OrganizationDeploymentProfileV1;
  dataResidencyRegion: string | null;
  entitlements: string[];
  verifiedDomainCount: number;
  firstAdminStatus: "not_invited" | "pending" | "accepted" | "expired";
  gates: OrganizationProvisioningGateV1[];
  createdAt: string;
}

export interface PlatformOrganizationsV1 extends JsonObject {
  contractId: typeof PLATFORM_CONTROL_PLANE_CONTRACT_ID;
  organizations: PlatformOrganizationSummaryV1[];
}

export interface PlatformOrganizationDetailV1 extends JsonObject {
  contractId: typeof PLATFORM_CONTROL_PLANE_CONTRACT_ID;
  organization: PlatformOrganizationSummaryV1 & {
    legalName: string;
    countryCode: string | null;
    timeZone: string | null;
    supportContact: string | null;
    securityContact: string | null;
    activatedAt: string | null;
    suspendedAt: string | null;
    offboardedAt: string | null;
  };
  domains: Array<{
    id: string;
    domain: string;
    verificationMethod: "dns_txt" | "manual_contract";
    verifiedAt: string | null;
    challenge: {
      recordType: "TXT";
      name: string;
      value: string;
      expiresAt: string;
      lastCheckedAt: string | null;
      failure: string | null;
    } | null;
  }>;
  firstAdminInvitation: {
    id: string;
    email: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    expiresAt: string;
    acceptedAt: string | null;
    identityLinkedAt: string | null;
    delivery: {
      status: "queued" | "sent" | "failed" | "cancelled";
      attemptCount: number;
      sentAt: string | null;
      failedAt: string | null;
      failureReason: string | null;
    } | null;
  } | null;
  identityProviders: OrganizationIdentityProviderV1[];
  auditRecords: Array<{
    id: string;
    action: string;
    actorDisplayName: string;
    recordedAt: string;
    details: JsonObject;
  }>;
}

export type PlatformAdministratorStatusV1 = "active" | "suspended" | "revoked";
export type PlatformAdministratorChangeTypeV1 = "invite" | "suspend" | "revoke" | "recover";
export type PlatformAdministratorChangeStatusV1 = "pending" | "approved" | "rejected" | "applied" | "expired";

export interface PlatformAdministratorWorkforceV1 extends JsonObject {
  contractId: typeof PLATFORM_CONTROL_PLANE_CONTRACT_ID;
  currentPersonId: string;
  stepUp: { satisfied: boolean; expiresAt: string | null };
  administrators: Array<{
    personId: string;
    displayName: string;
    status: PlatformAdministratorStatusV1;
    homeOrganization: { id: string; name: string };
    assignedAt: string;
    suspendedAt: string | null;
    revokedAt: string | null;
    assignmentVersion: number;
    activeSessionCount: number;
    lastAuthenticatedAt: string | null;
  }>;
  changeRequests: Array<{
    id: string;
    changeType: PlatformAdministratorChangeTypeV1;
    status: PlatformAdministratorChangeStatusV1;
    target: { personId: string | null; displayName: string; email: string | null };
    requestedBy: { personId: string; displayName: string };
    requestedAt: string;
    expiresAt: string;
    reason: string;
    decidedBy: { personId: string; displayName: string } | null;
    decidedAt: string | null;
    decisionReason: string | null;
    invitation: {
      expiresAt: string;
      identityLinkedAt: string | null;
      deliveryStatus: "queued" | "sent" | "failed" | "cancelled";
      deliveryFailureReason: string | null;
    } | null;
  }>;
}

export interface PlatformAdministratorMutationV1 extends JsonObject {
  workforce: PlatformAdministratorWorkforceV1;
  invitationUrl?: string;
}

export interface OrganizationMemberV1 extends JsonObject {
  id: string;
  displayName: string;
  roles: string[];
}

export interface ProjectSummaryV1 extends JsonObject {
  id: string;
  title: string;
  lifecycleStatus: "active" | "archived";
  version: number;
  owner: { id: string; displayName: string };
  collaborators: OrganizationMemberV1[];
  sourceTemplate: { id: string; title: string } | null;
  releaseCount: number;
  createdAt: string;
  updatedAt: string;
  editorUrl: string;
}

export interface ProjectPortalV1 extends JsonObject {
  contractId: typeof PROJECT_PORTAL_CONTRACT_ID;
  organization: { id: string; name: string };
  availableOrganizations: Array<{ id: string; name: string; current: boolean }>;
  permissions: { canCreateProject: boolean; canManageProjects: boolean; canViewMembers: boolean };
  projects: ProjectSummaryV1[];
  nextCursor: string | null;
  members?: OrganizationMemberV1[];
}

export interface ProjectMutationV1 extends JsonObject {
  projectId: string;
  lifecycleStatus: "active" | "archived";
  version: number;
  editorUrl: string;
  replayed: boolean;
}

export interface ContentLibraryVersionV1 extends JsonObject {
  id: string;
  version: number;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  scanStatus: "quarantined" | "clean" | "infected" | "failed";
  scanDetail: string;
  availableAt: string | null;
  createdAt: string;
}

export interface ContentLibraryItemV1 extends JsonObject {
  id: string;
  projectId: string;
  title: string;
  currentVersion: number;
  versions: ContentLibraryVersionV1[];
}

export interface ContentLibraryV1 extends JsonObject {
  contractId: typeof CONTENT_LIBRARY_CONTRACT_ID;
  projectId: string;
  permissions: { canUpload: boolean };
  items: ContentLibraryItemV1[];
}

export interface UploadQuarantineV1 extends JsonObject {
  contractId: typeof UPLOAD_QUARANTINE_CONTRACT_ID;
  projectId: string;
  contentItem: ContentLibraryItemV1;
  replayed: boolean;
}

export interface SimulationTemplateSummaryV1 extends JsonObject {
  id: string;
  title: string;
  summary: string;
  includesOptionalScenario: boolean;
  publishedAt: string;
  version: number;
  lifecycleStatus: "published" | "superseded" | "deprecated" | "archived";
  lifecycleHistory: Array<{ eventType: "published" | "superseded" | "deprecated" | "archived"; actorDisplayName: string; rationale: string; occurredAt: string }>;
}

export interface TemplateLibraryV1 extends JsonObject {
  contractId: typeof TEMPLATE_LIBRARY_CONTRACT_ID;
  templates: SimulationTemplateSummaryV1[];
  nextCursor: string | null;
}

export interface ReleaseSummaryV1 extends JsonObject {
  id: string;
  project: { id: string; title: string };
  label: string;
  releaseNumber: number;
  packageSchemaVersion: string;
  compilerVersion: string;
  packageDigest: string;
  publishedBy: { id: string; displayName: string };
  publishedAt: string;
  approvalCount: number;
  sessionCount: number;
  immutable: true;
  detailUrl: string;
  packageUrl: string;
}

export interface ReleaseCatalogV1 extends JsonObject {
  contractId: typeof RELEASE_CATALOG_CONTRACT_ID;
  permissions: { canExportPackage: boolean; canImportPackage: boolean; canCreateSession: boolean };
  releases: ReleaseSummaryV1[];
  nextCursor: string | null;
}

export type SessionLifecycleStatusV1 = "created" | "configured" | "ready" | "open" | "active" |
  "paused" | "completed" | "locked" | "archived";

export interface SessionSummaryV1 extends JsonObject {
  id: string;
  title: string;
  project: { id: string; title: string };
  governingRelease: { id: string; label: string };
  status: SessionLifecycleStatusV1;
  version: number;
  scheduledStartAt: string | null;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  readiness: { complete: number; total: number; blockingIncomplete: number };
  nextActions: string[];
  urls: { detail: string; staffing: string; runtime: string; reports: string; replay: string; archive: string };
}

export interface SessionCatalogV1 extends JsonObject {
  contractId: typeof SESSION_CATALOG_CONTRACT_ID;
  permissions: { canCreateSession: boolean; canOperateSessions: boolean };
  sessions: SessionSummaryV1[];
  nextCursor: string | null;
}

export interface CreatedConfiguredSessionV1 extends JsonObject {
  contractId: typeof SESSION_CATALOG_CONTRACT_ID;
  sessionId: string;
  title: string;
  status: "configured";
  version: number;
  governingReleaseId: string;
  scheduledStartAt: string | null;
  replayed: boolean;
  evidenceSequence: number;
  detailUrl: string;
  staffingUrl: string;
}

export interface ParticipantRoleContextV1 extends JsonObject {
  sessionRoleId: string;
  sessionRoleLabel: string;
  teamLabel: string | null;
  seatLabel: string;
  runtimeUrl: string;
}

export interface ParticipantSeatChoiceV1 extends JsonObject {
  seatId: string;
  seatLabel: string;
  sessionRoleId: string;
  sessionRoleLabel: string;
  teamLabel: string | null;
}

export interface ParticipantBrandAssetV1 extends JsonObject {
  url: string;
  altText: string;
  mediaType: "image/png" | "image/jpeg";
}

export interface ParticipantSessionBrandingV1 extends JsonObject {
  title: string;
  subtitle: string | null;
  developer: string;
  developerLogo: ParticipantBrandAssetV1 | null;
  simulationImage: ParticipantBrandAssetV1 | null;
}

export interface ParticipantSessionEntryV1 extends JsonObject {
  sessionId: string;
  governingReleaseId: string;
  title: string;
  releaseLabel: string;
  status: SessionLifecycleStatusV1;
  entryState: "invited" | "waiting_room" | "assignment_pending" | "ready";
  invitationId: string | null;
  roleContexts: ParticipantRoleContextV1[];
  eligibleSeats: ParticipantSeatChoiceV1[];
  branding?: ParticipantSessionBrandingV1;
}

export interface ParticipantEntryV1 extends JsonObject {
  contractId: typeof PARTICIPANT_ENTRY_CONTRACT_ID;
  sessions: ParticipantSessionEntryV1[];
}

export interface RuntimeNavigationV1 extends JsonObject {
  contractId: typeof RUNTIME_NAVIGATION_CONTRACT_ID;
  items: Array<{ id: string; label: string; moduleId: string; regionId?: string }>;
  defaultItemId?: string;
}

export interface RuntimeRegionV1 extends JsonObject {
  id: string;
  moduleIds: string[];
}

export const OFFLINE_QUEUEABLE_COMMAND_TYPES_V1 = [
  "artifact.create",
  "artifact.edit",
  "artifact.submit",
  "ballot.cast"
] as const;

export type ReleaseChangeClassV1 = "safe_prospective" | "compatibility_dependent" | "consequential";

export interface CompatibilityChangeV1 extends JsonObject {
  path: string;
  kind: "added" | "changed" | "removed";
  classification: ReleaseChangeClassV1;
  summary: string;
}

export interface CompatibilityReportV1 extends JsonObject {
  contractId: typeof COMPATIBILITY_REPORT_CONTRACT_ID;
  fromReleaseId: string;
  toReleaseId: string;
  classification: ReleaseChangeClassV1;
  changes: CompatibilityChangeV1[];
  blockedReasons: string[];
  requiresImpactReview: boolean;
  existingInstanceHandling: "keep_existing";
}

export interface ReleaseActivationV1 extends JsonObject {
  contractId: typeof RELEASE_ACTIVATION_CONTRACT_ID;
  activationId: string;
  sessionId: string;
  fromReleaseId: string;
  toReleaseId: string;
  activationSequence: number;
  impactReviewId: string;
  compatibilityReportDigest: string;
  classification: ReleaseChangeClassV1;
  existingInstanceHandling: "keep_existing";
  activatedBy: string;
  activatedAt: string;
}

export interface EvidenceProofEventV1 extends JsonObject {
  id: string;
  sequence: number;
  eventType: string;
  eventVersion: number;
  commandId: string | null;
  actorPersonId: string | null;
  actorParticipantId: string | null;
  governingReleaseId: string;
  authorityEpoch: number;
  correlationId: string | null;
  causationId: string | null;
  aggregateId: string | null;
  aggregateVersion: number | null;
  occurredAt: string;
  recordedAt: string;
  bodyDigest: string;
}

export interface EvidenceCheckpointV1 extends JsonObject {
  contractId: typeof CHECKPOINT_CONTRACT_ID;
  checkpointId: string;
  sessionId: string;
  firstSequence: number;
  lastSequence: number;
  previousCheckpointDigest: string | null;
  batchMerkleRoot: string;
  canonicalization: "plenum-evidence-v1";
  algorithm: "sha256";
  checkpointDigest: string;
  createdAt: string;
}

export interface EvidenceCheckpointSignatureV1 extends JsonObject {
  keyId: string;
  algorithm: "Ed25519";
  signature: string;
  publicKeyJwk: JsonObject;
  signedAt: string;
}

export interface EvidenceAnchorReceiptV1 extends JsonObject {
  endpoint: string;
  reference: string;
  anchoredDigest: string;
  keyId: string;
  verificationResult: "pending" | "verified" | "failed";
  recordedAt: string;
}

export interface VerificationCheckpointV1 extends JsonObject {
  checkpoint: EvidenceCheckpointV1;
  events: EvidenceProofEventV1[];
  signature: EvidenceCheckpointSignatureV1;
  anchorReceipts: EvidenceAnchorReceiptV1[];
}

export interface VerificationExportV1 extends JsonObject {
  contractId: typeof VERIFICATION_EXPORT_CONTRACT_ID;
  sessionId: string;
  generatedAt: string;
  lastEvidenceSequence: number;
  checkpoints: VerificationCheckpointV1[];
}

export type ReportKindV1 = "session_archive" | "after_action" | "team" | "control" | "research_dataset" | "organization_archive";

export interface ReportDefinitionV1 extends JsonObject {
  contractId: typeof REPORT_DEFINITION_CONTRACT_ID;
  definitionKey: string;
  definitionVersion: number;
  reportKind: ReportKindV1;
  includedDataClasses: string[];
  excludedDataClasses: string[];
  analyticalLayers: Array<"observation" | "derived_metric" | "analytical_note" | "finding">;
}

export interface ResearchExportV1 extends JsonObject {
  contractId: typeof RESEARCH_EXPORT_CONTRACT_ID;
  exportId: string;
  projectId: string;
  sessionIds: string[];
  releaseIds: string[];
  generatedAt: string;
  exportDefinitionVersion: number;
  anonymizationProfile: string;
  purposeLabel: string;
  includedDataClasses: string[];
  excludedDataClasses: string[];
  reproducibilityManifests: JsonObject[];
  observations: JsonObject[];
  derivedMetrics: JsonObject[];
  analyticalNotes: JsonObject[];
  findings: JsonObject[];
  provenance: JsonObject;
}

export interface ReplayDivergenceV1 extends JsonObject {
  contractId: typeof REPLAY_DIVERGENCE_CONTRACT_ID;
  sessionId: string;
  generatedAt: string;
  manifestDigest: string;
  matched: boolean;
  comparedEvents: number;
  divergences: JsonObject[];
}

export type StudioSaveStateV1 = "saved_on_device" | "synchronized" | "validation_required" | "published";

export interface StudioValidationIssueV1 extends JsonObject {
  code: string;
  severity: "error" | "warning";
  message: string;
  path: string;
  elementId: string | null;
}

export interface StudioValidationReportV1 extends JsonObject {
  contractId: "studio-validation-v1";
  valid: boolean;
  issues: StudioValidationIssueV1[];
  reportDigest: string;
}

export interface StudioCrdtV1 {
  contractId: typeof STUDIO_CRDT_CONTRACT_ID;
  type: "sync" | "update" | "ack" | "remote_update" | "error";
  documentId: string;
  generation: number;
  updateId: string | null;
  update: string | null;
  stateVector: string | null;
  saveState: StudioSaveStateV1 | null;
  unsynchronizedChanges: number;
  validation: StudioValidationReportV1 | null;
  message: string | null;
}

export interface StudioPublishV1 {
  contractId: typeof STUDIO_PUBLISH_CONTRACT_ID;
  freezeId: string;
  releaseId: string;
  definitionRevisionId: string;
  contentDigest: string;
  manifestDigest: string;
  packageDigest: string;
  saveState: "published";
}

export interface StudioRehearsalV1 extends JsonObject {
  contractId: typeof STUDIO_REHEARSAL_CONTRACT_ID;
  projectId: string;
  artifactDigest: string;
  seed: number;
  startedAt: string;
  finalStageIds: string[];
  trace: Array<{
    triggerId: string;
    kind: "entry" | "completion" | "transition" | "effect";
    fired: boolean;
    explanations: Array<{ path: string; fact: string | null; operator: string; passed: boolean; reason: string }>;
    stateChanges: Array<{ stateVariableId: string; scopeReference: string; previousValue: JsonValue; newValue: JsonValue; operation: string }>;
  }>;
}

export interface PublicationReviewV1 extends JsonObject {
  contractId: typeof PUBLICATION_REVIEW_CONTRACT_ID;
  projectId: string;
  freeze: null | {
    id: string;
    artifactDigest: string;
    validationReportDigest: string;
    frozenAt: string;
    frozenBy: { id: string; displayName: string };
    authorPersonIds: string[];
    policyVersion: string;
  };
  approvals: Array<{
    reviewerPersonId: string;
    reviewerDisplayName: string;
    rationale: string;
    decidedAt: string;
    artifactDigest: string;
    policyVersion: string;
  }>;
  permissions: { canFreeze: boolean; canApprove: boolean; canPublish: boolean };
  liveChangeOptions: {
    sessions: Array<{ id: string; label: string }>;
    releases: Array<{ id: string; label: string }>;
  };
}

export interface RolePreviewV1 {
  contractId: typeof ROLE_PREVIEW_CONTRACT_ID;
  projectId: string;
  sessionRoleId: string;
  sessionRoleLabel: string;
  stageId: string;
  stageLabel: string;
  teamId: string | null;
  teamLabel: string | null;
  interfaceProfileId: string;
  layout: "single_column" | "main_with_sidebar" | "dashboard_grid" | "workspace_tabs";
  modules: RuntimeModuleV1[];
  content: Array<{ id: string; title: string; type: string; body?: string }>;
}

/** Read-only Draft materialization used by the isolated browser-local QA demo. */
export interface ProjectDemoV1 {
  contractId: typeof PROJECT_DEMO_CONTRACT_ID;
  projectId: string;
  projectTitle: string;
  demoSessionId: string;
  demoMode: true;
  materialization: JsonObject;
  validation: StudioValidationReportV1;
}

/** Platform authorization for the Session Operator persona; this is never a Release Session Role. */
export const SESSION_OPERATOR_POLICY_V1 = {
  displayLabel: "Game Master",
  organizationRole: "operator",
  scope: ["organization", "session"],
  participantSeat: "forbidden",
  readOperations: ["session.monitor", "report.view"],
  consequentialOperations: [
    "session.create", "session.configure", "session.ready", "session.open", "session.start",
    "session.pause", "session.resume", "session.complete", "session.lock", "session.archive", "session.delete",
    "participant.assign", "participant.reassign", "participant.remove_bulk", "participant.readiness_override", "principal.revoke",
    "stage.start", "stage.end", "stage.reopen", "stage.extend", "stage.skip", "stage.return",
    "timer.pause", "timer.resume", "timer.extend", "inject.release", "inject.cancel", "inject.reschedule",
    "adjudication.route", "plugin_binding.enable", "plugin_binding.disable", "export.request",
    "delivery.retry", "session.recover", "authority.transfer", "release.activate"
  ],
  recording: {
    accepted: "command_receipt_evidence_event_and_immutable_audit_record",
    rejected: "command_receipt_and_evidence_event",
    recovery: "compensating_record_preserving_original"
  }
} as const;

export interface CommandEnvelopeV1 {
  commandId: string;
  deviceId: string;
  operationType: string;
  aggregateId: string;
  expectedAggregateVersion: number;
  governingReleaseId: string;
  activeSessionRoleId?: string;
  deviceObservedAt?: string;
  payload: JsonObject;
}

export interface EventEnvelopeV1 {
  eventId: string;
  eventType: string;
  eventVersion: 1;
  producer: string;
  correlationId: string;
  causationId: string;
  sessionId: string;
  governingReleaseId: string;
  aggregateId: string;
  aggregateVersion: number;
  evidenceSequence: number;
  occurredAt: string;
  payload: JsonObject;
}

export type CommandOutcomeStatus = "received" | "accepted" | "rejected" | "needs_reconciliation";

export interface CommandReceiptV1 {
  commandId: string;
  status: CommandOutcomeStatus;
  aggregateVersion: number | null;
  evidenceSequence: number | null;
  errorCode: CanonicalErrorCode | null;
  message: string | null;
  replayed: boolean;
}

export type DomainEventV1 = EventEnvelopeV1;

export interface RuntimeDeltaV1 {
  deltaId: string;
  cursor: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  occurredAt: string;
  payload: JsonObject;
}

export interface SyncDeltasV1 {
  projectionVersion: string;
  policyVersion: string;
  deltas: RuntimeDeltaV1[];
  nextCursor: string;
}

export interface SyncSnapshotV1 {
  projectionVersion: string;
  policyVersion: string;
  cursor: string;
  state: JsonObject;
  aggregateVersions: Record<string, number>;
}

export interface SyncBootstrapV1 {
  contractId: typeof SYNC_BOOTSTRAP_CONTRACT_ID;
  sessionId: string;
  deviceId: string;
  participantId: string;
  seatAssignmentIds: string[];
  activeSessionRoleId: string;
  isControlRole: boolean;
  authorityDeploymentId: string;
  authorityEpoch: number;
  accessRevision: number;
  governingReleaseId: string;
  credentialExpiresAt: string;
  serverTime: string;
  projectionVersion: string;
  policyVersion: string;
  offlineCommandTypes: string[];
}

export type OfflineCommandStatusV1 = "local_pending" | CommandOutcomeStatus;

export interface OfflineCommandV1 {
  command: CommandEnvelopeV1;
  draftPayload: JsonObject;
  queuedAt: string;
  queueSequence: number;
  status: OfflineCommandStatusV1;
  receipt: CommandReceiptV1 | null;
}

export interface OfflineOutboxV1 {
  contractId: typeof OFFLINE_OUTBOX_CONTRACT_ID;
  sessionId: string;
  deviceId: string;
  participantId: string;
  activeSessionRoleId: string;
  authorityEpoch: number;
  accessRevision: number;
  credentialExpiresAt: string;
  entries: OfflineCommandV1[];
}

export type RuntimeSseEventV1 =
  | { kind: "delta"; cursor: string; delta: RuntimeDeltaV1 }
  | { kind: "cursor"; cursor: string; delta: null };

export interface RuntimeSseV1 {
  projectionVersion: string;
  policyVersion: string;
  events: RuntimeSseEventV1[];
}

export interface RuntimeFormFieldV1 {
  computation?: import("@plenum/simulation-schema").FormComputationV1;
  formattedTextContractId?: "formatted-text-v1";
  defaultValue?: boolean | number | string | Array<boolean | number | string>;
  key: string;
  label: string;
  type: "text" | "long_text" | "number" | "yes_no" | "date" | "time" | "date_time" | "currency" | "percentage" | "single_select" | "multi_select" | "artifact_reference" | "entity_reference" | "formatted_text";
  numeric?: { unit: string; precision: number };
  entityReference?: { kind: "artifact" | "team" | "session_role" | "resource" | "capability" | "state_variable" | "stage"; multiple: boolean };
  required: boolean;
  requiredWhen?: { field: string; operator: "equals" | "not_equals" | "includes" | "present"; value?: string | number | boolean };
  visibleWhen?: { field: string; operator: "equals" | "not_equals" | "includes" | "present"; value?: string | number | boolean };
  helpText?: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  control?: "cards" | "select" | "range";
  readOnly?: boolean;
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; integer?: boolean; minItems?: number; maxItems?: number; uniqueItems?: boolean };
}

export interface RuntimeFormV1 {
  attachments?: import("@plenum/simulation-schema").FormAttachmentPolicyV1;
  contractId?: "structured-form-v2";
  id: string;
  name: string;
  formVersion: string;
  layout?: { pages: string[]; review?: boolean };
  fields: RuntimeFormFieldV1[];
  sections: Array<{
    id: string;
    title?: string;
    description?: string;
    page?: number;
    columns?: 2 | 3 | 4;
    collapsed?: boolean;
    table?: { columns: string[]; rows: Array<{ label: string; fields: string[] }>; editor?: "groups" };
    fields: RuntimeFormFieldV1[];
    repeatable?: boolean;
    itemLabel?: string;
    itemKeyField?: string;
    minItems?: number;
    maxItems?: number;
  }>;
  rules?: Array<{ kind: "distinct"; fields: string[]; message: string }>;
}

export interface RuntimeActionV1 {
  operationType: string;
  label: string;
  requiresForm: boolean;
  editableFieldKeys?: string[];
}

export interface RuntimeArtifactHistoryV1 {
  artifactId: string;
  revisions: Array<{ version: number; state: string; stateLabel: string; payload: JsonObject; form: RuntimeFormV1;
    authorDisplayName: string; recordedAt: string }>;
  nextBeforeVersion: number | null;
}

export interface RuntimeArtifactV1 {
  exportable?: boolean;
  id: string;
  artifactTypeKey: string;
  title: string;
  state: string;
  stateLabel: string;
  payload: JsonObject;
  version: number;
  governingReleaseId: string;
  form: RuntimeFormV1;
  createdByMe: boolean;
  actions: RuntimeActionV1[];
}

export interface FormAttachmentV1 {
  id: string; fileName: string; mediaType: string; sizeBytes: number; sha256: string;
  scanStatus: "quarantined" | "clean" | "infected" | "failed"; available: boolean; canRetryScan: boolean; expiresAt: string;
}

export const FORM_ATTACHMENT_UPLOAD_CONTRACT_ID = "form-attachment-upload-v1";
export const formAttachmentUploadV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: FORM_ATTACHMENT_UPLOAD_CONTRACT_ID,
  type: "object", additionalProperties: false, required: ["command", "attachmentId", "fileName", "mediaType", "contentBase64"],
  properties: {
    command: { type: "object", required: ["commandId", "deviceId", "aggregateId", "expectedAggregateVersion", "governingReleaseId", "operationType", "payload"],
      properties: { commandId: { type: "string", format: "uuid" }, deviceId: { type: "string", format: "uuid" }, aggregateId: { type: "string", format: "uuid" },
        governingReleaseId: { type: "string", format: "uuid" }, expectedAggregateVersion: { type: "integer", minimum: 0 }, activeSessionRoleId: { type: "string" },
        operationType: { enum: ["artifact.attach_file", "artifact.rescan_file"] }, payload: { type: "object", maxProperties: 0 } } },
    attachmentId: { type: "string", format: "uuid" }, fileName: { type: "string", minLength: 1, maxLength: 255, pattern: "^[^\\x00-\\x1f\\x7f/\\\\]+$" },
    mediaType: { enum: ["text/plain", "text/markdown", "application/pdf", "image/png", "image/jpeg"] },
    contentBase64: { type: "string", minLength: 4, maxLength: 26666668, contentEncoding: "base64" }
  }
} as const;

export interface RuntimeCreateTaskV1 {
  artifactTypeKey: string;
  title: string;
  action: RuntimeActionV1;
  form: RuntimeFormV1;
  /** Server-resolved values for a scoped form, such as an enabled Industry cell. */
  initialValues?: JsonObject;
}

export interface RuntimeModuleV1 {
  id: string;
  type: "session_status" | "artifact_form" | "task_list" | "artifact_presentation" | "slide_deck" |
    "resource_library" | "message_inbox" | "proposal_thread" | "inject_inbox" | "session_timeline";
  title: string;
  mode: "read" | "write";
  emptyStateText: string;
  configuration: JsonObject;
}

export interface RuntimeResourceV1 {
  id: string;
  name: string;
  type: string;
  mediaType: string;
  altText?: string;
}

export interface RuntimeMessageV1 {
  id: string;
  channelId: string;
  routeId: string;
  threadId: string | null;
  senderParticipantId: string;
  senderSessionRoleId: string;
  operationType: string;
  content: JsonObject;
  sentAt: string;
  approvedAt: string | null;
  approvalRouteId: string | null;
  threadState: "open" | "accepted_terms" | "closed" | null;
  threadVersion: number | null;
  deliveryState: "released" | "delivered" | "read";
}

export interface RuntimeInjectV1 {
  id: string;
  definitionId: string;
  title: string;
  content: JsonObject;
  state: "released" | "acknowledged" | "responded" | "closed";
  releasedAt: string;
  acknowledgedAt: string | null;
  respondedAt: string | null;
  requiredResponseArtifactTypeId: string | null;
  governingReleaseId?: string;
  acknowledgementRequired?: boolean;
  recipientComplete?: boolean;
  responseArtifactTypeKey?: string | null;
  version: number;
}

export interface RuntimePollTallyV1 {
  ballotSetSha256: string;
  resultSha256: string;
  method: "builtin_count";
  methodVersion: string;
  counts: Record<string, number>;
  electorateSize: number;
  participationCount: number;
  quorumMet: boolean;
  winningOptionIds: string[];
  tied: boolean;
  vetoExercised: boolean;
  passed: boolean;
  computedAt: string;
}

export interface CertificationV1 {
  contractId: typeof CERTIFICATION_CONTRACT_ID;
  id: string;
  resultSha256: string;
  methodVersion: string;
  certifiedAt: string;
  correctsCertificationId: string | null;
  reason: string | null;
}

export interface RuntimePollV1 {
  id: string;
  definitionId: string;
  definitionRevision: number;
  question: string;
  options: Array<{ id: string; label: string }>;
  pollType: "single_choice" | "multiple_choice" | "yes_no_abstain" | "opinion";
  minSelections: number | null;
  maxSelections: number | null;
  secrecy: "open" | "secret_ballot" | "anonymous_survey";
  status: "open" | "closed" | "tallied" | "certified" | "voided" | "correction_issued";
  version: number;
  governingReleaseId: string;
  deadlineAt: string | null;
  eligible: boolean;
  hasVoted: boolean;
  ballotCapability: string | null;
  receipt: { commandId: string; acceptedAt: string; ballotRevision: number } | null;
  canManage: boolean;
  canCertify: boolean;
  tally: RuntimePollTallyV1 | null;
  certification: CertificationV1 | null;
}

export type VoiceChannelModeV1 = "radio_ptt" | "open_room" | "private_call" | "broadcast";
export type MediaPermissionV1 = "listen" | "transmit" | "moderate";

export interface MediaCredentialV1 {
  contractId: typeof MEDIA_CREDENTIAL_CONTRACT_ID;
  providerAdapterId: string;
  providerAdapterVersion: string;
  providerAdapterDigest: string;
  serverUrl: string;
  room: string;
  participantIdentity: string;
  token: string;
  permissions: MediaPermissionV1[];
  expiresAt: string;
}

export interface FloorLeaseV1 {
  contractId: typeof FLOOR_LEASE_CONTRACT_ID;
  requestId: string;
  channelId: string;
  status: "granted" | "queued" | "released" | "expired" | "preempted";
  floorToken: string | null;
  expiresAt: string | null;
  queuePosition: number | null;
}

export interface RuntimeVoiceChannelV1 {
  id: string;
  definitionId: string;
  name: string;
  mode: VoiceChannelModeV1;
  status: "open" | "degraded" | "unavailable";
  joined: boolean;
  canListen: boolean;
  canTransmit: boolean;
  canModerate: boolean;
  microphoneState: "unavailable" | "muted" | "ready" | "transmitting";
  floorHeldByMe: boolean;
  floorExpiresAt: string | null;
  version: number;
  governingReleaseId: string;
  consent: VoiceConsentStateV1;
}

export interface VoiceConsentStateV1 {
  contractId: typeof VOICE_CONSENT_CONTRACT_ID;
  channelId: string;
  recording: {
    policy: "off" | "on" | "with_consent";
    active: boolean;
    mine: "given" | "withdrawn" | "not_given";
  };
  transcription: {
    policy: "off" | "with_consent";
    active: boolean;
    mine: "given" | "withdrawn" | "not_given";
  };
}

export interface VoiceCommandReceiptV1 extends CommandReceiptV1 {
  contractId: typeof VOICE_COMMAND_CONTRACT_ID;
  mediaCredential: MediaCredentialV1 | null;
}

export interface RuntimeTimelineV1 {
  entries: Array<{ id: string; sequence: number; occurredAt: string; category: "artifact" | "message" | "stage" | "inject";
    title: string; activity: string; aggregateId: string; version: number | null }>;
  nextBefore: number | null;
}

export interface RuntimeProjectionV1 {
  contractId: typeof RUNTIME_PROJECTION_CONTRACT_ID;
  sessionId: string;
  sessionStatus: string;
  releaseId: string;
  releaseLabel: string;
  simulationTitle?: string;
  sessionTitle?: string;
  participantId: string;
  activeSessionRoleId: string;
  activeSessionRoleLabel: string;
  authorityEpoch: number;
  activeTeamId: string | null;
  activeTeamLabel: string | null;
  currentStageId: string | null;
  currentStageLabel: string | null;
  currentStageStatus: "not_started" | "active" | "paused" | "completed";
  stageStartedAt: string | null;
  stageDeadlineAt: string | null;
  stageRemainingSeconds: number | null;
  interfaceProfileId: string;
  layout: "single_column" | "main_with_sidebar" | "dashboard_grid" | "workspace_tabs";
  navigation: RuntimeNavigationV1;
  regions?: RuntimeRegionV1[];
  roleContexts: ParticipantRoleContextV1[];
  modules: RuntimeModuleV1[];
  resources: RuntimeResourceV1[];
  createTasks: RuntimeCreateTaskV1[];
  artifacts: RuntimeArtifactV1[];
  messages: RuntimeMessageV1[];
  injects: RuntimeInjectV1[];
  polls: RuntimePollV1[];
  voiceChannels: RuntimeVoiceChannelV1[];
  timeline?: RuntimeTimelineV1;
}

export interface OperatorProjectionV1 {
  contractId: typeof OPERATOR_PROJECTION_CONTRACT_ID;
  sessionId: string;
  sessionTitle: string;
  sessionStatus: string;
  releaseId: string;
  releaseLabel: string;
  sessionVersion: number;
  authority: { epoch: number; status: string };
  participantCount: number;
  connectedParticipantCount: number;
  occupiedSeatCount: number;
  totalSeatCount: number;
  stage: null | {
    id: string;
    label: string;
    status: "not_started" | "active" | "paused" | "completed";
    version: number;
    durationSeconds: number | null;
    elapsedSeconds: number;
    remainingSeconds: number | null;
    extensionSeconds: number;
    transitions: Array<{ targetStageId: string; label: string }>;
    controls: { allowStart: boolean; allowEnd: boolean; allowReopen: boolean; allowExtend: boolean; allowSkip: boolean; allowReturnToPrevious: boolean };
  };
  artifactsByState: Record<string, number>;
  activeTasks: Array<{ artifactId: string; artifactTypeKey: string; state: string; version: number }>;
  requiredSubmissions: Array<{ id: string; label: string; complete: boolean }>;
  injectQueue: Array<{ id: string | null; definitionId: string; title: string; state: string; version: number; scheduledAt: string | null; releaseMode: string }>;
  adjudicationQueue: Array<{ id: string; status: string; version: number; createdAt: string }>;
  warnings: string[];
  recentEvents: Array<{ sequence: number; type: string; recordedAt: string; aggregateId: string | null }>;
  deliveryHealth: {
    pending: number;
    deadLettered: number;
    deadLetters: Array<{ outboxId: string; eventId: string; eventType: string; attempts: number; createdAt: string }>;
  };
}

export interface ReadinessProjectionV1 {
  contractId: typeof READINESS_CONTRACT_ID;
  sessionId: string;
  governingReleaseId: string;
  assignmentVersion: number;
  ready: boolean;
  checks: Array<{ key: string; label: string; blocking: boolean; complete: boolean }>;
  staffing: {
    people?: Array<{ personId: string; displayName: string }>;
    peopleTruncated?: boolean;
    sessionRoles?: Array<{ id: string; name: string }>;
    seats: Array<{ seatId: string; label?: string; sessionRoleIds: string[]; teamId: string | null; minimum: number; maximum: number | null; occupied: number }>;
    joinRequests: Array<{ personId: string; requestedSeatId: string | null; status: string; submittedAt: string }>;
    rosterReview: Array<{ rowId: string; rowNumber: number; personId: string | null; seatId: string | null; reasons: string[] }>;
    assignments: Array<{ seatAssignmentId: string; participantId: string; personId: string; seatId: string; sessionRoleId: string; teamId: string | null; accessRevision: number }>;
  };
}

export type EffectProposalStatus = "staged" | "in_review" | "applied" | "rejected" | "returned" | "stale" | "failed";

export interface ModelRunV1 {
  contractId: typeof MODEL_RUN_CONTRACT_ID;
  id: string;
  compositionRunId: string;
  sessionId: string;
  governingReleaseId: string;
  pluginDigest: string;
  configurationDigest: string;
  inputSnapshotId: string;
  inputDigest: string;
  outputDigest: string | null;
  environmentDigest: string | null;
  seed: number;
  status: "pending" | "running" | "completed" | "failed";
  failureCode: "timeout" | "output_invalid" | "execution_failed" | null;
}

/** Deployment configuration only; never grants permission to start a Model Run. */
export interface ModelRunCapabilityV1 {
  status: "unavailable" | "configured";
  reason: "executor_not_configured" | "plans_not_configured" | "executor_unavailable" | null;
  message: string;
}

export interface EffectProposalV1 {
  contractId: typeof EFFECT_PROPOSAL_CONTRACT_ID;
  id: string;
  modelRunId: string;
  proposalHash: string;
  targetAggregateId: string;
  targetStateVariableId: string;
  scopeReference: string;
  operation: "set" | "adjust";
  value: JsonValue;
  rationale: string;
  status: EffectProposalStatus;
  expectedStateVersion: number;
  governingReleaseId: string;
  authorityEpoch: number;
  pluginDigest: string;
  configurationDigest: string;
  inputDigest: string;
  outputDigest: string;
  version: number;
}

export interface StateTransactionV1 {
  contractId: typeof STATE_TRANSACTION_CONTRACT_ID;
  id: string;
  sessionId: string;
  governingReleaseId: string;
  targetKind: "state_value" | "capability" | "resource";
  targetId: string;
  definitionId: string;
  scopeReference: string;
  operation: "set" | "increment" | "decrement" | "multiply" | "transition" | "consume" | "renew" | "credit" | "debit";
  previousValue: JsonValue;
  newValue: JsonValue;
  sourceType: "inject" | "stage" | "workflow" | "outcome" | "plugin" | "control_intervention";
  sourceReference: string;
  sourceCommandId: string;
  actorPersonId: string;
  rationale: string;
  occurredAt: string;
  version: number;
}

export interface ApprovalDecisionV1 {
  contractId: typeof APPROVAL_DECISION_CONTRACT_ID;
  id: string;
  proposalId: string;
  proposalHash: string;
  reviewerPersonId: string;
  reviewerSessionRoleId: string;
  decision: "approve" | "reject" | "return";
  reason: string;
  governingReleaseId: string;
  authorityEpoch: number;
  expectedStateVersion: number;
  commandId: string;
  decidedAt: string;
}

export type AdjudicationMechanismV1 = "manual" | "rubric" | "rules" | "plugin" | "hybrid";

export interface AdjudicationTraceEntryV1 extends JsonObject {
  source: "manual" | "rubric" | "rule" | "plugin" | "review";
  referenceId: string;
  passed: boolean | null;
  explanation: string;
  details: JsonValue;
}

/** Request choices scoped to the active reviewer and visible decision artifacts. */
export interface AdjudicationOptionV1 {
  modelId: string;
  modelName: string;
  actions: Array<{ id: string; label: string }>;
}

export interface AdjudicationReviewV1 {
  id: string;
  perspectiveId: string;
  recommendation: JsonValue;
  rationale: string;
  evidenceArtifactIds: string[];
  hiddenAnalyticalNotes?: string;
  confidence: number;
  reviewerPersonId: string;
  reviewerSessionRoleId: string;
  reviewerDisplayName: string;
  reviewerOrganizationName: string;
  submittedAt: string;
}

export interface AdjudicationRecordV1 {
  contractId: typeof ADJUDICATION_RECORD_CONTRACT_ID;
  id: string;
  requestId: string;
  status: "draft" | "published";
  mechanism: AdjudicationMechanismV1;
  outcome: JsonValue;
  rationale: string;
  participantRationale: string;
  confidence: number;
  synthesis: string;
  explanationTrace: AdjudicationTraceEntryV1[];
  suggestion: JsonValue | null;
  overrideRationale: string | null;
  effects: JsonValue[];
  publicationScope: JsonObject;
  leadDisplayName: string;
  leadOrganizationName: string;
  version: number;
  publishedAt: string | null;
}

export interface AdjudicationRequestV1 {
  contractId: typeof ADJUDICATION_REQUEST_CONTRACT_ID;
  id: string;
  modelId: string;
  modelName: string;
  mechanism: AdjudicationMechanismV1;
  status: "requested" | "in_progress" | "drafted" | "published" | "cancelled" | "failed";
  version: number;
  actionSnapshots: Array<{ artifactId: string; artifactVersion: number; artifactTypeKey: string; payload: JsonObject }>;
  perspectives: Array<{ id: string; label: string; reviewerSessionRoleIds: string[] }>;
  reviews: AdjudicationReviewV1[];
  record: AdjudicationRecordV1 | null;
  canReview: boolean;
  canSynthesize: boolean;
  /** Authored scoring guidance is projected only to an authorized lead reviewer. */
  rubric?: Array<{ id: string; label: string; weight: number; minimum: number; maximum: number;
    anchors?: Array<{ score: number; label: string }> }>;
}

const uuidProperty = { type: "string", format: "uuid" } as const;
const utcInstantProperty = { type: "string", format: "date-time" } as const;
const jsonObjectProperty = { type: "object" } as const;

export const checkpointV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: CHECKPOINT_CONTRACT_ID, title: "Evidence Checkpoint v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "checkpointId", "sessionId", "firstSequence", "lastSequence", "previousCheckpointDigest",
    "batchMerkleRoot", "canonicalization", "algorithm", "checkpointDigest", "createdAt"],
  properties: {
    contractId: { const: CHECKPOINT_CONTRACT_ID }, checkpointId: uuidProperty, sessionId: uuidProperty,
    firstSequence: { type: "integer", minimum: 1 }, lastSequence: { type: "integer", minimum: 1 },
    previousCheckpointDigest: { type: ["string", "null"], pattern: "^[0-9a-f]{64}$" },
    batchMerkleRoot: { type: "string", pattern: "^[0-9a-f]{64}$" },
    canonicalization: { const: "plenum-evidence-v1" }, algorithm: { const: "sha256" },
    checkpointDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, createdAt: utcInstantProperty
  }
} as const satisfies ContractSchema<EvidenceCheckpointV1>;

export const verificationExportV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: VERIFICATION_EXPORT_CONTRACT_ID, title: "Evidence Verification Export v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "sessionId", "generatedAt", "lastEvidenceSequence", "checkpoints"],
  properties: {
    contractId: { const: VERIFICATION_EXPORT_CONTRACT_ID }, sessionId: uuidProperty, generatedAt: utcInstantProperty,
    lastEvidenceSequence: { type: "integer", minimum: 0 }, checkpoints: { type: "array", items: { type: "object" } }
  }
} as const satisfies ContractSchema<VerificationExportV1>;

export const reportDefinitionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: REPORT_DEFINITION_CONTRACT_ID, title: "Report Definition v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "definitionKey", "definitionVersion", "reportKind", "includedDataClasses", "excludedDataClasses", "analyticalLayers"],
  properties: {
    contractId: { const: REPORT_DEFINITION_CONTRACT_ID }, definitionKey: { type: "string", minLength: 1 },
    definitionVersion: { type: "integer", minimum: 1 },
    reportKind: { enum: ["session_archive", "after_action", "team", "control", "research_dataset", "organization_archive"] },
    includedDataClasses: { type: "array", items: { type: "string" } },
    excludedDataClasses: { type: "array", items: { type: "string" } },
    analyticalLayers: { type: "array", items: { enum: ["observation", "derived_metric", "analytical_note", "finding"] } }
  }
} as const satisfies ContractSchema<ReportDefinitionV1>;

export const researchExportV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: RESEARCH_EXPORT_CONTRACT_ID, title: "Research Export v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "exportId", "projectId", "sessionIds", "releaseIds", "generatedAt", "exportDefinitionVersion",
    "anonymizationProfile", "purposeLabel", "includedDataClasses", "excludedDataClasses", "reproducibilityManifests",
    "observations", "derivedMetrics", "analyticalNotes", "findings", "provenance"],
  properties: {
    contractId: { const: RESEARCH_EXPORT_CONTRACT_ID }, exportId: uuidProperty, projectId: uuidProperty,
    sessionIds: { type: "array", items: uuidProperty }, releaseIds: { type: "array", items: uuidProperty },
    generatedAt: utcInstantProperty, exportDefinitionVersion: { type: "integer", minimum: 1 },
    anonymizationProfile: { type: "string", minLength: 1 }, purposeLabel: { type: "string", minLength: 1 },
    includedDataClasses: { type: "array", items: { type: "string" } }, excludedDataClasses: { type: "array", items: { type: "string" } },
    reproducibilityManifests: { type: "array", items: jsonObjectProperty }, observations: { type: "array", items: jsonObjectProperty },
    derivedMetrics: { type: "array", items: jsonObjectProperty }, analyticalNotes: { type: "array", items: jsonObjectProperty },
    findings: { type: "array", items: jsonObjectProperty }, provenance: jsonObjectProperty
  }
} as const satisfies ContractSchema<ResearchExportV1>;

export const replayDivergenceV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: REPLAY_DIVERGENCE_CONTRACT_ID, title: "Replay Divergence v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "sessionId", "generatedAt", "manifestDigest", "matched", "comparedEvents", "divergences"],
  properties: {
    contractId: { const: REPLAY_DIVERGENCE_CONTRACT_ID }, sessionId: uuidProperty, generatedAt: utcInstantProperty,
    manifestDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, matched: { type: "boolean" },
    comparedEvents: { type: "integer", minimum: 0 }, divergences: { type: "array", items: jsonObjectProperty }
  }
} as const satisfies ContractSchema<ReplayDivergenceV1>;

export const modelRunV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: MODEL_RUN_CONTRACT_ID, title: "Model Run v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "compositionRunId", "sessionId", "governingReleaseId", "pluginDigest", "configurationDigest", "inputSnapshotId", "inputDigest", "outputDigest", "environmentDigest", "seed", "status", "failureCode"],
  properties: {
    contractId: { const: MODEL_RUN_CONTRACT_ID }, id: uuidProperty, compositionRunId: uuidProperty, sessionId: uuidProperty,
    governingReleaseId: uuidProperty, pluginDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    configurationDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, inputSnapshotId: uuidProperty,
    inputDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, outputDigest: { type: ["string", "null"], pattern: "^sha256:[0-9a-f]{64}$" },
    environmentDigest: { type: ["string", "null"], pattern: "^sha256:[0-9a-f]{64}$" }, seed: { type: "integer", minimum: 0 },
    status: { enum: ["pending", "running", "completed", "failed"] }, failureCode: { enum: ["timeout", "output_invalid", "execution_failed", null] }
  }
} as const satisfies ContractSchema<ModelRunV1>;

export const effectProposalV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: EFFECT_PROPOSAL_CONTRACT_ID, title: "Effect Proposal v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "modelRunId", "proposalHash", "targetAggregateId", "targetStateVariableId", "scopeReference", "operation", "value", "rationale", "status", "expectedStateVersion", "governingReleaseId", "authorityEpoch", "pluginDigest", "configurationDigest", "inputDigest", "outputDigest", "version"],
  properties: {
    contractId: { const: EFFECT_PROPOSAL_CONTRACT_ID }, id: uuidProperty, modelRunId: uuidProperty,
    proposalHash: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, targetAggregateId: uuidProperty,
    targetStateVariableId: { type: "string", minLength: 1 }, scopeReference: { type: "string" }, operation: { enum: ["set", "adjust"] },
    value: {}, rationale: { type: "string", minLength: 1 }, status: { enum: ["staged", "in_review", "applied", "rejected", "returned", "stale", "failed"] },
    expectedStateVersion: { type: "integer", minimum: 0 }, governingReleaseId: uuidProperty, authorityEpoch: { type: "integer", minimum: 1 },
    pluginDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, configurationDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    inputDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, outputDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, version: { type: "integer", minimum: 1 }
  }
} as const satisfies ContractSchema<EffectProposalV1>;

export const stateTransactionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: STATE_TRANSACTION_CONTRACT_ID, title: "State Transaction v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "sessionId", "governingReleaseId", "targetKind", "targetId", "definitionId", "scopeReference",
    "operation", "previousValue", "newValue", "sourceType", "sourceReference", "sourceCommandId", "actorPersonId", "rationale", "occurredAt", "version"],
  properties: {
    contractId: { const: STATE_TRANSACTION_CONTRACT_ID }, id: uuidProperty, sessionId: uuidProperty, governingReleaseId: uuidProperty,
    targetKind: { enum: ["state_value", "capability", "resource"] }, targetId: uuidProperty,
    definitionId: { type: "string", minLength: 1 }, scopeReference: { type: "string" },
    operation: { enum: ["set", "increment", "decrement", "multiply", "transition", "consume", "renew", "credit", "debit"] },
    previousValue: {}, newValue: {}, sourceType: { enum: ["inject", "stage", "workflow", "outcome", "plugin", "control_intervention"] },
    sourceReference: { type: "string", minLength: 1 }, sourceCommandId: uuidProperty, actorPersonId: uuidProperty,
    rationale: { type: "string", minLength: 1 }, occurredAt: utcInstantProperty, version: { type: "integer", minimum: 1 }
  }
} as const satisfies ContractSchema<StateTransactionV1>;

export const approvalDecisionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: APPROVAL_DECISION_CONTRACT_ID, title: "Approval Decision v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "proposalId", "proposalHash", "reviewerPersonId", "reviewerSessionRoleId", "decision", "reason", "governingReleaseId", "authorityEpoch", "expectedStateVersion", "commandId", "decidedAt"],
  properties: {
    contractId: { const: APPROVAL_DECISION_CONTRACT_ID }, id: uuidProperty, proposalId: uuidProperty,
    proposalHash: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, reviewerPersonId: uuidProperty,
    reviewerSessionRoleId: { type: "string", minLength: 1 }, decision: { enum: ["approve", "reject", "return"] }, reason: { type: "string", minLength: 1 },
    governingReleaseId: uuidProperty, authorityEpoch: { type: "integer", minimum: 1 }, expectedStateVersion: { type: "integer", minimum: 0 },
    commandId: uuidProperty, decidedAt: utcInstantProperty
  }
} as const satisfies ContractSchema<ApprovalDecisionV1>;

export const certificationV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: CERTIFICATION_CONTRACT_ID, title: "Certification v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "resultSha256", "methodVersion", "certifiedAt", "correctsCertificationId", "reason"],
  properties: {
    contractId: { const: CERTIFICATION_CONTRACT_ID },
    id: uuidProperty,
    resultSha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    methodVersion: { type: "string", minLength: 1 },
    certifiedAt: utcInstantProperty,
    correctsCertificationId: { type: ["string", "null"], format: "uuid" },
    reason: { type: ["string", "null"] }
  }
} as const satisfies ContractSchema<CertificationV1>;

export type ArtifactCommandV1 = CommandEnvelopeV1;
export type StageCommandV1 = CommandEnvelopeV1;
export type InjectCommandV1 = CommandEnvelopeV1;
export type MessageCommandV1 = CommandEnvelopeV1;
export type PollCommandV1 = CommandEnvelopeV1;
export type BallotCommandV1 = CommandEnvelopeV1;

export const canonicalErrorCodes = [
  "UNAUTHENTICATED",
  "AUTH_EXPIRED",
  "INVALID_ID",
  "INVALID_JSON",
  "INVALID_COMMAND",
  "VALIDATION_FAILED",
  "PERMISSION_DENIED",
  "RESULT_NOT_RELEASED",
  "CONSENT_REQUIRED",
  "PLUGIN_NOT_APPROVED",
  "ACCESS_REVOKED",
  "NOT_A_PARTICIPANT",
  "DEVICE_NOT_REGISTERED",
  "NOT_FOUND",
  "TARGET_NOT_FOUND",
  "TARGET_EXISTS",
  "INVALID_TRANSITION",
  "ALREADY_VOTED",
  "DEADLINE_EXPIRED",
  "FLOOR_BUSY",
  "FLOOR_TOKEN_EXPIRED",
  "STALE_PROPOSAL",
  "CAPABILITY_UNAVAILABLE",
  "SESSION_NOT_ACTIVE",
  "STALE_AGGREGATE_VERSION",
  "INCOMPATIBLE_RELEASE",
  "VERSION_CONFLICT",
  "ALREADY_PUBLISHED",
  "IDEMPOTENCY_COLLISION",
  "CONFLICT",
  "REFERENCE_INVALID",
  "SYNC_CURSOR_EXPIRED",
  "TOO_LARGE",
  "RATE_LIMITED",
  "AUTHORITY_UNAVAILABLE",
  "TRANSIENT_DEPENDENCY",
  "PLUGIN_UNAVAILABLE",
  "MEDIA_UNAVAILABLE",
  "INTERNAL",
  "NETWORK_UNAVAILABLE"
] as const;

export type CanonicalErrorCode = (typeof canonicalErrorCodes)[number];

export interface ErrorDetailV1 {
  code: CanonicalErrorCode;
  message: string;
  details: JsonValue;
  correlationId: string;
}

export interface ErrorEnvelopeV1 {
  error: ErrorDetailV1;
}

export const commandEnvelopeV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: COMMAND_ENVELOPE_CONTRACT_ID,
  title: "Command Envelope v1",
  type: "object",
  additionalProperties: false,
  required: [
    "commandId",
    "deviceId",
    "operationType",
    "aggregateId",
    "expectedAggregateVersion",
    "governingReleaseId",
    "payload"
  ],
  properties: {
    commandId: uuidProperty,
    deviceId: uuidProperty,
    operationType: { type: "string", pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
    aggregateId: uuidProperty,
    expectedAggregateVersion: { type: "integer", minimum: 0 },
    governingReleaseId: uuidProperty,
    activeSessionRoleId: { type: "string", minLength: 1 },
    deviceObservedAt: utcInstantProperty,
    payload: jsonObjectProperty
  }
} as const satisfies ContractSchema<CommandEnvelopeV1>;

export const artifactCommandV1Schema = {
  ...commandEnvelopeV1Schema,
  $id: ARTIFACT_COMMAND_CONTRACT_ID,
  title: "Artifact Command v1",
  properties: {
    ...commandEnvelopeV1Schema.properties,
    operationType: { type: "string", pattern: "^artifact\\.[a-z][a-z0-9_]*$" },
    payload: { type: "object", properties: { content: { type: "object",
      description: "The single record payload. For a decision-bearing type this is exactly one Action; repeating fields are supporting data." } } }
  }
} as const satisfies ContractSchema<ArtifactCommandV1>;

function commandSchema(contractId: string, title: string, namespace: string) {
  return {
    ...commandEnvelopeV1Schema,
    $id: contractId,
    title,
    properties: {
      ...commandEnvelopeV1Schema.properties,
      operationType: { type: "string", pattern: `^${namespace}\\.[a-z][a-z0-9_]*$` }
    }
  } as const;
}

export const stageCommandV1Schema = commandSchema(STAGE_COMMAND_CONTRACT_ID, "Stage Command v1", "stage");
export const injectCommandV1Schema = commandSchema(INJECT_COMMAND_CONTRACT_ID, "Inject Command v1", "inject");
export const messageCommandV1Schema = commandSchema(MESSAGE_COMMAND_CONTRACT_ID, "Message Command v1", "message");
export const pollCommandV1Schema = commandSchema(POLL_COMMAND_CONTRACT_ID, "Poll Command v1", "poll");
export const ballotCommandV1Schema = commandSchema(BALLOT_COMMAND_CONTRACT_ID, "Ballot Command v1", "ballot");
export const voiceCommandV1Schema = {
  ...commandEnvelopeV1Schema,
  $id: VOICE_COMMAND_CONTRACT_ID,
  title: "Voice Command v1",
  properties: {
    ...commandEnvelopeV1Schema.properties,
    operationType: { type: "string", pattern: "^voice_(?:channel|recording|transcription|consent)\\.[a-z][a-z0-9_]*$" }
  }
} as const satisfies ContractSchema<CommandEnvelopeV1>;

export const mediaCredentialV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: MEDIA_CREDENTIAL_CONTRACT_ID, title: "Media Credential v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "providerAdapterId", "providerAdapterVersion", "providerAdapterDigest", "serverUrl", "room", "participantIdentity", "token", "permissions", "expiresAt"],
  properties: {
    contractId: { const: MEDIA_CREDENTIAL_CONTRACT_ID }, providerAdapterId: { type: "string", minLength: 1 },
    providerAdapterVersion: { type: "string", minLength: 1 }, providerAdapterDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    serverUrl: { type: "string", pattern: "^wss?://" }, room: { type: "string", minLength: 1 },
    participantIdentity: { type: "string", minLength: 1 }, token: { type: "string", minLength: 1 },
    permissions: { type: "array", uniqueItems: true, items: { enum: ["listen", "transmit", "moderate"] } },
    expiresAt: utcInstantProperty
  }
} as const satisfies ContractSchema<MediaCredentialV1>;

export const floorLeaseV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: FLOOR_LEASE_CONTRACT_ID, title: "Floor Lease v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "requestId", "channelId", "status", "floorToken", "expiresAt", "queuePosition"],
  properties: {
    contractId: { const: FLOOR_LEASE_CONTRACT_ID }, requestId: uuidProperty, channelId: uuidProperty,
    status: { enum: ["granted", "queued", "released", "expired", "preempted"] },
    floorToken: { type: ["string", "null"] }, expiresAt: { type: ["string", "null"], format: "date-time" },
    queuePosition: { type: ["integer", "null"], minimum: 1 }
  }
} as const satisfies ContractSchema<FloorLeaseV1>;

export const voiceConsentV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: VOICE_CONSENT_CONTRACT_ID, title: "Voice consent state v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "channelId", "recording", "transcription"],
  properties: {
    contractId: { const: VOICE_CONSENT_CONTRACT_ID }, channelId: uuidProperty,
    recording: { type: "object", additionalProperties: false, required: ["policy", "active", "mine"], properties: {
      policy: { enum: ["off", "on", "with_consent"] }, active: { type: "boolean" }, mine: { enum: ["given", "withdrawn", "not_given"] }
    } },
    transcription: { type: "object", additionalProperties: false, required: ["policy", "active", "mine"], properties: {
      policy: { enum: ["off", "with_consent"] }, active: { type: "boolean" }, mine: { enum: ["given", "withdrawn", "not_given"] }
    } }
  }
} as const satisfies ContractSchema<VoiceConsentStateV1>;

export const studioCrdtV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: STUDIO_CRDT_CONTRACT_ID, title: "Studio CRDT envelope v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "type", "documentId", "generation", "updateId", "update", "stateVector", "saveState", "unsynchronizedChanges", "validation", "message"],
  properties: {
    contractId: { const: STUDIO_CRDT_CONTRACT_ID },
    type: { enum: ["sync", "update", "ack", "remote_update", "error"] },
    documentId: uuidProperty,
    generation: { type: "integer", minimum: 1 },
    updateId: { type: ["string", "null"], format: "uuid" },
    update: { type: ["string", "null"], contentEncoding: "base64" },
    stateVector: { type: ["string", "null"], contentEncoding: "base64" },
    saveState: { type: ["string", "null"], enum: ["saved_on_device", "synchronized", "validation_required", "published", null] },
    unsynchronizedChanges: { type: "integer", minimum: 0 },
    validation: { type: ["object", "null"] },
    message: { type: ["string", "null"] }
  }
} as const satisfies ContractSchema<StudioCrdtV1>;

export const studioPublishV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: STUDIO_PUBLISH_CONTRACT_ID, title: "Studio publish result v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "freezeId", "releaseId", "definitionRevisionId", "contentDigest", "manifestDigest", "packageDigest", "saveState"],
  properties: {
    contractId: { const: STUDIO_PUBLISH_CONTRACT_ID }, freezeId: uuidProperty, releaseId: uuidProperty,
    definitionRevisionId: uuidProperty, contentDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    manifestDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, packageDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    saveState: { const: "published" }
  }
} as const satisfies ContractSchema<StudioPublishV1>;

export const studioRehearsalV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: STUDIO_REHEARSAL_CONTRACT_ID, title: "Studio rehearsal result v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "projectId", "artifactDigest", "seed", "startedAt", "finalStageIds", "trace"],
  properties: {
    contractId: { const: STUDIO_REHEARSAL_CONTRACT_ID }, projectId: uuidProperty,
    artifactDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, seed: { type: "integer", minimum: 0 },
    startedAt: { type: "string", format: "date-time" }, finalStageIds: { type: "array", items: { type: "string" } },
    trace: { type: "array", items: { type: "object" } }
  }
} as const satisfies ContractSchema<StudioRehearsalV1>;

export const publicationReviewV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: PUBLICATION_REVIEW_CONTRACT_ID, title: "Publication review workspace v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "projectId", "freeze", "approvals", "permissions", "liveChangeOptions"],
  properties: {
    contractId: { const: PUBLICATION_REVIEW_CONTRACT_ID }, projectId: uuidProperty,
    freeze: { type: ["object", "null"] }, approvals: { type: "array", items: { type: "object" } }, permissions: { type: "object" },
    liveChangeOptions: { type: "object" }
  }
} as const satisfies ContractSchema<PublicationReviewV1>;

export const rolePreviewV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: ROLE_PREVIEW_CONTRACT_ID, title: "Studio role preview v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "projectId", "sessionRoleId", "sessionRoleLabel", "stageId", "stageLabel", "teamId", "teamLabel", "interfaceProfileId", "layout", "modules", "content"],
  properties: {
    contractId: { const: ROLE_PREVIEW_CONTRACT_ID }, projectId: uuidProperty,
    sessionRoleId: { type: "string", minLength: 1 }, sessionRoleLabel: { type: "string", minLength: 1 },
    stageId: { type: "string", minLength: 1 }, stageLabel: { type: "string", minLength: 1 },
    teamId: { type: ["string", "null"] }, teamLabel: { type: ["string", "null"] },
    interfaceProfileId: { type: "string", minLength: 1 },
    layout: { type: "string", enum: ["single_column", "main_with_sidebar", "dashboard_grid", "workspace_tabs"] },
    modules: { type: "array", items: { type: "object" } },
    content: { type: "array", items: { type: "object" } }
  }
} as const satisfies ContractSchema<RolePreviewV1>;

export const projectDemoV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: PROJECT_DEMO_CONTRACT_ID, title: "Isolated Project QA demo v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "projectId", "projectTitle", "demoSessionId", "demoMode", "materialization", "validation"],
  properties: {
    contractId: { const: PROJECT_DEMO_CONTRACT_ID }, projectId: uuidProperty,
    projectTitle: { type: "string", minLength: 1 }, demoSessionId: uuidProperty, demoMode: { const: true },
    materialization: { type: "object" }, validation: { type: "object" }
  }
} as const satisfies ContractSchema<ProjectDemoV1>;

export const compatibilityReportV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: COMPATIBILITY_REPORT_CONTRACT_ID,
  title: "Release Compatibility Report v1",
  type: "object",
  additionalProperties: false,
  required: ["contractId", "fromReleaseId", "toReleaseId", "classification", "changes", "blockedReasons", "requiresImpactReview", "existingInstanceHandling"],
  properties: {
    contractId: { const: COMPATIBILITY_REPORT_CONTRACT_ID },
    fromReleaseId: uuidProperty,
    toReleaseId: uuidProperty,
    classification: { enum: ["safe_prospective", "compatibility_dependent", "consequential"] },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "kind", "classification", "summary"],
        properties: {
          path: { type: "string", minLength: 1 },
          kind: { enum: ["added", "changed", "removed"] },
          classification: { enum: ["safe_prospective", "compatibility_dependent", "consequential"] },
          summary: { type: "string", minLength: 1 }
        }
      }
    },
    blockedReasons: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    requiresImpactReview: { type: "boolean" },
    existingInstanceHandling: { const: "keep_existing" }
  }
} as const satisfies ContractSchema<CompatibilityReportV1>;

export const releaseActivationV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RELEASE_ACTIVATION_CONTRACT_ID,
  title: "Release Activation v1",
  type: "object",
  additionalProperties: false,
  required: ["contractId", "activationId", "sessionId", "fromReleaseId", "toReleaseId", "activationSequence", "impactReviewId", "compatibilityReportDigest", "classification", "existingInstanceHandling", "activatedBy", "activatedAt"],
  properties: {
    contractId: { const: RELEASE_ACTIVATION_CONTRACT_ID },
    activationId: uuidProperty,
    sessionId: uuidProperty,
    fromReleaseId: uuidProperty,
    toReleaseId: uuidProperty,
    activationSequence: { type: "integer", minimum: 2 },
    impactReviewId: uuidProperty,
    compatibilityReportDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    classification: { enum: ["safe_prospective", "compatibility_dependent", "consequential"] },
    existingInstanceHandling: { const: "keep_existing" },
    activatedBy: uuidProperty,
    activatedAt: utcInstantProperty
  }
} as const satisfies ContractSchema<ReleaseActivationV1>;

export const eventEnvelopeV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: EVENT_ENVELOPE_CONTRACT_ID,
  title: "Event Envelope v1",
  type: "object",
  additionalProperties: false,
  required: [
    "eventId",
    "eventType",
    "eventVersion",
    "producer",
    "correlationId",
    "causationId",
    "sessionId",
    "governingReleaseId",
    "aggregateId",
    "aggregateVersion",
    "evidenceSequence",
    "occurredAt",
    "payload"
  ],
  properties: {
    eventId: uuidProperty,
    eventType: { type: "string", pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
    eventVersion: { const: EVENT_ENVELOPE_VERSION },
    producer: { type: "string", minLength: 1 },
    correlationId: uuidProperty,
    causationId: uuidProperty,
    sessionId: uuidProperty,
    governingReleaseId: uuidProperty,
    aggregateId: uuidProperty,
    aggregateVersion: { type: "integer", minimum: 1 },
    evidenceSequence: { type: "integer", minimum: 1 },
    occurredAt: utcInstantProperty,
    payload: jsonObjectProperty
  }
} as const satisfies ContractSchema<EventEnvelopeV1>;

export const errorEnvelopeV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: ERROR_ENVELOPE_CONTRACT_ID,
  title: "Error Envelope v1",
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "details", "correlationId"],
      properties: {
        code: { type: "string", enum: canonicalErrorCodes },
        message: { type: "string", minLength: 1 },
        details: {},
        correlationId: uuidProperty
      }
    }
  }
} as const satisfies ContractSchema<ErrorEnvelopeV1>;

const organizationMemberV1Schema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "displayName", "roles"],
  properties: {
    id: uuidProperty,
    displayName: { type: "string", minLength: 1 },
    roles: { type: "array", items: { type: "string", minLength: 1 } }
  }
} as const;

const projectSummaryV1Schema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "lifecycleStatus", "version", "owner", "collaborators", "sourceTemplate",
    "releaseCount", "createdAt", "updatedAt", "editorUrl"],
  properties: {
    id: uuidProperty,
    title: { type: "string", minLength: 1, maxLength: 200 },
    lifecycleStatus: { type: "string", enum: ["active", "archived"] },
    version: { type: "integer", minimum: 1 },
    owner: {
      type: "object", additionalProperties: false, required: ["id", "displayName"],
      properties: { id: uuidProperty, displayName: { type: "string", minLength: 1 } }
    },
    collaborators: { type: "array", items: organizationMemberV1Schema },
    sourceTemplate: {
      oneOf: [
        { type: "null" },
        { type: "object", additionalProperties: false, required: ["id", "title"],
          properties: { id: uuidProperty, title: { type: "string", minLength: 1 } } }
      ]
    },
    releaseCount: { type: "integer", minimum: 0 },
    createdAt: utcInstantProperty,
    updatedAt: utcInstantProperty,
    editorUrl: { type: "string", pattern: "^/studio/projects/[0-9a-f-]{36}$" }
  }
} as const;

export const projectPortalV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: PROJECT_PORTAL_CONTRACT_ID,
  title: "Project portal v1",
  type: "object",
  additionalProperties: false,
  required: ["contractId", "organization", "availableOrganizations", "permissions", "projects", "nextCursor"],
  properties: {
    contractId: { const: PROJECT_PORTAL_CONTRACT_ID },
    organization: {
      type: "object", additionalProperties: false, required: ["id", "name"],
      properties: { id: uuidProperty, name: { type: "string", minLength: 1 } }
    },
    availableOrganizations: {
      type: "array", minItems: 1, maxItems: 1,
      items: { type: "object", additionalProperties: false, required: ["id", "name", "current"],
        properties: { id: uuidProperty, name: { type: "string", minLength: 1 }, current: { const: true } } }
    },
    permissions: {
      type: "object", additionalProperties: false,
      required: ["canCreateProject", "canManageProjects", "canViewMembers"],
      properties: { canCreateProject: { type: "boolean" }, canManageProjects: { type: "boolean" }, canViewMembers: { type: "boolean" } }
    },
    projects: { type: "array", items: projectSummaryV1Schema },
    nextCursor: { type: ["string", "null"] },
    members: { type: "array", items: organizationMemberV1Schema }
  }
} as const satisfies ContractSchema<ProjectPortalV1>;

export const templateLibraryV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: TEMPLATE_LIBRARY_CONTRACT_ID,
  title: "Template library v1",
  type: "object",
  additionalProperties: false,
  required: ["contractId", "templates", "nextCursor"],
  properties: {
    contractId: { const: TEMPLATE_LIBRARY_CONTRACT_ID },
    templates: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "summary", "includesOptionalScenario", "publishedAt", "version", "lifecycleStatus", "lifecycleHistory"],
        properties: { id: uuidProperty, title: { type: "string", minLength: 1, maxLength: 200 },
          summary: { type: "string", maxLength: 1000 }, includesOptionalScenario: { type: "boolean" },
          publishedAt: utcInstantProperty, version: { type: "integer", minimum: 1 },
          lifecycleStatus: { enum: ["published", "superseded", "deprecated", "archived"] },
          lifecycleHistory: { type: "array", items: { type: "object" } } }
      }
    },
    nextCursor: { type: ["string", "null"] }
  }
} as const satisfies ContractSchema<TemplateLibraryV1>;

const releaseSummaryV1Schema = {
  type: "object", additionalProperties: false,
  required: ["id", "project", "label", "releaseNumber", "packageSchemaVersion", "compilerVersion",
    "packageDigest", "publishedBy", "publishedAt", "approvalCount", "sessionCount", "immutable", "detailUrl", "packageUrl"],
  properties: {
    id: uuidProperty,
    project: { type: "object", additionalProperties: false, required: ["id", "title"], properties: {
      id: uuidProperty, title: { type: "string", minLength: 1, maxLength: 200 }
    } },
    label: { type: "string", minLength: 1, maxLength: 200 }, releaseNumber: { type: "integer", minimum: 1 },
    packageSchemaVersion: { type: "string", minLength: 1 }, compilerVersion: { type: "string", minLength: 1 },
    packageDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    publishedBy: { type: "object", additionalProperties: false, required: ["id", "displayName"], properties: {
      id: uuidProperty, displayName: { type: "string", minLength: 1 }
    } },
    publishedAt: utcInstantProperty, approvalCount: { type: "integer", minimum: 0 },
    sessionCount: { type: "integer", minimum: 0 }, immutable: { const: true },
    detailUrl: { type: "string", pattern: "^/releases/[0-9a-f-]{36}$" },
    packageUrl: { type: "string", pattern: "^/v1/releases/[0-9a-f-]{36}/package$" }
  }
} as const;

export const releaseCatalogV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: RELEASE_CATALOG_CONTRACT_ID,
  title: "Release catalog v1", type: "object", additionalProperties: false,
  required: ["contractId", "permissions", "releases", "nextCursor"],
  properties: {
    contractId: { const: RELEASE_CATALOG_CONTRACT_ID },
    permissions: { type: "object", additionalProperties: false,
      required: ["canExportPackage", "canImportPackage", "canCreateSession"], properties: {
        canExportPackage: { type: "boolean" }, canImportPackage: { type: "boolean" }, canCreateSession: { type: "boolean" }
      } },
    releases: { type: "array", items: releaseSummaryV1Schema }, nextCursor: { type: ["string", "null"] }
  }
} as const satisfies ContractSchema<ReleaseCatalogV1>;

const sessionStatusV1Schema = { type: "string", enum: ["created", "configured", "ready", "open", "active", "paused", "completed", "locked", "archived"] } as const;
const sessionSummaryV1Schema = {
  type: "object", additionalProperties: false,
  required: ["id", "title", "project", "governingRelease", "status", "version", "scheduledStartAt", "createdAt",
    "updatedAt", "participantCount", "readiness", "nextActions", "urls"],
  properties: {
    id: uuidProperty, title: { type: "string", minLength: 1, maxLength: 200 },
    project: { type: "object", additionalProperties: false, required: ["id", "title"], properties: {
      id: uuidProperty, title: { type: "string", minLength: 1, maxLength: 200 }
    } },
    governingRelease: { type: "object", additionalProperties: false, required: ["id", "label"], properties: {
      id: uuidProperty, label: { type: "string", minLength: 1, maxLength: 200 }
    } },
    status: sessionStatusV1Schema, version: { type: "integer", minimum: 1 },
    scheduledStartAt: { type: ["string", "null"], format: "date-time" }, createdAt: utcInstantProperty, updatedAt: utcInstantProperty,
    participantCount: { type: "integer", minimum: 0 },
    readiness: { type: "object", additionalProperties: false, required: ["complete", "total", "blockingIncomplete"], properties: {
      complete: { type: "integer", minimum: 0 }, total: { type: "integer", minimum: 0 }, blockingIncomplete: { type: "integer", minimum: 0 }
    } },
    nextActions: { type: "array", items: { type: "string", minLength: 1 } },
    urls: { type: "object", additionalProperties: false,
      required: ["detail", "staffing", "runtime", "reports", "replay", "archive"], properties: {
        detail: { type: "string" }, staffing: { type: "string" }, runtime: { type: "string" },
        reports: { type: "string" }, replay: { type: "string" }, archive: { type: "string" }
      } }
  }
} as const;

export const sessionCatalogV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: SESSION_CATALOG_CONTRACT_ID,
  title: "Session catalog v1", type: "object", additionalProperties: false,
  required: ["contractId", "permissions", "sessions", "nextCursor"],
  properties: {
    contractId: { const: SESSION_CATALOG_CONTRACT_ID },
    permissions: { type: "object", additionalProperties: false, required: ["canCreateSession", "canOperateSessions"], properties: {
      canCreateSession: { type: "boolean" }, canOperateSessions: { type: "boolean" }
    } },
    sessions: { type: "array", items: sessionSummaryV1Schema }, nextCursor: { type: ["string", "null"] }
  }
} as const satisfies ContractSchema<SessionCatalogV1>;

export const createdConfiguredSessionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: "session-catalog-created-v1",
  title: "Created configured Session v1", type: "object", additionalProperties: false,
  required: ["contractId", "sessionId", "title", "status", "version", "governingReleaseId", "scheduledStartAt",
    "replayed", "evidenceSequence", "detailUrl", "staffingUrl"],
  properties: {
    contractId: { const: SESSION_CATALOG_CONTRACT_ID }, sessionId: uuidProperty,
    title: { type: "string", minLength: 1, maxLength: 200 }, status: { const: "configured" },
    version: { type: "integer", minimum: 2 }, governingReleaseId: uuidProperty,
    scheduledStartAt: { type: ["string", "null"], format: "date-time" }, replayed: { type: "boolean" },
    evidenceSequence: { type: "integer", minimum: 1 }, detailUrl: { type: "string" }, staffingUrl: { type: "string" }
  }
} as const satisfies ContractSchema<CreatedConfiguredSessionV1>;

export const participantEntryV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: PARTICIPANT_ENTRY_CONTRACT_ID,
  title: "Participant entry v1", type: "object", additionalProperties: false,
  required: ["contractId", "sessions"],
  properties: {
    contractId: { const: PARTICIPANT_ENTRY_CONTRACT_ID },
    sessions: { type: "array", items: { type: "object" } }
  }
} as const satisfies ContractSchema<ParticipantEntryV1>;

export const runtimeNavigationV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: RUNTIME_NAVIGATION_CONTRACT_ID,
  title: "Runtime navigation v1", type: "object", additionalProperties: false,
  required: ["contractId", "items"],
  properties: {
    contractId: { const: RUNTIME_NAVIGATION_CONTRACT_ID },
    items: { type: "array", items: { type: "object" } },
    defaultItemId: { type: "string", minLength: 1 }
  }
} as const satisfies ContractSchema<RuntimeNavigationV1>;

export const commandReceiptV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: COMMAND_RECEIPT_CONTRACT_ID,
  title: "Command Receipt v1",
  type: "object",
  additionalProperties: false,
  required: ["commandId", "status", "aggregateVersion", "evidenceSequence", "errorCode", "message", "replayed"],
  properties: {
    commandId: uuidProperty,
    status: { type: "string", enum: ["received", "accepted", "rejected", "needs_reconciliation"] },
    aggregateVersion: { type: ["integer", "null"], minimum: 0 },
    evidenceSequence: { type: ["integer", "null"], minimum: 1 },
    errorCode: { type: ["string", "null"], enum: [...canonicalErrorCodes, null] },
    message: { type: ["string", "null"] },
    replayed: { type: "boolean" }
  }
} as const satisfies ContractSchema<CommandReceiptV1>;

export const syncBootstrapV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SYNC_BOOTSTRAP_CONTRACT_ID,
  title: "Runtime sync bootstrap v1",
  type: "object",
  additionalProperties: false,
  required: [
    "contractId", "sessionId", "deviceId", "participantId", "seatAssignmentIds",
    "activeSessionRoleId", "isControlRole", "authorityDeploymentId", "authorityEpoch",
    "accessRevision", "governingReleaseId", "credentialExpiresAt", "serverTime",
    "projectionVersion", "policyVersion", "offlineCommandTypes"
  ],
  properties: {
    contractId: { const: SYNC_BOOTSTRAP_CONTRACT_ID },
    sessionId: uuidProperty,
    deviceId: uuidProperty,
    participantId: uuidProperty,
    seatAssignmentIds: { type: "array", items: uuidProperty, minItems: 1, uniqueItems: true },
    activeSessionRoleId: { type: "string", minLength: 1 },
    isControlRole: { type: "boolean" },
    authorityDeploymentId: { type: "string", minLength: 1 },
    authorityEpoch: { type: "integer", minimum: 1 },
    accessRevision: { type: "integer", minimum: 1 },
    governingReleaseId: uuidProperty,
    credentialExpiresAt: utcInstantProperty,
    serverTime: utcInstantProperty,
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    offlineCommandTypes: {
      type: "array",
      items: { type: "string", enum: [...OFFLINE_QUEUEABLE_COMMAND_TYPES_V1] },
      uniqueItems: true
    }
  }
} as const satisfies ContractSchema<SyncBootstrapV1>;

export const offlineOutboxV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: OFFLINE_OUTBOX_CONTRACT_ID,
  title: "Offline Outbox v1",
  type: "object",
  additionalProperties: false,
  required: [
    "contractId", "sessionId", "deviceId", "participantId", "activeSessionRoleId",
    "authorityEpoch", "accessRevision", "credentialExpiresAt", "entries"
  ],
  properties: {
    contractId: { const: OFFLINE_OUTBOX_CONTRACT_ID },
    sessionId: uuidProperty,
    deviceId: uuidProperty,
    participantId: uuidProperty,
    activeSessionRoleId: { type: "string", minLength: 1 },
    authorityEpoch: { type: "integer", minimum: 1 },
    accessRevision: { type: "integer", minimum: 1 },
    credentialExpiresAt: utcInstantProperty,
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["command", "draftPayload", "queuedAt", "queueSequence", "status", "receipt"],
        properties: {
          command: {
            type: "object",
            additionalProperties: false,
            required: commandEnvelopeV1Schema.required,
            properties: commandEnvelopeV1Schema.properties
          },
          draftPayload: jsonObjectProperty,
          queuedAt: utcInstantProperty,
          queueSequence: { type: "integer", minimum: 0 },
          status: { type: "string", enum: ["local_pending", "received", "accepted", "rejected", "needs_reconciliation"] },
          receipt: {
            anyOf: [{ type: "null" }, {
              type: "object",
              additionalProperties: false,
              required: commandReceiptV1Schema.required,
              properties: commandReceiptV1Schema.properties
            }]
          }
        }
      }
    }
  }
} as const satisfies ContractSchema<OfflineOutboxV1>;

export const domainEventV1Schema = {
  ...eventEnvelopeV1Schema,
  $id: DOMAIN_EVENT_CONTRACT_ID,
  title: "Domain Event v1"
} as const satisfies ContractSchema<DomainEventV1>;

const runtimeDeltaProperties = {
  deltaId: uuidProperty,
  cursor: uuidProperty,
  eventType: { type: "string", pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
  aggregateId: uuidProperty,
  aggregateVersion: { type: ["integer", "null"], minimum: 0 },
  occurredAt: utcInstantProperty,
  payload: jsonObjectProperty
} as const;

export const syncDeltasV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SYNC_DELTAS_CONTRACT_ID,
  title: "Runtime sync deltas v1",
  type: "object",
  additionalProperties: false,
  required: ["projectionVersion", "policyVersion", "deltas", "nextCursor"],
  properties: {
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    deltas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["deltaId", "cursor", "eventType", "aggregateId", "aggregateVersion", "occurredAt", "payload"],
        properties: runtimeDeltaProperties
      }
    },
    nextCursor: uuidProperty
  }
} as const satisfies ContractSchema<SyncDeltasV1>;

export const syncSnapshotV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SYNC_SNAPSHOT_CONTRACT_ID,
  title: "Runtime sync snapshot v1",
  type: "object",
  additionalProperties: false,
  required: ["projectionVersion", "policyVersion", "cursor", "state", "aggregateVersions"],
  properties: {
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    cursor: uuidProperty,
    state: jsonObjectProperty,
    aggregateVersions: { type: "object", additionalProperties: { type: "integer", minimum: 0 } }
  }
} as const satisfies ContractSchema<SyncSnapshotV1>;

export const runtimeSseV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RUNTIME_SSE_CONTRACT_ID,
  title: "Runtime SSE batch v1",
  type: "object",
  additionalProperties: false,
  required: ["projectionVersion", "policyVersion", "events"],
  properties: {
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "cursor", "delta"],
        properties: {
          kind: { type: "string", enum: ["delta", "cursor"] },
          cursor: uuidProperty,
          delta: { anyOf: [{ type: "null" }, {
            type: "object",
            additionalProperties: false,
            required: ["deltaId", "cursor", "eventType", "aggregateId", "aggregateVersion", "occurredAt", "payload"],
            properties: runtimeDeltaProperties
          }] }
        }
      }
    }
  }
} as const satisfies ContractSchema<RuntimeSseV1>;

export const runtimeProjectionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RUNTIME_PROJECTION_CONTRACT_ID,
  title: "Authorized Runtime Projection v1",
  type: "object",
  additionalProperties: false,
  required: [
    "contractId", "sessionId", "sessionStatus", "releaseId", "releaseLabel", "participantId",
    "activeSessionRoleId", "activeSessionRoleLabel", "authorityEpoch", "activeTeamId", "activeTeamLabel", "currentStageId", "currentStageLabel", "currentStageStatus",
    "stageStartedAt", "stageDeadlineAt", "stageRemainingSeconds",
    "interfaceProfileId", "layout", "navigation", "roleContexts", "modules", "createTasks", "artifacts", "messages", "injects", "polls", "voiceChannels"
  ],
  properties: {
    contractId: { const: RUNTIME_PROJECTION_CONTRACT_ID },
    sessionId: uuidProperty,
    sessionStatus: { type: "string", minLength: 1 },
    releaseId: uuidProperty,
    releaseLabel: { type: "string", minLength: 1 },
    simulationTitle: { type: "string", minLength: 1 },
    sessionTitle: { type: "string", minLength: 1 },
    participantId: uuidProperty,
    activeSessionRoleId: { type: "string", minLength: 1 },
    activeSessionRoleLabel: { type: "string", minLength: 1 },
    authorityEpoch: { type: "integer", minimum: 1 },
    activeTeamId: { type: ["string", "null"] },
    activeTeamLabel: { type: ["string", "null"] },
    currentStageId: { type: ["string", "null"] },
    currentStageLabel: { type: ["string", "null"] },
    currentStageStatus: { type: "string", enum: ["not_started", "active", "paused", "completed"] },
    stageStartedAt: { type: ["string", "null"], format: "date-time" },
    stageDeadlineAt: { type: ["string", "null"], format: "date-time" },
    stageRemainingSeconds: { type: ["integer", "null"], minimum: 0 },
    interfaceProfileId: { type: "string", minLength: 1 },
    layout: { type: "string", enum: ["single_column", "main_with_sidebar", "dashboard_grid", "workspace_tabs"] },
    navigation: { type: "object" },
    regions: { type: "array", items: { type: "object" } },
    roleContexts: { type: "array", items: { type: "object" } },
    modules: { type: "array", items: { type: "object" } },
    resources: { type: "array", items: { type: "object" } },
    createTasks: { type: "array", items: { type: "object" } },
    artifacts: { type: "array", items: { type: "object" } },
    messages: { type: "array", items: { type: "object" } },
    injects: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["id", "definitionId", "title", "content", "state", "releasedAt", "acknowledgedAt", "respondedAt", "requiredResponseArtifactTypeId", "version"],
      properties: { id: uuidProperty, definitionId: { type: "string", minLength: 1 }, title: { type: "string" }, content: jsonObjectProperty,
        state: { enum: ["released", "acknowledged", "responded", "closed"] }, releasedAt: utcInstantProperty,
        acknowledgedAt: { type: ["string", "null"], format: "date-time" }, respondedAt: { type: ["string", "null"], format: "date-time" },
        requiredResponseArtifactTypeId: { type: ["string", "null"] }, version: { type: "integer", minimum: 1 },
        governingReleaseId: uuidProperty, acknowledgementRequired: { type: "boolean" }, recipientComplete: { type: "boolean" },
        responseArtifactTypeKey: { type: ["string", "null"] } } } },
    polls: { type: "array", items: { type: "object" } },
    voiceChannels: { type: "array", items: { type: "object" } },
    timeline: { type: "object" }
  }
} as const satisfies ContractSchema<RuntimeProjectionV1>;

export function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalizeJson(value[key] as JsonValue)}`).join(",")}}`;
}

const dotCaseName = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const irregularPastParticiples = new Set(["cast", "given", "held", "left", "sent", "set", "withdrawn"]);

export function isCommandOperationType(value: string): boolean {
  if (!dotCaseName.test(value)) return false;
  if (value === "ballot.cast") return true;
  const action = value.slice(value.indexOf(".") + 1);
  return !action.endsWith("ed") && !irregularPastParticiples.has(action);
}

export function isPastTenseEventType(value: string): boolean {
  if (!dotCaseName.test(value)) return false;
  const action = value.slice(value.indexOf(".") + 1);
  return action.endsWith("ed") || irregularPastParticiples.has(action);
}

export function createErrorEnvelope(
  code: CanonicalErrorCode,
  message: string,
  correlationId: string,
  details: JsonValue = null
): ErrorEnvelopeV1 {
  return { error: { code, message, details, correlationId } };
}
