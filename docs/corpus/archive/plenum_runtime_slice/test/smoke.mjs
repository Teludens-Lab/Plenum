// Requires real PostgreSQL and running API, and `npm run seed` IDs in environment.
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const host=process.env.API_URL||'http://127.0.0.1:3000',org=process.env.DEMO_ORG_ID;
const users={designer:process.env.DEMO_DESIGNER,publisher:process.env.DEMO_PUBLISHER,operator:process.env.DEMO_OPERATOR,scribe:process.env.DEMO_SCRIBE,facilitator:process.env.DEMO_FACILITATOR,white_cell:process.env.DEMO_WHITE_CELL};
if(!org||Object.values(users).some(x=>!x))throw Error('Set DEMO_ORG_ID and DEMO_* environment variables from npm run seed');
async function api(role,path,method='GET',payload){const resp=await fetch(host+path,{method,headers:{'x-org-id':org,'x-demo-user':users[role],'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});const v=await resp.json();if(!resp.ok)throw Error(`${role} ${path}: ${resp.status} ${JSON.stringify(v)}`);return v;}
const def={roles:['scribe','facilitator','white_cell'],artifactType:'request',workflow:['scribe','facilitator','white_cell']};
const {projectId}=await api('designer','/v1/projects','POST',{title:'End-to-end SSG handoff',definition:def});
const {releaseId}=await api('publisher',`/v1/projects/${projectId}/publish`,'POST',{});
const {sessionId}=await api('operator','/v1/sessions','POST',{releaseId,deploymentId:randomUUID()});
for(const role of ['scribe','facilitator','white_cell'])await api('operator',`/v1/sessions/${sessionId}/participants`,'POST',{userId:users[role],role});
const device={};for(const role of ['scribe','facilitator','white_cell'])device[role]=(await api(role,'/v1/devices','POST',{})).deviceId;
const aggregateId=randomUUID();let version=0,sequence=0;
for(const [role,op] of [['scribe','artifact.create'],['scribe','artifact.submit'],['facilitator','artifact.forward'],['white_cell','artifact.accept']]){
const c={commandId:randomUUID(),deviceId:device[role],operationType:op,aggregateId,governingReleaseId:releaseId,expectedAggregateVersion:version,payload:{note:'test'}};
const result=await api(role,`/v1/sessions/${sessionId}/commands`,'POST',c);assert.equal(result.status,'accepted');assert.ok(result.evidenceSequence>sequence);sequence=result.evidenceSequence;version=result.aggregateVersion;
const retry=await api(role,`/v1/sessions/${sessionId}/commands`,'POST',c);assert.equal(retry.replayed,true);}
const items=await api('white_cell',`/v1/sessions/${sessionId}/artifacts`);assert.equal(items.artifacts[0].status,'accepted');console.log('PASS PostgreSQL-backed Studio -> Release -> Session -> Handoff, receipts and evidence',sessionId);
