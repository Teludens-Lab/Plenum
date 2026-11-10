import { interfaceFindings } from "./interface-consistency/assertions.mjs";
// Browser-level interface evidence using the real Release definitions and explicit in-memory API fixtures.
// Does not substitute for database-backed authorization or media integration tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { stageControlPresentation } from '../../apps/server/dist/runtime/stage-control-presentation.js';
const core=JSON.parse(fs.readFileSync('definitions/fractured-order/fractured-order-interface-release-source.json','utf8')).materialization.coreDesign;
const dist=path.resolve('apps/runtime-web/dist/web');
const out='output/playwright/participant-interfaces';
fs.mkdirSync(out,{recursive:true});
const sessionId='15000000-0000-4000-8000-000000000001';
const mime={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
const formFor=type=>{const f=structuredClone(core.forms.find(f=>f.id===type.formId));for(const s of f.sections)for(const field of s.fields)if(field.optionSource)field.options=core.teamCells.filter(c=>c.enabled&&c.teamId===field.optionSource.teamId&&c.kind===field.optionSource.cellKind).map(c=>({value:c.id,label:c.name}));return {...f,fields:f.sections.flatMap(s=>s.fields)};};
const browser=await chromium.launch();
const results=[];
try {
for(const [roleId,teamId] of [['scribe','blue'],['facilitator','blue'],['notetaker','blue'],['white_cell','blue'],['scribe','red'],['scribe','green'],['scribe','industry']]) {
  const scenario=teamId==='blue'?roleId:`${roleId}-${teamId}`;
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  const page=await context.newPage(); page.setDefaultTimeout(15000); console.log('Checking '+scenario);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const role=core.sessionRoles.find(r=>r.id===roleId);
  const profile=core.interfaces.find(p=>p.selectors.sessionRoleIds.includes(roleId));
  const modules=profile.layout.regions.flatMap(r=>r.modules.map(m=>({id:m.id,type:m.moduleType,title:m.title,mode:m.configuration.mode,emptyStateText:m.configuration.emptyStateText,configuration:m.configuration})));
  for(const module of modules) if(module.type==='session_status') module.configuration={...module.configuration,
    stageSchedule:core.stages.map(stage=>({id:stage.id,label:stage.name??stage.id,durationSeconds:stage.durationSeconds??null})),
    stageControl:stageControlPresentation(role.capabilities,{id:'move-2',operatorControls:{allowStart:true,allowEnd:true,allowReopen:true,allowExtend:true,allowSkip:false,allowReturnToPrevious:false},transitions:[]},'paused',4,[])};
  const createTasks=core.artifactTypes.filter(t=>t.allowedCreatorSessionRoleIds.includes(roleId)&&t.allowedTeamIds.includes(teamId))
    .flatMap(t=>{const task={artifactTypeKey:t.key,title:t.name,form:formFor(t),action:{operationType:'artifact.create',label:'Save draft',requiresForm:true}};
      return task.form.fields.some(f=>f.key==='industryCellId')?core.teamCells.filter(c=>c.enabled&&c.teamId===teamId).map(c=>({...task,title:`${task.title} · ${c.name}`,initialValues:{industryCellId:c.id}})):[task];});
  const orientation=core.artifactTypes.find(t=>t.key==='blue_strategic_orientation');
  const initial={id:'record-1',artifactTypeKey:orientation.key,title:orientation.name,state:'with_facilitator',stateLabel:'With Team Facilitator',
    payload:{ownOrientation:'reframe',redForecast:'stabilization',forecastActionDescription:'Synthetic team forecast for interface verification.'},version:1,governingReleaseId:'release',form:formFor(orientation),createdByMe:roleId==='scribe',
    actions:roleId==='facilitator'?[{operationType:'artifact.forward',label:'Forward to White Cell',requiresForm:false}]:[]};
  const records=roleId==='notetaker'?[]:[initial,{...initial,id:'record-2',state:'completed',stateLabel:'Completed',actions:[]}];
  const commands=[];
  let rejectMessage=true;
  let activeStage='move-2';
  const projection=()=>({contractId:'plenum.runtime-projection.v1',sessionId,sessionStatus:'active',releaseId:'release',releaseLabel:'Fractured Order 1.0',simulationTitle:'Fractured Order',sessionTitle:'Fractured Order — Interface fixture',participantId:'participant',
    activeSessionRoleId:roleId,activeSessionRoleLabel:role.name,authorityEpoch:1,activeTeamId:roleId==='white_cell'?null:teamId,activeTeamLabel:roleId==='white_cell'?null:`${teamId[0].toUpperCase()+teamId.slice(1)} Team`,
    currentStageId:activeStage,currentStageLabel:'Move 2',currentStageStatus:'paused',stageStartedAt:null,stageDeadlineAt:null,stageRemainingSeconds:5400,
    interfaceProfileId:profile.id,layout:'workspace_tabs',navigation:{contractId:'plenum.runtime-navigation.v1',defaultItemId:profile.navigation.defaultItemId,items:profile.navigation.items.map(n=>({id:n.id,label:n.label,regionId:n.target.regionId,moduleId:profile.layout.regions.find(r=>r.id===n.target.regionId).modules[0].id}))},
    regions:profile.layout.regions.map(r=>({id:r.id,moduleIds:r.modules.map(m=>m.id)})),roleContexts:[{sessionRoleId:roleId,sessionRoleLabel:role.name,teamLabel:'Blue Team',seatLabel:'Synthetic seat',runtimeUrl:`/sessions/${sessionId}/runtime?role=${roleId}`}],
    modules,resources:[],createTasks,artifacts:records,messages:[{id:'message-1',channelId:'broadcast',routeId:'control-broadcast',threadId:null,senderParticipantId:'control',senderSessionRoleId:'white_cell',operationType:'message.send',content:{text:'Synthetic control briefing.'},sentAt:new Date().toISOString(),approvedAt:null,approvalRouteId:null,threadState:null,threadVersion:null,deliveryState:'delivered'}],injects:[],polls:[],voiceChannels:[{id:'voice-1',name:'Team voice',mode:'open_room',canTransmit:true,canModerate:false,microphoneState:'muted',consent:{recording:{active:false,policy:'off',mine:'not_given'},transcription:{active:false,policy:'off',mine:'not_given'}}}]});
  const bootstrap=()=>({contractId:'sync-bootstrap-v1',sessionId,deviceId:'device',participantId:'participant',seatAssignmentIds:['seat'],activeSessionRoleId:roleId,isControlRole:roleId==='white_cell',authorityDeploymentId:'deployment',authorityEpoch:1,accessRevision:1,governingReleaseId:'release',credentialExpiresAt:new Date(Date.now()+3600000).toISOString(),serverTime:new Date().toISOString(),projectionVersion:'1',policyVersion:'1',offlineCommandTypes:['artifact.create']});
  await page.route('https://plenum.test/**',async route=>{
    const url=new URL(route.request().url());
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname==='/v1/devices')return json({deviceId:'device'});
    if(url.pathname.endsWith('/sync/bootstrap'))return json(bootstrap());
    if(url.pathname.endsWith('/runtime-projection'))return json(projection());
    if(url.pathname.endsWith('/effect-proposals'))return json({proposals:[]});
    if(url.pathname.endsWith('/adjudications'))return json({adjudications:[]});
    if(url.pathname.endsWith('/commands')){
      const command=route.request().postDataJSON(); commands.push(command);
      if(command.operationType==='voice_channel.join')return json({commandId:command.commandId,status:'rejected',replayed:false,message:'Synthetic media unavailable.'});
      if(command.operationType==='message.send'&&rejectMessage){rejectMessage=false;return json({commandId:command.commandId,status:'rejected',replayed:false,message:'Synthetic rejection'});}
      if(command.operationType==='artifact.create') {
        const task=createTasks.find(t=>t.artifactTypeKey===command.payload.artifactTypeKey);
        records.push({id:command.aggregateId,artifactTypeKey:task.artifactTypeKey,title:task.title,state:'draft',stateLabel:'Draft',payload:command.payload.content,version:1,governingReleaseId:'release',form:task.form,createdByMe:true,actions:[]});
      }
      return json({commandId:command.commandId,status:'accepted',replayed:false});
    }
    if(url.pathname.includes('/runtime-resources/'))return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic deck</title><p>Synthetic deck content</p>'});
    const file=path.join(dist,url.pathname);
    return route.fulfill({status:200,contentType:mime[path.extname(file)]??'text/html',body:fs.existsSync(file)&&fs.statSync(file).isFile()?fs.readFileSync(file):fs.readFileSync(path.join(dist,'index.html'))});
  });
  await page.goto(`https://plenum.test/sessions/${sessionId}/runtime?role=${roleId}`);
  await page.getByRole('heading',{level:1}).waitFor();
  // Capture the settled workspace: the entry loader has faded and local drafts have been restored.
  await page.waitForFunction(()=>document.querySelector('.plenum-loader-overlay.is-visible')===null&&!document.body.innerText.includes('Restoring local draft'));
  await page.screenshot({path:`${out}/${scenario}-desktop.png`});
  assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await page.getByRole('button',{name:'Control Broadcast',exact:true}).click();
  await page.getByRole('dialog',{name:'Control Broadcast'}).waitFor();
  assert.ok(await page.getByText('Synthetic control briefing.',{exact:true}).isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'Control Broadcast',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Voice channels',exact:true}).click();
  assert.ok(await page.getByRole('button',{name:'Join voice',exact:true}).isVisible());
  await page.getByRole('button',{name:'Close Voice channels'}).click();
  if(roleId==='scribe'&&teamId==='blue') {
    await page.getByRole('button',{name:'Strategic Orientation',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Strategic Orientation'});
    await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
    assert.equal(commands.length,0,'Invalid form must not dispatch');
    assert.ok(await dialog.getByRole('alert').count()>0);
    await dialog.getByRole('radiogroup',{name:'Blue strategic orientation'}).getByLabel('Reframe',{exact:true}).check();
    await dialog.getByRole('radiogroup',{name:'Forecast Red orientation'}).getByLabel('Stabilization',{exact:true}).check();
    await dialog.getByLabel('What will Red do first?').fill('Synthetic team forecast retained when the form closes.');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Strategic Orientation',exact:true}).click();
    assert.equal(await dialog.getByLabel('What will Red do first?').inputValue(),'Synthetic team forecast retained when the form closes.');
    await dialog.getByText('Draft saved on this device. It has not been submitted.',{exact:true}).waitFor();
    await page.reload();
    await page.getByRole('button',{name:'Strategic Orientation',exact:true}).click();
    await dialog.getByText('Local draft restored. It has not been submitted.',{exact:true}).waitFor();
    assert.equal(await dialog.getByLabel('What will Red do first?').inputValue(),'Synthetic team forecast retained when the form closes.');
    const persisted=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('plenum-offline-v1');request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result;const rows=db.transaction('runtime').objectStore('runtime').getAll();
        rows.onsuccess=()=>{resolve(JSON.stringify(rows.result));db.close();};rows.onerror=()=>reject(rows.error);};
    }));
    assert.equal(persisted.includes('Synthetic team forecast retained when the form closes.'),false,'Local draft must be encrypted');
    activeStage='move-3';
    await page.reload();
    await page.getByRole('button',{name:'Strategic Orientation',exact:true}).click();
    await dialog.getByLabel('What will Red do first?').waitFor();
    assert.equal(await dialog.getByLabel('What will Red do first?').inputValue(),'','Drafts must not leak into another stage');
    activeStage='move-2';
    await page.reload();
    await page.getByRole('button',{name:'Strategic Orientation',exact:true}).click();
    await dialog.getByText('Local draft restored. It has not been submitted.',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
    await page.getByText('The server accepted the Command.',{exact:false}).last().waitFor();
    assert.equal(commands[0].payload.content.ownOrientation,'reframe');
    await dialog.getByText('Submitted. Ready for a new entry.',{exact:true}).waitFor();
    assert.equal(await dialog.getByLabel('What will Red do first?').inputValue(),'');
    await page.reload();
    await page.getByRole('button',{name:'Strategic Orientation',exact:true}).click();
    await dialog.getByLabel('What will Red do first?').waitFor();
    assert.equal(await dialog.getByLabel('What will Red do first?').inputValue(),'','Accepted drafts must stay cleared after reload');
    await page.screenshot({path:`${out}/scribe-form.png`});
    await page.keyboard.press('Escape');
  }
  if(roleId==='scribe'&&teamId==='blue') {
    await page.getByRole('button',{name:'Take Action',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Take Action'});
    const before=commands.length;
    await dialog.getByRole('button',{name:'Next',exact:true}).click();
    assert.equal(commands.length,before);
    assert.equal(await dialog.getByLabel(/^Action title/).evaluate(el=>el===document.activeElement),true);
    await dialog.getByLabel(/^Action title/).fill('Synthetic supply-chain action');
    await dialog.getByRole('group',{name:'Instrument of Power'}).getByLabel('Other',{exact:true}).check();
    await dialog.getByLabel(/^Objective/).fill('Synthetic objective for the action builder.');
    await dialog.getByRole('button',{name:'Next',exact:true}).click();
    assert.ok(await dialog.getByLabel(/^Other Instrument of Power/).isVisible());
    await dialog.getByLabel(/^Other Instrument of Power/).fill('Synthetic custom instrument');
    await dialog.getByRole('button',{name:'Next',exact:true}).click();
    await dialog.getByRole('radiogroup',{name:/Does this action/}).getByLabel('Yes',{exact:true}).check();
    await dialog.getByRole('group',{name:'Sectors'}).getByLabel('Agriculture',{exact:true}).check();
    await dialog.getByRole('button',{name:'Next',exact:true}).click();
    assert.ok(await dialog.getByText('Page 2 of 3',{exact:true}).isVisible());
    await dialog.getByRole('group',{name:'Action Angle'}).getByLabel('Build resilience',{exact:true}).check();
    await dialog.getByRole('group',{name:'Supply Chain Area'}).getByLabel('Refinement',{exact:true}).check();
    await dialog.getByRole('button',{name:'Next',exact:true}).click();
    await dialog.getByLabel('Implementation *',{exact:true}).selectOption('legislative');
    await dialog.getByRole('group',{name:'Legislative Route'}).getByLabel('Existing legislation/policy',{exact:true}).check();
    await dialog.getByRole('group',{name:'Focus countries'}).getByLabel('EU',{exact:true}).check();
    await dialog.getByLabel(/^Expected outcomes/).fill('Synthetic expected outcome.');
    await dialog.getByRole('group',{name:'Teams to inform'}).getByLabel('Green',{exact:true}).check();
    await dialog.getByLabel(/^Clarifying note/).fill('Synthetic coordination note.');
    await dialog.getByRole('button',{name:'Back',exact:true}).click();
    assert.equal(await dialog.getByLabel('Refinement',{exact:true}).isChecked(),true);
    await dialog.getByRole('button',{name:'Next',exact:true}).click();
    await page.screenshot({path:`${out}/action-builder-page-3.png`});
    assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);
    await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
    await dialog.getByText('Submitted. Ready for a new entry.',{exact:true}).waitFor();
    assert.equal(commands.length,before+1);
    assert.deepEqual(commands.at(-1).payload.content.focusCountries,['EU']);
    assert.deepEqual(commands.at(-1).payload.content.legislativeVehicle,['existing']);
    assert.equal(commands.at(-1).payload.content.instrumentOther,'Synthetic custom instrument');
    await page.keyboard.press('Escape');
  }
  if(roleId==='scribe'&&teamId!=='blue') {
    for(const label of ['Strategic Orientation','Take Action']) {
      await page.getByRole('button',{name:label,exact:true}).click();
      const dialog=page.getByRole('dialog',{name:label});
      const relevant=createTasks.filter(t=> label==='Strategic Orientation' ? t.artifactTypeKey.includes('orientation')||t.artifactTypeKey==='industry_strategic_plan' : !t.artifactTypeKey.includes('orientation')&&t.artifactTypeKey!=='industry_strategic_plan'&&t.artifactTypeKey!=='note');
      for(const task of relevant) {
        if(relevant.length>1)await dialog.getByRole('button',{name:task.title,exact:true}).click();
        const region=dialog.getByRole('region',{name:task.title,exact:true});
        assert.ok(await region.isVisible());
        if(task.initialValues)assert.equal(await region.getByLabel(/^Industry\s*\*/).inputValue(),task.initialValues.industryCellId);
      }
      if(teamId==='industry'&&label==='Strategic Orientation') {
        const task=relevant.at(-1);
        const editor=dialog.getByRole('region',{name:task.title,exact:true});
        for(let index=0;index<5;index++) {
          for(const field of task.form.sections.filter(section=>section.page===index&&!section.collapsed).flatMap(section=>section.fields)) {
            if(!field.required||field.readOnly)continue;
            if(field.type==='single_select') {
              const choice=field.options[(field.key.match(/^risks\.(\d)\.type$/)?.[1]??0)%field.options.length];
              if(field.control==='select'||field.options.length>4)await editor.getByRole('combobox',{name:field.label,exact:false}).selectOption(choice.value);
              else await editor.getByRole('radiogroup',{name:field.label,exact:false}).getByRole('radio',{name:choice.label,exact:true}).check();
            } else if(field.type==='number'&&field.control==='cards')await editor.getByRole('radiogroup',{name:field.label,exact:false}).getByRole('radio',{name:'3',exact:true}).check();
            else await editor.getByLabel(field.label+' *',{exact:true}).fill('Synthetic '+field.label);
          }
          if(index===2)await page.screenshot({path:`${out}/industry-risk-groups.png`});
          await editor.getByRole('button',{name:'Next',exact:true}).click();
          await editor.getByText(`Page ${index+2} of 6`,{exact:true}).waitFor();
        }
        assert.ok(await editor.getByRole('heading',{name:'Review Strategic Plan',exact:true}).isVisible());
        await page.screenshot({path:`${out}/industry-plan-review.png`});
        await editor.getByRole('button',{name:'Save draft',exact:true}).click();
        await editor.getByText('Submitted. Ready for a new entry.',{exact:true}).waitFor();
        assert.equal(commands.at(-1).payload.content.strategicStance,3);
        assert.equal(commands.at(-1).payload.content.industryCellId,task.initialValues.industryCellId);
        assert.equal(commands.at(-1).payload.content.risks.length,3);
      }
      await page.screenshot({path:out+'/'+scenario+'-'+label.replaceAll(' ','-')+'.png'});
      const formAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(formAxe.violations.map(v=>v.id),[]);
      await page.keyboard.press('Escape');
    }
  }
  if(roleId==='notetaker'){
    await page.getByLabel('Quote',{exact:true}).check();
    await page.getByLabel(/^Content/).fill('Synthetic observation from a notetaker.');
    await page.getByRole('link',{name:'Communications',exact:true}).click();
    await page.getByRole('link',{name:'Quick Capture',exact:true}).click();
    assert.equal(await page.getByLabel(/^Content/).inputValue(),'Synthetic observation from a notetaker.');
    await page.getByRole('button',{name:'Save Observation'}).click();
    await page.getByText('The server accepted the Command.',{exact:false}).last().waitFor();
    assert.equal(commands[0].payload.content.kind,'quote');
    await page.getByLabel('Recent captures',{exact:true}).getByText('Synthetic observation from a notetaker.',{exact:true}).waitFor();
    await page.getByRole('link',{name:'Team Dynamics',exact:true}).click();
    await page.getByRole('slider',{name:/Friction Level/}).focus();
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.getByLabel('Emerging Leaders',{exact:true}).fill('Synthetic leadership observation.');
    await page.getByRole('button',{name:'Save Dynamics',exact:true}).click();
    await page.getByRole('region',{name:'Saved snapshots',exact:true}).getByText('Synthetic leadership observation.',{exact:true}).waitFor();
    assert.equal(commands[1].payload.artifactTypeKey,'team_dynamics');
    await page.getByRole('link',{name:'Alliance Tracking',exact:true}).click();
    await page.getByLabel('Alliance Coordination Notes',{exact:true}).fill('Synthetic alliance observation.');
    await page.getByRole('button',{name:'Save Alliance',exact:true}).click();
    await page.getByRole('region',{name:'Saved snapshots',exact:true}).getByText('Synthetic alliance observation.',{exact:true}).waitFor();
    assert.equal(commands[2].payload.artifactTypeKey,'alliance_tracking');
  }
  if(roleId==='white_cell'){
    await page.getByRole('button',{name:'Resume timer',exact:true}).click();
    await page.getByLabel('Reason for this change').fill('Synthetic test resumes the current stage.');
    await page.screenshot({path:`${out}/white_cell-stage-confirm.png`});
    await page.getByRole('button',{name:'Confirm resume timer',exact:true}).click();
    await page.getByText('The server accepted the Command.',{exact:false}).last().waitFor();
    assert.equal(commands[0].operationType,'stage.resume');
    assert.equal(commands[0].expectedAggregateVersion,4);
    await page.getByRole('button',{name:'Control Broadcast',exact:true}).click();
    const broadcast=page.getByRole('dialog',{name:'Control Broadcast'});
    await broadcast.getByLabel('Message',{exact:true}).fill('Synthetic broadcast retained on rejection.');
    await broadcast.getByRole('button',{name:'Send Message',exact:true}).click();
    await page.getByText('Message was not confirmed. Your text has been kept.',{exact:true}).waitFor();
    assert.equal(await broadcast.getByLabel('Message',{exact:true}).inputValue(),'Synthetic broadcast retained on rejection.');
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:'Communications',exact:true}).click();
    const communications=page.getByRole('region',{name:'Communications',exact:true});
    await communications.getByLabel('Recipient',{exact:true}).selectOption('control-communication-blue-notetaker');
    await communications.getByLabel('Type',{exact:true}).selectOption('Guidance');
    await communications.getByLabel('Message',{exact:true}).fill('Synthetic targeted guidance.');
    await communications.getByRole('button',{name:'Send Communication',exact:true}).click();
    await communications.getByText('Message sent.',{exact:true}).waitFor();
    assert.equal(commands.at(-1).payload.routeId,'control-communication-blue-notetaker');
    assert.equal(commands.at(-1).payload.content.type,'Guidance');
    const noteType=core.artifactTypes.find(t=>t.key==='note');
    records.push({id:'17000000-0000-4000-8000-000000000001',artifactTypeKey:'note',title:noteType.name,state:'saved',stateLabel:'Saved',
      payload:{note:'Synthetic captured observation.'},version:1,governingReleaseId:'release',form:formFor(noteType),createdByMe:false,actions:[]});
    await page.reload();
    await page.getByRole('link',{name:'Tribe Street Journal',exact:true}).click();
    const journal=page.getByRole('region',{name:'Tribe Street Journal',exact:true});
    await journal.getByLabel('Captured observation',{exact:true}).selectOption('17000000-0000-4000-8000-000000000001');
    assert.ok((await journal.getByLabel('Message',{exact:true}).inputValue()).includes('Synthetic captured observation.'));
    await journal.getByLabel('Message',{exact:true}).fill('Reviewed synthetic journal update.');
    await journal.getByLabel('Recipient',{exact:true}).selectOption('control-tribe-street-journal-green');
    await journal.getByRole('button',{name:'Publish update',exact:true}).click();
    await journal.getByText('Message sent.',{exact:true}).waitFor();
    assert.equal(commands.at(-1).payload.routeId,'control-tribe-street-journal-green');
    assert.equal(commands.at(-1).payload.content.text,'Reviewed synthetic journal update.');
    assert.equal(commands.at(-1).payload.content.sourceArtifactId,'17000000-0000-4000-8000-000000000001');
    await page.screenshot({path:`${out}/journal-forwarding.png`});
  }
  if(roleId==='facilitator'){
    await page.getByRole('button',{name:'Next record',exact:true}).click();
    assert.ok(await page.getByRole('button',{name:'Forward to White Cell'}).isVisible());
    await page.getByRole('button',{name:'Forward to White Cell'}).click();
    await page.getByText('The server accepted the Command.',{exact:false}).last().waitFor();
    assert.equal(commands[0].aggregateId,'record-1');
    assert.equal(commands[0].expectedAggregateVersion,1);
    const recordViews=page.getByRole('navigation',{name:'Record views',exact:true});
    assert.equal(await recordViews.getByRole('link',{name:'Team Action Review',exact:true}).getAttribute('aria-current'),'page');
    await page.screenshot({path:`${out}/facilitator-record-views.png`});
    await page.getByRole('main').getByRole('link',{name:'Present',exact:true}).click();
    assert.equal(await page.getByRole('main').getByRole('link',{name:'Present',exact:true}).getAttribute('aria-current'),'page');
    assert.ok(await page.getByRole('region',{name:'Present',exact:true}).getByRole('article').getByText('Synthetic team forecast for interface verification.',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Enter full screen',exact:true}).click();
    await page.waitForFunction(()=>document.fullscreenElement!==null);
    await page.keyboard.press('End');
    await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
    await page.waitForFunction(()=>document.fullscreenElement===null);
  }
  if(roleId==='scribe'&&teamId==='industry') {
    await page.getByRole('button',{name:'Voice channels',exact:true}).click();
    const voice=page.getByRole('dialog',{name:'Voice channels'});
    await voice.getByRole('button',{name:'Join voice',exact:true}).click();
    await voice.getByRole('alert').getByText('Synthetic media unavailable.',{exact:true}).waitFor();
    assert.equal(await voice.getByRole('button',{name:'Join voice',exact:true}).isEnabled(),true);
    await page.screenshot({path:`${out}/voice-error.png`});
    await voice.getByRole('button',{name:'Close Voice channels',exact:true}).click();
  }
  const consistency=[];
  for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:512,height:384}])for(const theme of ['light','dark']){
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>document.querySelector('.runtime-frame')?.getAttribute('data-sidebar')===(matchMedia('(min-width: 52.01rem)').matches?'open':'closed'));
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem('plenum.theme',theme);},theme);
    for(const item of profile.navigation.items){
      const toggle=page.getByRole('button',{name:'Open workspace navigation',exact:true});
      if(viewport.width<833){await toggle.waitFor();await toggle.click();}
      await page.locator('#runtime-navigation a').filter({has:page.getByText(item.label,{exact:true})}).click();
      const heading=page.getByRole('heading',{level:1});
      assert.equal((await heading.innerText()).trim(),item.label);
      consistency.push({item:item.id,viewport,theme,findings:await interfaceFindings(page)});
    }
  }
  fs.writeFileSync(`${out}/${scenario}-consistency.json`,JSON.stringify(consistency,null,2));
  assert.deepEqual(consistency.flatMap(row=>row.findings.map(f=>row.item+': '+f)),[]);
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
  assert.deepEqual(await interfaceFindings(page),[]);
  await page.screenshot({path:`${out}/${scenario}-forced-colors.png`});
  await page.emulateMedia({forcedColors:'none'});
  await page.setViewportSize({width:1440,height:900});
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await page.setViewportSize({width:1024,height:768});
  await page.screenshot({path:`${out}/${scenario}-mobile.png`});
  assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth),false);
  const navigationToggle=page.getByRole('button',{name:'Open workspace navigation'});
  if(await navigationToggle.isVisible())await navigationToggle.click();
  assert.ok(await page.getByRole('navigation',{name:'Work navigation',exact:true}).isVisible());
  await page.setViewportSize({width:512,height:384});
  await page.emulateMedia({reducedMotion:'reduce'});

  await page.screenshot({path:`${out}/${scenario}-320-zoom.png`});
  const overflow=await page.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth);
  if(overflow)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&el.getBoundingClientRect().width>0).slice(-12).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,60),right:el.getBoundingClientRect().right}))));
  assert.equal(overflow,false);
  assert.deepEqual(errors,[]);
  results.push({role:roleId,team:teamId,status:'PASS',commands:commands.map(c=>c.operationType),axeViolations:axe.violations.length});
  await context.close();
}
fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); }
