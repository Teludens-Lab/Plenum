import {test} from 'node:test';import {strict as assert} from 'node:assert';import {validateDefinition,transition,sha,validateCommand} from '../src/domain.mjs';
const definition={roles:['scribe','facilitator','white_cell'],artifactType:'request',workflow:['scribe','facilitator','white_cell']};
test('valid reference definition',()=>assert.equal(validateDefinition(definition),definition));
test('reject missing methodology role',()=>assert.throws(()=>validateDefinition({...definition,roles:['scribe']})));
test('scribe submission and facilitated review',()=>{assert.equal(transition('draft','scribe','artifact.submit'),'submitted');assert.equal(transition('submitted','facilitator','artifact.forward'),'in_review');assert.equal(transition('in_review','white_cell','artifact.accept'),'accepted');});
test('cannot skip facilitator',()=>assert.throws(()=>transition('submitted','white_cell','artifact.accept')));
test('cannot accept twice',()=>assert.throws(()=>transition('accepted','white_cell','artifact.accept')));
test('command requires optimistic concurrency version',()=>assert.throws(()=>validateCommand({commandId:'x',deviceId:'x',operationType:'x',aggregateId:'x',governingReleaseId:'x'})));
test('deterministic content digest',()=>assert.equal(sha(definition),sha(definition)));
