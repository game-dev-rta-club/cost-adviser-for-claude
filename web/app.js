const D=window.CCA,$=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=v=>`$${v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const short=v=>v>=1e9?`${+(v/1e9).toFixed(1)}B`:v>=1e6?`${+(v/1e6).toFixed(1)}M`:v>=1e3?`${+(v/1e3).toFixed(1)}k`:`${+v.toFixed(2)}`;
const usdAxis=v=>`$${short(v)}`;
const pct=v=>`${v.toFixed(0)}%`;
const tok=v=>v>=1e9?`${(v/1e9).toFixed(2)}B`:v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:`${Math.round(v)}`;
const num=v=>Math.round(v).toLocaleString('en-US');
const hrs=ms=>ms>=3600000?`${(ms/3600000).toFixed(1)}h`:`${Math.round(ms/60000)}m`;
const md=d=>{const [,m,dd]=d.split('-');return `${+m}/${+dd}`;};
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(day,n)=>{const d=new Date(day+'T00:00');d.setDate(d.getDate()+n);return ymd(d);};
// 3 days are counted back from the day the page was built, so the latest
// period is always whole; the key is its first day.
const LAST_DAY=ymd(new Date(D.generatedAt));
// 3d and 7d are blocks of days counted back from the build day, so 7d matches
// the summary's 7 days.
const ROLLING={'3d':3,'7d':7};
function periodKey(day,p){if(p==='day')return day;
 if(ROLLING[p]){const n=ROLLING[p],back=Math.round((new Date(LAST_DAY+'T00:00')-new Date(day+'T00:00'))/86400000);return addDays(LAST_DAY,-(Math.floor(back/n)*n+n-1));}return day.slice(0,7);}
const periodLabel=(k,p)=>ROLLING[p]?(e=>`${md(k)}–${e.slice(5,7)===k.slice(5,7)?+e.slice(8):md(e)}`)(addDays(k,ROLLING[p]-1)):p==='day'?md(k):new Date(k+'-01T00:00').toLocaleString('en-US',{month:'short'});
// Chart on/off is kept per browser so the page reopens the same way.
const DEFAULT_SHOWN={totals:['cost','activeMs','calls'],stats:['perHour','perCall','callsPerHour','subShare']};
const loadShown=()=>{let saved={};try{saved=JSON.parse(localStorage.getItem('cca.shown')||'{}');}catch{}
 return Object.fromEntries(Object.entries(DEFAULT_SHOWN).map(([k,v])=>[k,new Set(Array.isArray(saved[k])?saved[k]:v)]));};
const saveShown=()=>{try{localStorage.setItem('cca.shown',JSON.stringify(Object.fromEntries(Object.entries(state.shown).map(([k,v])=>[k,[...v]]))));}catch{}};
const state={ssort:'cost',project:'all',period:'day',key:null,tool:null,sort:'cost',filter:'',toolLimit:10,sessionLimit:5,toggled:new Map(),moreTree:new Set(),allProjects:false,minStars:3,scope:null,sessOpen:new Map(),sessMore:new Set(),shown:loadShown()};
// Ratios from a small sample mislead, so they are hidden below this much use.
const MIN_ACTIVE_MS=10*60000,MIN_CALLS=10;
const enough=a=>a.activeMs>=MIN_ACTIVE_MS&&a.calls>=MIN_CALLS;
// Recorded changes come with the data when the page is built.
const CHANGES=Array.isArray(D.changes)?D.changes:[];
// Totals show how much Claude was used; Stats show efficiency. The bar that
// matters most in each chart is drawn wide.
const compactCost=a=>a.compactSummary+a.compactRebuild;
const CHARTS={
 totals:{cost:{name:'Cost',color:'#ea5f2c',wide:true,v:a=>a.cost,f:usd,af:usdAxis},activeMs:{name:'Active time',color:'#2f7fe0',v:a=>a.activeMs,f:hrs,af:v=>`${+(v/3600000).toFixed(1)}h`,unit:3600000},calls:{name:'Calls',color:'#18a874',v:a=>a.calls,f:v=>`${num(v)} calls`,af:short},tokens:{name:'Tokens',color:'#9b4de0',v:a=>Object.values(a.tokens).reduce((s,x)=>s+x,0),f:tok,af:short}},
 stats:{perHour:{name:'Cost / active hour',color:'#ea5f2c',wide:true,v:a=>a.activeMs?a.cost/(a.activeMs/3600000):0,f:v=>`${usd(v)}/h`,af:usdAxis},
  // What was spent writing the cache again after it expired (a break or a resumed conversation).
  // Off unless chosen; drawn inside the cost per hour bar when that shows, as its own bar otherwise.
  reload:{name:'Cache reload cost / active hour',color:'#a83a14',inside:'perHour',v:a=>a.activeMs?a.cacheExpired/(a.activeMs/3600000):0,f:v=>`${usd(v)}/h`,af:usdAxis},ctx:{name:'Avg context',color:'#0aa5c2',v:a=>a.calls?a.ctx/a.calls:0,f:tok},perCall:{name:'Cost / call',color:'#e8b100',v:a=>a.calls?a.cost/a.calls:0,f:usd,af:usdAxis},callsPerHour:{name:'Calls / active hour',color:'#2f7fe0',v:a=>a.activeMs?a.calls/(a.activeMs/3600000):0,f:v=>`${num(v)} calls/h`,af:short},cacheHit:{name:'Cache hit rate',color:'#d63384',v:a=>{const t=a.tokens.cacheRead+a.tokens.cacheWrite+a.tokens.input;return t?a.tokens.cacheRead/t*100:0;},f:pct},subShare:{name:'Subagent calls',color:'#9b4de0',v:a=>a.calls?a.subCalls/a.calls*100:0,f:pct},compactPerHour:{name:'Compacting / active hour',color:'#18a874',v:a=>a.activeMs?compactCost(a)/(a.activeMs/3600000):0,f:v=>`${usd(v)}/h`,af:usdAxis}}};
// Stats are ratios: hide them when the period has too little use.
const sparse=name=>name==='stats';
// Profile: Claude's orange is the base (Opus, Input); effort only changes the shade.
// By spec, largest first: Fable is redder than Opus, then Sonnet and Haiku move
// toward blue, with Haiku a navy (its shades are darker).
const HUES={fable:[356,70,0],opus:[16,72,0],sonnet:[270,48,0],haiku:[226,58,-16]};
const hue=(family,l)=>{const [h,sat,dl]=HUES[family]||[30,8,0];return `hsl(${h} ${sat}% ${l+dl}%)`;};
const EFFORT={low:72,medium:62,high:56,xhigh:46,max:36};
const modelColor=name=>{const [model,effort='']=name.split(' · '),family=Object.keys(HUES).find(f=>model.includes(f));return hue(family,EFFORT[effort.trim()]||56);};
// Profile shares use Claude's orange, darkest to lightest by cost.
const PALETTE=['#d97757','#a8462e','#e9a37f','#7a3320','#f2c6a8','#c26a4a','#5c2a1c','#f7e0cf'];
const inProject=r=>state.project==='all'||r.project===state.project;
const inPeriod=r=>!state.key||periodKey(r.day,state.period)===state.key;
const SUMS=['calls','cost','cacheRead','cacheWrite','input','output','ctx','activeMs','subCalls','subCost','compactions','compactSummary','compactRebuild','cacheExpired'];
function sumDaily(rows){const a={calls:0,cost:0,cacheRead:0,cacheWrite:0,input:0,output:0,compactions:0,compactSummary:0,compactRebuild:0,cacheExpired:0,tokens:{cacheRead:0,cacheWrite:0,input:0,output:0},ctx:0,activeMs:0,subCalls:0,subCost:0,byModel:{},byEffort:{},byModelEffort:{}};
 for(const r of rows){for(const k of SUMS)a[k]+=r[k]||0;for(const k in a.tokens)a.tokens[k]+=r.tokens[k];
  for(const f of ['byModel','byEffort','byModelEffort'])for(const [n,v] of Object.entries(r[f]||{})){const t=a[f][n]||(a[f][n]={cost:0,calls:0});t.cost+=v.cost;t.calls+=v.calls;}}return a;}
function periods(){const keys=new Map();for(const r of D.daily.filter(inProject)){const k=periodKey(r.day,state.period);if(!keys.has(k))keys.set(k,[]);keys.get(k).push(r);}
 return [...keys.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,rows])=>({key:k,...sumDaily(rows)}));}
// Projects are listed by cost, without the running totals. Only the first ones
// show until asked, so the proposals below stay in view; the chosen one always shows.
const PROJECT_LIMIT=10;
function renderProjects(){const total={};for(const r of D.daily)total[r.project]=(total[r.project]||0)+r.cost;
 const list=Object.keys(total).sort((a,b)=>total[b]-total[a]);
 const shown=state.allProjects?list:list.filter((p,i)=>i<PROJECT_LIMIT||p===state.project);
 $('#projects').innerHTML=[['all','All projects'],...shown.map(p=>[p,p])].map(([id,name])=>`<button data-project="${esc(id)}" class="${id==='all'?'':'indent'}" aria-current="${state.project===id}"><span>${esc(name)}</span></button>`).join('')
  +(list.length>PROJECT_LIMIT?`<button type="button" class="indent more-projects" data-all-projects>${state.allProjects?'Show fewer':`Show all (${list.length-shown.length} more)`}</button>`:'');}
// A time series per chart: each period is a group of bars, one per shown metric,
// each on its own scale. The right axis shows one metric's scale at a time.
const nice=v=>{const e=10**Math.floor(Math.log10(v)),f=v/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;};
// A recorded change is a 🔧 in a row along the top of the chart, over the
// period it falls in, with a count when the period has several. Its title and
// detail open in a popup on hover or click (changePop below), so the chart
// stays clear however many there are.
// Not a star: stars rate the improvement proposals.
function changeMarks(ps,width){const by=new Map();
 CHANGES.forEach((c,n)=>{const i=ps.findIndex(p=>p.key===periodKey(c.date,state.period));if(i>=0)by.set(i,[...(by.get(i)||[]),n]);});
 return [...by].map(([i,ns])=>{const cx=(i+.5)*width,many=ns.length>1,w=many?36:22;
  return `<g class="change-mark" data-changes="${ns.join(',')}" tabindex="0" role="button" aria-label="${esc(`Changes: ${ns.map(n=>CHANGES[n].label).join(', ')}`)}" transform="translate(${cx} 14)"><rect x="${-w/2}" y="-10" width="${w}" height="20" rx="10"/><text class="icon" x="${many?-7:0}" y="4">🔧</text>${many?`<text x="6" y="4">${ns.length}</text>`:''}</g>`;}).join('');}
// The shown metrics that get a bar and an axis of their own: one drawn inside
// another shown metric's bar does not.
const ownBars=(metrics,shown)=>Object.keys(metrics).filter(k=>shown.has(k)&&!(metrics[k].inside&&shown.has(metrics[k].inside)));
function drawChart(name,metrics,shown,ps,slots){const id=`#chart-${name}`,ms=ownBars(metrics,shown),inner=Object.keys(metrics).filter(k=>shown.has(k)&&!ms.includes(k)),gw=72,aw=46,plot=Math.max(ps.length*gw,420),scale=plot/(ps.length*gw||1);
 const ok=p=>!sparse(name)||enough(p);
 const step=Object.fromEntries(ms.map(k=>{const u=metrics[k].unit||1;return [k,nice(Math.max(...ps.filter(ok).map(metrics[k].v),1e-9)/u/4)*u];})),max=Object.fromEntries(ms.map(k=>[k,step[k]*4]));
 const widths=ms.map(k=>metrics[k].wide?18:7),gap=3,groupW=widths.reduce((s,w)=>s+w,0)+gap*(ms.length-1);
 const h=214,top=32,base=h-24,y=f=>base-f*(base-top);
 const svg=$(id),axis=$(`${id}-axis`);svg.setAttribute('viewBox',`0 0 ${plot} ${h}`);svg.style.minWidth=`${plot}px`;
 axis.setAttribute('viewBox',`0 0 ${aw*slots} ${h}`);axis.style.width=`${aw*slots}px`;
 // One axis per shown metric, in its color.
 axis.innerHTML=ms.map((k,j)=>{const m=metrics[k],x=j*aw;return `<g class="axis" data-axis="${k}" transform="translate(${x} 0)"><rect class="axis-hit" x="0" y="0" width="${aw}" height="${base}"/><line x1="1.5" x2="1.5" y1="${top}" y2="${base}" stroke="${m.color}" stroke-width="3"/>${[0,1,2,3,4].map(i=>`<line x1="0" x2="6" y1="${y(i/4)}" y2="${y(i/4)}" stroke="${m.color}" stroke-width="2"/><text x="9" y="${y(i/4)+4}" text-anchor="start" fill="${m.color}">${i?(m.af||m.f)(step[k]*i):0}</text>`).join('')}</g>`;}).join('');
 svg.innerHTML=`<line x1="0" x2="${plot}" y1="${base+.5}" y2="${base+.5}" stroke="var(--line)"/>`+ms.map(k=>`<g class="grid-set" data-axis="${k}">${[1,2,3,4].map(i=>`<line class="grid" x1="0" x2="${plot}" y1="${y(i/4)+.5}" y2="${y(i/4)+.5}" stroke="${metrics[k].color}"/>`).join('')}</g>`).join('')+ps.map((p,i)=>{const x0=i*gw*scale,cx=x0+gw*scale/2;let x=cx-groupW/2;
  const bars=ok(p)?ms.map((k,j)=>{const m=metrics[k],v=m.v(p),bh=Math.max(1,v/max[k]*(base-top)),bx=x;x+=widths[j]+gap;
   return `<rect x="${bx}" y="${base-bh}" width="${widths[j]}" height="${bh}" rx="${widths[j]>10?3:1.5}" fill="${m.color}" data-tip="${periodLabel(p.key,state.period)}|${m.name}|${m.f(v)}" data-color="${m.color}"></rect>${inner.filter(i=>metrics[i].inside===k).map(i=>partBar(metrics[i],p,v,bx,widths[j],bh,base)).join('')}`;}).join('')
   :'';
  return `<g class="group ${p.key===state.key?'is-sel':''}" data-key="${p.key}"><rect class="band" x="${x0+2}" y="0" width="${gw*scale-4}" height="${h}" rx="6"/>${bars}<text x="${cx}" y="${h-7}" text-anchor="middle">${periodLabel(p.key,state.period)}</text></g>`;}).join('')+changeMarks(ps,gw*scale);}
// A metric that is part of another (cache reload inside cost per hour) is
// drawn over the bottom of that bar, on its scale.
function partBar(m,p,v,x,w,bh,base){const pv=m.v(p);if(!pv)return '';const ph=Math.min(bh,pv/v*bh);
 return `<rect x="${x}" y="${base-ph}" width="${w}" height="${ph}" rx="${w>10?3:1.5}" fill="${m.color}" data-tip="${periodLabel(p.key,state.period)}|${m.name}|${m.f(pv)} (${pct(pv/v*100)} of it)" data-color="${m.color}"></rect>`;}
// A tooltip that shows at once (the browser's own waits about a second):
// "where|what|value", with the item's color as a swatch.
const tip=document.createElement('div');tip.className='tip';tip.hidden=true;document.body.append(tip);
function placeTip(e){const pad=14,w=tip.offsetWidth,h=tip.offsetHeight;let x=e.clientX+pad,y=e.clientY-h-pad;
 if(x+w>innerWidth-8)x=e.clientX-w-pad;if(y<8)y=e.clientY+pad;tip.style.transform=`translate(${Math.max(8,x)}px,${y}px)`;}
document.addEventListener('pointerover',e=>{const el=e.target.closest?.('[data-tip]');if(!el){tip.hidden=true;return;}
 const [where,what,value]=el.dataset.tip.split('|');
 tip.innerHTML=value===undefined?`<span>${esc(where)}</span>`:`<small>${esc(where)}</small><span>${el.dataset.color?`<i style="background:${esc(el.dataset.color)}"></i>`:''}${esc(what)}</span><b>${esc(value)}</b>`;
 tip.hidden=false;placeTip(e);});
document.addEventListener('pointermove',e=>{if(!tip.hidden)placeTip(e);});
document.addEventListener('pointerleave',()=>{tip.hidden=true;});
addEventListener('scroll',()=>{tip.hidden=true;},{passive:true});
// Hovering a metric button or its axis draws that metric's grid lines.
function showGrid(chart,metric){for(const svg of [$(`#chart-${chart}`),$(`#chart-${chart}-axis`)]){if(!svg)continue;svg.classList.toggle('show-grid',!!metric);
  for(const g of svg.querySelectorAll('[data-axis]'))g.classList.toggle('is-on',g.dataset.axis===metric);}}
const hovered=t=>t.closest?.('.metrics [data-metric]')||t.closest?.('.chart-axis .axis');
const chartOf=el=>el.dataset.chart||el.closest('svg').id.replace(/^chart-|-axis$/g,'');
document.addEventListener('pointerover',e=>{const el=hovered(e.target);if(el)showGrid(chartOf(el),el.dataset.metric||el.dataset.axis);});
document.addEventListener('pointerout',e=>{const el=hovered(e.target);if(!el||el.contains(e.relatedTarget))return;showGrid(chartOf(el),null);});
function renderChart(){const ps=periods();if(!ps.some(p=>p.key===state.key))state.key=ps.at(-1)?.key||null;
 // Both axis columns take the width of the wider one, so the charts scroll
 // the same distance and their periods line up.
 const slots=Math.max(...Object.entries(CHARTS).map(([n,m])=>ownBars(m,state.shown[n]).length));
 for(const [name,metrics] of Object.entries(CHARTS)){drawChart(name,metrics,state.shown[name],ps,slots);
  document.querySelector(`.metrics[data-chart="${name}"]`).innerHTML=Object.entries(metrics).map(([id,m])=>`<button type="button" data-metric="${id}" data-chart="${name}" aria-pressed="${state.shown[name].has(id)}"><i style="background:${m.color};${m.wide?'width:16px':''}"></i>${m.name}</button>`).join('');}
 revealKey();}
// Wide charts scroll sideways. The chosen period (the latest unless one was
// clicked) is kept in view, so the page opens on today, not the oldest day.
function revealKey(){for(const wrap of document.querySelectorAll('.chart-wrap')){const band=wrap.querySelector(`.group[data-key="${state.key}"] .band`);if(!band)continue;
 const r=band.getBoundingClientRect(),w=wrap.getBoundingClientRect();
 if(r.left<w.left)wrap.scrollLeft+=r.left-w.left;else if(r.right>w.right)wrap.scrollLeft+=r.right-w.right;}}
// Both charts show the same periods, so they scroll together.
for(const wrap of document.querySelectorAll('.chart-wrap'))wrap.addEventListener('scroll',()=>{for(const other of document.querySelectorAll('.chart-wrap'))if(other!==wrap&&other.scrollLeft!==wrap.scrollLeft)other.scrollLeft=wrap.scrollLeft;},{passive:true});
// A part's label sits on its bar when the bar is wide enough: the group on
// the first line and the part on the second, e.g. "Input\n(cache read)".
const modelLabel=name=>{const [model,effort]=name.split(' · ');return [model.replace(/^(\w)(\w*)-(\d+)-(\d+)$/,(m,a,b,x,y)=>`${a.toUpperCase()}${b} ${x}.${y}`),effort].filter(Boolean).join('\n');};
function fitLabels(){for(const span of document.querySelectorAll('.stack span')){const box=span.parentElement;span.classList.toggle('is-hidden',span.scrollWidth>box.clientWidth-16||span.scrollHeight>box.clientHeight);}}
addEventListener('resize',()=>fitLabels());
// Models by their total cost, most first; within a model, effort from low to max.
const EFFORT_ORDER=Object.keys(EFFORT);
function byModel(entries){const model=e=>e.name.split(' · ')[0],effort=e=>e.name.split(' · ')[1],total={};
 for(const e of entries)total[model(e)]=(total[model(e)]||0)+e.cost;
 const rank=e=>{const i=EFFORT_ORDER.indexOf((effort(e)||'').trim());return i<0?EFFORT_ORDER.length:i;};
 return [...entries].sort((a,b)=>total[model(b)]-total[model(a)]||model(a).localeCompare(model(b))||rank(a)-rank(b));}
function breakdown(title,entries,{calls=true,sorted=true,rows=null}={}){const total=entries.reduce((s,e)=>s+e.cost,0);if(!total)return '';
 entries=entries.filter(e=>e.cost>0);if(sorted)entries.sort((a,b)=>b.cost-a.cost);
 return `<div class="breakdown" data-breakdown="${esc(title)}"><h3>${title}</h3><div class="stack">${entries.map((e,i)=>`<div data-tip="${esc(title)}|${esc(e.name)}|${usd(e.cost)}" data-color="${e.color||PALETTE[i%PALETTE.length]}" style="flex:${e.cost};background:${e.color||PALETTE[i%PALETTE.length]}"><span>${esc(e.label||e.name)}</span></div>`).join('')}</div>
  <table><tbody>${(rows||entries).map((e,i)=>`<tr class="${e.kind||''}" data-name="${esc(e.name)}"><td>${e.kind==='group'?'':`<i style="background:${e.color||PALETTE[i%PALETTE.length]}"></i>`}${esc(e.name)}</td><td class="num">${usd(e.cost)}</td><td class="num">${Math.round(e.cost/total*100)}%</td><td class="num">${e.note??(calls?`${num(e.calls)} calls`:`${tok(e.tokens)} tokens`)}</td></tr>`).join('')}</tbody></table></div>`;}
function renderProfile(){const a=sumDaily(D.daily.filter(r=>inProject(r)&&inPeriod(r)));
 $('#profile-title').innerHTML=`Profile <small>${state.key?periodLabel(state.key,state.period):''} · ${esc(state.project==='all'?'All projects':state.project)}</small>`;
 $('#cost').textContent=usd(a.cost);
 const tokens=Object.values(a.tokens).reduce((s,v)=>s+v,0);
 const ratio=f=>enough(a)?f():'—';
 $('#stats').innerHTML=[['Calls',num(a.calls)],['Tokens',tok(tokens)],['Active time',hrs(a.activeMs)],['Cost / active hour',ratio(()=>`${usd(a.cost/(a.activeMs/3600000))}/h`)],['Avg context',ratio(()=>tok(a.ctx/a.calls))],['Cost / call',ratio(()=>usd(a.cost/a.calls))],['Cache hit rate',ratio(()=>pct(CHARTS.stats.cacheHit.v(a)))],['Subagent calls',ratio(()=>`${pct(a.subCalls/a.calls*100)} (${num(a.subCalls)})`)],['Compactions',num(a.compactions)],['Compacting / active hour',ratio(()=>`${usd(compactCost(a)/(a.activeMs/3600000))}/h`)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
 // Input is split by cache use. Compacting is the summary (estimated: it is
 // not logged as a call) and the cache write right after it. None overlap.
 // Each group (Input, Output, Compacting) lists its parts below it, so the
 // colored parts line up.
 const parts=[['cacheRead','Cache read',hue('opus',61),'Input\n(cache read)'],['cacheWrite','Cache write',hue('opus',54),'Input\n(cache write)'],['input','Uncached',hue('opus',74),'Input\n(uncached)'],['output','Output','hsl(226 55% 38%)','Output']].map(([k,name,color,label])=>({name,label,color,cost:a[k],tokens:a.tokens[k],kind:'sub'}));
 const inputs=parts.slice(0,3),input={name:'Input',kind:'group',cost:inputs.reduce((s,e)=>s+e.cost,0),tokens:inputs.reduce((s,e)=>s+e.tokens,0)};
 const compacts=[{name:'Summary (est.)',label:'Compacting\n(summary)',color:'#18a874',cost:a.compactSummary,kind:'sub',note:'estimated'},{name:'Cache rebuild',label:'Compacting\n(rebuild)',color:'#5fc49c',cost:a.compactRebuild,kind:'sub',note:''}];
 const compact={name:'Compacting',kind:'group',cost:compactCost(a),note:`${num(a.compactions)} compactions`};
 $('#breakdowns').innerHTML=breakdown('Cost by type',[...parts,...compacts],{calls:false,sorted:false,rows:[input,...inputs,{name:'Output',kind:'group',cost:parts[3].cost,tokens:parts[3].tokens},{...parts[3],kind:'sub'},...(a.compactions?[compact,...compacts]:[])]})
  +breakdown('Cost by model',byModel(Object.entries(a.byModelEffort).map(([name,v])=>({name,label:modelLabel(name),...v,color:modelColor(name)}))),{sorted:false});
 fitLabels();}
// A project or session picked in Sessions narrows Calls by action to it.
const inScope=r=>!state.scope||(state.scope.kind==='project'?r.project===state.scope.id:r.session===state.scope.id);
function toolRows(){const m=new Map();for(const r of D.tools.filter(r=>inProject(r)&&inPeriod(r)&&inScope(r)&&r.tool.includes(state.filter))){const t=m.get(r.tool)||{tool:r.tool,count:0,resultChars:0,cost:0,keys:[]};t.count+=r.count;t.resultChars+=r.resultChars;t.cost+=r.cost;t.keys.push(`${r.day}|${r.project}|${r.tool}`);m.set(r.tool,t);}
 for(const t of m.values())t.keys=[...new Set(t.keys)];
 const by={cost:t=>t.cost,count:t=>t.count,result:t=>t.resultChars,unit:t=>t.cost/t.count};return [...m.values()].sort((a,b)=>by[state.sort](b)-by[state.sort](a));}
// Calls by action: each call's cost goes to what it did (the tools it asked for,
// the final reply, or compacting). It is a tree, like a profiler: uses that share leading words add up
// (bash › chill › connection › reply). Each node's id is the start of the
// key up to it, so a leaf's id is its key.
const tokens=key=>[...key.matchAll(key.startsWith('mcp ')?/\([^)]*\)|[^\s.]+/g:/\([^)]*\)|\S+/g)].map(m=>({text:m[0],id:key.slice(0,m.index+m[0].length)}));
const emptyNode=(id,text,depth)=>({id,text,depth,count:0,resultChars:0,cost:0,keys:[],children:new Map(),self:null});
function toolTree(){const root=emptyNode('','',0);
 for(const t of toolRows()){let node=root;
  for(const tk of tokens(t.tool)){node.count+=t.count;node.resultChars+=t.resultChars;node.cost+=t.cost;node.keys.push(...t.keys);
   if(!node.children.has(tk.text))node.children.set(tk.text,emptyNode(tk.id,tk.text,node.depth+1));node=node.children.get(tk.text);}
  node.count+=t.count;node.resultChars+=t.resultChars;node.cost+=t.cost;node.keys.push(...t.keys);node.self=t;}
 return root;}
const SORT={cost:t=>t.cost,count:t=>t.count,result:t=>t.resultChars,unit:t=>t.cost/t.count};
// A node with uses of its own and longer ones lists its own as a child.
function kids(node){const list=[...node.children.values()];
 if(node.self&&list.length)list.push({...emptyNode(`${node.id} ·`,'(no subcommand)',node.depth+1),count:node.self.count,resultChars:node.self.resultChars,cost:node.self.cost,keys:node.self.keys});
 return list.sort((a,b)=>SORT[state.sort](b)-SORT[state.sort](a));}
// Open by default: the top level, and Python and Node one level further.
const isOpen=n=>state.filter?true:state.toggled.has(n.id)?state.toggled.get(n.id):n.depth===1||(n.depth===2&&/^(python3?|node)$/.test(n.text));
// Show a node: open its parents and widen any list it is hidden in.
function revealTool(id){for(const tk of tokens(id).slice(0,-1)){state.toggled.set(tk.id,true);state.moreTree.add(tk.id);}
 const top=tokens(id)[0]?.text,i=kids(toolTree()).findIndex(n=>n.text===top);if(i>=state.toolLimit)state.toolLimit=Math.ceil((i+1)/10)*10;}
// A title often quotes a path; the home folder shrinks to ~, on any machine.
const tidyPath=t=>String(t||'').replace(/(?:[A-Za-z]:\\Users\\[^\\\s]+|\/Users\/[^\/\s]+|\/home\/[^\/\s]+)(?=[\\/]|\s|$)/g,'~');
for(const s of D.sessions)s.title=tidyPath(s.title);
const titles=Object.fromEntries(D.sessions.map(s=>[s.session,s.title]));
const when=ts=>new Date(ts).toLocaleString('en-US',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function moreButtons(id,shown,total,step){$(id).innerHTML=`${shown<total?`<button class="link" data-more="${id}" data-step="${step}">Show ${Math.min(step,total-shown)} more (${total-shown} left)</button>`:''}${shown>step?`<button class="link" data-less="${id}" data-step="${step}">Back to top ${step}</button>`:''}`;}
const CHILD_LIMIT=8;
function findNode(id){let node=toolTree();for(const tk of tokens(id)){node=node.children.get(tk.text);if(!node)return null;}return node;}
function renderTools(){const root=toolTree(),total=root.cost,top=kids(root),shown=top.slice(0,state.toolLimit),out=[];
 $('#tools-note').innerHTML=`${toolRows().length} actions · ${usd(total)}${state.scope?` <button type="button" class="scope-chip" data-clear-scope title="Show all">${esc(cut(state.scope.label,32))} ✕</button>`:''}`;
 const row=(n,rank)=>{const share=total?n.cost/total:0,list=kids(n),leaf=!list.length,open=!leaf&&isOpen(n),sel=state.tool===n.id;
  out.push(`<tr class="tool ${sel?'is-focus':''} ${leaf?'is-leaf':''}" data-tool="${esc(n.id)}"><td class="num">${rank||''}</td><td class="tool-name" style="padding-left:${8+(n.depth-1)*18}px"><span class="caret">${leaf?'':open?'▾':'▸'}</span>${esc(n.text)}</td><td class="num"><span class="share"><i style="width:${Math.max(2,share*90)}px"></i>${usd(n.cost)} <small>${Math.round(share*100)}%</small></span></td><td class="num">${num(n.count)}</td></tr>`);
  if(leaf&&sel){const ex=[...new Set(n.keys)].flatMap(k=>D.examples[k]||[]).filter(e=>state.scope?.kind!=='session'||e.session===state.scope.id).sort((a,b)=>b.result-a.result).slice(0,6);
   out.push(`<tr class="detail"><td colspan="4"><div class="ex">${ex.length?ex.map(e=>`<div><code>${esc(e.label)}</code><small>${usd(e.cost)}</small><small>${when(e.at)} · ${esc(titles[e.session]||'')} · ${esc(e.session.slice(0,8))}</small><small>result ${tok(e.result/4)} · context ${tok(e.ctx)}</small></div>`).join(''):'<p class="empty">No examples.</p>'}</div></td></tr>`);}
  if(!open)return;const all=state.moreTree.has(n.id)||state.filter,part=all?list:list.slice(0,CHILD_LIMIT);
  for(const c of part)row(c);
  if(part.length<list.length){const rest=list.slice(part.length);out.push(`<tr class="tool-more"><td></td><td colspan="3" style="padding-left:${8+n.depth*18}px"><button class="link" data-more-tree="${esc(n.id)}">${rest.length} more · ${usd(rest.reduce((s,c)=>s+c.cost,0))}</button></td></tr>`);}};
 shown.forEach((n,i)=>row(n,i+1));
 $('#tools').innerHTML=out.join('')||'<tr><td colspan="4" class="empty">No data.</td></tr>';
 moreButtons('#tools-more',shown.length,top.length,10);}
// Sessions as a tree: All, each project, then its sessions. Picking a row
// narrows Calls by action to it, and All shows everything again; the caret only
// opens or closes a project. Every project starts closed.
const SESSION_CHILDREN=5,cut=(t,n)=>t.length>n?t.slice(0,n-1)+'…':t;
function renderSessions(){const m=new Map();for(const s of D.sessions.filter(s=>inProject(s)&&inPeriod(s))){const t=m.get(s.session)||{...s,calls:0,cost:0,activeMs:0};t.calls+=s.calls;t.cost+=s.cost;t.activeMs+=s.activeMs;t.first=Math.min(t.first,s.first);t.last=Math.max(t.last,s.last);m.set(s.session,t);}
 const by=(a,b)=>b[state.ssort]-a[state.ssort],groups=new Map();
 for(const s of m.values()){const g=groups.get(s.project)||{project:s.project,calls:0,cost:0,activeMs:0,sessions:[]};g.calls+=s.calls;g.cost+=s.cost;g.activeMs+=s.activeMs;g.sessions.push(s);groups.set(s.project,g);}
 const list=[...groups.values()].sort(by),shown=list.slice(0,state.sessionLimit),picked=(kind,id)=>state.scope?.kind===kind&&state.scope.id===id,out=[];
 const open=g=>state.sessOpen.get(g.project)??false,sum=k=>list.reduce((t,g)=>t+g[k],0);
 if(list.length)out.push(`<tr class="tool sess-all${state.scope?'':' is-focus'}" data-scope-all><td class="tool-name"><b>All</b> <small>${list.length} project${list.length===1?'':'s'}</small></td><td class="num">${num(sum('calls'))}</td><td class="num">${usd(sum('cost'))}</td><td class="num">${hrs(sum('activeMs'))}</td></tr>`);
 shown.forEach(g=>{const o=open(g);
  out.push(`<tr class="tool sess-project${picked('project',g.project)?' is-focus':''}" data-scope-project="${esc(g.project)}"><td class="tool-name" style="padding-left:20px"><span class="caret" data-sess-toggle="${esc(g.project)}">${o?'▾':'▸'}</span><b>${esc(g.project)}</b> <small>${g.sessions.length} session${g.sessions.length===1?'':'s'}</small></td><td class="num">${num(g.calls)}</td><td class="num">${usd(g.cost)}</td><td class="num">${hrs(g.activeMs)}</td></tr>`);
  if(!o)return;const ss=g.sessions.sort(by),part=state.sessMore.has(g.project)?ss:ss.slice(0,SESSION_CHILDREN);
  for(const s of part)out.push(`<tr class="tool${picked('session',s.session)?' is-focus':''}" data-session="${esc(s.session)}" data-scope-session="${esc(s.session)}"><td class="tool-name" style="padding-left:52px" title="${esc(s.title)}">${esc(cut(s.title,56))}${s.sub?' <small>(subagent)</small>':''} <small class="sess-id">${esc(s.session.slice(0,8))}</small></td><td class="num">${num(s.calls)}</td><td class="num">${usd(s.cost)}</td><td class="num">${hrs(s.activeMs)}</td></tr>`);
  if(part.length<ss.length){const rest=ss.slice(part.length);out.push(`<tr class="tool-more"><td colspan="4" style="padding-left:52px"><button class="link" data-sess-more="${esc(g.project)}">${rest.length} more · ${usd(rest.reduce((t,s)=>t+s.cost,0))}</button></td></tr>`);}});
 $('#sessions-note').textContent=`${list.length} project${list.length===1?'':'s'} · ${m.size} sessions`;
 $('#sessions').innerHTML=out.join('')||'<tr><td colspan="4" class="empty">No data.</td></tr>';
 moreButtons('#sessions-more',shown.length,list.length,5);}
// Narrowing changes how long Calls by action is. The clicked row stays where it
// was on screen, and the section keeps its height so the page does not shrink
// under the reader (reserved space, as for layout shift); a full render resets it.
function rescope(sel){const before=$(sel)?.getBoundingClientRect().top,sec=$('#tools-section');
 sec.style.minHeight=`${sec.offsetHeight}px`;state.tool=null;state.toolLimit=10;renderSessions();renderTools();
 const el=$(sel);if(el&&before!=null)scrollBy(0,el.getBoundingClientRect().top-before);}
function pickScope(kind,id,label){state.scope=state.scope?.kind===kind&&state.scope.id===id?null:{kind,id,label};rescope(`[data-scope-${kind}="${CSS.escape(id)}"]`);}
function render(){$('#tools-section').style.minHeight='';renderProjects();renderProposals();renderChart();renderProfile();renderTools();renderSessions();}
const resetLimits=()=>{state.toolLimit=10;state.sessionLimit=5;state.tool=null;state.scope=null;state.sessMore.clear();};
document.addEventListener('click',e=>{const t=e.target;
 const all=t.closest('[data-all-projects]');if(all){state.allProjects=!state.allProjects;renderProjects();return;}
 const p=t.closest('[data-project]');if(p){state.project=p.dataset.project;resetLimits();render();return;}
 const per=t.closest('[data-p]');if(per){state.period=per.dataset.p;state.key=null;resetLimits();document.querySelectorAll('#period button').forEach(b=>b.setAttribute('aria-pressed',b===per));render();return;}
 const g=t.closest('[data-key]');if(g){state.key=g.dataset.key;resetLimits();render();return;}
 const m=t.closest('[data-metric]');if(m){const set=state.shown[m.dataset.chart],id=m.dataset.metric;if(set.has(id)&&set.size>1)set.delete(id);else set.add(id);saveShown();renderChart();return;}
 const s=t.closest('[data-sort]');if(s){state.sort=s.dataset.sort;document.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b===s));renderTools();return;}
 const st=t.closest('[data-sess-toggle]');if(st){const id=st.dataset.sessToggle;state.sessOpen.set(id,!(state.sessOpen.get(id)??false));renderSessions();return;}
 const sm=t.closest('[data-sess-more]');if(sm){state.sessMore.add(sm.dataset.sessMore);renderSessions();return;}
 const sa=t.closest('[data-scope-all]');if(sa){state.scope=null;rescope('[data-scope-all]');return;}
 const cs=t.closest('[data-clear-scope]');if(cs){e.preventDefault();state.scope=null;rescope('#tools-section summary');return;}
 const sp=t.closest('[data-scope-project]');if(sp){const id=sp.dataset.scopeProject;state.sessOpen.set(id,true);pickScope('project',id,id);return;}
 const sx=t.closest('[data-scope-session]');if(sx){const id=sx.dataset.scopeSession;pickScope('session',id,titles[id]||id.slice(0,8));return;}
 const ss=t.closest('[data-ssort]');if(ss){state.ssort=ss.dataset.ssort;document.querySelectorAll('[data-ssort]').forEach(b=>b.setAttribute('aria-pressed',b===ss));renderSessions();return;}
 const more=t.closest('[data-more]');if(more){const k=more.dataset.more==='#tools-more'?'toolLimit':'sessionLimit';state[k]+=+more.dataset.step;more.dataset.more==='#tools-more'?renderTools():renderSessions();return;}
 const less=t.closest('[data-less]');if(less){const k=less.dataset.less==='#tools-more'?'toolLimit':'sessionLimit';state[k]=+less.dataset.step;less.dataset.less==='#tools-more'?renderTools():renderSessions();return;}
 const mt=t.closest('[data-more-tree]');if(mt){state.moreTree.add(mt.dataset.moreTree);renderTools();return;}
 // A group opens and closes; a single tool shows its examples.
 const row=t.closest('tr.tool');if(row){const id=row.dataset.tool;if(row.classList.contains('is-leaf'))state.tool=state.tool===id?null:id;
  else{const n=findNode(id);state.toggled.set(id,!isOpen(n));}renderTools();}
});
document.addEventListener('input',e=>{if(e.target.id!=='tool-filter')return;state.filter=e.target.value.trim();state.toolLimit=10;renderTools();});
// A link can open the page on one item and highlight it, e.g.
// #project=app&period=day&date=2026-10-14&metrics=stats.ctx&tool=bash%20cat&focus=tools
// focus: totals, stats, profile, cost-type, cost-model, tools, sessions; item: a row in a cost breakdown.
const FOCUS={totals:'#chart-totals',stats:'#chart-stats',profile:'#profile','cost-type':'[data-breakdown="Cost by type"]','cost-model':'[data-breakdown="Cost by model"]',tools:'#tools-section',sessions:'#sessions-section'};
// Set the whole view from link parameters and return what to highlight.
function applyView(q){
 document.querySelectorAll('.focus-glow').forEach(el=>el.classList.remove('focus-glow'));
 // Each link describes the whole view, so anything it leaves out goes back to the default.
 state.project=q.get('project')||'all';
 // Links from before the week tab was dropped open the 7 days instead.
 const period=q.get('period')==='week'?'7d':q.get('period');state.period=['day','3d','7d','month'].includes(period)?period:'day';
 document.querySelectorAll('#period button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===state.period));
 state.key=q.has('date')?periodKey(q.get('date'),state.period):null;resetLimits();state.filter='';$('#tool-filter').value='';
 const metrics=(q.get('metrics')||'').split(',').map(m=>m.split('.')).filter(([c,m])=>CHARTS[c]?.[m]);
 for(const [c,m] of metrics)state.shown[c].add(m);
 state.toggled.clear();state.moreTree.clear();
 if(q.has('tool')){state.tool=q.get('tool');revealTool(state.tool);const n=findNode(state.tool);if(n?.children.size)state.toggled.set(n.id,true);}
 render();
 if(q.has('session')){const id=q.get('session'),s=D.sessions.find(x=>x.session.startsWith(id));if(s){state.sessOpen.set(s.project,true);state.sessMore.add(s.project);state.sessionLimit=1000;renderSessions();}}
 const targets=[];
 for(const [c,m] of metrics){targets.push($(`.metrics [data-chart="${c}"][data-metric="${m}"]`));showGrid(c,m);}
 if(q.has('date'))targets.push(...document.querySelectorAll(`.group[data-key="${state.key}"] .band`));
 if(q.has('tool'))targets.push(...[...document.querySelectorAll('#tools tr.tool')].filter(r=>r.dataset.tool===state.tool));
 if(q.has('session'))targets.push([...document.querySelectorAll('#sessions tr')].find(r=>r.dataset.session?.startsWith(q.get('session'))));
 const focus=FOCUS[q.get('focus')]&&$(FOCUS[q.get('focus')]);
 if(focus&&q.has('item'))targets.push([...focus.querySelectorAll('tr[data-name]')].find(r=>r.dataset.name===q.get('item')));
 else if(focus)targets.push(focus);
 // Wide charts scroll sideways; bring the linked period into view.
 if(q.has('date'))for(const band of document.querySelectorAll(`.group[data-key="${state.key}"] .band`)){const wrap=band.closest('.chart-wrap'),r=band.getBoundingClientRect(),w=wrap.getBoundingClientRect();wrap.scrollLeft+=r.left+r.width/2-(w.left+w.width/2);}
 const found=targets.filter(Boolean);found.forEach(el=>el.classList.add('focus-glow'));
 // The note sits by the main item: a row or section rather than a chart button.
 // A chart is shown from its title, so the whole chart sits above the note.
 const chart=metrics.length?$(`#chart-${metrics[0][0]}`).closest('.chart-box').previousElementSibling:null;
 return focus&&!q.has('item')?focus:found.find(el=>!el.closest('.metrics,svg'))||chart||found[0]||null;}

// Improvement proposals an agent keeps (cca advise), listed under the projects.
const PROPOSALS=Array.isArray(D.advice?.proposals)?D.advice.proposals:[];
// Stars drawn as a filled share of five, so a half star shows; the number follows.
const starText=n=>`<span class="meter" style="--v:${n/5*100}%"><i></i></span>`;
const overallText=n=>`${starText(n)}<b class="score">${n.toFixed(1)}</b>`;
const RATING_NAMES={ease:'Upkeep',safety:'Quality kept',savings:'Savings'};
// Each axis has its own stars; the overall rating is their rounded geometric mean.
const ratingTags=r=>`<dl class="ratings">${Object.keys(RATING_NAMES).filter(k=>r?.[k]).map(k=>`<div><dt>${RATING_NAMES[k]}</dt><dd class="stars" role="img" aria-label="${r[k]} of 5">${starText(r[k])}</dd></div>`).join('')}</dl>`;
// The latest run's changes are marked, so a reader sees what moved since last time.
const LATEST=PROPOSALS.reduce((d,p)=>p.updated>d?p.updated:d,'');
const mark=p=>p.updated===LATEST?` <em>${p.since===p.updated?'New':'Updated'}</em>`:'';
// A slider sets the lowest overall rating shown; ★3 and above at first. It
// runs from ★5 on the left to ★1, with how many proposals each whole star holds
// (4.6 counts as ★4) under it.
const bucket=p=>Math.max(1,Math.min(5,Math.floor(p.stars)));
const titleOf=p=>p.title||p.action;
const visibleProposals=()=>PROPOSALS.filter(p=>!p.project||state.project==='all'||p.project===state.project).sort((a,b)=>b.stars-a.stars);
let activeProposal=null;
// Each card opens its details in a card at the lower right (#proposal=ID), so
// the list stays short and the view it is about is highlighted beside it.
function renderProposals(){const all=visibleProposals();
 if(!all.length){$('#proposals').innerHTML='';return;}
 const scale=f=>[5,4,3,2,1].map((n,i)=>`<span style="--i:${i}" data-n="${n}">${f(n)}</span>`).join('');
 $('#proposals').innerHTML=`<h2>Improvements</h2><div class="star-slider">
  <div class="star-scale" aria-hidden="true">${scale(n=>`★${n}`)}</div>
  <input id="min-stars" type="range" min="1" max="5" step="1" dir="rtl" value="${state.minStars}" aria-label="Lowest rating shown" data-min-stars>
  <div class="star-scale star-counts" aria-hidden="true">${scale(n=>all.filter(p=>bucket(p)===n).length)}</div></div><div id="proposal-list"></div>`;
 renderProposalList();}
function renderProposalList(){const all=visibleProposals(),list=all.filter(p=>p.stars>=state.minStars||p.id===activeProposal);
 const input=$('#min-stars');input.setAttribute('aria-valuetext',`${state.minStars===5?'★5':`★5 to ★${state.minStars}`}, ${list.length} of ${all.length} shown`);input.style.setProperty('--fill',`${(5-state.minStars)/4*100}%`);
 document.querySelectorAll('.star-scale span').forEach(s=>s.classList.toggle('is-on',+s.dataset.n>=state.minStars));
 $('#proposal-list').innerHTML=list.map(p=>`<a class="proposal${activeProposal===p.id?' is-active':''}" href="#proposal=${encodeURIComponent(p.id)}" data-proposal="${esc(p.id)}">
  <span class="stars" role="img" aria-label="Recommended ${p.stars} of 5">${overallText(p.stars)}${mark(p)}</span>
  <strong>${esc(titleOf(p))}</strong>${p.summary?`<span class="proposal-summary">${esc(p.summary)}</span>`:''}${p.project&&state.project==='all'?`<small class="proposal-project">${esc(p.project)}</small>`:''}
  <span class="proposal-more">Details ›</span></a>`).join('')+(list.length?'':`<p class="proposal-none">None in ★5–★${state.minStars}.</p>`);}
document.addEventListener('input',e=>{if(e.target.matches?.('[data-min-stars]')){state.minStars=+e.target.value;renderProposalList();}});
const callout=document.createElement('aside');callout.className='callout';callout.hidden=true;callout.setAttribute('aria-live','polite');document.body.append(callout);
// The card stays in a corner; the item it is about is scrolled into the upper
// part of the window, so the card does not cover it.
function bringIntoView(el){if(!el)return;const r=el.getBoundingClientRect();scrollTo({top:Math.max(0,r.top+scrollY-Math.max(80,innerHeight*.18)),behavior:'smooth'});}
function showProposal(id){const p=PROPOSALS.find(x=>x.id===id);if(!p)return hideProposal();activeProposal=id;
 const anchor=applyView(new URLSearchParams(p.link||{}));
 const list=visibleProposals(),i=list.findIndex(x=>x.id===id),prev=list[i-1],next=list[i+1];
 callout.innerHTML=`<header><span class="stars" role="img" aria-label="Recommended ${p.stars} of 5">${overallText(p.stars)}${mark(p)}</span><button type="button" data-callout-close aria-label="Close">✕</button></header>
  <h3>${esc(titleOf(p))}</h3>${p.project?`<small class="proposal-project">${esc(p.project)}</small>`:''}
  ${p.summary?`<p class="callout-summary">${esc(p.summary)}</p>`:''}${p.title&&p.action?`<p class="callout-action"><b>What to do</b>${esc(p.action)}</p>`:''}
  ${p.news?`<p class="proposal-news">${esc(p.news)}</p>`:''}${p.detail?`<p class="callout-detail">${esc(p.detail)}</p>`:''}${ratingTags(p.ratings)}
  ${/^https?:\/\//.test(p.source||'')?`<a class="option-source" href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.source)}</a>`:''}
  <footer>${prev?`<a href="#proposal=${encodeURIComponent(prev.id)}">← Previous</a>`:'<span></span>'}<small>Since ${md(p.since)}${p.updated!==p.since?` · updated ${md(p.updated)}`:''}</small>${next?`<a href="#proposal=${encodeURIComponent(next.id)}">Next →</a>`:'<span></span>'}</footer>`;
 callout.hidden=false;callout.classList.remove('flash');void callout.offsetWidth;callout.classList.add('flash');
 bringIntoView(anchor);}
function hideProposal(){callout.hidden=true;if(activeProposal){activeProposal=null;renderProposals();}}
callout.addEventListener('click',e=>{if(e.target.closest('[data-callout-close]')){history.replaceState(null,'',location.pathname+location.search);hideProposal();}});
function applyLink(){const q=new URLSearchParams(location.hash.slice(1));
 if(q.has('proposal'))return showProposal(q.get('proposal'));
 hideProposal();if(![...q.keys()].length)return;bringIntoView(applyView(q));}
window.addEventListener('hashchange',applyLink);
// Reload builds the report again through `cca serve`; a page opened as a
// file has no server to ask, so the dialog says how to get one.
const RELOAD_ICON=$('#reload svg').outerHTML,reloadDialog=$('#reload-dialog');
$('#updated').textContent=`Updated ${md(LAST_DAY)} ${new Date(D.generatedAt).toTimeString().slice(0,5)}`;
function showReload(stage,message=''){const served=/^https?:$/.test(location.protocol);
 reloadDialog.innerHTML=!served?`<h2 id="reload-title">Reload needs cca serve</h2><p>This page was opened as a file, so it cannot build itself again. Run <code>cca serve</code> and open <code>http://127.0.0.1:7319/</code>, or run <code>cca build</code> and reopen this file.</p><menu><button type="button" class="primary" data-reload="close">Close</button></menu>`
  :stage==='running'?`<h2 id="reload-title">Reloading…</h2><p>Reading the latest conversations and building the report. The page refreshes when it is done.</p><menu><button type="button" class="primary" disabled><span class="spin" style="display:inline-flex">${RELOAD_ICON}</span> Reloading</button></menu>`
  :`<h2 id="reload-title">Reload the data?</h2><p>This reads the latest Claude Code conversations and builds the report again. It can take a while.</p>${message?`<p class="error">${esc(message)}</p>`:''}<menu><button type="button" data-reload="close">Cancel</button><button type="button" class="primary" data-reload="run">${message?'Try again':'Reload'}</button></menu>`;
 if(!reloadDialog.open)reloadDialog.showModal();reloadDialog.querySelector('.primary:not(:disabled)')?.focus();}
async function runReload(){showReload('running');
 try{const res=await fetch('refresh',{method:'POST',headers:{'X-CCA-Refresh':'1'}});if(!res.ok)throw new Error(await res.text()||`The server answered ${res.status}.`);location.reload();}
 catch(error){showReload('confirm',error instanceof TypeError?'Could not reach cca serve. Is it still running?':`Could not reload: ${error.message}`);}}
$('#reload').addEventListener('click',()=>showReload('confirm'));
reloadDialog.addEventListener('click',e=>{const b=e.target.closest('[data-reload]');if(b?.dataset.reload==='close')reloadDialog.close();else if(b?.dataset.reload==='run')runReload();});
// Escape must not hide a rebuild that is still running.
reloadDialog.addEventListener('cancel',e=>{if(reloadDialog.querySelector('.spin'))e.preventDefault();});
// The changes behind a 🔧: hovering opens them, clicking keeps them open
// until a click elsewhere, Escape or ✕. The popup sits below the 🔧, or
// above it near the bottom of the window.
const changePop=document.createElement('div');changePop.className='change-pop';changePop.hidden=true;changePop.setAttribute('role','dialog');document.body.append(changePop);
let popMark=null,popPinned=false;
function openPop(mark,pin){popMark=mark;popPinned=pin;
 const list=mark.dataset.changes.split(',').map(n=>CHANGES[+n]);
 changePop.innerHTML=`${pin?'<button type="button" class="close" data-pop-close aria-label="Close">✕</button>':''}${list.map(c=>`<article><small>🔧 ${esc(c.date)}</small><strong>${esc(c.label)}</strong>${c.detail?`<p>${esc(c.detail)}</p>`:''}</article>`).join('')}`;
 changePop.classList.toggle('pinned',pin);changePop.hidden=false;
 const r=mark.getBoundingClientRect(),w=changePop.offsetWidth,h=changePop.offsetHeight;
 const x=Math.min(Math.max(8,r.left+r.width/2-w/2),innerWidth-w-8),below=r.bottom+8+h<=innerHeight-8;
 changePop.style.transform=`translate(${x}px,${below?r.bottom+8:Math.max(8,r.top-8-h)}px)`;}
function closePop(){changePop.hidden=true;popMark=null;popPinned=false;}
document.addEventListener('pointerover',e=>{if(popPinned)return;const m=e.target.closest?.('.change-mark');if(m&&m!==popMark)openPop(m,false);else if(!m&&popMark)closePop();});
document.addEventListener('click',e=>{const m=e.target.closest('.change-mark');
 if(m){popPinned&&popMark===m?closePop():openPop(m,true);return;}
 if(e.target.closest('[data-pop-close]')||popPinned&&!changePop.contains(e.target))closePop();});
document.addEventListener('keydown',e=>{const m=e.target.closest?.('.change-mark');
 if(m&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openPop(m,true);}else if(e.key==='Escape'&&popMark)closePop();});
// Capture also sees a chart scrolling sideways, which moves the 🔧.
document.addEventListener('scroll',()=>{if(popPinned&&popMark?.isConnected)openPop(popMark,true);else closePop();},{capture:true,passive:true});
render();applyLink();
