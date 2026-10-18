const TOKENS = {
  primitive:{
    neutral:{0:'#FFFFFF',25:'#FDFCFA',50:'#F8F7F4',100:'#F0EFEB',200:'#E3E1DC',300:'#C9C6BF',400:'#A5A19A',500:'#7D7972',600:'#5F5B55',700:'#45413C',800:'#2D2A27',900:'#1D1B19',950:'#121110'},
    vermilion:{50:'#FFF4F1',100:'#FFE5DF',200:'#FFC8BD',300:'#FF9B89',400:'#FF6B52',500:'#F24B35',600:'#D93A27',700:'#B72D1D',800:'#8F261B',900:'#76241C'},
    cobalt:{100:'#E7EEFF',500:'#3567D6',700:'#24489E'},green:{100:'#E5F4EA',500:'#2E7D4F',700:'#205A39'},amber:{100:'#FFF0D1',500:'#A96500',700:'#754700'},crimson:{100:'#FDE5E3',500:'#D13C32',700:'#9C2923'}
  },
  semantic:{light:{'material/canvas':'#F8F7F4','material/workspace':'#FDFCFA','material/surface':'#FFFFFF','material/surfaceRaised':'#FFFFFF','material/surfaceRecessed':'#F0EFEB','material/control':'#F0EFEB','material/selection':'#FFF4F1','text/primary':'#1D1B19','text/secondary':'#45413C','boundary/subtle':'#E3E1DC','boundary/standard':'#C9C6BF','signal/decision':'#F24B35','info/default':'#3567D6','success/default':'#2E7D4F','caution/default':'#A96500','error/default':'#D13C32'},dark:{'material/canvas':'#121110','material/workspace':'#1D1B19','material/surface':'#2D2A27','material/surfaceRaised':'#45413C','material/surfaceRecessed':'#121110','material/control':'#45413C','material/selection':'#45413C','text/primary':'#F8F7F4','text/secondary':'#C9C6BF','boundary/subtle':'#45413C','boundary/standard':'#5F5B55','signal/decision':'#FF6B52','info/default':'#3567D6','success/default':'#2E7D4F','caution/default':'#A96500','error/default':'#D13C32'}},
  density:{focus:{controlHeight:48,rowHeight:44,toolbarHeight:48,panelPadding:24,sectionGap:28,inlineGap:12},standard:{controlHeight:42,rowHeight:36,toolbarHeight:44,panelPadding:16,sectionGap:22,inlineGap:10},operations:{controlHeight:38,rowHeight:30,toolbarHeight:40,panelPadding:12,sectionGap:14,inlineGap:8}},
  motion:{press:80,hover:110,selection:140,tooltip:150,popover:180,modal:210,panel:220,view:260,majorCausal:340},
  loading:{indicatorDelay:180,minimumVisible:400,skeletonCycle:1200}
};

const $=(s,c=document)=>c.querySelector(s);const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const toast=$('#toast');let toastTimer;
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1700)}
async function copy(value,label=value){try{await navigator.clipboard.writeText(value);notify(`Copied ${label}`)}catch{notify(value)}}

// Primitive palette
const palette=$('#primitivePalette');
Object.entries(TOKENS.primitive).forEach(([name,ramp])=>{const row=document.createElement('div');row.className='palette-row';row.innerHTML=`<span>${name}</span><div class="swatch-row"></div>`;const wrap=$('.swatch-row',row);Object.entries(ramp).forEach(([step,hex])=>{const b=document.createElement('button');b.className='swatch';b.style.setProperty('--swatch',hex);b.setAttribute('aria-label',`${name} ${step} ${hex}`);b.innerHTML=`<span class="swatch-tip">${step} · ${hex}</span>`;b.addEventListener('click',()=>copy(hex,`${name}/${step}`));wrap.appendChild(b)});palette.appendChild(row)});

function renderSemantic(){const theme=document.documentElement.dataset.theme;const grid=$('#semanticPalette');grid.innerHTML='';Object.entries(TOKENS.semantic[theme]).forEach(([name,color])=>{const card=document.createElement('button');card.className='semantic-token';card.style.setProperty('--token-color',color);card.innerHTML=`<div class="color"></div><div class="meta"><b>${name}</b><code>${color}</code></div>`;card.addEventListener('click',()=>copy(color,name));grid.appendChild(card)})}
renderSemantic();

const typeData=[
 ['Display','Decision architecture',40,500,'48px','-0.02em'],['Heading / Large','Operational clarity at scale',28,650,'36px','-0.02em'],['Heading / Medium','Proposal requires review',20,650,'28px','-0.01em'],['Title','Port access guarantees',16,650,'22px','0'],['Body','Preserve the proposal record and its history across ownership changes.',14,400,'20px','0'],['Label','CURRENT OWNER',12,550,'16px','.01em'],['Detail','Submitted 14:08 · Move 02',11,400,'16px','0'],['Operational','FACILITATOR REVIEW · LIVE',12,550,'16px','.02em'],['State','ACTION',11,650,'14px','.04em'],['Telemetry','14:32 · SYNCED',11,550,'14px','.02em']
];
const typeWrap=$('#typeSpecimens');typeData.forEach(([role,sample,size,weight,lh,ls])=>{const row=document.createElement('div');row.className='type-row';row.innerHTML=`<div class="role">${role}</div><div class="sample" style="--type-size:${size}px;--type-weight:${weight};--type-lh:${lh};--type-ls:${ls}">${sample}</div><div class="spec">${size}px · ${lh} · ${weight}</div>`;typeWrap.appendChild(row)});

const densityRows=['Port access guarantees and emergency logistics corridor','Temporary tariff relief for strategic components','Fuel allocation priority for coastal transport nodes','Industrial credit backstop for priority manufacturers'];
function buildDensityRows(){const w=$('#densityDemoRows');w.innerHTML='';densityRows.forEach((title,i)=>{const row=document.createElement('div');row.className='density-row';row.innerHTML=`<span>P-${142+i}</span><span>Blue · Industry</span><span>${title}</span><span>MOVE 02</span><span>Facilitator</span>`;w.appendChild(row)})}
buildDensityRows();
function renderDensityMetrics(mode){const m=TOKENS.density[mode],wrap=$('#densityMetrics');wrap.innerHTML='';Object.entries(m).forEach(([k,v])=>{const el=document.createElement('div');el.className='metric';el.innerHTML=`<span>${k}</span><b>${v}px</b>`;wrap.appendChild(el)})}
renderDensityMetrics('standard');
$$('[data-density-value]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.densityValue;document.documentElement.dataset.density=mode;$$('[data-density-value]').forEach(x=>x.classList.toggle('selected',x===b));renderDensityMetrics(mode);notify(`${mode[0].toUpperCase()+mode.slice(1)} density`)}));

const motionWrap=$('#motionTokens'),maxMotion=340;Object.entries(TOKENS.motion).filter(([k])=>k!=='majorCausal').forEach(([name,ms])=>{const el=document.createElement('div');el.className='motion-token';el.innerHTML=`<span>${name}</span><b>${ms} ms</b><div class="motion-bar"><i style="--motion-w:${Math.max(12,(ms/maxMotion)*100)}%"></i></div>`;motionWrap.appendChild(el)});$('#motionPanelTrigger').addEventListener('click',()=>$('#motionInspector').classList.toggle('open'));

const transitionMeta={
  selection:{caption:'Selection · 140 ms · state changes in place',timing:'selection / fast ease-out'},
  panel:{caption:'Inspector · 220 ms · enters from its owning edge',timing:'panel / cubic-bezier(.16,1,.3,1)'},
  modal:{caption:'Dialog · 210 ms · 8 px rise + restrained scrim',timing:'modal / anchored ease-out'},
  view:{caption:'Related view · 260 ms · crossfade + 6 px continuity',timing:'view / restrained directional crossfade'}
};
const transitionDemo=$('#transitionDemo');
function playTransition(mode=transitionDemo?.dataset.mode||'selection'){
  if(!transitionDemo)return;
  transitionDemo.dataset.mode=mode;
  $$('#transitionDemo .td-view-a,#transitionDemo .td-view-b,#transitionDemo .td-inspector,#transitionDemo .td-dialog,#transitionDemo .td-scrim').forEach(el=>el.getAnimations?.().forEach(a=>a.cancel()));
  transitionDemo.classList.remove('is-playing');
  void transitionDemo.offsetWidth;
  requestAnimationFrame(()=>transitionDemo.classList.add('is-playing'));
  const meta=transitionMeta[mode];
  $('#transitionCaption').textContent=meta.caption;
  $('#transitionTiming').textContent=meta.timing;
  $$('[data-transition-demo]').forEach(b=>b.classList.toggle('selected',b.dataset.transitionDemo===mode));
}
$$('[data-transition-demo]').forEach(b=>b.addEventListener('click',()=>playTransition(b.dataset.transitionDemo)));
$('#transitionReplay')?.addEventListener('click',()=>playTransition());
playTransition('selection');

const loadingDemo=$('#loadingDemo');
const loadingButton=$('#runLoadingDemo');
const loadingStatus=$('#loadingStatus');
const loadingSubstatus=$('#loadingSubstatus');
const loadingTime=$('#loadingTime');
const loadingProgress=$('#loadingProgress');
let loadingRunId=0;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setLoadingState(state,status,substatus,time='—'){
  loadingDemo.dataset.state=state;
  loadingStatus.textContent=status;
  loadingSubstatus.textContent=substatus;
  loadingTime.textContent=time;
}
async function runLoadingSequence(){
  if(!loadingDemo||!loadingButton)return;
  const runId=++loadingRunId;
  const started=performance.now();
  loadingButton.disabled=true;
  loadingButton.textContent='Running…';
  loadingProgress.style.removeProperty('width');
  setLoadingState('idle','Received','Input acknowledged immediately. No loader yet.','0 ms');
  await delay(TOKENS.loading.indicatorDelay);
  if(runId!==loadingRunId)return;
  setLoadingState('pending','Starting model run','Trace Loader appears only after the latency threshold.',`${Math.round(performance.now()-started)} ms`);
  await delay(340);
  if(runId!==loadingRunId)return;
  setLoadingState('skeleton','Loading authorized projection','Skeleton preserves final geometry while structure is unavailable.',`${Math.round(performance.now()-started)} ms`);
  await delay(520);
  if(runId!==loadingRunId)return;
  setLoadingState('progress','Running composition','Known progress uses a rail; unknown progress never gets a fabricated percentage.',`${Math.round(performance.now()-started)} ms`);
  const progressStart=performance.now();
  const duration=900;
  await new Promise(resolve=>{
    function tick(now){
      if(runId!==loadingRunId){resolve();return;}
      const p=Math.min(1,(now-progressStart)/duration);
      loadingProgress.style.width=`${Math.round(24+p*76)}%`;
      loadingTime.textContent=`${Math.round(performance.now()-started)} ms`;
      if(p<1)requestAnimationFrame(tick);else resolve();
    }
    requestAnimationFrame(tick);
  });
  if(runId!==loadingRunId)return;
  const elapsed=Math.round(performance.now()-started);
  setLoadingState('complete','Completed','Result confirmed. Geometry settles before success is announced.',`${elapsed} ms`);
  loadingProgress.style.width='100%';
  loadingButton.disabled=false;
  loadingButton.textContent='Run again';
}
loadingButton?.addEventListener('click',runLoadingSequence);


const grammarInfo={Node:'A discrete actor, decision, event, or stateful object.',Branch:'A point where one path becomes multiple plausible alternatives.',Path:'A directional relationship showing consequence, progression, or dependency.',Gate:'A constraint, prerequisite, approval, or condition that controls progression.',State:'A meaningful condition of an object or system at a given time.'};
const legend=$('#grammarLegend');Object.entries(grammarInfo).forEach(([name,desc],i)=>{const item=document.createElement('div');item.className='grammar-item'+(i===0?' active':'');item.innerHTML=`<span>0${i+1}</span><h4>${name}</h4><p>${desc}</p>`;item.addEventListener('click',()=>{$$('.grammar-item').forEach(x=>x.classList.remove('active'));item.classList.add('active');$('#grammarReadout').textContent=`${name}: ${desc}`});legend.appendChild(item)});
$$('.grammar-node,.grammar-gate').forEach(n=>n.addEventListener('click',()=>{const isAlt=n.dataset.node==='Alternate';$$('.grammar-node,.grammar-gate').forEach(x=>x.classList.remove('active'));n.classList.add('active');$$('.grammar-path').forEach(p=>p.classList.remove('active'));if(isAlt){$$('[data-path="a"],[data-path="c"],[data-path="e"]').forEach(p=>p.classList.add('active'));$('#grammarReadout').textContent='Alternate path: Decision → Branch → Alternate → State'}else{$$('[data-path="a"],[data-path="b"],[data-path="d"]').forEach(p=>p.classList.add('active'));$('#grammarReadout').textContent='Current path: Decision → Gate → State'}}));

const statuses=[['Draft','draft'],['Facilitator Review','review'],['Returned','returned'],['White Cell','white'],['Accepted','accepted'],['Resolved','resolved']];const statusStrip=$('#statusStrip');statuses.forEach(([label,c])=>statusStrip.insertAdjacentHTML('beforeend',`<span class="proposal-status ${c}">${label}</span>`));
const proposals=['Port access guarantees and emergency logistics corridor','Temporary tariff relief for strategic components','Fuel allocation priority for coastal transport nodes','Industrial credit backstop for priority manufacturers','Public statement on regional supply assurance','Emergency customs waiver for critical imports'];
function proposalRowHTML(title,i,compact=false){return `<div class="proposal-row ${i===0?'selected':''}"><span>P-${142+i}</span><span>Blue · Industry</span><span>${title}</span><span>MOVE 02</span><span>Facilitator</span><span class="proposal-status review">Review</span></div>`}
const proposalTable=$('#proposalTable');proposals.forEach((p,i)=>proposalTable.insertAdjacentHTML('beforeend',proposalRowHTML(p,i)));const pList=$('#pList');proposals.forEach((p,i)=>pList.insertAdjacentHTML('beforeend',proposalRowHTML(p,i,true)));

// Theme
$('#themeToggle').addEventListener('click',()=>{const root=document.documentElement;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';renderSemantic();notify(`${root.dataset.theme==='dark'?'Dark':'Light'} theme`)});

// Reference slice states
const refStateMeta={
 landing:{className:'show-landing',context:'PUBLIC ENTRY',role:'PLENUM',note:'Landing page · public product entry + system posture',nav:null},
 login:{className:'show-login',context:'SECURE ACCESS',role:'IDENTITY',note:'Login · institutional authentication + deployment context',nav:null},
 base:{className:null,context:'MOVE 02 · ACTION',role:'INDUSTRY · FACILITATOR',note:'Facilitator workspace · review, RFI, submit',nav:'base'},
 dialog:{className:'show-dialog',context:'MOVE 02 · ACTION',role:'INDUSTRY · FACILITATOR',note:'Consequential Facilitator → White Cell handoff · confirmation state',nav:'base'},
 command:{className:'show-command',context:'MOVE 02 · ACTION',role:'INDUSTRY · FACILITATOR',note:'Global command layer · transient expert navigation',nav:'base'},
 admin:{className:'show-admin',context:'ORGANIZATION CONTROL PLANE',role:'ADMINISTRATOR',note:'Administration · access, deployment, capability + governance posture',nav:null},
 extension:{className:'show-extension',context:'MODEL RUN · REVIEW',role:'WHITE CELL',note:'Extension Framework · composition + staged effect approval',nav:'extension'},
 vote:{className:'show-vote',context:'POLL-03 · OPEN',role:'BLUE · INDUSTRY',note:'Core Runtime capability · authoritative ballot lifecycle',nav:'vote'},
 voice:{className:'show-voice',context:'BLUE COMMAND NET · LIVE',role:'BLUE · INDUSTRY',note:'Core Runtime capability · media transport under Runtime grants',nav:'voice'}
};
const roleStateMeta={
 scribe:{className:'role-scribe',context:'MOVE 02 · AUTHORING',role:'INDUSTRY · SCRIBE',note:'Scribe workspace · author official team artifact → forward to Facilitator'},
 facilitator:{className:null,context:'MOVE 02 · ACTION',role:'INDUSTRY · FACILITATOR',note:'Facilitator workspace · challenge, RFI, submit, respond'},
 notetaker:{className:'role-notetaker',context:'MOVE 02 · OBSERVATION',role:'INDUSTRY · NOTETAKER',note:'Notetaker workspace · reasoning, quotes, dynamics + relationships'},
 whitecell:{className:'role-whitecell',context:'MOVE 02 · COMPLETENESS',role:'WHITE CELL · LEAD',note:'White Cell workspace · completeness, returns, SME routing + ruling'},
 sme:{className:'role-sme',context:'MOVE 02 · ASSESSMENT',role:'SME · MACRO',note:'SME workspace · lane assessment → recommendation → White Cell'}
};
const roleClasses=Object.values(roleStateMeta).map(x=>x.className).filter(Boolean);
let activeRoleView='facilitator';
function clearRoleClasses(){const f=$('#plenumFrame');roleClasses.forEach(c=>f.classList.remove(c))}
function setRoleView(role,announce=true){
 const f=$('#plenumFrame'),meta=roleStateMeta[role]||roleStateMeta.facilitator;activeRoleView=roleStateMeta[role]?role:'facilitator';
 clearRoleClasses();if(meta.className)f.classList.add(meta.className);
 $('#pContextState').textContent=meta.context;$('#pRole').textContent=meta.role;$('#referenceNote').textContent=meta.note;
 $$('[data-role-view]').forEach(b=>b.classList.toggle('selected',b.dataset.roleView===activeRoleView));
 $$('[data-ref-nav]').forEach(b=>b.classList.toggle('selected',b.dataset.refNav==='base'));
 if(announce)notify(`${bakedRoleLabel(activeRoleView)} role surface`);
}
function bakedRoleLabel(role){return ({scribe:'Scribe',facilitator:'Facilitator',notetaker:'Notetaker',whitecell:'White Cell',sme:'SME'})[role]||'Facilitator'}
function setRefState(state){
 const f=$('#plenumFrame'),meta=refStateMeta[state]||refStateMeta.base;
 f.classList.remove('show-dialog','show-command','show-landing','show-login','show-admin','show-extension','show-vote','show-voice');clearRoleClasses();
 if(meta.className)f.classList.add(meta.className);
 $$('[data-ref-state]').forEach(b=>b.classList.toggle('selected',b.dataset.refState===state));
 $$('[data-ref-nav]').forEach(b=>b.classList.toggle('selected',b.dataset.refNav===meta.nav));
 const rolebar=$('#referenceRolebar');if(rolebar)rolebar.hidden=state!=='base';
 if(state==='base'){setRoleView(activeRoleView,false)}else{$('#pContextState').textContent=meta.context;$('#pRole').textContent=meta.role;$('#referenceNote').textContent=meta.note}
}
$$('[data-ref-state]').forEach(b=>b.addEventListener('click',()=>setRefState(b.dataset.refState)));
$$('[data-ref-nav]').forEach(b=>b.addEventListener('click',()=>setRefState(b.dataset.refNav)));
$$('[data-role-view]').forEach(b=>b.addEventListener('click',()=>{activeRoleView=b.dataset.roleView;setRefState('base');notify(`${bakedRoleLabel(activeRoleView)} role surface`)}));

// Role-surface prototype behavior. These demos illustrate UI state only.
$('#scribeForwardDemo')?.addEventListener('click',e=>{const state=$('#scribeSaveState');state.textContent='FORWARDED';state.classList.remove('success');state.classList.add('info');e.currentTarget.textContent='Forwarded to Facilitator';e.currentTarget.disabled=true;notify('Prototype Scribe → Facilitator handoff')});
$('#noteCaptureDemo')?.addEventListener('click',e=>{e.currentTarget.textContent='Observation captured';setTimeout(()=>e.currentTarget.textContent='Add observation',900);notify('Prototype evidence observation captured')});
$('#whiteSendSmeDemo')?.addEventListener('click',()=>{activeRoleView='sme';setRefState('base');notify('Prototype White Cell → SME routing')});

const smeLaneData={
 macro:{title:'Macro assessment',eyebrow:'MACRO REVIEW CONSOLE',role:'SME · MACRO',fields:[['GDP-growth impact','Modest negative pressure on advanced-manufacturing export earnings; second-order drag on coastal SEZ employment over 12–18 months.'],['Allied cost distribution','Near-term costs concentrate on Japan and ROK equipment suppliers; co-investment mitigates part of the burden.'],['Implementation horizon','Processing capacity effect trails the immediate investment signal and should not be treated as instantaneous capacity.']]},
 ni:{title:'National interests & escalation',eyebrow:'NI & ESCALATION REVIEW CONSOLE',role:'SME · NI & ESCALATION',fields:[['Escalation dynamics','Red is likely to retaliate through targeted commercial pressure calibrated below a coordinated counter-response threshold.'],['Coalition cohesion','Low-to-medium risk; Green AP conditional participation remains the primary cohesion variable.'],['National-interest effect','Resilience gains are positive but unevenly distributed across participating allies and industries.']]},
 diplo:{title:'Diplomacy & information',eyebrow:'DIPLOMACY & INFORMATION REVIEW CONSOLE',role:'SME · DIPLOMACY / INFO',fields:[['Diplomatic yield','A multilateral licensing framework creates a visible co-signature moment while consuming diplomatic capital with key allies.'],['Information environment','Red information activity targeting Green AP is the primary narrative risk; coordinated allied announcement is a mitigating asset.'],['Signaling effect','Procurement and financing commitments improve credibility if announced with specific implementation milestones.']]}
};
function renderSmeLane(lane='macro'){const d=smeLaneData[lane]||smeLaneData.macro;$('#smeLaneTitle').textContent=d.title;$('#smeLaneEyebrow').textContent=d.eyebrow;$('#pRole').textContent=d.role;$('#referenceNote').textContent=`SME workspace · ${d.title.toLowerCase()} → recommendation → White Cell`;const f=$('#smeAssessmentFields');f.innerHTML=d.fields.map(([k,v])=>`<div class="sme-field"><span>${k}</span><p>${v}</p></div>`).join('');$$('[data-sme-lane]').forEach(b=>b.classList.toggle('selected',b.dataset.smeLane===lane));const st=$('#smeAssessmentState');st.textContent='DRAFT ASSESSMENT';st.classList.remove('success')}
$$('[data-sme-lane]').forEach(b=>b.addEventListener('click',()=>renderSmeLane(b.dataset.smeLane)));
$('#smeSendDemo')?.addEventListener('click',e=>{const st=$('#smeAssessmentState');st.textContent='SENT TO WHITE CELL';st.classList.add('success');e.currentTarget.textContent='Assessment sent';e.currentTarget.disabled=true;notify('Prototype SME → White Cell assessment handoff')});
renderSmeLane('macro');

// Entry, authentication, and administration reference states.
$('#landingSignIn')?.addEventListener('click',()=>setRefState('login'));
$('#landingEnter')?.addEventListener('click',()=>setRefState('login'));
$('#landingExplore')?.addEventListener('click',()=>setRefState('base'));
const loginForm=$('#plenumLoginForm'),loginEmail=$('#plenumLoginEmail'),loginPassword=$('#plenumLoginPassword'),loginState=$('#plenumLoginState');
function setLoginState(state,label){if(!loginState)return;loginState.dataset.state=state;const s=$('span',loginState);if(s)s.textContent=label}
async function demoLogin(source='credentials'){
 if(source==='credentials'&&(!loginEmail?.value.trim()||!loginPassword?.value)){setLoginState('error','Enter email and password to demonstrate sign-in.');(!loginEmail?.value.trim()?loginEmail:loginPassword)?.focus();return}
 setLoginState('loading',source==='sso'?'Contacting institutional identity provider…':'Verifying organization and role context…');
 await delay(720);
 setLoginState('success','Access established · opening workspace');
 await delay(360);
 setRefState('base');
 setTimeout(()=>setLoginState('idle','Ready'),300);
}
loginForm?.addEventListener('submit',e=>{e.preventDefault();demoLogin('credentials')});
$('#plenumLoginSSO')?.addEventListener('click',()=>demoLogin('sso'));
const adminMeta={overview:['ORGANIZATION OVERVIEW','Control plane','Deployment health, active simulation workload, capability posture, and governance queues.'],sessions:['SESSION OPERATIONS','Sessions','Active, scheduled, completed, and paused Sessions across authorized deployments.'],access:['IDENTITY & ACCESS','Users & roles','Organization membership, Seat eligibility sources, role grants, revocations, and approval queues.'],releases:['RELEASE GOVERNANCE','Releases','Published Simulation Releases, activation posture, compatibility, and controlled migration.'],extensions:['EXTENSION GOVERNANCE','Extensions','Approved publishers, installed artifacts, pinned digests, availability, and review posture.'],voting:['VOTING ADAPTERS','Voting methods','Installed deterministic tally methods, versions, compatibility, and deployment availability.'],media:['MEDIA PROVIDERS','Media providers','Media Provider bindings, health, local availability, and controlled capability posture.'],security:['SECURITY & EVIDENCE','Security & audit','Policy changes, administrator actions, security posture, and evidence-linked audit review.']};
$$('[data-admin-section]').forEach(b=>b.addEventListener('click',()=>{const m=adminMeta[b.dataset.adminSection]||adminMeta.overview;$$('[data-admin-section]').forEach(x=>x.classList.toggle('selected',x===b));$('#adminSectionEyebrow').textContent=m[0];$('#adminSectionTitle').textContent=m[1];$('#adminSectionDescription').textContent=m[2];notify(`${m[1]} · reference state`)}));
$('#adminAuditDemo')?.addEventListener('click',()=>{const b=$('[data-admin-section="security"]');b?.click()});

$('#pForward').addEventListener('click',()=>setRefState('dialog'));$$('[data-close-overlay]').forEach(b=>b.addEventListener('click',()=>setRefState('base')));$('#pScrim').addEventListener('click',()=>setRefState('base'));

// Capability-state demos — visual prototypes, never authoritative operations.
$('#approveEffectDemo')?.addEventListener('click',e=>{const s=$('#effectStatus');s.textContent='APPROVED · COMMAND ISSUED';s.classList.remove('caution');s.classList.add('success');e.currentTarget.disabled=true;notify('Prototype effect approval state')});
$('#castDemoBallot')?.addEventListener('click',e=>{const selected=$('input[name="demoBallot"]:checked');if(!selected){notify('Choose a ballot option');$('input[name="demoBallot"]')?.focus();return}const s=$('#ballotState');s.textContent='SUBMITTED';s.classList.remove('success');e.currentTarget.disabled=true;setTimeout(()=>{s.textContent='ACCEPTED · RECEIPT ISSUED';s.classList.add('success');e.currentTarget.textContent='Ballot accepted';notify('Prototype ballot accepted state')},420)});
function requestFloorDemo(){const s=$('#floorDemoState');if(!s)return;s.textContent='Queued behind current Floor holder · request will not replay offline.';notify('Prototype floor request queued')}
$('#requestFloorDemo')?.addEventListener('click',requestFloorDemo);$$('[data-floor-request]').forEach(b=>b.addEventListener('click',requestFloorDemo));

// Search / command dialog
const dialog=$('#searchDialog'),search=$('#catalogSearch'),results=$('#searchResults');let resultItems=[],activeResult=0;
const sections=$$('.searchable').map(s=>({id:s.id,title:$('.section-heading h2',s)?.textContent || $('h1',s)?.textContent || s.id,kicker:$('.section-kicker',s)?.textContent||'',text:(s.dataset.search||'')+' '+s.textContent}));
function renderSearch(q=''){const term=q.trim().toLowerCase();const found=(term?sections.filter(s=>s.text.toLowerCase().includes(term)):sections).slice(0,12);results.innerHTML='';found.forEach((s,i)=>{const a=document.createElement('a');a.href=`#${s.id}`;a.className='search-result'+(i===0?' active':'');a.innerHTML=`<div><b>${s.title}</b><br><small>${s.kicker}</small></div><span>↵</span>`;a.addEventListener('click',closeSearch);results.appendChild(a)});resultItems=$$('.search-result',results);activeResult=0;if(!found.length)results.innerHTML='<div class="search-result"><small>No matching catalog entry.</small></div>'}
function openSearch(){dialog.hidden=false;requestAnimationFrame(()=>search.focus());renderSearch(search.value)}function closeSearch(){dialog.hidden=true;search.value=''}
$('#commandTrigger').addEventListener('click',openSearch);$('#closeSearch').addEventListener('click',closeSearch);search.addEventListener('input',e=>renderSearch(e.target.value));
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return}if(e.key==='Escape'){if(!dialog.hidden)closeSearch();else setRefState('base')}if(!dialog.hidden&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(e.key==='ArrowDown')activeResult=Math.min(resultItems.length-1,activeResult+1);if(e.key==='ArrowUp')activeResult=Math.max(0,activeResult-1);resultItems.forEach((x,i)=>x.classList.toggle('active',i===activeResult));resultItems[activeResult]?.scrollIntoView({block:'nearest'});if(e.key==='Enter')resultItems[activeResult]?.click()}});dialog.addEventListener('click',e=>{if(e.target===dialog)closeSearch()});

// Active nav via IntersectionObserver
const navLinks=$$('.nav-link');const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${visible.target.id}`))},{rootMargin:'-15% 0px -70% 0px',threshold:[0,.1,.2,.4]});$$('.catalog-section').forEach(s=>observer.observe(s));

// Mobile nav
$('#mobileNavToggle').addEventListener('click',()=>{document.body.classList.toggle('nav-open');$('#mobileNavToggle').setAttribute('aria-expanded',document.body.classList.contains('nav-open'))});navLinks.forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('nav-open')));

renderSearch();
