import {
  PARTICIPANT_ENTRY_CONTRACT_ID,
  type ParticipantEntryV1,
  type ParticipantRoleContextV1,
  type ParticipantSeatChoiceV1,
  type SessionLifecycleStatusV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../../database.js";
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
        eligibleSeats: await eligibleSeats(client, row)
      };
    }));
    return { contractId: PARTICIPANT_ENTRY_CONTRACT_ID, sessions };
  });
}
