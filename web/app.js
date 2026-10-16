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
function periodKey(day,p){if(p==='day')return day;
 if(p==='3d'){const back=Math.round((new Date(LAST_DAY+'T00:00')-new Date(day+'T00:00'))/86400000);return addDays(LAST_DAY,-(Math.floor(back/3)*3+2));}if(p==='month')return day.slice(0,7);const d=new Date(day+'T00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const periodLabel=(k,p)=>p==='3d'?(e=>`${md(k)}–${e.slice(5,7)===k.slice(5,7)?+e.slice(8):md(e)}`)(addDays(k,2)):p==='day'?md(k):p==='week'?`Wk ${md(k)}`:new Date(k+'-01T00:00').toLocaleString('en-US',{month:'short'});
// Chart on/off is kept per browser so the page reopens the same way.
const DEFAULT_SHOWN={totals:['cost','activeMs','calls'],stats:['perHour','perCall','subShare']};
const loadShown=()=>{let saved={};try{saved=JSON.parse(localStorage.getItem('cca.shown')||'{}');}catch{}
 return Object.fromEntries(Object.entries(DEFAULT_SHOWN).map(([k,v])=>[k,new Set(Array.isArray(saved[k])?saved[k]:v)]));};
const saveShown=()=>{try{localStorage.setItem('cca.shown',JSON.stringify(Object.fromEntries(Object.entries(state.shown).map(([k,v])=>[k,[...v]]))));}catch{}};
const state={ssort:'cost',project:'all',period:'day',key:null,tool:null,sort:'cost',filter:'',toolLimit:10,sessionLimit:5,toggled:new Map(),moreTree:new Set(),openProposals:new Set(),allProjects:false,shown:loadShown()};
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
 stats:{perHour:{name:'Cost / active hour',color:'#ea5f2c',wide:true,v:a=>a.activeMs?a.cost/(a.activeMs/3600000):0,f:v=>`${usd(v)}/h`,af:usdAxis},ctx:{name:'Avg context',color:'#0aa5c2',v:a=>a.calls?a.ctx/a.calls:0,f:tok},perCall:{name:'Cost / call',color:'#e8b100',v:a=>a.calls?a.cost/a.calls:0,f:usd,af:usdAxis},cacheHit:{name:'Cache hit rate',color:'#d63384',v:a=>{const t=a.tokens.cacheRead+a.tokens.cacheWrite+a.tokens.input;return t?a.tokens.cacheRead/t*100:0;},f:pct},subShare:{name:'Subagent calls',color:'#9b4de0',v:a=>a.calls?a.subCalls/a.calls*100:0,f:pct},compactPerHour:{name:'Compacting / active hour',color:'#18a874',v:a=>a.activeMs?compactCost(a)/(a.activeMs/3600000):0,f:v=>`${usd(v)}/h`,af:usdAxis}}};
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
const SUMS=['calls','cost','cacheRead','cacheWrite','input','output','ctx','activeMs','subCalls','subCost','compactions','compactSummary','compactRebuild'];
function sumDaily(rows){const a={calls:0,cost:0,cacheRead:0,cacheWrite:0,input:0,output:0,compactions:0,compactSummary:0,compactRebuild:0,tokens:{cacheRead:0,cacheWrite:0,input:0,output:0},ctx:0,activeMs:0,subCalls:0,subCost:0,byModel:{},byEffort:{},byModelEffort:{}};
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
 $('#projects').innerHTML=[['all','All Project'],...shown.map(p=>[p,p])].map(([id,name])=>`<button data-project="${esc(id)}" class="${id==='all'?'':'indent'}" aria-current="${state.project===id}"><span>${esc(name)}</span></button>`).join('')
  +(list.length>PROJECT_LIMIT?`<button type="button" class="indent more-projects" data-all-projects>${state.allProjects?'Show fewer':`Show all (${list.length-shown.length} more)`}</button>`:'');}
// A time series per chart: each period is a group of bars, one per shown metric,
// each on its own scale. The right axis shows one metric's scale at a time.
const nice=v=>{const e=10**Math.floor(Math.log10(v)),f=v/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;};
// A change sits as a tag above the bars of the period it falls in. The star
// marks that period; the name runs right, or left near the right edge.
function changeTags(ps,width){const stack={};
 return CHANGES.map(c=>{const i=ps.findIndex(p=>p.key===periodKey(c.date,state.period));if(i<0)return '';const n=stack[i]=(stack[i]||0)+1;
  return `<g class="change-tag" data-cx="${(i+.5)*width}" data-n="${n}" data-label="${esc(c.label)}" data-tip="⭐ ${esc(c.date)} ${esc(c.label)}"><rect height="18" rx="9"/><text>⭐ ${esc(c.label)}</text></g>`;}).join('');}
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
   return `<rect x="${bx}" y="${base-bh}" width="${widths[j]}" height="${bh}" rx="${widths[j]>10?3:1.5}" fill="${m.color}" data-tip="${periodLabel(p.key,state.period)}|${m.name}|${m.f(v)}" data-color="${m.color}"></rect>`;}).join('')
   :'';
  return `<g class="group ${p.key===state.key?'is-sel':''}" data-key="${p.key}"><rect class="band" x="${x0+2}" y="0" width="${gw*scale-4}" height="${h}" rx="6"/>${bars}<text x="${cx}" y="${h-7}" text-anchor="middle">${periodLabel(p.key,state.period)}</text></g>`;}).join('')+changeTags(ps,gw*scale);fitTags(svg,plot,tops,gw*scale);}
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
 for(const [name,metrics] of Object.entries(CHARTS)){drawChart(name,metrics,state.shown[name],ps);
  document.querySelector(`.metrics[data-chart="${name}"]`).innerHTML=Object.entries(metrics).map(([id,m])=>`<button type="button" data-metric="${id}" data-chart="${name}" aria-pressed="${state.shown[name].has(id)}"><i style="background:${m.color};${m.wide?'width:16px':''}"></i>${m.name}</button>`).join('');}}
// A part's label sits on its bar when the bar is wide enough: the group on
// the first line and the part on the second, e.g. "Input\n(cache read)".
const modelLabel=name=>{const [model,effort]=name.split(' · ');return [model.replace(/^(\w)(\w*)-(\d+)-(\d+)$/,(m,a,b,x,y)=>`${a.toUpperCase()}${b} ${x}.${y}`),effort].filter(Boolean).join('\n');};
function fitLabels(){for(const span of document.querySelectorAll('.stack span')){const box=span.parentElement;span.classList.toggle('is-hidden',span.scrollWidth>box.clientWidth-16||span.scrollHeight>box.clientHeight);}}
addEventListener('resize',()=>fitLabels());
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
  +breakdown('Cost by model',Object.entries(a.byModelEffort).map(([name,v])=>({name,label:modelLabel(name),...v,color:modelColor(name)})));
 fitLabels();}
function toolRows(){const m=new Map();for(const r of D.tools.filter(r=>inProject(r)&&inPeriod(r)&&r.tool.includes(state.filter))){const t=m.get(r.tool)||{tool:r.tool,count:0,resultChars:0,cost:0,keys:[]};t.count+=r.count;t.resultChars+=r.resultChars;t.cost+=r.cost;t.keys.push(`${r.day}|${r.project}|${r.tool}`);m.set(r.tool,t);}
 const by={cost:t=>t.cost,count:t=>t.count,result:t=>t.resultChars,unit:t=>t.cost/t.count};return [...m.values()].sort((a,b)=>by[state.sort](b)-by[state.sort](a));}
// Tool Use is a tree, like a profiler: uses that share leading words add up
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
const titles=Object.fromEntries(D.sessions.map(s=>[s.session,s.title]));
const when=ts=>new Date(ts).toLocaleString('en-US',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function moreButtons(id,shown,total,step){$(id).innerHTML=`${shown<total?`<button class="link" data-more="${id}" data-step="${step}">Show ${Math.min(step,total-shown)} more (${total-shown} left)</button>`:''}${shown>step?`<button class="link" data-less="${id}" data-step="${step}">Back to top ${step}</button>`:''}`;}
const CHILD_LIMIT=8;
function findNode(id){let node=toolTree();for(const tk of tokens(id)){node=node.children.get(tk.text);if(!node)return null;}return node;}
function renderTools(){const root=toolTree(),total=root.cost,top=kids(root),shown=top.slice(0,state.toolLimit),out=[];
 $('#tools-note').textContent=`${toolRows().length} tools · ${usd(total)}`;
 const row=(n,rank)=>{const share=total?n.cost/total:0,list=kids(n),leaf=!list.length,open=!leaf&&isOpen(n),sel=state.tool===n.id;
  out.push(`<tr class="tool ${sel?'is-focus':''} ${leaf?'is-leaf':''}" data-tool="${esc(n.id)}"><td class="num">${rank||''}</td><td class="tool-name" style="padding-left:${8+(n.depth-1)*18}px"><span class="caret">${leaf?'':open?'▾':'▸'}</span>${esc(n.text)}</td><td class="num"><span class="share"><i style="width:${Math.max(2,share*90)}px"></i>${usd(n.cost)} <small>${Math.round(share*100)}%</small></span></td><td class="num">${num(n.count)}</td></tr>`);
  if(leaf&&sel){const ex=n.keys.flatMap(k=>D.examples[k]||[]).sort((a,b)=>b.result-a.result).slice(0,6);
   out.push(`<tr class="detail"><td colspan="4"><div class="ex">${ex.length?ex.map(e=>`<div><code>${esc(e.label)}</code><small>${usd(e.cost)}</small><small>${when(e.at)} · ${esc(titles[e.session]||'')} · ${esc(e.session.slice(0,8))}</small><small>result ${tok(e.result/4)} · context ${tok(e.ctx)}</small></div>`).join(''):'<p class="empty">No examples.</p>'}</div></td></tr>`);}
  if(!open)return;const all=state.moreTree.has(n.id)||state.filter,part=all?list:list.slice(0,CHILD_LIMIT);
  for(const c of part)row(c);
  if(part.length<list.length){const rest=list.slice(part.length);out.push(`<tr class="tool-more"><td></td><td colspan="3" style="padding-left:${8+n.depth*18}px"><button class="link" data-more-tree="${esc(n.id)}">${rest.length} more · ${usd(rest.reduce((s,c)=>s+c.cost,0))}</button></td></tr>`);}};
 shown.forEach((n,i)=>row(n,i+1));
 $('#tools').innerHTML=out.join('')||'<tr><td colspan="4" class="empty">No data.</td></tr>';
 moreButtons('#tools-more',shown.length,top.length,10);}
function renderSessions(){const m=new Map();for(const s of D.sessions.filter(s=>inProject(s)&&inPeriod(s))){const t=m.get(s.session)||{...s,calls:0,cost:0,activeMs:0};t.calls+=s.calls;t.cost+=s.cost;t.activeMs+=s.activeMs;t.first=Math.min(t.first,s.first);t.last=Math.max(t.last,s.last);m.set(s.session,t);}
 const rows=[...m.values()].sort((a,b)=>b[state.ssort]-a[state.ssort]),shown=rows.slice(0,state.sessionLimit);
 $('#sessions-note').textContent=`${rows.length} sessions`;
 $('#sessions').innerHTML=shown.map(s=>`<tr data-session="${esc(s.session)}"><td>${esc(s.title)}${s.sub?' <small>(subagent)</small>':''}<br><small style="color:var(--muted)">${esc(s.session.slice(0,8))}</small></td><td>${esc(s.project)}</td><td class="num">${num(s.calls)}</td><td class="num">${usd(s.cost)}</td><td class="num">${hrs(s.activeMs)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No data.</td></tr>';
 moreButtons('#sessions-more',shown.length,rows.length,5);}
function render(){renderProjects();renderProposals();renderChart();renderProfile();renderTools();renderSessions();}
const resetLimits=()=>{state.toolLimit=10;state.sessionLimit=5;state.tool=null;};
document.addEventListener('click',e=>{const t=e.target;
 const pl=t.closest('[data-proposal-link]');if(pl){const p=PROPOSALS.find(x=>x.id===pl.dataset.proposalLink);history.replaceState(null,'',`#${new URLSearchParams(p.link)}`.replace(/\+/g,'%20'));applyLink();return;}
 const all=t.closest('[data-all-projects]');if(all){state.allProjects=!state.allProjects;renderProjects();return;}
 const p=t.closest('[data-project]');if(p){state.project=p.dataset.project;resetLimits();render();return;}
 const per=t.closest('[data-p]');if(per){state.period=per.dataset.p;state.key=null;resetLimits();document.querySelectorAll('#period button').forEach(b=>b.setAttribute('aria-pressed',b===per));render();return;}
 const g=t.closest('[data-key]');if(g){state.key=g.dataset.key;resetLimits();render();return;}
 const m=t.closest('[data-metric]');if(m){const set=state.shown[m.dataset.chart],id=m.dataset.metric;if(set.has(id)&&set.size>1)set.delete(id);else set.add(id);saveShown();renderChart();return;}
 const s=t.closest('[data-sort]');if(s){state.sort=s.dataset.sort;document.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b===s));renderTools();return;}
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
 state.project=q.get('project')||'all';state.period=['day','3d','week','month'].includes(q.get('period'))?q.get('period'):'day';
 document.querySelectorAll('#period button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===state.period));
 state.key=q.has('date')?periodKey(q.get('date'),state.period):null;resetLimits();state.filter='';$('#tool-filter').value='';
 const metrics=(q.get('metrics')||'').split(',').map(m=>m.split('.')).filter(([c,m])=>CHARTS[c]?.[m]);
 for(const [c,m] of metrics)state.shown[c].add(m);
 state.toggled.clear();state.moreTree.clear();
 if(q.has('tool')){state.tool=q.get('tool');revealTool(state.tool);const n=findNode(state.tool);if(n?.children.size)state.toggled.set(n.id,true);}
 render();
 if(q.has('session')){const id=q.get('session');if(![...document.querySelectorAll('#sessions tr')].some(r=>r.dataset.session?.startsWith(id))){state.sessionLimit=1000;renderSessions();}}
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
const RATING_NAMES={ease:'Ease of use',safety:'Few side effects',savings:'Savings'};
const ratingTags=r=>`<div class="ratings">${Object.keys(RATING_NAMES).filter(k=>r?.[k]).map(k=>`<span class="rank-${r[k]}">${RATING_NAMES[k]} <b>${r[k]}</b></span>`).join('')}</div>`;
const starText=n=>'★'.repeat(n)+'☆'.repeat(5-n);
// The latest run's changes are marked, so a reader sees what moved since last time.
const LATEST=PROPOSALS.reduce((d,p)=>p.updated>d?p.updated:d,'');
function renderProposals(){const box=$('#proposals');
 // Details the reader opened stay open when the list is drawn again.
 for(const a of box.querySelectorAll('[data-proposal]'))a.querySelector('details').open?state.openProposals.add(a.dataset.proposal):state.openProposals.delete(a.dataset.proposal);
 const list=PROPOSALS.filter(p=>!p.project||state.project==='all'||p.project===state.project).sort((a,b)=>b.stars-a.stars);
 box.innerHTML=list.length?`<h2>Improvements</h2>${list.map(p=>`<article class="proposal" data-proposal="${esc(p.id)}">
  <div class="stars" role="img" aria-label="Recommended ${p.stars} of 5">${starText(p.stars)}${p.updated===LATEST?` <em>${p.since===p.updated?'New':'Updated'}</em>`:''}</div>
  <strong>${esc(p.action)}</strong>${p.project&&state.project==='all'?`<small class="proposal-project">${esc(p.project)}</small>`:''}
  ${p.news?`<p class="proposal-news">${esc(p.news)}</p>`:''}
  <details${state.openProposals.has(p.id)?' open':''}><summary>Details</summary>${p.detail?`<p>${esc(p.detail)}</p>`:''}${ratingTags(p.ratings)}
   ${/^https?:\/\//.test(p.source||'')?`<a class="option-source" href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.source)}</a>`:''}
   ${Object.keys(p.link||{}).length?`<button type="button" class="link" data-proposal-link="${esc(p.id)}">Show in report</button>`:''}
   <small class="proposal-dates">Since ${md(p.since)}${p.updated!==p.since?` · updated ${md(p.updated)}`:''}</small></details></article>`).join('')}`:'';}
// The item a proposal is about is scrolled into the upper part of the window.
function bringIntoView(el){if(!el)return;const r=el.getBoundingClientRect();scrollTo({top:Math.max(0,r.top+scrollY-Math.max(80,innerHeight*.18)),behavior:'smooth'});}
function applyLink(){const q=new URLSearchParams(location.hash.slice(1));if(![...q.keys()].length)return;bringIntoView(applyView(q));}
window.addEventListener('hashchange',applyLink);
$('#meta').textContent=`As of ${new Date(D.generatedAt).toLocaleString('en-US')} · provisional list prices`;
render();applyLink();
