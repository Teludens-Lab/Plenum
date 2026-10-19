-- Plenum 013: authoritative Polls, Electorates, Ballots, Tallies and Certifications.
-- Sources: REQ-072 to REQ-078; INV-023 to INV-026, INV-028; ADR-003, ADR-015, ADR-016.

CREATE SCHEMA voting;

CREATE TABLE voting.polls (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  definition_id text NOT NULL,
  definition_revision integer NOT NULL CHECK (definition_revision > 0),
  definition jsonb NOT NULL,
  definition_sha256 text NOT NULL CHECK (definition_sha256 ~ '^[0-9a-f]{64}$'),
  electorate_sha256 text CHECK (electorate_sha256 IS NULL OR electorate_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('draft','configured','scheduled','open','closed','tallied','certified','cancelled','voided','disputed','correction_issued')),
  opened_at timestamptz,
  deadline_at timestamptz,
  closed_at timestamptz,
  tallied_at timestamptz,
  certified_at timestamptz,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, definition_id, definition_revision),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE voting.poll_options (
  organization_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  option_id text NOT NULL,
  label text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (poll_id, option_id),
  UNIQUE (organization_id, poll_id, option_id),
  UNIQUE (poll_id, ordinal),
  FOREIGN KEY (organization_id, poll_id) REFERENCES voting.polls(organization_id, id)
);

CREATE TABLE voting.electorate_members (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  seat_assignment_id uuid NOT NULL,
  ballot_capability uuid NOT NULL,
  weight numeric(18,6) NOT NULL CHECK (weight > 0),
  veto boolean NOT NULL,
  policy_snapshot_sha256 text NOT NULL CHECK (policy_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible','consumed','revoked')),
  UNIQUE (organization_id, id),
  UNIQUE (poll_id, seat_assignment_id),
  UNIQUE (poll_id, ballot_capability),
  FOREIGN KEY (organization_id, poll_id) REFERENCES voting.polls(organization_id, id),
  FOREIGN KEY (organization_id, seat_assignment_id) REFERENCES runtime.seat_assignments(organization_id, id)
);

-- Choice rows contain no Participant or Seat Assignment identifier. Identity remains in ballot_receipts.
CREATE TABLE voting.ballots (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  ballot_revision integer NOT NULL CHECK (ballot_revision > 0),
  choices jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'array'),
  accepted_sequence bigint NOT NULL CHECK (accepted_sequence > 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (poll_id, accepted_sequence),
  FOREIGN KEY (organization_id, poll_id) REFERENCES voting.polls(organization_id, id)
);

CREATE TABLE voting.ballot_receipts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  command_id uuid NOT NULL,
  seat_assignment_id uuid NOT NULL,
  eligibility_consumption_id uuid NOT NULL,
  ballot_id uuid,
  ballot_revision integer NOT NULL CHECK (ballot_revision > 0),
  status text NOT NULL CHECK (status IN ('accepted','superseded')),
  is_current boolean NOT NULL DEFAULT true,
  revote_allowed boolean NOT NULL,
  accepted_sequence bigint NOT NULL CHECK (accepted_sequence > 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (session_id, command_id),
  FOREIGN KEY (organization_id, poll_id) REFERENCES voting.polls(organization_id, id),
  FOREIGN KEY (organization_id, seat_assignment_id) REFERENCES runtime.seat_assignments(organization_id, id),
  FOREIGN KEY (organization_id, eligibility_consumption_id) REFERENCES voting.electorate_members(organization_id, id),
  FOREIGN KEY (organization_id, ballot_id) REFERENCES voting.ballots(organization_id, id)
);
CREATE UNIQUE INDEX ballot_receipts_one_current_per_seat
  ON voting.ballot_receipts (poll_id, seat_assignment_id) WHERE is_current;

CREATE TABLE voting.tallies (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  poll_revision integer NOT NULL CHECK (poll_revision > 0),
  ballot_set_sha256 text NOT NULL CHECK (ballot_set_sha256 ~ '^[0-9a-f]{64}$'),
  result_sha256 text NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  method text NOT NULL CHECK (method = 'builtin_count'),
  method_version text NOT NULL,
  counts jsonb NOT NULL,
  outcome jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (poll_id, poll_revision),
  FOREIGN KEY (organization_id, poll_id) REFERENCES voting.polls(organization_id, id)
);

CREATE TABLE voting.certifications (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  poll_revision integer NOT NULL CHECK (poll_revision > 0),
  tally_id uuid NOT NULL,
  result_sha256 text NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  method_version text NOT NULL,
  certifier_person_id uuid NOT NULL REFERENCES identity.persons(id),
  certifier_participant_id uuid NOT NULL,
  certifier_session_role_id text NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  corrects_certification_id uuid,
  reason text,
  is_current boolean NOT NULL DEFAULT true,
  certified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, poll_id) REFERENCES voting.polls(organization_id, id),
  FOREIGN KEY (organization_id, tally_id) REFERENCES voting.tallies(organization_id, id),
  FOREIGN KEY (organization_id, session_id, certifier_participant_id) REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, corrects_certification_id) REFERENCES voting.certifications(organization_id, id)
);
CREATE UNIQUE INDEX certifications_one_current_per_revision
  ON voting.certifications (poll_id, poll_revision) WHERE is_current;

CREATE FUNCTION voting.refuse_frozen_poll_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('draft','configured','scheduled') AND (
    NEW.definition IS DISTINCT FROM OLD.definition OR
    NEW.definition_sha256 IS DISTINCT FROM OLD.definition_sha256 OR
    NEW.electorate_sha256 IS DISTINCT FROM OLD.electorate_sha256 OR
    NEW.deadline_at IS DISTINCT FROM OLD.deadline_at OR
    NEW.governing_release_id IS DISTINCT FROM OLD.governing_release_id
  ) THEN
    RAISE EXCEPTION 'open Poll definition is immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION voting.refuse_frozen_child_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE target_poll uuid;
BEGIN
  target_poll := CASE WHEN TG_OP = 'DELETE' THEN OLD.poll_id ELSE NEW.poll_id END;
  IF EXISTS (SELECT 1 FROM voting.polls WHERE id=target_poll AND status NOT IN ('draft','configured','scheduled')) THEN
    RAISE EXCEPTION 'open Poll snapshot is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER polls_freeze BEFORE UPDATE ON voting.polls
  FOR EACH ROW EXECUTE FUNCTION voting.refuse_frozen_poll_change();
CREATE TRIGGER poll_options_freeze BEFORE INSERT OR UPDATE OR DELETE ON voting.poll_options
  FOR EACH ROW EXECUTE FUNCTION voting.refuse_frozen_child_change();
CREATE TRIGGER electorate_members_freeze BEFORE INSERT OR UPDATE OR DELETE ON voting.electorate_members
  FOR EACH ROW EXECUTE FUNCTION voting.refuse_frozen_child_change();

CREATE INDEX polls_session_status ON voting.polls (organization_id, session_id, status, created_at);
CREATE INDEX ballot_receipts_poll_current ON voting.ballot_receipts (organization_id, poll_id, is_current);
CREATE INDEX ballots_poll_sequence ON voting.ballots (organization_id, poll_id, accepted_sequence);
CREATE INDEX certifications_poll_chain ON voting.certifications (organization_id, poll_id, certified_at);

GRANT USAGE ON SCHEMA voting TO plenum_app;
GRANT SELECT, INSERT, UPDATE (status, electorate_sha256, opened_at, deadline_at, closed_at, tallied_at, certified_at, version, updated_at)
  ON voting.polls TO plenum_app;
GRANT SELECT, INSERT ON voting.poll_options, voting.electorate_members, voting.ballots, voting.tallies TO plenum_app;
GRANT SELECT, INSERT, UPDATE (status, is_current) ON voting.ballot_receipts TO plenum_app;
GRANT SELECT, INSERT, UPDATE (is_current) ON voting.certifications TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'voting.polls', 'voting.poll_options', 'voting.electorate_members', 'voting.ballots',
    'voting.ballot_receipts', 'voting.tallies', 'voting.certifications'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY organization_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
    EXECUTE format('CREATE TRIGGER refuse_delete BEFORE DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END
$$;

CREATE TRIGGER ballots_append_only BEFORE UPDATE ON voting.ballots
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER tallies_append_only BEFORE UPDATE ON voting.tallies
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
