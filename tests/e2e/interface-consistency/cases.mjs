import { fixture } from "../fixture.mjs";
const t = fixture.tokens;
const P = fixture.projectId, R = fixture.releaseId, S = fixture.sessionId, OS = fixture.operatorSessionId, O = fixture.organizationId;
const studioSections = ['overview','methodology','teams','roles','seats','activities','stages','forms','workflows','policies','communications','injects','content-library','advanced-logic','adjudication','polls','voice','plugins','compositions','interfaces','research','measurements-reports','access','preview','test-validate','review-publish','live-changes'];

export const plan = [
  ['visitor', null, [['landing', '/'], ['unknown-route', '/not-a-page'], ['unknown-admin', '/admin/not-a-page'], ['workforce-invite', '/organization/invitations/' + 'a'.repeat(43)], ['first-admin-invite', '/platform/invitations/' + 'a'.repeat(43)], ['platform-admin-invite', '/platform/administrator-invitations/' + 'a'.repeat(43)]]],
  ['designer', t.designerA, [['projects', '/?workspace=projects'], ['your-sessions', '/?workspace=participant'], ['studio-empty', '/studio/'], ['qa-demo', `/projects/${P}/demo`],
    ...studioSections.map((s) => ['studio-' + s, `/studio/projects/${P}#${s}`])]],
  ['reviewer', t.finalReviewer, [['projects', '/?workspace=projects'], ['studio', `/studio/projects/${P}#review-publish`]]],
  ['publisher', t.publisher, [['projects', '/?workspace=projects'], ['lifecycle', '/?workspace=lifecycle'], ['release-detail', `/releases/${R}`], ['admin-plugins', '/admin/plugins'], ['admin-members-denied', '/admin/members']]],
  ['operator-only', t.portalOperator, [['lifecycle', '/?workspace=lifecycle'], ['session-detail', `/sessions/${OS}`], ['console', `/admin/sessions/${OS}`], ['projects-denied', '/?workspace=projects']]],
  ['admin', t.operator, [['lifecycle', '/?workspace=lifecycle'], ['session-detail', `/sessions/${OS}`], ['console', `/admin/sessions/${OS}`], ['console-reports', `/admin/sessions/${OS}/reports`], ['console-replay', `/admin/sessions/${OS}/replay`], ['console-archive', `/admin/sessions/${OS}/archive`],
    ['admin-members', '/admin/members'], ['admin-identity', '/admin/identity'], ['admin-plugins', '/admin/plugins'], ['admin-deployment', '/admin/deployment'], ['admin-data-policy', '/admin/data-policy'],
    ['platform-orgs', '/platform/organizations'], ['platform-org-detail', `/platform/organizations/${O}`], ['platform-admins', '/platform/administrators'], ['your-sessions', '/?workspace=participant']]],
  ['research-analyst', t.designerB, [['research', '/research/reports'], ['home', '/']]],
  ['participant', t.invitedParticipant, [['your-sessions', '/'], ['research-denied', '/research/reports']]],
  ['seeded-notetaker', t.blueNotetaker, [['runtime', `/sessions/${S}/runtime`]]],
];
