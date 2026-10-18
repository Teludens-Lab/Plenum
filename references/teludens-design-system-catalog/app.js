const TOKENS = {
  primitive:{
    neutral:{0:'#FFFFFF',25:'#FDFCFA',50:'#F8F7F4',100:'#F0EFEB',200:'#E3E1DC',300:'#C9C6BF',400:'#A5A19A',500:'#7D7972',600:'#5F5B55',700:'#45413C',800:'#2D2A27',900:'#1D1B19',950:'#121110'},
    vermilion:{50:'#FFF4F1',100:'#FFE5DF',200:'#FFC8BD',300:'#FF9B89',400:'#FF6B52',500:'#F24B35',600:'#D93A27',700:'#B72D1D',800:'#8F261B',900:'#76241C'},
    cobalt:{100:'#E7EEFF',500:'#3567D6',700:'#24489E'},green:{100:'#E5F4EA',500:'#2E7D4F',700:'#205A39'},amber:{100:'#FFF0D1',500:'#A96500',700:'#754700'},crimson:{100:'#FDE5E3',500:'#D13C32',700:'#9C2923'}
  },
  semantic:{light:{'material/canvas':'#F8F7F4','material/workspace':'#FDFCFA','material/surface':'#FFFFFF','material/surfaceRaised':'#FFFFFF','material/surfaceRecessed':'#F0EFEB','material/control':'#F0EFEB','material/selection':'#FFF4F1','text/primary':'#1D1B19','text/secondary':'#45413C','boundary/subtle':'#E3E1DC','boundary/standard':'#C9C6BF','signal/decision':'#F24B35','info/default':'#3567D6','success/default':'#2E7D4F','caution/default':'#A96500','error/default':'#D13C32'},dark:{'material/canvas':'#121110','material/workspace':'#1D1B19','material/surface':'#2D2A27','material/surfaceRaised':'#45413C','material/surfaceRecessed':'#121110','material/control':'#45413C','material/selection':'#45413C','text/primary':'#F8F7F4','text/secondary':'#C9C6BF','boundary/subtle':'#45413C','boundary/standard':'#5F5B55','signal/decision':'#FF6B52','info/default':'#3567D6','success/default':'#2E7D4F','caution/default':'#A96500','error/default':'#D13C32'}},
  density:{focus:{controlHeight:48,rowHeight:44,toolbarHeight:48,panelPadding:24,sectionGap:28,inlineGap:12},standard:{controlHeight:42,rowHeight:36,toolbarHeight:44,panelPadding:16,sectionGap:22,inlineGap:10},operations:{controlHeight:38,rowHeight:30,toolbarHeight:40,panelPadding:12,sectionGap:14,inlineGap:8}},
  motion:{press:80,hover:110,selection:140,tooltip:150,popover:180,modal:210,panel:220,view:260,majorCausal:340}
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
function setRefState(state){const f=$('#plenumFrame');f.classList.remove('show-dialog','show-command');if(state==='dialog')f.classList.add('show-dialog');if(state==='command')f.classList.add('show-command');$$('[data-ref-state]').forEach(b=>b.classList.toggle('selected',b.dataset.refState===state))}
$$('[data-ref-state]').forEach(b=>b.addEventListener('click',()=>setRefState(b.dataset.refState)));$('#pForward').addEventListener('click',()=>setRefState('dialog'));$$('[data-close-overlay]').forEach(b=>b.addEventListener('click',()=>setRefState('base')));$('#pScrim').addEventListener('click',()=>setRefState('base'));

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
