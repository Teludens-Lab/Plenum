-- Keep session-scoped communication history on the filtered newest-first path.
-- This migration changes no rows and does not alter RLS policy behavior.

SET statement_timeout = '5min';
SET lock_timeout = '5s';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communications_session_created_at
    ON public.communications (session_id, created_at DESC);

RESET lock_timeout;
RESET statement_timeout;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class index_relation
        JOIN pg_namespace namespace ON namespace.oid = index_relation.relnamespace
        JOIN pg_index index_state ON index_state.indexrelid = index_relation.oid
        WHERE namespace.nspname = 'public'
          AND index_relation.relname = 'idx_communications_session_created_at'
          AND index_state.indisvalid
          AND index_state.indisready
    ) THEN
        RAISE EXCEPTION 'COMMUNICATIONS_SESSION_HISTORY_INDEX_INVALID'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

INSERT INTO public.live_demo_runtime_config (config_key, config_value, updated_at)
VALUES
    ('migration_state', '2026-10-17_communications_session_history_index', NOW()),
    ('migration_count', '67', NOW()),
    ('migration_ledger_sha256', '1e93078de76b5c425b3989131d9d1df3a43aaae627c506708092bb46a879e68d', NOW())
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = EXCLUDED.updated_at;
