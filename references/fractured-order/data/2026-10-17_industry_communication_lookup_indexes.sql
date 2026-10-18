-- Keep Industry proposal communication visibility checks on indexed JSON lookups.
-- This migration changes no rows and does not alter RLS policy behavior.

SET statement_timeout = '5min';
SET lock_timeout = '5s';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_industry_outbound_linked_record
    ON public.actions ((artifact_payload #>> '{proposal,industryTurnSheet,engagement,outbound,linkedRecordId}'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_industry_inbound_linked_record
    ON public.actions ((artifact_payload #>> '{proposal,industryTurnSheet,engagement,inbound,linkedRecordId}'));

RESET lock_timeout;
RESET statement_timeout;

ANALYZE public.actions;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM pg_class index_relation
        JOIN pg_namespace namespace ON namespace.oid = index_relation.relnamespace
        JOIN pg_index index_state ON index_state.indexrelid = index_relation.oid
        WHERE namespace.nspname = 'public'
          AND index_relation.relname IN (
              'idx_actions_industry_outbound_linked_record',
              'idx_actions_industry_inbound_linked_record'
          )
          AND index_state.indisvalid
          AND index_state.indisready
    ) <> 2 THEN
        RAISE EXCEPTION 'INDUSTRY_COMMUNICATION_LOOKUP_INDEX_INVALID'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP POLICY IF EXISTS industry_proposal_communication_visibility ON public.communications;
CREATE POLICY industry_proposal_communication_visibility
    ON public.communications AS RESTRICTIVE FOR SELECT TO authenticated
    USING (
        (
            NULLIF(BTRIM(metadata ->> 'source_proposal_id'), '') IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM public.actions action
                WHERE action.id::TEXT = metadata ->> 'source_proposal_id'
                  AND NOT public.industry_proposal_action_visible(action.id)
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.actions action
            WHERE public.is_industry_proposal(action)
              AND action.artifact_payload #>> '{proposal,industryTurnSheet,engagement,outbound,linkedRecordId}' = communications.id::TEXT
              AND NOT public.industry_proposal_action_visible(action.id)
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.actions action
            WHERE public.is_industry_proposal(action)
              AND action.artifact_payload #>> '{proposal,industryTurnSheet,engagement,inbound,linkedRecordId}' = communications.id::TEXT
              AND NOT public.industry_proposal_action_visible(action.id)
        )
    );

INSERT INTO public.live_demo_runtime_config (config_key, config_value, updated_at)
VALUES
    ('migration_state', '2026-10-17_industry_communication_lookup_indexes', NOW()),
    ('migration_count', '68', NOW()),
    ('migration_ledger_sha256', 'd8ab22bb18236d1bc4bb63aed6216c4928ac0efcaed71c1f5663b2b130fd5ca7', NOW())
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = EXCLUDED.updated_at;

COMMIT;
