window.MindAcademyUI=function(ctx){
  'use strict';
  const {node,btn,note,title,go,render,save,toast,start,questions,getState,daily,openModal}=ctx,A=window.MindAcademy,E=window.MindEngine,J=window.MindJourney;
  const BASE='./assets/academy/';
  let building=null,floor='practice',exam='',immersive=false,travel=0,position='plaza';
  const places=['plaza','pharmaceutics','pharmacology','herbal','battle','life'];
  const greetings={pharmaceutics:'劑型是起點，理解是藥物的下一站。',pharmacology:'先找到受體，再循著訊號往前走。',herbal:'一片葉子的紋理，也藏著值得觀察的線索。',battle:'準備好了嗎？這裡最強的招式，是把原因說清楚。',life:'休息一下，把下一次出發需要的東西備齊。'};
  function art(item,cls='',decorative=false){return node('img',{class:cls,src:BASE+item.image,alt:decorative?'':item.name,decoding:'async',draggable:'false'});}
  function portrait(raw,variant='normal'){
    const look=A.restore(raw),person=A.character(look.character),pet=A.pet(look.pet);
    return node('div',{class:'academy-portrait portrait-'+variant,'aria-label':person.name+(pet?'，夥伴'+pet.name:''),role:'img'},art(person,'portrait-person',true),pet?node('span',{class:'portrait-pet-wrap'+(J.growth(getState()).stage?' pet-evolved evo-'+J.growth(getState()).stage:'')},art(pet,'portrait-pet',true)):null);
  }
  function mode(){document.body.classList.toggle('academy-immersive',immersive);render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('.scene-actions .button')?.focus({preventScroll:true});requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));}
  function leave(){travel++;document.body.classList.remove('academy-immersive');}
  function back(){travel++;building=null;render();document.querySelector('.campus-map')?.focus({preventScroll:true});}
  function walk(id){
    if(!places.includes(id))return;
    travel++;position=id;
    const map=document.querySelector('.campus-map');if(!map)return;
    map.className='campus-map at-'+id;
    map.querySelectorAll('.campus-pin').forEach(p=>p.setAttribute('aria-pressed',String(p.dataset.place===id)));
    const place=A.BUILDINGS.find(b=>b.id===id);
    const status=map.querySelector('.campus-location-text');status.textContent=place?'前往 '+place.name+' · 再點一次或按 Enter 進入':'中央庭院 · 點選樓館開始探索';
  }
  function chooseBuilding(id){
    const map=document.querySelector('.campus-map');
    if(!map){enter(id);return;}
    walk(id);const ticket=travel;
    const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:650;
    setTimeout(()=>{if(ticket===travel&&map.isConnected)enter(id);},delay);
  }
  function enter(id){if(!A.BUILDINGS.some(b=>b.id===id))return;travel++;building=id;position=id;floor=A.floors(id)[0].id;exam='';render();document.getElementById('building-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function mapKeys(e){
    if(e.target!==e.currentTarget)return;
    if(e.key==='Enter'&&position!=='plaza'){e.preventDefault();enter(position);return;}
    const step=['ArrowRight','ArrowDown'].includes(e.key)?1:['ArrowLeft','ArrowUp'].includes(e.key)?-1:0;
    if(step){e.preventDefault();walk(places[(places.indexOf(position)+step+places.length)%places.length]);}
  }
  function groundWalk(e){
    if(e.target.closest('button'))return;
    const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    const pts={plaza:[.5,.7],pharmaceutics:[.29,.48],pharmacology:[.51,.43],herbal:[.74,.53],battle:[.76,.86],life:[.31,.81]};
    walk(Object.keys(pts).sort((a,b)=>Math.hypot(x-pts[a][0],y-pts[a][1])-Math.hypot(x-pts[b][0],y-pts[b][1]))[0]);e.currentTarget.focus({preventScroll:true});
  }
  function toolbar(){return node('div',{class:'academy-toolbar'},node('div',{},node('span',{class:'weather-dot','aria-hidden':'true'},'☀'),node('span',{},'晴日學院'),node('small',{},'把世界放慢一點，讓好奇心走遠一點。')),node('div',{class:'scene-actions'},btn(immersive?'收起沉浸視野':'展開沉浸視野',()=>{immersive=!immersive;mode();},'secondary small'),building?btn('← 回到校園',back,'secondary small'):btn('人物與夥伴',()=>go('wardrobe'),'secondary small')));}
  function home(){
    document.body.classList.toggle('academy-immersive',immersive);
    title('藥學學院','A LITTLE CURIOSITY, A WHOLE NEW WORLD');
    const s=getState(),person=A.character(s.appearance.character),pet=A.pet(s.appearance.pet),current=A.BUILDINGS.find(b=>b.id===building);
    if(current)return [toolbar(),buildingPanel(current)];
    const map=node('section',{class:'campus-map at-'+position,tabindex:'0','aria-label':'互動校園：點選樓館進入；方向鍵切換目的地，Enter 進入',onKeydown:mapKeys,onClick:groundWalk},
      node('img',{class:'campus-backdrop',src:BASE+'campus-taiwan.webp',alt:'晴日中的藥學學院，紅磚拱廊、素白研究館、玻璃溫室、臺灣杉、黑板樹、櫻花與木棉，圍繞著清澈水池與石板步道。',fetchpriority:'high',width:1536,height:1024,draggable:'false'}),
      node('div',{class:'campus-atmosphere','aria-hidden':'true'},node('i',{class:'sun-dust dust-one'}),node('i',{class:'sun-dust dust-two'}),node('i',{class:'sun-dust dust-three'})),
      node('div',{class:'campus-heading'},node('p',{class:'eyebrow'},'WELCOME TO YOUR ACADEMY'),node('h2',{},'今天，從哪一份好奇開始？'),node('p',{},'點選樓館，跟著夥伴走進下一堂冒險。')),
      node('div',{class:'campus-pins'},A.BUILDINGS.map(b=>node('button',{class:'campus-pin pin-'+b.id,type:'button','data-place':b.id,'aria-label':'前往'+b.name,'aria-pressed':String(position===b.id),onClick:()=>chooseBuilding(b.id)},node('span',{class:'pin-number'},b.number),node('span',{},b.name),node('span',{class:'pin-arrow','aria-hidden':'true'},'↗')))),
      node('div',{class:'campus-traveler','aria-hidden':'true'},node('span',{class:'traveler-shadow'}),portrait(s.appearance,'map')),
      node('div',{class:'campus-location',role:'status'},node('span',{class:'location-dot'}),node('span',{class:'campus-location-text'},position==='plaza'?'中央庭院 · 歡迎回到學院':'今天的探索，從這裡出發。'),node('span',{class:'location-sub'},'點選步道散步 · 點選樓館進入')));
    const identity=node('section',{class:'academy-pass'},portrait(s.appearance,'pass'),node('div',{class:'academy-pass-copy'},node('p',{class:'eyebrow'},'YOUR COMPANION, YOUR PACE'),node('h3',{},s.profile.name||person.name),node('p',{},pet?pet.name+' 正在等你一起出發。':'今天，跟著自己的步調出發。'),node('span',{class:'cosmetic-note'},'以理解結伴，讓好奇心一起成長')),btn('領取今日補給',daily,'gold small'),btn(s.session&&s.session.index<s.session.ids.length?'繼續上次答題 →':'自由修練 →',()=>go(s.session&&s.session.index<s.session.ids.length?'quiz':'practice'),'small'));
    return [toolbar(),map,node('p',{class:'botanical-note'},'校園植栽｜臺灣杉 · 黑板樹 · 櫻花 · 木棉　／　藥草花圃｜薄荷 · 紫蘇 · 艾草 · 菊花'),identity,mission(),directory(),node('div',{class:'academy-footnote'},node('span',{},'✦ 為這座學院創作的場景與夥伴'),node('span',{},'單人可離線 · 無需 ChatGPT 訂閱'))];
  }
  function directory(){return node('section',{class:'campus-directory'},node('div',{class:'section-title'},node('h2',{},'學院導覽'),node('p',{},'5 座樓館，5 種探索方式')),node('div',{class:'building-directory'},A.BUILDINGS.map(b=>node('button',{class:'directory-card '+b.color,onClick:()=>enter(b.id),type:'button'},node('span',{class:'directory-number'},b.number),node('strong',{},b.name),node('small',{},b.subtitle),node('span',{class:'school-inspiration'},b.school+'校園風格'),node('span',{class:'directory-arrow','aria-hidden':'true'},'↗')))));}
  function buildingPanel(b){
    const fs=A.floors(b.id),isStudy=!!E.SUBJECTS[b.id],f=fs.find(x=>x.id===floor)||fs[0],s=getState();
    const floorTabs=node('div',{class:'floor-tabs',role:'group','aria-label':b.name+'樓層'},fs.map(x=>node('button',{type:'button',class:'floor-tab'+(x.id===f.id?' selected':''),'aria-pressed':String(x.id===f.id),onClick:()=>{floor=x.id;render();document.querySelector('.floor-tab.selected')?.focus({preventScroll:true});}},node('strong',{},x.level),node('span',{},x.name),node('span',{class:'floor-door-icon','aria-hidden':'true'},x.id===f.id?'●':'↗'))));
    const detail=node('div',{class:'floor-room'},node('p',{class:'eyebrow'},b.name+' / '+f.level),node('h3',{},f.name),note(f.description));
    if(isStudy){
      const exams=[...new Set(questions.filter(q=>q.subject===b.id).map(q=>q.exam))].sort().reverse();
      if(!exams.includes(exam))exam=exams[0];
      if(f.id==='exam'){
        const select=node('select',{id:'academy-exam',onChange:e=>{exam=e.target.value;render();document.getElementById('academy-exam')?.focus({preventScroll:true});}},exams.map(x=>node('option',{value:x},x+' 國考')));select.value=exam;
        detail.append(node('div',{class:'academy-exam-picker'},node('label',{for:'academy-exam'},'試題年份與梯次'),select));
      }
      const pool=A.pool(questions,b.id,f.id,exam);
      detail.append(node('div',{class:'room-meta'},node('span',{},pool.length.toLocaleString()+' 題可練習'),node('span',{},'每次最多 5 題'),node('span',{},'閱讀 → 理解 → 挑戰')),btn(pool.length?'走進'+f.name+' →':'此樓層暫無符合題目',()=>start(pool,b.name+' · '+f.level+' '+f.name+(f.id==='exam'?' · '+exam:'')),'',!pool.length));
      if(f.id==='calculation')detail.append(note('包含計算相關觀念與推理題；分類依原題庫關鍵字整理。'));
      detail.append(btn('查看錯題修練',()=>go('review'),'secondary small'));
    }else detail.append(btn('走進'+f.name+' →',()=>go(f.id),f.id==='duel'?'gold':''));
    const scene=node('div',{class:'interior-scene floor-'+f.level},node('img',{class:'interior-backdrop',src:BASE+b.hall,alt:b.school+'校園風格啟發的原創'+b.name+'室內場景',width:1536,height:1024}),node('div',{class:'interior-sign'},node('span',{},'BUILDING '+b.number),node('h2',{id:'building-title',tabindex:'-1'},b.name),node('p',{},b.subtitle),node('span',{class:'school-inspiration'},b.school+'校園風格 · 原創空間')),node('div',{class:'interior-guide'},node('div',{class:'guide-bubble'},greetings[b.id]),portrait(s.appearance,'interior')),node('div',{class:'interior-floor-badge','aria-live':'polite'},node('strong',{},f.level),node('span',{},f.name)));
    return node('section',{class:'building-panel interior-panel '+b.color,'aria-labelledby':'building-title'},scene,node('div',{class:'floor-layout'},floorTabs,detail));
  }
  function choose(kind,id){if(A.choose(getState(),kind,id)){save();render();toast(kind==='character'?'已換上 '+A.character(id).name+' 的外觀。':id?'現在由 '+A.pet(id).name+' 陪你出發。':'夥伴先在工坊休息。');}}
  function lore(p){openModal(art(p,'pet-lore-art'),node('p',{class:'eyebrow'},'LITTLE VESSEL, LITTLE LESSON'),node('h2',{},p.name),node('p',{},p.line),node('div',{class:'memory'},node('strong',{},'認識器皿｜'),p.fact),note('夥伴只作外觀陪伴，不增加攻擊、經驗、金幣或抽獎機率。'));}
  function mission(){
    const s=getState(),g=J.growth(s),p=A.pet(s.appearance.pet);
    if(!s.companion.unlocked)return node('section',{class:'pet-mission'},node('p',{class:'eyebrow'},'FIRST FRIEND · 新手任務'),node('h3',{},'和第一位器皿夥伴相遇'),note('讓知識成為你們相遇的理由。完成兩項任務後，選一位喜歡的夥伴。'),node('div',{class:'mission-checks'},node('span',{class:s.claimed?'done':''},(s.claimed?'✓':'○')+' 閱讀並領取一次每日補給'),node('span',{class:s.mastered.length>=5?'done':''},(s.mastered.length>=5?'✓':'○')+' 答對不同題目 '+Math.min(5,s.mastered.length)+' / 5')),btn(J.ready(s)?'任務完成，選擇夥伴 →':'前往新手修練 →',()=>go(J.ready(s)?'wardrobe':'practice'),'gold'));
    return node('section',{class:'pet-mission'},node('div',{class:'pet-growth'},p?node('div',{class:'pet-art'+(g.stage?' pet-evolved evo-'+g.stage:'')},art(p)):null,node('div',{},node('span',{class:'pet-stage'},g.mark+' '+g.name),node('h3',{},(p?p.name:'器皿夥伴')+' · Lv. '+g.level),note('累積成長 '+g.xp+' 點'+(g.next?' · 距離'+g.next.name+'還有 '+(g.next.at-g.xp)+' 點':' · 已達最終進化，等級仍會成長')),node('progress',{max:10,value:g.xp%10,'aria-label':'夥伴升級進度'}))),node('div',{class:'evolution-path'},J.STAGES.map((x,i)=>node('span',{class:i<=g.stage?'achieved':''},x.mark+' '+x.name+' · '+x.at+' 點'))),note('領養後，每天每題第一次答對 +1 成長點；10 點升 1 級，20／60 點進化。各種練習、打怪與雙人對戰都算；休息不扣點，夥伴在工坊也能成長。'));
  }
  function adopt(id){
    if(J.unlock(getState(),id,A.PETS.map(p=>p.id))){save();render();toast('相遇了！'+A.pet(id).name+' 成為你的第一位夥伴。');}
    else toast('先完成每日補給與 5 道不同題目，就能領養夥伴。');
  }
  function wardrobe(){
    title('人物與器皿夥伴','THE ACADEMY WARDROBE');
    const s=getState(),look=s.appearance,person=A.character(look.character),pet=A.pet(look.pet),g=J.growth(s);
    const preview=node('section',{class:'wardrobe-hero'},node('div',{class:'wardrobe-stage'},node('div',{class:'wardrobe-orbit','aria-hidden':'true'}),portrait(look,'showcase'),node('span',{class:'wardrobe-stage-label'},'YOUR ORIGINAL ACADEMY LOOK')),node('div',{class:'wardrobe-copy'},node('p',{class:'eyebrow'},'CHOOSE YOUR OWN WAY TO EXPLORE'),node('h2',{},person.name),node('blockquote',{},person.line),note(person.story),node('div',{class:'wardrobe-tags'},node('span',{},person.role+'外觀'),node('span',{},pet?pet.name:'不攜帶夥伴'),node('span',{},'自由選用')),node('p',{class:'cosmetic-promise'},'博士、教授、研究生、研究員都是外觀選擇，沒有稀有度或階級。換造型不會改變等級、裝備與戰鬥能力。'),btn('回到藥學學院 →',()=>go('home'),'gold')));
    const people=node('div',{class:'character-gallery'},A.CHARACTERS.map(c=>node('article',{class:'character-card '+c.color+(look.character===c.id?' chosen':'')},node('div',{class:'character-art'},art(c)),node('div',{class:'character-copy'},node('p',{class:'eyebrow'},c.role+' / ORIGINAL CHARACTER'),node('h3',{},c.name),note(c.line),btn(look.character===c.id?'目前使用':'選用'+c.role+'外觀',()=>choose('character',c.id),look.character===c.id?'secondary full':'full',look.character===c.id)))));
    const pets=node('div',{class:'pet-gallery'},A.PETS.map(p=>node('article',{class:'pet-card'+(look.pet===p.id?' chosen':'')+(!s.companion.unlocked?' locked':'')},node('div',{class:'pet-art'+(s.companion.unlocked&&g.stage?' pet-evolved evo-'+g.stage:'')},art(p)),node('div',{class:'pet-copy'},node('p',{class:'eyebrow'},p.vessel+' / LAB COMPANION'),node('h3',{},p.name),note(p.line),btn(!s.companion.unlocked?(J.ready(s)?'領養'+p.name:'完成新手任務解鎖'):look.pet===p.id?'正在陪伴你':'邀請'+p.name,()=>s.companion.unlocked?choose('pet',p.id):adopt(p.id),look.pet===p.id?'secondary full':'full',look.pet===p.id||(!s.companion.unlocked&&!J.ready(s))),btn('認識這個器皿',()=>lore(p),'quiet-link')))));
    return [preview,btn('修改學院暱稱',()=>go('account'),'secondary small'),node('div',{class:'section-title'},node('h2',{},'選一位，代表今天的你'),node('p',{},'4 種原創人物 · 全部開放')),people,mission(),node('div',{class:'section-title'},node('h2',{},'實驗室裡的小小夥伴'),node('p',{},'4 種原創器皿 · 完成新手任務後自由換用 · 共用成長')),pets,node('div',{class:'wardrobe-footer'},note('人物和夥伴會出現在學院、個人資料與對戰畫面。選擇會自動存檔，也會包含在匯出的遊戲備份裡。'),btn(look.pet===null?'目前不攜帶夥伴':'讓夥伴在工坊休息',()=>choose('pet',null),'secondary small',look.pet===null))];
  }
  return {home,wardrobe,portrait,leave};
};
