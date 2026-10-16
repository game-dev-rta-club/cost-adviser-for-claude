const D=window.CCA,$=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=v=>`$${v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const short=v=>v>=1e6?`${+(v/1e6).toFixed(1)}M`:v>=1e3?`${+(v/1e3).toFixed(1)}k`:`${+v.toFixed(2)}`;
const usdAxis=v=>`$${short(v)}`;
const pct=v=>`${v.toFixed(0)}%`;
const tok=v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:`${Math.round(v)}`;
const num=v=>Math.round(v).toLocaleString('en-US');
const hrs=ms=>ms>=3600000?`${(ms/3600000).toFixed(1)}h`:`${Math.round(ms/60000)}m`;
const md=d=>{const [,m,dd]=d.split('-');return `${+m}/${+dd}`;};
function periodKey(day,p){if(p==='day')return day;if(p==='month')return day.slice(0,7);const d=new Date(day+'T00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const periodLabel=(k,p)=>p==='day'?md(k):p==='week'?`Wk ${md(k)}`:new Date(k+'-01T00:00').toLocaleString('en-US',{month:'short'});
// Chart on/off is kept per browser so the page reopens the same way.
const DEFAULT_SHOWN={totals:['cost','activeMs','calls'],stats:['perHour','perCall','subShare']};
const loadShown=()=>{let saved={};try{saved=JSON.parse(localStorage.getItem('cca.shown')||'{}');}catch{}
 return Object.fromEntries(Object.entries(DEFAULT_SHOWN).map(([k,v])=>[k,new Set(Array.isArray(saved[k])?saved[k]:v)]));};
const saveShown=()=>{try{localStorage.setItem('cca.shown',JSON.stringify(Object.fromEntries(Object.entries(state.shown).map(([k,v])=>[k,[...v]]))));}catch{}};
const state={ssort:'cost',project:'all',period:'day',key:null,tool:null,sort:'cost',filter:'',toolLimit:10,sessionLimit:5,shown:loadShown()};
// Ratios from a small sample mislead, so they are hidden below this much use.
const MIN_ACTIVE_MS=10*60000,MIN_CALLS=10;
const enough=a=>a.activeMs>=MIN_ACTIVE_MS&&a.calls>=MIN_CALLS;
// Recorded changes come with the data when the page is built.
const CHANGES=Array.isArray(D.changes)?D.changes:[];
// Totals show how much Claude was used; Stats show efficiency. The bar that
// matters most in each chart is drawn wide.
const CHARTS={
 totals:{cost:{name:'Cost',color:'#ea5f2c',wide:true,v:a=>a.cost,f:usd,af:usdAxis},activeMs:{name:'Active time',color:'#2f7fe0',v:a=>a.activeMs,f:hrs,unit:3600000},calls:{name:'Calls',color:'#18a874',v:a=>a.calls,f:v=>`${num(v)} calls`,af:short},tokens:{name:'Tokens',color:'#9b4de0',v:a=>Object.values(a.tokens).reduce((s,x)=>s+x,0),f:tok}},
 stats:{perHour:{name:'Cost / active hour',color:'#ea5f2c',wide:true,v:a=>a.activeMs?a.cost/(a.activeMs/3600000):0,f:v=>`${usd(v)}/h`,af:usdAxis},ctx:{name:'Avg context',color:'#0aa5c2',v:a=>a.calls?a.ctx/a.calls:0,f:tok},perCall:{name:'Cost / call',color:'#e8b100',v:a=>a.calls?a.cost/a.calls:0,f:usd,af:usdAxis},cacheHit:{name:'Cache hit rate',color:'#d63384',v:a=>{const t=a.tokens.cacheRead+a.tokens.cacheWrite+a.tokens.input;return t?a.tokens.cacheRead/t*100:0;},f:pct},subShare:{name:'Subagent calls',color:'#9b4de0',v:a=>a.calls?a.subCalls/a.calls*100:0,f:pct}}};
// Stats are ratios: hide them when the period has too little use.
const sparse=name=>name==='stats';
// Profile: Claude's orange is the base (Opus, Input). Other families get nearby
// cool hues; effort only changes the shade.
const HUES={opus:[16,72],sonnet:[268,52],haiku:[292,45],fable:[226,55]};
const hue=(family,l)=>{const [h,sat]=HUES[family]||[30,8];return `hsl(${h} ${sat}% ${l}%)`;};
const EFFORT={low:76,medium:66,high:56,xhigh:46,max:36};
const modelColor=name=>{const [model,effort='']=name.split(' · '),family=Object.keys(HUES).find(f=>model.includes(f));return hue(family,EFFORT[effort.trim()]||56);};
// Profile shares use Claude's orange, darkest to lightest by cost.
const PALETTE=['#d97757','#a8462e','#e9a37f','#7a3320','#f2c6a8','#c26a4a','#5c2a1c','#f7e0cf'];
const inProject=r=>state.project==='all'||r.project===state.project;
const inPeriod=r=>!state.key||periodKey(r.day,state.period)===state.key;
function sumDaily(rows){const a={calls:0,cost:0,cacheRead:0,cacheWrite:0,input:0,output:0,tokens:{cacheRead:0,cacheWrite:0,input:0,output:0},ctx:0,activeMs:0,subCalls:0,subCost:0,byModel:{},byEffort:{},byModelEffort:{}};
 for(const r of rows){for(const k of ['calls','cost','cacheRead','cacheWrite','input','output','ctx','activeMs','subCalls','subCost'])a[k]+=r[k]||0;for(const k in a.tokens)a.tokens[k]+=r.tokens[k];
  for(const f of ['byModel','byEffort','byModelEffort'])for(const [n,v] of Object.entries(r[f]||{})){const t=a[f][n]||(a[f][n]={cost:0,calls:0});t.cost+=v.cost;t.calls+=v.calls;}}return a;}
function periods(){const keys=new Map();for(const r of D.daily.filter(inProject)){const k=periodKey(r.day,state.period);if(!keys.has(k))keys.set(k,[]);keys.get(k).push(r);}
 return [...keys.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,rows])=>({key:k,...sumDaily(rows)}));}
function renderProjects(){const total={};for(const r of D.daily)total[r.project]=(total[r.project]||0)+r.cost;
 const list=Object.entries(total).sort((a,b)=>b[1]-a[1]),all=list.reduce((s,[,v])=>s+v,0);
 $('#projects').innerHTML=[['all','All Project',all],...list.map(([p,v])=>[p,p,v])].map(([id,name,v])=>`<button data-project="${esc(id)}" class="${id==='all'?'':'indent'}" aria-current="${state.project===id}"><span>${esc(name)}</span><span>${usd(v)}</span></button>`).join('');}
// A time series per chart: each period is a group of bars, one per shown metric,
// each on its own scale. The right axis shows one metric's scale at a time.
const nice=v=>{const e=10**Math.floor(Math.log10(v)),f=v/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;};
// A change sits as a tag above the bars of the period it falls in. The star
// marks that period; the name runs right, or left near the right edge.
function changeTags(ps,width){const stack={};
 return CHANGES.map(c=>{const i=ps.findIndex(p=>p.key===periodKey(c.date,state.period));if(i<0)return '';const n=stack[i]=(stack[i]||0)+1;
  return `<g class="change-tag" data-cx="${(i+.5)*width}" data-n="${n}" data-label="${esc(c.label)}"><rect height="18" rx="9"/><text>⭐ ${esc(c.label)}</text><title>${esc(c.date)} ${esc(c.label)}</title></g>`;}).join('');}
// Size each tag to its text and keep it above every bar it covers.
function fitTags(svg,plot,tops,width){for(const g of svg.querySelectorAll('.change-tag')){const t=g.querySelector('text'),r=g.querySelector('rect'),w=t.getComputedTextLength()+16,cx=+g.dataset.cx,pad=13;
 const right=cx-pad+w<=plot,x0=right?cx-pad:cx+pad-w;
 t.textContent=right?`⭐ ${g.dataset.label}`:`${g.dataset.label} ⭐`;t.setAttribute('text-anchor',right?'start':'end');t.setAttribute('x',right?x0+8:x0+w-8);
 const from=Math.max(0,Math.floor(x0/width)),to=Math.min(tops.length-1,Math.floor((x0+w)/width));
 const y=Math.max(10,Math.min(...tops.slice(from,to+1))-14-(g.dataset.n-1)*20);
 t.setAttribute('y',y+2);r.setAttribute('x',x0);r.setAttribute('y',y-11);r.setAttribute('width',w);}}
function drawChart(name,metrics,shown,ps){const id=`#chart-${name}`,ms=Object.keys(metrics).filter(k=>shown.has(k)),gw=72,h=214,top=32,base=h-24,aw=46,plot=Math.max(ps.length*gw,420),scale=plot/(ps.length*gw||1);
 const ok=p=>!sparse(name)||enough(p);
 const step=Object.fromEntries(ms.map(k=>{const u=metrics[k].unit||1;return [k,nice(Math.max(...ps.filter(ok).map(metrics[k].v),1e-9)/u/4)*u];})),max=Object.fromEntries(ms.map(k=>[k,step[k]*4]));
 const widths=ms.map(k=>metrics[k].wide?18:7),gap=3,groupW=widths.reduce((s,w)=>s+w,0)+gap*(ms.length-1);
 const y=f=>base-f*(base-top);
 const svg=$(id),axis=$(`${id}-axis`);svg.setAttribute('viewBox',`0 0 ${plot} ${h}`);svg.style.minWidth=`${plot}px`;
 axis.setAttribute('viewBox',`0 0 ${aw*ms.length} ${h}`);axis.style.width=`${aw*ms.length}px`;
 // One axis per shown metric, in its color.
 axis.innerHTML=ms.map((k,j)=>{const m=metrics[k],x=j*aw;return `<g class="axis" data-axis="${k}" transform="translate(${x} 0)"><rect class="axis-hit" x="0" y="0" width="${aw}" height="${base}"/><line x1="1.5" x2="1.5" y1="${top}" y2="${base}" stroke="${m.color}" stroke-width="3"/>${[0,1,2,3,4].map(i=>`<line x1="0" x2="6" y1="${y(i/4)}" y2="${y(i/4)}" stroke="${m.color}" stroke-width="2"/><text x="9" y="${y(i/4)+4}" text-anchor="start" fill="${m.color}">${i?(m.af||m.f)(step[k]*i):0}</text>`).join('')}</g>`;}).join('');
const tops=[];
 svg.innerHTML=`<line x1="0" x2="${plot}" y1="${base+.5}" y2="${base+.5}" stroke="var(--line)"/>`+ms.map(k=>`<g class="grid-set" data-axis="${k}">${[1,2,3,4].map(i=>`<line class="grid" x1="0" x2="${plot}" y1="${y(i/4)+.5}" y2="${y(i/4)+.5}" stroke="${metrics[k].color}"/>`).join('')}</g>`).join('')+ps.map((p,i)=>{const x0=i*gw*scale,cx=x0+gw*scale/2;let x=cx-groupW/2;
  tops[i]=base;const bars=ok(p)?ms.map((k,j)=>{const m=metrics[k],v=m.v(p),bh=Math.max(1,v/max[k]*(base-top)),bx=x;x+=widths[j]+gap;tops[i]=Math.min(tops[i],base-bh);
   return `<rect x="${bx}" y="${base-bh}" width="${widths[j]}" height="${bh}" rx="${widths[j]>10?3:1.5}" fill="${m.color}"><title>${periodLabel(p.key,state.period)} ${m.name} ${m.f(v)}</title></rect>`;}).join('')
   :'';
  return `<g class="group ${p.key===state.key?'is-sel':''}" data-key="${p.key}"><rect class="band" x="${x0+2}" y="0" width="${gw*scale-4}" height="${h}" rx="6"/>${bars}<text x="${cx}" y="${h-7}" text-anchor="middle">${periodLabel(p.key,state.period)}</text></g>`;}).join('')+changeTags(ps,gw*scale);fitTags(svg,plot,tops,gw*scale);}
// Hovering a metric button or its axis draws that metric's grid lines.
function showGrid(chart,metric){for(const svg of [$(`#chart-${chart}`),$(`#chart-${chart}-axis`)]){if(!svg)continue;svg.classList.toggle('show-grid',!!metric);
  for(const g of svg.querySelectorAll('[data-axis]'))g.classList.toggle('is-on',g.dataset.axis===metric);}}
const hovered=t=>t.closest?.('.metrics [data-metric]')||t.closest?.('.chart-axis .axis');
const chartOf=el=>el.dataset.chart||el.closest('svg').id.replace(/^chart-|-axis$/g,'');
document.addEventListener('pointerover',e=>{const el=hovered(e.target);if(el)showGrid(chartOf(el),el.dataset.metric||el.dataset.axis);});
document.addEventListener('pointerout',e=>{const el=hovered(e.target);if(!el||el.contains(e.relatedTarget))return;showGrid(chartOf(el),null);});
function renderChart(){const ps=periods();if(!ps.some(p=>p.key===state.key))state.key=ps.at(-1)?.key||null;
 for(const [name,metrics] of Object.entries(CHARTS)){drawChart(name,metrics,state.shown[name],ps);
  document.querySelector(`.metrics[data-chart="${name}"]`).innerHTML=Object.entries(metrics).map(([id,m])=>`<button type="button" data-metric="${id}" data-chart="${name}" aria-pressed="${state.shown[name].has(id)}"><i style="background:${m.color};${m.wide?'width:16px':''}"></i>${m.name}</button>`).join('');}}
function breakdown(title,entries,{calls=true,sorted=true,rows=null}={}){const total=entries.reduce((s,e)=>s+e.cost,0);if(!total)return '';
 entries=entries.filter(e=>e.cost>0);if(sorted)entries.sort((a,b)=>b.cost-a.cost);
 return `<div class="breakdown"><h3>${title}</h3><div class="stack">${entries.map((e,i)=>`<div title="${esc(e.name)} ${usd(e.cost)}" style="flex:${e.cost};background:${e.color||PALETTE[i%PALETTE.length]}"></div>`).join('')}</div>
  <table><tbody>${(rows||entries).map((e,i)=>`<tr class="${e.kind||''}"><td>${e.kind==='group'?'':`<i style="background:${e.color||PALETTE[i%PALETTE.length]}"></i>`}${esc(e.name)}</td><td class="num">${usd(e.cost)}</td><td class="num">${Math.round(e.cost/total*100)}%</td><td class="num">${calls?`${num(e.calls)} calls`:`${tok(e.tokens)} tokens`}</td></tr>`).join('')}</tbody></table></div>`;}
function renderProfile(){const a=sumDaily(D.daily.filter(r=>inProject(r)&&inPeriod(r)));
 $('#profile-title').innerHTML=`Profile <small>${state.key?periodLabel(state.key,state.period):''} · ${esc(state.project==='all'?'All projects':state.project)}</small>`;
 $('#cost').textContent=usd(a.cost);
 const tokens=Object.values(a.tokens).reduce((s,v)=>s+v,0);
 const ratio=f=>enough(a)?f():'—';
 $('#stats').innerHTML=[['Calls',num(a.calls)],['Tokens',tok(tokens)],['Active time',hrs(a.activeMs)],['Cost / active hour',ratio(()=>`${usd(a.cost/(a.activeMs/3600000))}/h`)],['Avg context',ratio(()=>tok(a.ctx/a.calls))],['Cost / call',ratio(()=>usd(a.cost/a.calls))],['Cache hit rate',ratio(()=>pct(CHARTS.stats.cacheHit.v(a)))],['Subagent calls',ratio(()=>`${pct(a.subCalls/a.calls*100)} (${num(a.subCalls)})`)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
 // Input is split by cache use: these three and Output do not overlap.
 const parts=[['cacheRead','Cache read',hue('opus',66)],['cacheWrite','Cache write',hue('opus',54)],['input','Uncached',hue('opus',80)],['output','Output',hue('fable',38)]].map(([k,name,color])=>({name,color,cost:a[k],tokens:a.tokens[k],kind:k==='output'?'group':'sub'}));
 const inputs=parts.slice(0,3),input={name:'Input',kind:'group',cost:inputs.reduce((s,e)=>s+e.cost,0),tokens:inputs.reduce((s,e)=>s+e.tokens,0)};
 $('#breakdowns').innerHTML=breakdown('Cost by type',parts,{calls:false,sorted:false,rows:[input,...inputs,{...parts[3],kind:'group output'}]})
  +breakdown('Cost by model',Object.entries(a.byModelEffort).map(([name,v])=>({name,...v,color:modelColor(name)})));}
function toolRows(){const m=new Map();for(const r of D.tools.filter(r=>inProject(r)&&inPeriod(r)&&r.tool.includes(state.filter))){const t=m.get(r.tool)||{tool:r.tool,count:0,resultChars:0,cost:0,keys:[]};t.count+=r.count;t.resultChars+=r.resultChars;t.cost+=r.cost;t.keys.push(`${r.day}|${r.project}|${r.tool}`);m.set(r.tool,t);}
 const by={cost:t=>t.cost,count:t=>t.count,result:t=>t.resultChars,unit:t=>t.cost/t.count};return [...m.values()].sort((a,b)=>by[state.sort](b)-by[state.sort](a));}
const titles=Object.fromEntries(D.sessions.map(s=>[s.session,s.title]));
const when=ts=>new Date(ts).toLocaleString('en-US',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function moreButtons(id,shown,total,step){$(id).innerHTML=`${shown<total?`<button class="link" data-more="${id}" data-step="${step}">Show ${Math.min(step,total-shown)} more (${total-shown} left)</button>`:''}${shown>step?`<button class="link" data-less="${id}" data-step="${step}">Back to top ${step}</button>`:''}`;}
function renderTools(){const rows=toolRows(),total=rows.reduce((s,t)=>s+t.cost,0),shown=rows.slice(0,state.toolLimit);
 $('#tools-note').textContent=`${rows.length} tools · ${usd(total)}`;
 $('#tools').innerHTML=shown.map((t,i)=>{const share=total?t.cost/total:0,open=state.tool===t.tool;let detail='';
  if(open){const ex=t.keys.flatMap(k=>D.examples[k]||[]).sort((a,b)=>b.result-a.result).slice(0,6);
   detail=`<tr class="detail"><td colspan="4"><div class="ex">${ex.length?ex.map(e=>`<div><code>${esc(e.label)}</code><small>${usd(e.cost)}</small><small>${when(e.at)} · ${esc(titles[e.session]||'')} · ${esc(e.session.slice(0,8))}</small><small>result ${tok(e.result/4)} · context ${tok(e.ctx)}</small></div>`).join(''):'<p class="empty">No examples.</p>'}</div></td></tr>`;}
  return `<tr class="tool ${open?'is-focus':''}" data-tool="${esc(t.tool)}"><td class="num">${i+1}</td><td>${esc(t.tool)}</td><td class="num"><span class="share"><i style="width:${Math.max(2,share*90)}px"></i>${usd(t.cost)} <small>${Math.round(share*100)}%</small></span></td><td class="num">${num(t.count)}</td></tr>${detail}`;}).join('')||'<tr><td colspan="4" class="empty">No data.</td></tr>';
 moreButtons('#tools-more',shown.length,rows.length,10);}
function renderSessions(){const m=new Map();for(const s of D.sessions.filter(s=>inProject(s)&&inPeriod(s))){const t=m.get(s.session)||{...s,calls:0,cost:0,activeMs:0};t.calls+=s.calls;t.cost+=s.cost;t.activeMs+=s.activeMs;t.first=Math.min(t.first,s.first);t.last=Math.max(t.last,s.last);m.set(s.session,t);}
 const rows=[...m.values()].sort((a,b)=>b[state.ssort]-a[state.ssort]),shown=rows.slice(0,state.sessionLimit);
 $('#sessions-note').textContent=`${rows.length} sessions`;
 $('#sessions').innerHTML=shown.map(s=>`<tr><td>${esc(s.title)}${s.sub?' <small>(subagent)</small>':''}<br><small style="color:var(--muted)">${esc(s.session.slice(0,8))}</small></td><td>${esc(s.project)}</td><td class="num">${num(s.calls)}</td><td class="num">${usd(s.cost)}</td><td class="num">${hrs(s.activeMs)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No data.</td></tr>';
 moreButtons('#sessions-more',shown.length,rows.length,5);}
function render(){renderProjects();renderChart();renderProfile();renderTools();renderSessions();}
const resetLimits=()=>{state.toolLimit=10;state.sessionLimit=5;state.tool=null;};
document.addEventListener('click',e=>{const t=e.target;
 const p=t.closest('[data-project]');if(p){state.project=p.dataset.project;resetLimits();render();return;}
 const per=t.closest('[data-p]');if(per){state.period=per.dataset.p;state.key=null;resetLimits();document.querySelectorAll('#period button').forEach(b=>b.setAttribute('aria-pressed',b===per));render();return;}
 const g=t.closest('[data-key]');if(g){state.key=g.dataset.key;resetLimits();render();return;}
 const m=t.closest('[data-metric]');if(m){const set=state.shown[m.dataset.chart],id=m.dataset.metric;if(set.has(id)&&set.size>1)set.delete(id);else set.add(id);saveShown();renderChart();return;}
 const s=t.closest('[data-sort]');if(s){state.sort=s.dataset.sort;document.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b===s));renderTools();return;}
 const ss=t.closest('[data-ssort]');if(ss){state.ssort=ss.dataset.ssort;document.querySelectorAll('[data-ssort]').forEach(b=>b.setAttribute('aria-pressed',b===ss));renderSessions();return;}
 const more=t.closest('[data-more]');if(more){const k=more.dataset.more==='#tools-more'?'toolLimit':'sessionLimit';state[k]+=+more.dataset.step;more.dataset.more==='#tools-more'?renderTools():renderSessions();return;}
 const less=t.closest('[data-less]');if(less){const k=less.dataset.less==='#tools-more'?'toolLimit':'sessionLimit';state[k]=+less.dataset.step;less.dataset.less==='#tools-more'?renderTools():renderSessions();return;}
 const row=t.closest('tr.tool');if(row){state.tool=state.tool===row.dataset.tool?null:row.dataset.tool;renderTools();}
});
document.addEventListener('input',e=>{if(e.target.id!=='tool-filter')return;state.filter=e.target.value.trim();state.toolLimit=10;renderTools();});
$('#meta').textContent=`As of ${new Date(D.generatedAt).toLocaleString('en-US')} · provisional list prices`;
render();
