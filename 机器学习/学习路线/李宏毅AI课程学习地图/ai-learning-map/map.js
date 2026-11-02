'use strict';
(async function () {
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORAGE='lee-ai-course-progress-v1';
  let data,done={},storageAvailable=true,view=new URLSearchParams(location.search).get('view')==='archive'?'archive':'map',page=0,currentUnit=null;
  try {const response=await fetch('data.json');if(!response.ok)throw new Error('data');data=await response.json();}
  catch { $('content').innerHTML='<div class="empty">课程资料暂时未能载入。请刷新页面，或<a href="learning-path.csv">下载学习路径 CSV</a>。</div>';$('progressText').textContent='课程资料未能载入';return; }
  const courses=Object.fromEntries(data.courses.map(c=>[c.id,c]));
  const topics=Object.fromEntries(data.topics.map(t=>[t.id,t]));
  const units=Object.fromEntries(data.units.map(u=>[u.id,u]));
  try {const parsed=JSON.parse(localStorage.getItem(STORAGE)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))for(const [key,value]of Object.entries(parsed))if(units[key]&&value===true)done[key]=true;}
  catch {storageAvailable=false;$('recordNotice').textContent='浏览器暂不允许保存记录，本次勾选仍可导出备份。';}
  const external=(text,href)=>/^https?:\/\//.test(href)?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`:'';
  function resourceLinks(u){
    const r=[{type:'官网',url:u.official},...u.slides,...u.videos];
    const totals=r.reduce((a,x)=>(a[x.type]=(a[x.type]||0)+1,a),{}),counter={};
    return '<div class="resource-links">'+r.map(x=>{counter[x.type]=(counter[x.type]||0)+1;return x.availability==='404'?`<span class="resource-note">${esc(x.type)}（官网原链失效）</span>`:external(x.type+(totals[x.type]>1?' '+counter[x.type]:''),x.url);}).join('')+'</div>'+(!u.slides.length?'<p class="resource-note">官网未为该讲单列课件。</p>':'');
  }
  function progress(){const n=Object.keys(done).length;$('progress').max=data.units.length;$('progress').value=n;$('progressText').textContent=`已完成 ${n} / ${data.units.length} 个推荐单元`;}
  function save(){if(storageAvailable)try{localStorage.setItem(STORAGE,JSON.stringify(done));}catch{storageAvailable=false;$('recordNotice').textContent='本地保存失败，请导出记录备份。';}progress();}
  function matches(u){
    const q=$('search').value.trim().toLowerCase(),route=$('route').value,course=$('course').value;
    if(course!=='all'&&u.course!==course)return false;
    if(route==='core'&&!['基础','主线','实践'].includes(u.level))return false;
    if(route==='llm'&&!(u.stage===4||['C13','C14','C15','C16','G16','G17'].includes(u.id)))return false;
    if(route==='agent'&&!(u.stage===5||['E06','E07'].includes(u.id)))return false;
    if(route==='multimodal'&&!['generative','speech'].includes(u.topic))return false;
    return !q||`${u.id} ${u.title} ${u.summary} ${u.course} ${courses[u.course].name} ${courses[u.course].term} ${topics[u.topic].title} ${u.level}`.toLowerCase().includes(q);
  }
  function filtered(){return data.units.filter(matches);}
  function renderMap(list){
    let out='';for(let stage=1;stage<=6;stage++){
      const stageUnits=list.filter(u=>u.stage===stage);if(!stageUnits.length)continue;
      out+=`<section class="stage" data-stage="${stage}"><span class="stage-number" aria-hidden="true">${String(stage).padStart(2,'0')}</span><div class="stage-heading"><h2>${esc(data.stages[stage])}</h2><small>${stageUnits.length} 个学习单元</small></div><div class="node-grid">`;
      for(const u of stageUnits){
        out+=`<button class="node ${done[u.id]?'complete':''}" data-unit="${u.id}" aria-label="学习 ${esc(u.id+' · '+u.title)}"><span class="node-top"><span>${esc(u.id+' · '+u.level)}</span><span class="node-arrow" aria-hidden="true">↗</span></span><h3>${esc(u.title)}</h3><p>${esc(u.summary)}</p><span class="node-bottom"><span>${esc(u.course+' · '+courses[u.course].term)}</span><span class="tag">${done[u.id]?'✓ 已完成':'查看课程'}</span></span></button>`;
      }out+='</div></section>';
    }return out||'<div class="empty">没有匹配的学习单元。请调整关键词或筛选条件。</div>';
  }
  function checkbox(u,prefix){return `<input type="checkbox" id="${prefix}-${u.id}" data-complete="${u.id}" ${done[u.id]?'checked':''} aria-label="将 ${esc(u.id+' '+u.title)} 标为完成">`;}
  function renderPath(list){return '<div class="table-scroller"><table class="path-table"><thead><tr><th>完成 / 单元</th><th>名称 / 课程</th><th>内容与完成标志</th><th>前置与资源</th></tr></thead><tbody>'+list.map(u=>`<tr><td class="id-cell">${checkbox(u,'path')} ${u.id}<br>${esc(u.level)}</td><td class="title-cell"><button class="unit-jump" data-unit="${u.id}">${esc(u.title)}</button><p>${esc(u.course+' · '+courses[u.course].term)}</p></td><td class="summary-cell">${esc(u.summary)}<p><strong>完成标志：</strong>${esc(u.goal)}</p></td><td><div>${u.prerequisites.map(p=>`<button class="unit-jump" data-unit="${p}">${p}</button>`).join('、')||'高中代数'}</div>${resourceLinks(u)}</td></tr>`).join('')+'</tbody></table></div>'+(list.length?'':'<p class="empty">没有匹配的学习单元。</p>');}
  function archiveList(){const q=$('search').value.trim().toLowerCase(),course=$('course').value;return data.archive.filter(a=>(course==='all'||course===a.course)&&(!q||`${a.title} ${a.course} ${courses[a.course].name} ${courses[a.course].term}`.toLowerCase().includes(q)));}
  function renderArchive(){const list=archiveList(),size=30,total=Math.ceil(list.length/size);page=Math.max(0,Math.min(page,total-1));const rows=list.slice(page*size,(page+1)*size);
    $('resultStatus').textContent=`找到 ${list.length} 个官网资源组 · 当前展示 ${rows.length} 个`;
    return '<div class="archive-note">历年目录保留官网主题／日期分组，一个资源组可能包含多段视频、多个语言版本或共享课件。资源组数不等于讲次数；同组课件需按官网核对具体讲次。目录按课程筛选，学习方向筛选仅用于推荐路径。</div><div class="table-scroller"><table class="archive-table"><thead><tr><th>所属课程</th><th>官网主题 / 日期资源组</th><th>原始资源</th></tr></thead><tbody>'+rows.map(a=>`<tr><td class="id-cell">${esc(a.course)}<br>${esc(courses[a.course].term)}</td><td class="summary-cell">${esc(a.title)}</td><td>${external('课程官网',courses[a.course].url)}<div class="resource-links">${a.resources.map((r,i)=>r.availability==='404'?`<span class="resource-note">${esc(r.type+' '+r.title)}（官网原链失效）</span>`:external(r.type+' '+(r.title||String(i+1)),r.url)).join('')}</div></td></tr>`).join('')+'</tbody></table></div>'+(list.length?`<div class="pagination"><button data-page="${page-1}" ${page<=0?'disabled':''}>上一页</button><span>${page+1} / ${total}</span><button data-page="${page+1}" ${page>=total-1?'disabled':''}>下一页</button></div>`:'<p class="empty">没有匹配的历史资源组。</p>');}
  function render(){const list=filtered();document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
    $('route').disabled=view==='archive';$('route').title=view==='archive'?'历年目录请使用课程与关键词筛选':'';
    $('hint').textContent=view==='map'?'与博文表 2 是同一条学习路径。按阶段向下，同阶段从左到右学习；点击单元查看前置知识和课程资料。':view==='path'?'与地图及博文表 2 的单元、顺序和资料一致。勾选完成状态后，地图会同步更新。':'保留历史版本，查找旧讲义、补充专题与不同学期的讲次。';
    $('resultStatus').textContent=`${list.length} 个匹配单元 · ${new Set(list.map(u=>u.stage)).size} 个学习阶段`;
    $('content').innerHTML=view==='map'?renderMap(list):view==='path'?renderPath(list):renderArchive();progress();
  }
  function detail(uid){currentUnit=uid;const u=units[uid];
    const pre=u.prerequisites.map(p=>`<button class="unit-jump" data-unit="${p}">${esc(p+' · '+units[p].title)}</button>`).join(' / ')||'高中代数与基本运算';
    const post='/机器学习/学习路线/李宏毅AI课程学习地图/';
    $('detailBody').innerHTML=`<h2 id="detailTitle">${esc(u.id+' · '+u.title)}</h2><p class="question">第 ${u.stage} 阶段 · ${esc(data.stages[u.stage])}</p><div class="prereq">前置单元：${pre}</div><section class="unit" id="detail-${u.id}"><div class="unit-head">${checkbox(u,'check-detail')}<label for="check-detail-${u.id}">标记为已完成<div class="unit-meta">${esc(u.course+' · '+courses[u.course].name+' · '+courses[u.course].term+' · '+u.level)}</div></label></div><p class="unit-summary">${esc(u.summary)}</p><p class="unit-goal"><strong>完成标志</strong>　${esc(u.goal)}</p>${resourceLinks(u)}</section><p class="resource-note"><a href="${post}#unit-${u.id.toLowerCase()}" target="_top">查看博文表 2 中的这一单元</a></p>`;
    if(!$('details').open)$('details').showModal();
    $('details').scrollTop=0;
  }
  $('stats').innerHTML=[[data.counts.courses,'学期入口'],[data.counts.units,'推荐单元'],[data.counts.stages,'学习阶段'],[data.counts.archive,'历年资源组']].map(([n,t])=>`<div class="stat"><strong>${n}</strong><span>${t}</span></div>`).join('');
  for(const c of data.courses){const option=document.createElement('option');option.value=c.id;option.textContent=`${c.id} · ${c.name} ${c.term}`;$('course').append(option);}
  document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
    if(b.dataset.view){view=b.dataset.view;page=0;const p=new URL(location.href);if(view==='archive')p.searchParams.set('view','archive');else p.searchParams.delete('view');history.replaceState(null,'',p);render();}
    if(b.dataset.unit)detail(b.dataset.unit);
    if(b.dataset.page){page=Number(b.dataset.page);render();$('content').scrollIntoView({block:'start'});}
  });
  document.addEventListener('change',event=>{if(event.target.dataset.complete){const id=event.target.dataset.complete;if(event.target.checked)done[id]=true;else delete done[id];save();render();}});
  for(const id of ['search','route','course'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render();});
  $('closeDetail').addEventListener('click',()=>$('details').close());
  $('details').addEventListener('click',event=>{if(event.target===$('details')){const rect=$('details').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('details').close();}});
  $('exportProgress').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),completed:Object.keys(done)},null,2)],{type:'application/json'}),a=document.createElement('a'),objectUrl=URL.createObjectURL(blob);a.href=objectUrl;a.download='lee-ai-learning-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);$('recordNotice').textContent='学习记录已导出，请保存下载的 JSON 文件。';});
  $('importProgress').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;
    try{if(file.size>1024*1024)throw new Error('size');const p=JSON.parse(await file.text());if(p.version!==1||!Array.isArray(p.completed)||!p.completed.every(x=>typeof x==='string'))throw new Error('format');const valid=p.completed.filter(id=>units[id]);for(const id of valid)done[id]=true;save();render();if(currentUnit&&$('details').open)detail(currentUnit);$('recordNotice').textContent=`已合并 ${valid.length} 个有效完成单元，原有记录已保留。`;}
    catch{$('recordNotice').textContent='无法导入：请选择本地图导出的有效 JSON 记录文件（小于 1 MB）。';}event.target.value='';
  });
  render();
})();
