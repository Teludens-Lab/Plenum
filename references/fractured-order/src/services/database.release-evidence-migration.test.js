import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    REQUIRED_MIGRATION_COUNT,
    REQUIRED_MIGRATION_LEDGER_SHA256,
    REQUIRED_MIGRATION_STATE
} from '../core/releaseEvidence.js';

function read(relativePath) {
    return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

const EVIDENCE_MIGRATION = read('data/2026-10-07_hosted_release_evidence.sql');
const COMMUNICATION_HISTORY_MIGRATION = read('data/2026-10-17_communications_session_history_index.sql');
const CURRENT_MIGRATION = read('data/2026-10-17_industry_communication_lookup_indexes.sql');
const SETUP = read('docs/supabase-setup.md');

describe('hosted release evidence migration', () => {
    it('binds the declared fingerprint to the complete ordered migration ledger', () => {
        const migrationNames = [...SETUP.matchAll(/^\d+\. `data\/([^`]+\.sql)`$/gm)]
            .map((match) => match[1]);
        const fingerprint = createHash('sha256')
            .update(`${migrationNames.join('\n')}\n`)
            .digest('hex');

        expect(migrationNames).toHaveLength(REQUIRED_MIGRATION_COUNT);
        expect(migrationNames.at(-1)).toBe(`${REQUIRED_MIGRATION_STATE}.sql`);
        expect(fingerprint).toBe(REQUIRED_MIGRATION_LEDGER_SHA256);
        expect(CURRENT_MIGRATION).toContain(`'migration_count', '${REQUIRED_MIGRATION_COUNT}'`);
        expect(CURRENT_MIGRATION).toContain(REQUIRED_MIGRATION_LEDGER_SHA256);
        expect(COMMUNICATION_HISTORY_MIGRATION).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communications_session_created_at');
        expect(COMMUNICATION_HISTORY_MIGRATION).toContain('ON public.communications (session_id, created_at DESC)');
        expect(CURRENT_MIGRATION).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_industry_outbound_linked_record');
        expect(CURRENT_MIGRATION).toContain("{proposal,industryTurnSheet,engagement,outbound,linkedRecordId}");
        expect(CURRENT_MIGRATION).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_industry_inbound_linked_record');
        expect(CURRENT_MIGRATION).toContain("{proposal,industryTurnSheet,engagement,inbound,linkedRecordId}");
        expect(CURRENT_MIGRATION).toContain('DROP POLICY IF EXISTS industry_proposal_communication_visibility');
        expect(CURRENT_MIGRATION.match(/AND NOT EXISTS \(/g)).toHaveLength(2);
    });

    it('fails closed on critical RLS, policy, trigger, and RPC prerequisites', () => {
        [
            'sessions',
            'session_participants',
            'game_state',
            'actions',
            'requests',
            'communications',
            'timeline',
            'notetaker_data',
            'artifact_workflow_reviews',
            'live_demo_runtime_config'
        ].forEach((relation) => expect(EVIDENCE_MIGRATION).toContain(`'${relation}'`));
        [
            'FWC08_RLS_PREREQUISITE_MISSING',
            'FWC08_BROAD_RLS_POLICY_PRESENT',
            'FWC08_REQUIRED_RPC_SIGNATURE_MISSING',
            'FWC08_INDUSTRY_TRIGGER_PREREQUISITE_MISSING',
            'FWC08_REQUIRED_RLS_POLICY_MISSING'
        ].forEach((failureCode) => expect(EVIDENCE_MIGRATION).toContain(failureCode));
        expect(EVIDENCE_MIGRATION).toContain('industry_proposal_move_gate');
        expect(EVIDENCE_MIGRATION).toContain('industry_proposal_prepare');
        expect(EVIDENCE_MIGRATION).toContain('operator_review_artifact(text,uuid,text,text,bigint,text)');
        expect(EVIDENCE_MIGRATION).toContain('append_proposal_thread_message(uuid,text,text,text,text)');
    });

    it('exposes only authenticated, non-secret, commit-shaped release identity', () => {
        expect(EVIDENCE_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.live_demo_release_evidence()');
        expect(EVIDENCE_MIGRATION).toContain('SECURITY DEFINER');
        expect(EVIDENCE_MIGRATION).toContain("~ '^[0-9A-Fa-f]{40}$'");
        expect(EVIDENCE_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.live_demo_release_evidence() FROM anon');
        expect(EVIDENCE_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.live_demo_release_evidence() TO authenticated');
        expect(EVIDENCE_MIGRATION).not.toContain('operator_code_sha256');
    });
});
