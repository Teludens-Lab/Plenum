import {
  PARTICIPANT_ENTRY_CONTRACT_ID,
  type ParticipantBrandAssetV1,
  type ParticipantEntryV1,
  type ParticipantRoleContextV1,
  type ParticipantSeatChoiceV1,
  type ParticipantSessionBrandingV1,
  type SessionLifecycleStatusV1
} from "@plenum/event-contracts";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../../database.js";
import { authorizationError } from "../../errors.js";
import type { AuthenticatedPrincipal } from "../../identity/login.js";

type EntryRow = {
  organization_id: string;
  session_id: string;
  title: string;
  status: SessionLifecycleStatusV1;
  release_label: string;
  governing_release_id: string;
  snapshot: unknown;
  invitation_id: string | null;
  join_status: "waiting_room" | "assignment_pending" | "admitted" | null;
  requested_seat_id: string | null;
  participant_id: string | null;
  join_methods: string[];
};

type AssignmentRow = {
  session_role_id: string;
  seat_id: string;
  team_id: string | null;
};

type SeatRow = {
  seat_id: string;
  session_role_ids: string[];
  team_id: string | null;
};

type Named = { id: string; name?: string; label?: string };
type ReleaseResource = {
  id: string;
  type?: string;
  mediaType?: string;
  usage?: unknown;
  altText?: string;
  dataUri?: string;
  contentDigest?: string;
};

export type ParticipantBrandingAsset = {
  contentType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  digest: string;
};

export type ParticipantRuntimeResource = {
  contentType: string;
  bytes: Uint8Array;
  digest: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function definitions(snapshot: unknown) {
  const root = record(snapshot) ?? {};
  const design = record(root.coreDesign) ?? root;
  const named = (value: unknown): Named[] => Array.isArray(value)
    ? value.filter((item): item is Named => typeof item === "object" && item !== null && typeof (item as Named).id === "string")
    : [];
  return { roles: named(design.sessionRoles), teams: named(design.teams), seats: named(design.seats) };
}

function label(items: Named[], id: string | null, fallback: string): string | null {
  if (id === null) return null;
  const item = items.find((candidate) => candidate.id === id);
  return item?.name ?? item?.label ?? fallback;
}

function releaseDesign(snapshot: unknown): Record<string, unknown> {
  const root = record(snapshot) ?? {};
  return record(root.coreDesign) ?? root;
}

function imageResource(value: unknown): value is ReleaseResource & { id: string; mediaType: "image/png" | "image/jpeg" } {
  if (record(value) === null) return false;
  const resource = value as ReleaseResource;
  return typeof resource.id === "string" && resource.id.length > 0 &&
    (resource.mediaType === "image/png" || resource.mediaType === "image/jpeg");
}

function usage(resource: ReleaseResource, value: string): boolean {
  return Array.isArray(resource.usage) && resource.usage.includes(value);
}

function runtimeResourceReferencedByRole(design: Record<string, unknown>, resourceId: string, sessionRoleId: string): boolean {
  if (!Array.isArray(design.interfaces)) return false;
  return design.interfaces.filter((candidate) => record(candidate) !== null).some((candidate) => {
    const profile = candidate as Record<string, unknown>;
    const selectors = record(profile.selectors);
    if (!Array.isArray(selectors?.sessionRoleIds) || !selectors.sessionRoleIds.includes(sessionRoleId)) return false;
    const layout = record(profile.layout);
    if (!Array.isArray(layout?.regions)) return false;
    return layout.regions.filter((region) => record(region) !== null).some((region) => {
      const modules = record(region)?.modules;
      return Array.isArray(modules) && modules.filter((module) => record(module) !== null).some((module) => {
        const configuration = record(record(module)?.configuration);
        return configuration?.releaseResourceId === resourceId ||
          Array.isArray(configuration?.resourceIds) && configuration.resourceIds.includes(resourceId);
      });
    });
  });
}

function assetProjection(sessionId: string, releaseId: string, resource: ReleaseResource | undefined): ParticipantBrandAssetV1 | null {
  if (resource === undefined || !imageResource(resource)) return null;
  return {
    url: `/v1/participant-entry/sessions/${sessionId}/releases/${releaseId}/assets/${encodeURIComponent(resource.id)}`,
    altText: typeof resource.altText === "string" ? resource.altText : "",
    mediaType: resource.mediaType
  };
}

function participantBranding(row: EntryRow): ParticipantSessionBrandingV1 | undefined {
  const design = releaseDesign(row.snapshot);
  const identity = record(design.identity);
  if (identity === null || typeof identity.title !== "string" || typeof identity.developer !== "string") return undefined;
  const resources = Array.isArray(design.resources) ? design.resources.filter(imageResource) : [];
  const developerLogoId = typeof identity.developerLogoResourceId === "string" ? identity.developerLogoResourceId : null;
  const developerLogo = developerLogoId === null ? undefined : resources.find((resource) => resource.id === developerLogoId);
  const presentation = record(design.presentation);
  const login = record(presentation?.login);
  const simulationImageId = typeof login?.imageResourceId === "string" ? login.imageResourceId : null;
  const simulationImage = (simulationImageId === null ? undefined : resources.find((resource) => resource.id === simulationImageId)) ??
    resources.find((resource) => usage(resource, "login") && resource.id !== developerLogoId);
  return {
    title: identity.title,
    subtitle: typeof identity.subtitle === "string" ? identity.subtitle : null,
    developer: identity.developer,
    developerLogo: assetProjection(row.session_id, row.governing_release_id, developerLogo),
    simulationImage: assetProjection(row.session_id, row.governing_release_id, simulationImage)
  };
}

async function roleContexts(client: PoolClient, row: EntryRow): Promise<ParticipantRoleContextV1[]> {
  if (row.participant_id === null) return [];
  const result = await client.query<AssignmentRow>(
    `SELECT session_role_id,seat_id,team_id
       FROM runtime.seat_assignments
      WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND valid_to IS NULL
      ORDER BY seat_id,session_role_id`,
    [row.organization_id, row.session_id, row.participant_id]
  );
  const { roles, teams, seats } = definitions(row.snapshot);
  return result.rows.map((assignment) => ({
    sessionRoleId: assignment.session_role_id,
    sessionRoleLabel: label(roles, assignment.session_role_id, assignment.session_role_id)!,
    teamLabel: label(teams, assignment.team_id, assignment.team_id ?? ""),
    seatLabel: label(seats, assignment.seat_id, assignment.seat_id)!,
    runtimeUrl: `/sessions/${row.session_id}/runtime?role=${encodeURIComponent(assignment.session_role_id)}`
  }));
}

async function eligibleSeats(client: PoolClient, row: EntryRow): Promise<ParticipantSeatChoiceV1[]> {
  if (row.participant_id === null || !row.join_methods.includes("open_seat_selection")) return [];
  const result = await client.query<SeatRow>(
    `SELECT seat.seat_id,seat.session_role_ids,seat.team_id
       FROM runtime.session_seats seat
      WHERE seat.organization_id=$1 AND seat.session_id=$2 AND seat.join_mode='open_selection'
        AND ($3::text IS NULL OR seat.seat_id=$3)
        AND seat.state IN ('open','vacated')
        AND (seat.max_occupancy IS NULL OR (SELECT count(*) FROM runtime.seat_assignments assignment
          WHERE assignment.organization_id=seat.organization_id AND assignment.session_id=seat.session_id
            AND assignment.seat_id=seat.seat_id AND assignment.valid_to IS NULL) < seat.max_occupancy)
      ORDER BY seat.seat_id`,
    [row.organization_id, row.session_id, row.requested_seat_id]
  );
  const { roles, teams, seats } = definitions(row.snapshot);
  return result.rows.flatMap((seat) => seat.session_role_ids.map((sessionRoleId) => ({
    seatId: seat.seat_id,
    seatLabel: label(seats, seat.seat_id, seat.seat_id)!,
    sessionRoleId,
    sessionRoleLabel: label(roles, sessionRoleId, sessionRoleId)!,
    teamLabel: label(teams, seat.team_id, seat.team_id ?? "")
  })));
}

export async function getParticipantEntry(pool: Pool, principal: AuthenticatedPrincipal): Promise<ParticipantEntryV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<EntryRow>(
      `SELECT session.organization_id,session.id AS session_id,session.title,session.status,
              release.release_label,config.governing_release_id,revision.snapshot,
              invitation.id AS invitation_id,request.status AS join_status,request.requested_seat_id,
              participant.id AS participant_id,
              ARRAY(SELECT jsonb_array_elements_text(config.access_policy->'joinMethods')) AS join_methods
         FROM runtime.sessions session
         JOIN runtime.session_access_configs config
           ON config.organization_id=session.organization_id AND config.session_id=session.id
         JOIN registry.releases release
           ON release.organization_id=session.organization_id AND release.id=config.governing_release_id
         JOIN studio.definition_revisions revision
           ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
         LEFT JOIN runtime.participants participant
           ON participant.organization_id=session.organization_id AND participant.session_id=session.id
          AND participant.person_id=$2
         LEFT JOIN LATERAL (
           SELECT id FROM identity.session_invitations candidate
            WHERE candidate.organization_id=session.organization_id AND candidate.session_id=session.id
              AND candidate.recipient_person_id=$2 AND candidate.accepted_at IS NULL
              AND candidate.revoked_at IS NULL AND candidate.expires_at>transaction_timestamp()
            ORDER BY candidate.created_at DESC LIMIT 1
         ) invitation ON true
         LEFT JOIN LATERAL (
           SELECT status,requested_seat_id FROM runtime.join_requests candidate
            WHERE candidate.organization_id=session.organization_id AND candidate.session_id=session.id
              AND candidate.person_id=$2 AND candidate.status IN ('waiting_room','assignment_pending','admitted')
            ORDER BY candidate.submitted_at DESC LIMIT 1
         ) request ON true
        WHERE session.organization_id=$1
          AND (participant.id IS NOT NULL OR invitation.id IS NOT NULL OR request.status IS NOT NULL)
        ORDER BY session.updated_at DESC,session.id`,
      [principal.organizationId, principal.principalId]
    );
    const sessions = await Promise.all(result.rows.map(async (row) => {
      const contexts = await roleContexts(client, row);
      const branding = participantBranding(row);
      return {
        sessionId: row.session_id,
        governingReleaseId: row.governing_release_id,
        title: row.title,
        releaseLabel: row.release_label,
        status: row.status,
        entryState: row.invitation_id !== null ? "invited" as const
          : row.join_status === "waiting_room" ? "waiting_room" as const
            : row.participant_id === null || contexts.length === 0 ? "assignment_pending" as const : "ready" as const,
        invitationId: row.invitation_id,
        roleContexts: contexts,
        eligibleSeats: await eligibleSeats(client, row),
        ...(branding === undefined ? {} : { branding })
      };
    }));
    return { contractId: PARTICIPANT_ENTRY_CONTRACT_ID, sessions };
  });
}

export async function getParticipantBrandingAsset(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  releaseId: string,
  resourceId: string,
  correlationId: string
): Promise<ParticipantBrandingAsset> {
  if (resourceId.length === 0 || resourceId.length > 200 || !/^[a-z0-9._-]+$/iu.test(resourceId)) {
    throw authorizationError("NOT_FOUND", "The participant branding asset was not found.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ snapshot: unknown }>(
      `SELECT revision.snapshot
         FROM runtime.sessions session
         JOIN runtime.session_access_configs config
           ON config.organization_id=session.organization_id AND config.session_id=session.id
         JOIN registry.releases release
           ON release.organization_id=session.organization_id AND release.id=config.governing_release_id
         JOIN studio.definition_revisions revision
           ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
        WHERE session.organization_id=$1 AND session.id=$3 AND config.governing_release_id=$4
          AND (
            EXISTS (SELECT 1 FROM runtime.participants participant
              WHERE participant.organization_id=session.organization_id AND participant.session_id=session.id
                AND participant.person_id=$2)
            OR EXISTS (SELECT 1 FROM identity.session_invitations invitation
              WHERE invitation.organization_id=session.organization_id AND invitation.session_id=session.id
                AND invitation.recipient_person_id=$2 AND invitation.accepted_at IS NULL
                AND invitation.revoked_at IS NULL AND invitation.expires_at>transaction_timestamp())
            OR EXISTS (SELECT 1 FROM runtime.join_requests request
              WHERE request.organization_id=session.organization_id AND request.session_id=session.id
                AND request.person_id=$2 AND request.status IN ('waiting_room','assignment_pending','admitted'))
          )`,
      [principal.organizationId, principal.principalId, sessionId, releaseId]
    );
    const snapshot = result.rows[0]?.snapshot;
    if (snapshot === undefined) {
      throw authorizationError("PERMISSION_DENIED", "The participant branding asset is unavailable.", correlationId);
    }
    const design = releaseDesign(snapshot);
    const resource = Array.isArray(design.resources)
      ? design.resources.filter(imageResource).find((candidate) => candidate.id === resourceId &&
        (usage(candidate, "login") || usage(candidate, "developer_branding")))
      : undefined;
    if (resource === undefined || typeof resource.dataUri !== "string" || typeof resource.contentDigest !== "string") {
      throw authorizationError("NOT_FOUND", "The participant branding asset was not found.", correlationId);
    }
    const prefix = `data:${resource.mediaType};base64,`;
    if (!resource.dataUri.startsWith(prefix)) {
      throw authorizationError("CONFLICT", "The published branding asset has an invalid media encoding.", correlationId);
    }
    const bytes = Buffer.from(resource.dataUri.slice(prefix.length), "base64");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== resource.contentDigest) {
      throw authorizationError("CONFLICT", "The published branding asset failed its integrity check.", correlationId);
    }
    return { contentType: resource.mediaType, bytes, digest };
  });
}

export async function getParticipantRuntimeResource(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  resourceId: string,
  deviceId: string,
  activeSessionRoleId: string,
  correlationId: string
): Promise<ParticipantRuntimeResource> {
  if (resourceId.length === 0 || resourceId.length > 200 || !/^[a-z0-9._-]+$/iu.test(resourceId)) {
    throw authorizationError("NOT_FOUND", "The Runtime resource was not found.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ snapshot: unknown }>(
      `SELECT revision.snapshot
         FROM runtime.sessions session
         JOIN runtime.session_access_configs config
           ON config.organization_id=session.organization_id AND config.session_id=session.id
         JOIN registry.releases release
           ON release.organization_id=session.organization_id AND release.id=config.governing_release_id
         JOIN studio.definition_revisions revision
           ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
         JOIN runtime.participants participant
           ON participant.organization_id=session.organization_id AND participant.session_id=session.id
          AND participant.person_id=$2
         JOIN runtime.seat_assignments assignment
           ON assignment.organization_id=session.organization_id AND assignment.session_id=session.id
          AND assignment.participant_id=participant.id AND assignment.session_role_id=$5 AND assignment.valid_to IS NULL
         JOIN sync.devices device
           ON device.organization_id=session.organization_id AND device.id=$4
          AND device.person_id=$2 AND device.revoked_at IS NULL
        WHERE session.organization_id=$1 AND session.id=$3`,
      [principal.organizationId, principal.principalId, sessionId, deviceId, activeSessionRoleId]
    );
    const snapshot = result.rows[0]?.snapshot;
    if (snapshot === undefined) {
      throw authorizationError("PERMISSION_DENIED", "The Runtime resource is unavailable.", correlationId);
    }
    const design = releaseDesign(snapshot);
    if (!runtimeResourceReferencedByRole(design, resourceId, activeSessionRoleId)) {
      throw authorizationError("PERMISSION_DENIED", "The Runtime resource is unavailable for this Role.", correlationId);
    }
    const resource = Array.isArray(design.resources)
      ? design.resources.filter((candidate) => record(candidate) !== null)
        .map((candidate) => candidate as ReleaseResource)
        .find((candidate) => candidate.id === resourceId)
      : undefined;
    if (resource === undefined || typeof resource.mediaType !== "string" || typeof resource.dataUri !== "string" ||
        typeof resource.contentDigest !== "string") {
      throw authorizationError("NOT_FOUND", "The Runtime resource was not found.", correlationId);
    }
    const prefix = `data:${resource.mediaType};base64,`;
    if (!resource.dataUri.startsWith(prefix)) {
      throw authorizationError("CONFLICT", "The published Runtime resource has an invalid media encoding.", correlationId);
    }
    const bytes = Buffer.from(resource.dataUri.slice(prefix.length), "base64");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== resource.contentDigest) {
      throw authorizationError("CONFLICT", "The published Runtime resource failed its integrity check.", correlationId);
    }
    return { contentType: resource.mediaType, bytes, digest };
  });
}
