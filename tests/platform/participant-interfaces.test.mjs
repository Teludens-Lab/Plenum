import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { stageControlPresentation } from '../../apps/server/dist/runtime/stage-control-presentation.js';
import { validateRuntimeFormPayload } from '../../packages/simulation-schema/dist/index.js';
const core=JSON.parse(fs.readFileSync(new URL('../../definitions/fractured-order/fractured-order-interface-release-source.json',import.meta.url),'utf8')).materialization.coreDesign;
const controls={allowStart:true,allowEnd:true,allowReopen:true,allowExtend:true,allowSkip:false,allowReturnToPrevious:true};
const stages=[{id:'previous',label:'Previous move',transitions:[{targetStageId:'current'}]},{id:'current',label:'Current move'},{id:'next',label:'Next move'}];
const stage={id:'current',operatorControls:controls,transitions:[{targetStageId:'next',mode:'manual'}]};
test('Stage controls expose only the active role capabilities and preserve the authoritative version',()=>{
  assert.equal(stageControlPresentation([],stage,'active',7,stages),null);
  const timer=stageControlPresentation([{capability:'timer.control'}],stage,'paused',7,stages);
  assert.equal(timer.version,7);
  assert.deepEqual(timer.actions.map(a=>a.operation),['stage.resume','stage.extend','stage.end']);
  const move=stageControlPresentation([{capability:'stage.advance'}],stage,'active',8,stages);
  assert.deepEqual(move.actions.map(a=>a.operation),['stage.advance','stage.return']);
  assert.equal(move.actions[0].targetStageId,'next');
  assert.equal(stageControlPresentation([{capability:'stage.advance'}],stage,'not_started',0,stages).actions.some(a=>a.operation==='stage.advance'),false);
  assert.equal(stageControlPresentation([{capability:'stage.advance'}],{...stage,transitions:[{targetStageId:'next',mode:'automatic'}]},'active',0,stages).actions.some(a=>a.operation==='stage.advance'),false);
});
test('Every participant role has an explicit workspace and broadcast remains an icon tool',()=>{
  for(const role of ['scribe','facilitator','notetaker','white_cell']){
    const profile=core.interfaces.find(p=>p.selectors.sessionRoleIds.includes(role));
    assert.ok(profile);
    const broadcast=profile.layout.regions.flatMap(r=>r.modules).find(m=>m.configuration.placement==='header');
    assert.deepEqual(broadcast.configuration.channelIds,['broadcast']);
    assert.equal(profile.navigation.items.some(n=>n.target.regionId==='broadcast'),false);
    assert.equal(broadcast.configuration.mode,role==='white_cell'?'write':'read');
    assert.ok(profile.layout.regions.some(region=>region.modules.some(module=>module.moduleType==='session_timeline')));
    for (const channel of ['tribe-street-journal','verba']) {
      const feed=profile.layout.regions.flatMap(region=>region.modules).find(module=>module.configuration.channelIds?.includes(channel));
      assert.equal(feed.configuration.mode,role==='white_cell'?'write':'read');
      assert.equal(feed.configuration.settingsGroup,'plugins');
    }
  }
  const capture=core.interfaces.find(p=>p.id==='participant-capture');
  assert.ok(capture.navigation.items.some(n=>n.label==='Team Dynamics'));
  assert.ok(capture.navigation.items.some(n=>n.label==='Alliance Tracking'));
  assert.ok(capture.navigation.items.some(n=>n.label==='View Actions'));
});
test('Notetaker snapshots validate ratings and preserve legacy note payloads',()=>{
  const note=core.forms.find(f=>f.id==='form-note');
  assert.deepEqual(validateRuntimeFormPayload(note,{note:'Existing saved note'}),[]);
  assert.deepEqual(validateRuntimeFormPayload(note,{kind:'quote',note:'An observed quotation'}),[]);
  assert.ok(validateRuntimeFormPayload(note,{kind:'invalid',note:'Text'}).length>0);
  const dynamics=core.forms.find(f=>f.id==='form-team-dynamics');
  assert.deepEqual(validateRuntimeFormPayload(dynamics,{frictionLevel:1,consensusLevel:10}),[]);
  assert.ok(validateRuntimeFormPayload(dynamics,{frictionLevel:0,consensusLevel:11}).length>=2);
  for(const id of ['team-dynamics','alliance-tracking']) {
    const type=core.artifactTypes.find(t=>t.id===id);
    assert.deepEqual(type.allowedCreatorSessionRoleIds,['notetaker']);
    assert.equal(type.workflowId,'workflow-note');
    assert.equal(type.informationPolicyId,'policy-team-control');
  }
});

test('Reference forms preserve structured layouts and conditional Other details',()=>{
  const action=core.forms.find(f=>f.id==='form-blue-action');
  assert.equal(action.layout.pages.length,3);
  const fields=action.sections.flatMap(s=>s.fields);
  assert.equal(fields.find(f=>f.key==='focusCountries').type,'multi_select');
  assert.equal(fields.find(f=>f.key==='legislativeVehicle').type,'multi_select');
  const valid={title:'Supply chain resilience',objective:'Protect capacity',instruments:['other'],instrumentOther:'Custom instrument',
    supplyChainFocusDecision:'no',sectors:['agriculture'],implementationPath:'executive_order',focusCountries:['EU'],expectedOutcomes:'More resilience'};
  assert.deepEqual(validateRuntimeFormPayload(action,valid),[]);
  assert.ok(validateRuntimeFormPayload(action,{...valid,instrumentOther:''}).some(e=>e.field==='instrumentOther'));
  assert.ok(validateRuntimeFormPayload(action,{...valid,supplyChainFocusDecision:'yes'}).some(e=>e.field==='supplyChainAreas'));
  for(const id of ['form-industry-orientation','form-industry-turn-sheet']) {
    const form=core.forms.find(f=>f.id===id);
    assert.equal(form.layout.review,true);
    assert.ok(form.sections.some(section=>section.table || section.columns));
    assert.equal(form.sections.some(section=>section.page>=form.layout.pages.length-1),false);
  }
  const modules=core.interfaces.find(i=>i.id==='control').layout.regions.flatMap(r=>r.modules);
  assert.deepEqual(modules.find(m=>m.id==='task-list').configuration.artifactTypeKeys,['blue_action']);
  assert.deepEqual(modules.find(m=>m.id==='red-responses-module').configuration.artifactTypeKeys,['red_move_response']);
  assert.ok(modules.find(m=>m.configuration.presentation==='history').configuration.historyStates.includes('returned'));
});
