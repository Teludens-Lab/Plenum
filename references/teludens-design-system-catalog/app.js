const TOKENS = {
  "primitive": {
    "neutral": {
      "0": "#FFFFFF",
      "25": "#FAFBF9",
      "50": "#F5F7F4",
      "100": "#ECEFEB",
      "200": "#DCE2DB",
      "300": "#C1CAC0",
      "400": "#9CA89E",
      "500": "#738078",
      "600": "#56625B",
      "700": "#3B4740",
      "800": "#28322C",
      "900": "#1C241F",
      "950": "#141715"
    },
    "mineralSage": {
      "50": "#F2F5F1",
      "100": "#E4EBE2",
      "200": "#D1DECF",
      "300": "#B6C7B3",
      "400": "#9DAF9B",
      "500": "#627E68",
      "600": "#455F4B",
      "700": "#344D3B",
      "800": "#253D2D",
      "900": "#25382B"
    },
    "cobalt": {
      "100": "#E7EEFF",
      "500": "#3567D6",
      "700": "#24489E"
    },
    "green": {
      "100": "#E5F4EA",
      "500": "#2E7D4F",
      "700": "#205A39"
    },
    "amber": {
      "100": "#FFF0D1",
      "500": "#A96500",
      "700": "#754700"
    },
    "crimson": {
      "100": "#FDE5E3",
      "500": "#D13C32",
      "700": "#9C2923"
    }
  },
  "semantic": {
    "light": {
      "material/canvas": "#F5F7F4",
      "material/workspace": "#FAFBF9",
      "material/surface": "#FFFFFF",
      "material/surfaceRaised": "#FFFFFF",
      "material/surfaceRecessed": "#ECEFEB",
      "material/control": "#ECEFEB",
      "material/selection": "#ECEFEB",
      "material/focusHalo": "#DCE8DF",
      "text/primary": "#1C241F",
      "text/secondary": "#3B4740",
      "boundary/subtle": "#DCE2DB",
      "boundary/standard": "#C1CAC0",
      "signal/decision": "#455F4B",
      "signal/decisionSoft": "#E4EBE2",
      "signal/decisionFill": "#455F4B",
      "signal/decisionText": "#344D3B",
      "focus/ring": "#344D3B",
      "info/default": "#3567D6",
      "info/text": "#24489E",
      "success/default": "#2E7D4F",
      "success/text": "#205A39",
      "caution/default": "#A96500",
      "caution/text": "#754700",
      "error/default": "#D13C32",
      "error/text": "#9C2923"
    },
    "dark": {
      "material/canvas": "#141715",
      "material/workspace": "#1C241F",
      "material/surface": "#28322C",
      "material/surfaceRaised": "#3B4740",
      "material/surfaceRecessed": "#141715",
      "material/control": "#3B4740",
      "material/selection": "#323B34",
      "material/focusHalo": "#324F3D",
      "text/primary": "#F5F7F4",
      "text/secondary": "#C1CAC0",
      "boundary/subtle": "#3B4740",
      "boundary/standard": "#56625B",
      "signal/decision": "#B6C7B3",
      "signal/decisionSoft": "#283B2E",
      "signal/decisionFill": "#B6C7B3",
      "signal/decisionText": "#D1DECF",
      "focus/ring": "#D1DECF",
      "info/default": "#3567D6",
      "info/text": "#E7EEFF",
      "success/default": "#2E7D4F",
      "success/text": "#E5F4EA",
      "caution/default": "#A96500",
      "caution/text": "#FFF0D1",
      "error/default": "#D13C32",
      "error/text": "#FDE5E3"
    }
  },
  "density": {
    "focus": {
      "controlHeight": 48,
      "rowHeight": 44,
      "toolbarHeight": 48,
      "panelPadding": 24,
      "sectionGap": 28,
      "inlineGap": 12
    },
    "standard": {
      "controlHeight": 42,
      "rowHeight": 36,
      "toolbarHeight": 44,
      "panelPadding": 16,
      "sectionGap": 22,
      "inlineGap": 10
    },
    "operations": {
      "controlHeight": 38,
      "rowHeight": 30,
      "toolbarHeight": 40,
      "panelPadding": 12,
      "sectionGap": 14,
      "inlineGap": 8
    }
  },
  "motion": {
    "press": 80,
    "hover": 110,
    "selection": 140,
    "tooltip": 150,
    "popover": 180,
    "modal": 210,
    "panel": 220,
    "view": 260,
    "majorCausal": 340
  },
  "loading": {
    "indicatorDelay": 180,
    "minimumVisible": 400,
    "skeletonCycle": 1200
  }
};

const $=(s,c=document)=>c.querySelector(s);const $$=(s,c=document)=>[...c.querySelectorAll(s)];
// Keeps the visual .selected class and the announced aria-pressed state in sync.
function syncPressed(buttons,isOn){buttons.forEach(b=>{const on=isOn(b);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))})}
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
$$('[data-density-value]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.densityValue;document.documentElement.dataset.density=mode;syncPressed($$('[data-density-value]'),x=>x===b);renderDensityMetrics(mode);notify(`${mode[0].toUpperCase()+mode.slice(1)} density`)}));

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
  syncPressed($$('[data-transition-demo]'),b=>b.dataset.transitionDemo===mode);
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
function activateOnKey(el){el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true}))}})}
const legend=$('#grammarLegend');Object.entries(grammarInfo).forEach(([name,desc],i)=>{const item=document.createElement('div');item.className='grammar-item'+(i===0?' active':'');item.setAttribute('role','button');item.tabIndex=0;item.setAttribute('aria-pressed',String(i===0));item.innerHTML=`<span>0${i+1}</span><h4>${name}</h4><p>${desc}</p>`;item.addEventListener('click',()=>{$$('.grammar-item').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false')});item.classList.add('active');item.setAttribute('aria-pressed','true');$('#grammarReadout').textContent=`${name}: ${desc}`});activateOnKey(item);legend.appendChild(item)});
$$('.grammar-node,.grammar-gate').forEach(activateOnKey);
$$('.grammar-node,.grammar-gate').forEach(n=>n.addEventListener('click',()=>{const isAlt=n.dataset.node==='Alternate';$$('.grammar-node,.grammar-gate').forEach(x=>x.classList.remove('active'));n.classList.add('active');$$('.grammar-path').forEach(p=>p.classList.remove('active'));if(isAlt){$$('[data-path="a"],[data-path="c"],[data-path="e"]').forEach(p=>p.classList.add('active'));$('#grammarReadout').textContent='Alternate path: Decision → Branch → Alternate → State'}else{$$('[data-path="a"],[data-path="b"],[data-path="d"]').forEach(p=>p.classList.add('active'));$('#grammarReadout').textContent='Current path: Decision → Gate → State'}}));

const statuses=[['Draft','draft'],['Facilitator Review','review'],['Returned','returned'],['White Cell','white'],['Accepted','accepted'],['Resolved','resolved']];const statusStrip=$('#statusStrip');statuses.forEach(([label,c])=>statusStrip.insertAdjacentHTML('beforeend',`<span class="proposal-status ${c}">${label}</span>`));
const proposals=['Port access guarantees and emergency logistics corridor','Temporary tariff relief for strategic components','Fuel allocation priority for coastal transport nodes','Industrial credit backstop for priority manufacturers','Public statement on regional supply assurance','Emergency customs waiver for critical imports'];
function proposalRowHTML(title,i,compact=false){return `<div class="proposal-row ${i===0?'selected':''}"><span>P-${142+i}</span><span>Blue · Industry</span><span>${title}</span><span>MOVE 02</span><span>Facilitator</span><span class="proposal-status review">Review</span></div>`}
const proposalTable=$('#proposalTable');proposals.forEach((p,i)=>proposalTable.insertAdjacentHTML('beforeend',proposalRowHTML(p,i)));const pList=$('#pList');proposals.forEach((p,i)=>pList.insertAdjacentHTML('beforeend',proposalRowHTML(p,i,true)));

// Theme
$('#themeToggle').addEventListener('click',()=>{const root=document.documentElement;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';$('#themeToggle').setAttribute('aria-pressed',String(root.dataset.theme==='dark'));renderSemantic();notify(`${root.dataset.theme==='dark'?'Dark':'Light'} theme`)});

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
 syncPressed($$('[data-role-view]'),b=>b.dataset.roleView===activeRoleView);
 $$('[data-ref-nav]').forEach(b=>b.classList.toggle('selected',b.dataset.refNav==='base'));
 if(activeRoleView==='sme')renderSmeLane(activeSmeLane);
 if(announce)notify(`${bakedRoleLabel(activeRoleView)} role surface`);
}
function bakedRoleLabel(role){return ({scribe:'Scribe',facilitator:'Facilitator',notetaker:'Notetaker',whitecell:'White Cell',sme:'SME'})[role]||'Facilitator'}
let activeRefState='base',overlayReturnFocus=null;
function setRefState(state){
 const f=$('#plenumFrame'),meta=refStateMeta[state]||refStateMeta.base,previous=activeRefState;activeRefState=refStateMeta[state]?state:'base';
 f.classList.remove('show-dialog','show-command','show-landing','show-login','show-admin','show-extension','show-vote','show-voice');clearRoleClasses();
 if(meta.className)f.classList.add(meta.className);
 syncPressed($$('[data-ref-state]'),b=>b.dataset.refState===state);
 $$('[data-ref-nav]').forEach(b=>b.classList.toggle('selected',b.dataset.refNav===meta.nav));
 const rolebar=$('#referenceRolebar');if(rolebar)rolebar.hidden=state!=='base';
 resetPrototypeDemos();
 if(state==='base'){setRoleView(activeRoleView,false)}else{$('#pContextState').textContent=meta.context;$('#pRole').textContent=meta.role;$('#referenceNote').textContent=meta.note}
 // Hidden overlays stay out of the tab order; opening one moves focus in, closing returns it.
 const pDialog=$('#pDialog'),pCommand=$('#pCommand'),overlayOpen=activeRefState==='dialog'||activeRefState==='command',wasOpen=previous==='dialog'||previous==='command';
 pDialog.inert=activeRefState!=='dialog';pCommand.inert=activeRefState!=='command';
 if(overlayOpen){if(!wasOpen)overlayReturnFocus=document.activeElement;(activeRefState==='dialog'?$('[data-close-overlay]',pDialog):pCommand).focus({preventScroll:true})}
 else if(wasOpen){const target=overlayReturnFocus;overlayReturnFocus=null;if(target?.isConnected&&!target.closest('[inert]'))target.focus({preventScroll:true})}
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
let activeSmeLane='macro';
function renderSmeLane(lane='macro'){const d=smeLaneData[lane]||smeLaneData.macro;activeSmeLane=smeLaneData[lane]?lane:'macro';$('#smeLaneTitle').textContent=d.title;$('#smeLaneEyebrow').textContent=d.eyebrow;$('#pRole').textContent=d.role;$('#referenceNote').textContent=`SME workspace · ${d.title.toLowerCase()} → recommendation → White Cell`;const f=$('#smeAssessmentFields');f.innerHTML=d.fields.map(([k,v])=>`<div class="sme-field"><span>${k}</span><p>${v}</p></div>`).join('');syncPressed($$('[data-sme-lane]'),b=>b.dataset.smeLane===activeSmeLane);const st=$('#smeAssessmentState');st.textContent='DRAFT ASSESSMENT';st.classList.remove('success');const send=$('#smeSendDemo');if(send){send.textContent='Send to White Cell';send.disabled=false}}
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
$$('[data-admin-section]').forEach(b=>b.addEventListener('click',()=>{const m=adminMeta[b.dataset.adminSection]||adminMeta.overview;syncPressed($$('[data-admin-section]'),x=>x===b);$('#adminSectionEyebrow').textContent=m[0];$('#adminSectionTitle').textContent=m[1];$('#adminSectionDescription').textContent=m[2];notify(`${m[1]} · reference state`)}));
$('#adminAuditDemo')?.addEventListener('click',()=>{const b=$('[data-admin-section="security"]');b?.click()});

$('#pForward').addEventListener('click',()=>setRefState('dialog'));$$('[data-close-overlay]').forEach(b=>b.addEventListener('click',()=>setRefState('base')));$('#pScrim').addEventListener('click',()=>setRefState('base'));

// Capability-state demos — visual prototypes, never authoritative operations.
$('#approveEffectDemo')?.addEventListener('click',e=>{const s=$('#effectStatus');s.textContent='APPROVED · COMMAND ISSUED';s.classList.remove('caution');s.classList.add('success');e.currentTarget.disabled=true;notify('Prototype effect approval state')});
let ballotTimer;
$('#castDemoBallot')?.addEventListener('click',e=>{const selected=$('input[name="demoBallot"]:checked');if(!selected){notify('Choose a ballot option');$('input[name="demoBallot"]')?.focus();return}const s=$('#ballotState'),btn=e.currentTarget;s.textContent='SUBMITTED';s.classList.remove('success');btn.disabled=true;clearTimeout(ballotTimer);ballotTimer=setTimeout(()=>{s.textContent='ACCEPTED · RECEIPT ISSUED';s.classList.add('success');btn.textContent='Ballot accepted';notify('Prototype ballot accepted state')},420)});
function requestFloorDemo(){const s=$('#floorDemoState');if(!s)return;s.textContent='Queued behind current Floor holder · request will not replay offline.';notify('Prototype floor request queued')}
$('#requestFloorDemo')?.addEventListener('click',requestFloorDemo);$$('[data-floor-request]').forEach(b=>b.addEventListener('click',requestFloorDemo));
// Prototype demos return to their starting state whenever the slice changes view.
function resetPrototypeDemos(){
 const scribeState=$('#scribeSaveState'),scribeBtn=$('#scribeForwardDemo');if(scribeState){scribeState.textContent='AUTOSAVED';scribeState.classList.remove('info');scribeState.classList.add('success')}if(scribeBtn){scribeBtn.textContent='Forward to Facilitator';scribeBtn.disabled=false}
 const effect=$('#effectStatus'),approve=$('#approveEffectDemo');if(effect){effect.textContent='IN REVIEW · NOT APPLIED';effect.classList.remove('success');effect.classList.add('caution')}if(approve)approve.disabled=false;
 clearTimeout(ballotTimer);const ballot=$('#ballotState'),cast=$('#castDemoBallot');if(ballot){ballot.textContent='READY TO CAST';ballot.classList.remove('success')}if(cast){cast.textContent='Cast ballot';cast.disabled=false}$$('input[name="demoBallot"]').forEach(x=>{x.checked=false});
 const floor=$('#floorDemoState');if(floor)floor.textContent='Your microphone is listen-only until a Floor is granted.';
}

// Expanded view — renders the slice at 1.6× so its smallest labels reach the Detail role size.
const plenumStage=$('#plenumStage'),plenumExpand=$('#plenumExpand');
function setPlenumExpanded(on){
 if(!plenumStage||!plenumExpand)return;
 plenumStage.classList.toggle('is-expanded',on);document.body.classList.toggle('plenum-expanded',on);
 [$('.sidebar'),$('.topbar'),$('#plenum .section-heading'),$('.catalog-footer'),...$$('.catalog-section:not(#plenum)')].forEach(el=>{if(el)el.inert=on});
 plenumExpand.setAttribute('aria-pressed',String(on));plenumExpand.textContent=on?'Exit expanded view':'Expand';
 if(on)plenumStage.scrollTo(0,0);
 plenumExpand.focus({preventScroll:true});
 notify(on?'Expanded view · 1.6×':'Inline view');
}
plenumExpand?.addEventListener('click',()=>setPlenumExpanded(!plenumStage.classList.contains('is-expanded')));

// Search / command dialog
const dialog=$('#searchDialog'),search=$('#catalogSearch'),results=$('#searchResults');let resultItems=[],activeResult=0;
const sections=$$('.searchable').map(s=>({id:s.id,title:$('.section-heading h2',s)?.textContent || $('h1',s)?.textContent || s.id,kicker:$('.section-kicker',s)?.textContent||'',text:(s.dataset.search||'')+' '+s.textContent}));
function renderSearch(q=''){const term=q.trim().toLowerCase();const found=(term?sections.filter(s=>s.text.toLowerCase().includes(term)):sections).slice(0,12);results.innerHTML='';found.forEach((s,i)=>{const a=document.createElement('a');a.href=`#${s.id}`;a.className='search-result'+(i===0?' active':'');a.innerHTML=`<div><b>${s.title}</b><br><small>${s.kicker}</small></div><span>↵</span>`;a.addEventListener('click',()=>closeSearch(false));results.appendChild(a)});resultItems=$$('.search-result',results);activeResult=0;if(!found.length)results.innerHTML='<div class="search-result"><small>No matching catalog entry.</small></div>'}
let searchReturnFocus=null;
function openSearch(){if(!dialog.hidden){search.focus();return}searchReturnFocus=document.activeElement;$('.app-shell').inert=true;dialog.hidden=false;requestAnimationFrame(()=>search.focus());renderSearch(search.value)}
function closeSearch(restoreFocus=true){dialog.hidden=true;search.value='';$('.app-shell').inert=false;const target=searchReturnFocus;searchReturnFocus=null;if(restoreFocus&&target?.isConnected&&!target.closest('[inert]'))target.focus()}
$('#commandTrigger').addEventListener('click',openSearch);$('#closeSearch').addEventListener('click',()=>closeSearch());search.addEventListener('input',e=>renderSearch(e.target.value));
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return}if(e.key==='Escape'){if(!dialog.hidden){closeSearch();return}if(document.body.classList.contains('nav-open')){closeMobileNav(true);return}const frame=$('#plenumFrame');if(frame.classList.contains('show-dialog')||frame.classList.contains('show-command')){setRefState('base');return}if(plenumStage?.classList.contains('is-expanded')){setPlenumExpanded(false);return}return}if(!dialog.hidden&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(e.key==='ArrowDown')activeResult=Math.min(resultItems.length-1,activeResult+1);if(e.key==='ArrowUp')activeResult=Math.max(0,activeResult-1);resultItems.forEach((x,i)=>x.classList.toggle('active',i===activeResult));resultItems[activeResult]?.scrollIntoView({block:'nearest'});if(e.key==='Enter')resultItems[activeResult]?.click()}});dialog.addEventListener('click',e=>{if(e.target===dialog)closeSearch()});

// Active nav via IntersectionObserver
const navLinks=$$('.nav-link');const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${visible.target.id}`))},{rootMargin:'-15% 0px -70% 0px',threshold:[0,.1,.2,.4]});$$('.catalog-section').forEach(s=>observer.observe(s));

// Mobile nav
function closeMobileNav(restoreFocus=false){document.body.classList.remove('nav-open');const t=$('#mobileNavToggle');t.setAttribute('aria-expanded','false');if(restoreFocus)t.focus()}
$('#mobileNavToggle').addEventListener('click',()=>{document.body.classList.toggle('nav-open');$('#mobileNavToggle').setAttribute('aria-expanded',document.body.classList.contains('nav-open'))});navLinks.forEach(a=>a.addEventListener('click',()=>closeMobileNav()));

// Initial state — announce the pressed state of toggle groups and sync the slice header with the default surface.
$$('[data-density-value],[data-admin-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('selected'))));
setRefState('base');
renderSearch();

/* TELUDENS v1.1: Operational design language specimens (local only). */
(()=>{
const states={
 idle:['READY','Resting; no user interaction or unsaved changes.','Enabled','No recovery necessary.'],hover:['AVAILABLE','Pointer indicates an available action.','Enabled','No recovery necessary.'],focus:['FOCUSED','Keyboard focus is visible and never conveyed by color alone.','Enabled','Tab or Shift+Tab moves focus.'],active:['PRESSED','Direct press feedback precedes the resulting transition.','Enabled','Release or cancel the press.'],selected:['SELECTED','Object is the current selection; it is not necessarily focused.','Enabled','Select another object.'],editing:['EDITING','Local changes exist but are not committed.','Enabled','Save or discard deliberately.'],saving:['SAVING','A request is in flight; do not claim completion.','Read-only during save','Await confirmation; retry on failure.'],saved:['SAVED','A confirmed write has finished.','Enabled','Undo only if supported by the service.'],pending:['PENDING','An operation has been submitted but not resolved.','Depends on operation','Provide status, cancel if possible.'],stale:['STALE','Displayed data no longer matches the latest known version.','Read-only pending refresh','Refresh and reconcile changes.'],conflicting:['CONFLICT','Concurrent updates require reconciliation.','Temporarily read-only','Compare versions and resolve.'],rejected:['REJECTED','Server rejected an attempted operation.','Enabled after correction','Correct the cause, then retry.'],locked:['LOCKED','Authority or policy prevents modification.','Read-only','Request access if a path exists.'],disabled:['DISABLED','A control is temporarily unavailable.','Disabled','Explain prerequisite outside the control.'],offline:['OFFLINE','Connection unavailable; locally permitted actions only.','Read-only for this specimen','Reconnect; reconcile before mutation.']};
const opt=$('#stateOptions');let chosen='idle';
Object.keys(states).forEach(key=>{const b=document.createElement('button');b.textContent=key[0].toUpperCase()+key.slice(1);b.type='button';b.setAttribute('aria-pressed',String(key==='idle'));b.addEventListener('click',()=>{chosen=key;drawState()});opt.appendChild(b)});
function drawState(){const m=states[chosen],example=$('#stateExample'),input=$('#stateDemoInput'),action=$('#stateDemoAction');$('#stateDemoTitle').textContent=chosen[0].toUpperCase()+chosen.slice(1);$('#stateDemoSignal').textContent=m[0];$('#stateMeaning').textContent=m[1];$('#stateInput').textContent=m[2];$('#stateRecovery').textContent=m[3];example.dataset.state=chosen;input.disabled=['disabled','locked'].includes(chosen);input.readOnly=['saving','pending','stale','conflicting','offline'].includes(chosen);action.disabled=['disabled','locked','saving','pending','conflicting','offline'].includes(chosen);action.textContent=chosen==='saving'?'Saving…':chosen==='saved'?'Saved':chosen==='pending'?'Pending…':'Save changes';$$('button',opt).forEach(b=>b.setAttribute('aria-pressed',String(b.textContent.toLowerCase()===chosen)))}drawState();$('#stateDemoAction').addEventListener('click',()=>{chosen='saving';drawState();setTimeout(()=>{if(chosen==='saving'){chosen='saved';drawState()}},650)});
const shell=$('#spatialShell'),resizer=$('#spatialResizer');const key='teludens-layout-specimen-v1';let width=260;
function applyLayout(layout){width=Math.min(460,Math.max(200,Number(layout.width)||260));shell.style.setProperty('--inspector-width',width+'px');shell.classList.toggle('no-nav',!!layout.noNav);shell.classList.toggle('no-inspector',!!layout.noInspector);shell.classList.toggle('dock-bottom',!!layout.dock);$('#toggleSpatialNav').setAttribute('aria-pressed',String(!layout.noNav));$('#toggleSpatialInspector').setAttribute('aria-pressed',String(!layout.noInspector));$('#toggleSpatialDock').setAttribute('aria-pressed',String(!!layout.dock));resizer.setAttribute('aria-valuenow',String(width));}
function currentLayout(){return{width,noNav:shell.classList.contains('no-nav'),noInspector:shell.classList.contains('no-inspector'),dock:shell.classList.contains('dock-bottom')}}
function persist(){try{localStorage.setItem(key,JSON.stringify(currentLayout()))}catch{}}
try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored)applyLayout(stored)}catch{}
$('#toggleSpatialNav').addEventListener('click',()=>{shell.classList.toggle('no-nav');applyLayout(currentLayout());persist()});$('#toggleSpatialInspector').addEventListener('click',()=>{shell.classList.toggle('no-inspector');applyLayout(currentLayout());persist()});$('#toggleSpatialDock').addEventListener('click',()=>{shell.classList.toggle('dock-bottom');applyLayout(currentLayout());persist()});$('#resetSpatial').addEventListener('click',()=>{applyLayout({width:260});persist()});
function resizeTo(px){width=Math.max(200,Math.min(460,Math.round(px)));shell.style.setProperty('--inspector-width',width+'px');resizer.setAttribute('aria-valuenow',String(width))}
resizer.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();resizeTo(e.key==='Home'?200:e.key==='End'?460:width+(e.key==='ArrowLeft'?10:-10));persist()}});
resizer.addEventListener('pointerdown',e=>{if(shell.classList.contains('dock-bottom')||shell.classList.contains('no-inspector'))return;e.preventDefault();resizer.setPointerCapture(e.pointerId);const start=e.clientX,initial=width;const move=ev=>resizeTo(initial-(ev.clientX-start));const stop=()=>{resizer.removeEventListener('pointermove',move);resizer.removeEventListener('pointerup',stop);resizer.removeEventListener('pointercancel',stop);persist()};resizer.addEventListener('pointermove',move);resizer.addEventListener('pointerup',stop);resizer.addEventListener('pointercancel',stop)});
const records=[{entity:'Provincial agency',kind:'Institution',relation:'Issued award A',confidence:100},{entity:'Supplier One',kind:'Supplier',relation:'Reported award recipient',confidence:92},{entity:'Supplier Two',kind:'Supplier',relation:'Candidate linked entity',confidence:54},{entity:'Award A',kind:'Contract',relation:'Connected to agency',confidence:98}];let sort='entity',descending=false;
function renderRecords(){const q=$('#analyticsFilter').value.trim().toLowerCase();const visible=records.filter(x=>Object.values(x).some(v=>String(v).toLowerCase().includes(q))).sort((a,b)=>{const x=a[sort],y=b[sort];return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*(descending?-1:1)});$('#analyticsRows').innerHTML='';for(const r of visible){const tr=document.createElement('tr');for(const value of [r.entity,r.kind,r.relation,`${r.confidence}% · ${r.confidence<60?'review':'documented'}`]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td)}$('#analyticsRows').appendChild(tr)}$('#analyticsCount').textContent=`${visible.length} of ${records.length} illustrative records · confidence values are synthetic specimen data.`}
$$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{descending=sort===b.dataset.sort?!descending:false;sort=b.dataset.sort;renderRecords()}));$('#analyticsFilter').addEventListener('input',renderRecords);renderRecords();
$$('[data-analytics-view]').forEach(b=>b.addEventListener('click',()=>{$$('[data-analytics-view]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});for(const [name,id] of Object.entries({table:'analyticsTableView',graph:'analyticsGraphView',timeline:'analyticsTimelineView'}))$('#'+id).hidden=b.dataset.analyticsView!==name}));
const feedback={validation:['Check the proposal title','A title is required before submission. The field should receive focus and an inline error.','validation','No changes submitted',false,false],network:['Save did not complete','The connection was interrupted. Your local draft is preserved; retry when connected.','error','No confirmed server change',true,false],conflict:['Newer version available','Another participant updated this record. Review the latest version before reconciling.','conflict','Conflicting write not applied',true,false],permission:['Access denied','Your current role cannot publish this ruling. Request the appropriate authorization.','permission','No change permitted',false,false],success:['Change confirmed','The specimen has applied a reversible local change. Undo is available below.','success','Local demo change · reversible',false,true]};let lastFeedback=null;
function showFeedback(name){lastFeedback=name;const [title,desc,kind,audit,retry,undo]=feedback[name];const el=$('#feedbackResult');el.dataset.kind=kind;el.querySelector('strong').textContent=title;el.querySelector('p').textContent=desc;$('#feedbackAudit').textContent=audit;$('#feedbackRetry').hidden=!retry;$('#feedbackUndo').hidden=!undo;}
$$('[data-feedback]').forEach(b=>b.addEventListener('click',()=>showFeedback(b.dataset.feedback)));$('#feedbackRetry').addEventListener('click',()=>{showFeedback('success')});$('#feedbackUndo').addEventListener('click',()=>{const el=$('#feedbackResult');el.dataset.kind='';el.querySelector('strong').textContent='Local change undone';el.querySelector('p').textContent='The previous local specimen state was restored.';$('#feedbackAudit').textContent='Local state restored';$('#feedbackUndo').hidden=true});
const symbols={Decision:'<circle cx="12" cy="12" r="8"/><path d="M9 12h6m-3-3 3 3-3 3"/>',Actor:'<circle cx="12" cy="7.5" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',Branch:'<path d="M5 4v16M5 12h7l7-7m-7 7 7 7"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>',Gate:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 12h6m-3-3 3 3-3 3"/>',Evidence:'<path d="M7 3h8l4 4v14H7zM15 3v5h4M10 13h6M10 17h6"/>',Time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>',Search:'<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/>',Inspect:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M15 9h3M15 13h3"/>',Compare:'<rect x="2" y="5" width="8" height="14" rx="1"/><rect x="14" y="5" width="8" height="14" rx="1"/>',Warning:'<path d="M12 3 22 21H2zM12 9v5m0 3v1"/>',Locked:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',Offline:'<path d="M3 10q9-9 18 0M6 13q6-6 12 0m-9 3q3-3 6 0m-3 3h.01M3 3l18 18"/>'};
const symbolGrid=$('#symbolGrid');for(const [name,shape] of Object.entries(symbols)){const el=document.createElement('div');el.className='symbol-cell';el.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${shape}</svg><span>${name}</span>`;symbolGrid.appendChild(el)}$$('[data-icon-size]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.iconSize;$$('.symbol-cell svg').forEach(el=>{el.setAttribute('width',n);el.setAttribute('height',n)});$$('[data-icon-size]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))})}));
const choices=$$('#a11yChoice [role=radio]');function selectChoice(i,focus=true){choices.forEach((b,j)=>{b.setAttribute('aria-checked',String(i===j));b.tabIndex=i===j?0:-1});$('#a11yStatus').textContent=choices[i].textContent+' selected';if(focus)choices[i].focus()}choices.forEach((b,i)=>{b.addEventListener('click',()=>selectChoice(i,false));b.addEventListener('keydown',e=>{let j=i;if(e.key==='ArrowRight'||e.key==='ArrowDown')j=(i+1)%choices.length;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')j=(i+choices.length-1)%choices.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=choices.length-1;else return;e.preventDefault();selectChoice(j)})});
$('#a11yHighContrast').addEventListener('change',e=>document.documentElement.classList.toggle('teludens-high-contrast',e.target.checked));$('#a11yReduceMotion').addEventListener('change',e=>document.documentElement.classList.toggle('teludens-motion-off',e.target.checked));$('#a11yReset').addEventListener('click',()=>{for(const id of ['a11yHighContrast','a11yReduceMotion'])$('#'+id).checked=false;document.documentElement.classList.remove('teludens-high-contrast','teludens-motion-off');selectChoice(0,false)});
})();

// v1.3 — institutional specimens (local demonstrations only)
(()=>{
const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));const $=sel=>document.querySelector(sel);
const views={instrument:'#instInstrument',record:'#instRecord',materials:'#instMaterials',audit:'#instAudit'};
$$('[data-institutional-view]').forEach(btn=>btn.addEventListener('click',()=>{
 const name=btn.dataset.institutionalView;
 Object.entries(views).forEach(([key,id])=>{const node=$(id);if(node)node.hidden=key!==name});
 $$('[data-institutional-view]').forEach(b=>{const selected=b===btn;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
}));
const records={'P-142':['Port access guarantees','Facilitator','14:08'],'P-143':['Regional logistics continuity','Facilitator','14:12'],'P-144':['Fuel allocation priority','Scribe','14:18']};
$$('[data-inst-record]').forEach(btn=>btn.addEventListener('click',()=>{
 const id=btn.dataset.instRecord;$$('[data-inst-record]').forEach(x=>{x.classList.toggle('selected',x===btn);x.setAttribute('aria-pressed',String(x===btn))});
 $('#instRecordId').textContent=id;$('#instRecordTitle').textContent=records[id][0];
 const values=$$('.inst-inspector dl dd');if(values[0])values[0].textContent=records[id][1];if(values[3])values[3].textContent=records[id][2];
}));
$$('[data-inst-nav]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-inst-nav]').forEach(x=>{x.classList.toggle('selected',x===btn);x.setAttribute('aria-current',x===btn?'page':'false')});$('#instHeading').textContent=btn.dataset.instNav}));
const checklist=$$('#instAuditList input');function updateAudit(){const count=checklist.filter(x=>x.checked).length;$('#instAuditResult').textContent=`${count} / ${checklist.length} checks complete`;}checklist.forEach(input=>input.addEventListener('change',updateAudit));
$('#instPrint')?.addEventListener('click',()=>window.print());
})();
