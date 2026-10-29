window.MindAcademyUI=function(ctx){
  'use strict';
  const {node,btn,note,title,go,render,save,toast,start,questions,getState,daily,openModal,closeModal,adventure}=ctx,A=window.MindAcademy,E=window.MindEngine,J=window.MindJourney,W=window.MindWalk,R=window.MindAdventure;
  const BASE='./assets/academy/',sceneArt=window.MindSceneUI({node});
  let building=null,district=null,queuedDistrict=null,districtPosition=null,floor='practice',exam='',immersive=true,walking=null,pendingWalk=null,worldZoom=1.6;
  const lobby=window.MindLobbyUI({node,btn,note,openModal,closeModal,getState,save,toast});
  let campusPosition=W.nearest(W.campus,{x:W.campus.spawn.x+(Math.random()-.5)*220,y:W.campus.spawn.y+(Math.random()-.5)*100}),hallPosition={...W.hall('').spawn};
  function stopWalking(){if(walking){walking.destroy();walking=null;}}
  function mount(){stopWalking();if(pendingWalk?.root.isConnected){lobby.bind(pendingWalk.root,pendingWalk.sceneId,pendingWalk.initial);walking=window.MindWalkUI(pendingWalk);if(!district&&!building&&queuedDistrict){const id=queuedDistrict;queuedDistrict=null;walking.toward(W.campus.portals.find(p=>p.id===id));}}}
  function controls(){return node('div',{class:'walk-console'},node('div',{class:'walk-instructions'},node('strong',{},'讓好奇心，帶你往前走'),node('p',{},'方向鍵 / WASD 移動 · Shift 加速 · 空白鍵跳躍。手機使用方向鍵與互動按鈕。'),node('div',{class:'walk-status',role:'status','aria-live':'polite'},'準備出發'),btn('靠近入口即可進入',()=>{},'walk-enter secondary small',true)),node('div',{class:'walk-pad',role:'group','aria-label':'角色移動方向'},[['up','ArrowUp','↑','向上移動'],['left','ArrowLeft','←','向左移動'],['down','ArrowDown','↓','向下移動'],['right','ArrowRight','→','向右移動']].map(([cls,direction,mark,label])=>node('button',{type:'button',class:'walk-direction walk-'+cls,'data-direction':direction,'aria-label':label},mark))),node('div',{class:'walk-extra'},btn('跳躍 ␣',()=>{},'walk-jump')));}
  function actor(){const s=getState();return window.MindAvatar({node,appearance:s.appearance,name:s.profile.name,loadout:s.rpg.loadout});}
  function portals(scene){return scene.portals.map(p=>{const button=node('button',{type:'button',class:'walk-portal','data-walk-portal':p.id,'aria-label':'走向'+p.name+'入口'},p.name+' ↗');button.style.left=p.x/10+'%';button.style.top=p.y/W.HEIGHT*100+'%';return button;});}
  function walkingScene(scene,world,initial,onPosition,onPortal){
    world.style.setProperty('--world-zoom',worldZoom);
    const root=node('div',{class:'walk-section'},node('div',{class:'world-viewport'},world),hud(),controls());
    pendingWalk={root,scene,initial,onPosition,onPortal,sceneId:building?'hall:'+building+':'+floor:district?'district:'+district:'campus',onMotion:lobby.move};return root;
  }
  function scenery(scene){
    const trees=[['cedar',25,20,8],['blackboard',99,36,12],['cherry',1,35,13],['kapok',91,18,9]];
    return [sceneArt.water(scene),...trees.map(([kind,x,y,size])=>{const t=node('span',{class:'living-tree tree-'+kind,'aria-hidden':'true'},node('span',{class:'tree-crown'}));t.style.left=x+'%';t.style.top=y+'%';t.style.width=size+'%';t.style.zIndex='15';return t;})];
  }
  function zoom(delta){worldZoom=Math.max(1,Math.min(2.2,Math.round((worldZoom+delta)*10)/10));pendingWalk?.root.querySelector('.walk-world')?.style.setProperty('--world-zoom',worldZoom);walking?.reframe();}
  function menu(){openModal(node('p',{class:'eyebrow'},'YOUR ACADEMY'),node('h2',{},'下一站，想去哪裡？'),node('div',{class:'world-menu'},[['bag','隨身背包'],['quests','主線任務'],['shop','金幣商城'],['wardrobe','人物與夥伴'],['practice','自由修練'],['arena','怪物試煉'],['duel','雙人對戰'],['draw','星願寶箱'],['account','帳號與雲端存檔'],['settings','備份與說明']].map(([page,label])=>btn(label,()=>{closeModal();go(page);},'secondary'))),btn('領取每日補給',daily,'gold'),btn(immersive?'切回網頁版導覽':'使用滿版遊戲視角',()=>{closeModal();immersive=!immersive;mode();},'secondary'),document.documentElement.requestFullscreen?btn(document.fullscreenElement?'離開全螢幕':'隱藏瀏覽器工具列',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();closeModal();}catch(_){toast('可繼續使用目前的滿版遊戲視角。');}},'secondary'):null);}
  function examPicker(){if(!E.SUBJECTS[building]||floor!=='exam')return null;const years=[...new Set(questions.filter(q=>q.subject===building).map(q=>q.exam))].sort().reverse(),select=node('select',{id:'world-exam',onChange:e=>{exam=e.target.value;render();}},years.map(y=>node('option',{value:y},y+' 國考')));select.value=exam;return node('div',{class:'academy-exam-picker'},node('label',{for:'world-exam'},'試題年份與梯次'),select);}
  function stairMenu(){const fs=A.floors(building),i=fs.findIndex(f=>f.id===floor);openModal(node('h2',{},'樓梯平台 · '+fs[i].level),note('沿著階梯到達平台。選擇相鄰樓層繼續探索。'),node('div',{class:'world-menu'},[i-1,i+1].filter(n=>n>=0&&n<fs.length).map(n=>btn((n>i?'往上 ':'往下 ')+fs[n].level+' '+fs[n].name,()=>{closeModal();floor=fs[n].id;const scene=W.hall('',building),p=scene.portals.find(p=>p.id==='stairs');hallPosition=W.nearest(scene,{x:p.x,y:p.y+34});render();document.querySelector('.walk-world')?.focus({preventScroll:true});},'secondary'))));}
  function mapMenu(){openModal(node('h2',{},building?'樓館樓層':'學院地圖'),building?node('div',{class:'world-menu'},A.floors(building).map(f=>btn(f.level+' '+f.name,()=>{closeModal();walking?.toward(W.hall('',building).portals.find(p=>p.id==='stairs'));},f.id===floor?'':'secondary'))):node('div',{},node('img',{class:'world-map-preview',src:BASE+'campus-taiwan.webp',alt:'五座樓館環繞中央噴泉的學院地圖'}),node('div',{class:'world-menu'},A.BUILDINGS.map(b=>btn('走向'+b.name,()=>{closeModal();travel(b.id);},'secondary')))),examPicker(),building?btn('走向校園出口',()=>{closeModal();walking?.toward(W.hall('',building).portals.find(p=>p.id==='exit'));},'secondary'):null,note('方向鍵 / WASD 跑動，Shift 加速；也可以點擊地面。手機長按方向鍵即可。走近標記入口，便會進入下一個場景。'));}
  function hud(){const s=getState(),current=A.BUILDINGS.find(b=>b.id===(building||district));return node('div',{class:'world-hud'},node('div',{class:'world-top'},node('button',{type:'button',class:'world-identity',onClick:()=>go('account')},art(A.character(s.appearance.character),'world-face',true),node('span',{},node('strong',{},s.profile.name),node('small',{},'Lv. '+(Math.floor(s.xp/100)+1)+' · ◉ '+s.arena.coins+' 金幣'))),node('div',{class:'world-place'},node('span',{class:'weather-dot'},'☀'),node('strong',{},current?current.name:'晴日藥學學院'),node('small',{},building?A.floors(building).find(f=>f.id===floor)?.name:district?'前庭與步道':'沿著步道，讀懂世界')),node('div',{class:'world-top-actions'},lobby.button(),btn('☰ 選單',menu,'secondary small'))),adventure().questMini(),node('button',{type:'button',class:'world-minimap',onClick:mapMenu,'aria-label':building?'選擇樓層':'打開學院地圖'},node('img',{src:BASE+(building?current.hall:'campus-taiwan.webp'),alt:'',draggable:'false'}),node('span',{class:'mini-self'}),node('strong',{},building?'選擇樓層 ↗':'學院地圖 ↗')),node('div',{class:'world-zoom'},node('button',{type:'button','aria-label':'拉遠場景',onClick:()=>zoom(-.2)},'−'),node('button',{type:'button','aria-label':'放大場景',onClick:()=>zoom(.2)},'+')),node('div',{class:'world-hotbar'},btn('▦ 背包 '+R.count(s)+'/'+s.rpg.capacity,()=>go('bag'),'world-shortcut'),btn('▱ 商城',()=>go('shop'),'world-shortcut'),btn('⚔ 試煉',()=>go('arena'),'world-shortcut'),btn('✦ 任務',()=>go('quests'),'world-shortcut'),btn('☏ 社交',()=>lobby.social(),'world-shortcut')),node('div',{class:'world-help'},'WASD 跑動 · 空白鍵跳躍'));
  }
  function art(item,cls='',decorative=false){return node('img',{class:cls,src:BASE+item.image,alt:decorative?'':item.name,decoding:'async',draggable:'false'});}
  function portrait(raw,variant='normal'){
    const look=A.restore(raw),person=A.character(look.character),pet=A.pet(look.pet);
    return node('div',{class:'academy-portrait portrait-'+variant,'aria-label':person.name+(pet?'，夥伴'+pet.name:''),role:'img'},art(person,'portrait-person',true),pet?node('span',{class:'portrait-pet-wrap'+(J.growth(getState()).stage?' pet-evolved evo-'+J.growth(getState()).stage:'')},art(pet,'portrait-pet',true)):null);
  }
  function mode(){document.body.classList.toggle('academy-immersive',immersive);render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('.walk-world')?.focus({preventScroll:true});requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));}
  function leave(disconnect=false){stopWalking();pendingWalk=null;lobby.hide();if(disconnect)lobby.disconnect();document.body.classList.remove('academy-immersive');}
  function focusWorld(){render();document.querySelector('.walk-world')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function back(){stopWalking();if(building){const scene=W.district(building),door=scene.portals.find(p=>p.id==='door');district=building;districtPosition=W.nearest(scene,door.out);building=null;}else{const door=W.campus.portals.find(p=>p.id===district);if(door)campusPosition={...door.out};district=null;districtPosition=null;}focusWorld();}
  function enter(id){if(!A.BUILDINGS.some(b=>b.id===id))return;stopWalking();district=id;building=null;districtPosition={...W.district(id).spawn};focusWorld();}
  function openBuilding(){stopWalking();building=district;floor=A.floors(building)[0].id;exam='';hallPosition={...W.hall('',building).spawn};if(R.visit(getState(),building))save();focusWorld();}
  function travel(id){if(district){if(id===district)walking?.toward(W.district(district).portals.find(p=>p.id==='door'));else{queuedDistrict=id;walking?.toward(W.district(district).portals.find(p=>p.id==='return'));}}else walking?.toward(W.campus.portals.find(p=>p.id===id));}
  function toolbar(){return node('div',{class:'academy-toolbar'},node('div',{},node('span',{class:'weather-dot','aria-hidden':'true'},'☀'),node('span',{},'晴日學院'),node('small',{},'把世界放慢一點，讓好奇心走遠一點。')),node('div',{class:'scene-actions'},btn(immersive?'收起沉浸視野':'展開沉浸視野',()=>{immersive=!immersive;mode();},'secondary small'),btn('共同大廳',lobby.dialog,'secondary small'),(building||district)?btn('← 返回步道',back,'secondary small'):btn('人物與夥伴',()=>go('wardrobe'),'secondary small')));}
  function home(){
    stopWalking();pendingWalk=null;
    document.body.classList.toggle('academy-immersive',immersive);
    title('藥學學院','A LITTLE CURIOSITY, A WHOLE NEW WORLD');
    const s=getState(),person=A.character(s.appearance.character),pet=A.pet(s.appearance.pet),current=A.BUILDINGS.find(b=>b.id===building);
    if(current)return [toolbar(),buildingPanel(current)];
    if(district)return [toolbar(),districtPanel(A.BUILDINGS.find(b=>b.id===district))];
    const scene=W.campus;
    const world=node('section',{class:'campus-map walk-world',tabindex:'0','aria-label':'可自由走動的校園：方向鍵或 WASD 移動，靠近入口進樓'},
      node('img',{class:'campus-backdrop',src:BASE+W.campus.image,alt:'中央金球廣場，橋與階梯分別通往西北藥劑、北方藥理、東北生藥、東南對戰、西南工坊。',fetchpriority:'high',width:1536,height:1024,draggable:'false'}),
      node('div',{class:'campus-heading'},node('p',{class:'eyebrow'},'WALK INTO YOUR ACADEMY'),node('h2',{},'沿著步道，跑進下一段冒險。'),node('p',{},'繞過中央噴泉，五座樓館都能走進去。')),
      scenery(scene),sceneArt.birds('campus'),portals(scene),node('span',{class:'walk-target',hidden:true,'aria-hidden':'true'}),actor());
    const map=walkingScene(scene,world,campusPosition,p=>campusPosition=p,enter);
    const identity=node('section',{class:'academy-pass'},portrait(s.appearance,'pass'),node('div',{class:'academy-pass-copy'},node('p',{class:'eyebrow'},'YOUR COMPANION, YOUR PACE'),node('h3',{},s.profile.name||person.name),node('p',{},pet?pet.name+' 正在等你一起出發。':'今天，跟著自己的步調出發。'),node('span',{class:'cosmetic-note'},'以理解結伴，讓好奇心一起成長')),btn('領取今日補給',daily,'gold small'),btn(s.session&&s.session.index<s.session.ids.length?'繼續上次答題 →':'自由修練 →',()=>go(s.session&&s.session.index<s.session.ids.length?'quiz':'practice'),'small'));
    return [toolbar(),map,node('p',{class:'botanical-note'},'校園植栽｜臺灣杉 · 黑板樹 · 櫻花 · 木棉　／　藥草花圃｜薄荷 · 紫蘇 · 艾草 · 菊花'),identity,mission(),directory(),node('div',{class:'academy-footnote'},node('span',{},'✦ 為這座學院創作的場景與夥伴'),node('span',{},'單人可離線 · 無需 ChatGPT 訂閱'))];
  }
  function directory(){return node('section',{class:'campus-directory'},node('div',{class:'section-title'},node('h2',{},'學院導覽'),node('p',{},'5 座樓館，5 種探索方式')),node('div',{class:'building-directory'},A.BUILDINGS.map(b=>node('button',{class:'directory-card '+b.color,onClick:()=>travel(b.id),type:'button'},node('span',{class:'directory-number'},b.number),node('strong',{},b.name),node('small',{},b.subtitle),node('span',{class:'school-inspiration'},b.school+'校園風格'),node('span',{class:'directory-arrow','aria-hidden':'true'},'↗')))));}
  function districtPanel(b){
    const scene=W.district(b.id),world=node('section',{class:'campus-map district-scene walk-world',tabindex:'0','aria-label':b.name+'前庭：沿小路、橋與階梯走向入口'},node('img',{class:'campus-backdrop',src:BASE+scene.image,alt:b.name+'獨立前庭與連續步道',width:1536,height:1024,draggable:'false'}),scenery(scene),sceneArt.birds('campus'),portals(scene),node('span',{class:'walk-target',hidden:true,'aria-hidden':'true'}),actor());
    return walkingScene(scene,world,districtPosition||scene.spawn,p=>districtPosition=p,id=>id==='return'?back():openBuilding());
  }
  function buildingPanel(b){
    const fs=A.floors(b.id),isStudy=!!E.SUBJECTS[b.id],f=fs.find(x=>x.id===floor)||fs[0],s=getState();let launch=null;
    const floorTabs=node('div',{class:'floor-tabs',role:'group','aria-label':b.name+'樓層'},fs.map(x=>node('button',{type:'button',class:'floor-tab'+(x.id===f.id?' selected':''),'aria-pressed':String(x.id===f.id),onClick:()=>walking?.toward(W.hall('',building).portals.find(p=>p.id==='stairs'))},node('strong',{},x.level),node('span',{},x.name),node('span',{class:'floor-door-icon','aria-hidden':'true'},x.id===f.id?'●':'↗'))));
    const detail=node('div',{class:'floor-room'},node('p',{class:'eyebrow'},b.name+' / '+f.level),node('h3',{},f.name),note(f.description));
    if(isStudy){
      const exams=[...new Set(questions.filter(q=>q.subject===b.id).map(q=>q.exam))].sort().reverse();
      if(!exams.includes(exam))exam=exams[0];
      if(f.id==='exam'){
        const select=node('select',{id:'academy-exam',onChange:e=>{exam=e.target.value;render();document.getElementById('academy-exam')?.focus({preventScroll:true});}},exams.map(x=>node('option',{value:x},x+' 國考')));select.value=exam;
        detail.append(node('div',{class:'academy-exam-picker'},node('label',{for:'academy-exam'},'試題年份與梯次'),select));
      }
      const pool=A.pool(questions,b.id,f.id,exam);
      if(pool.length)launch=()=>start(pool,b.name+' · '+f.level+' '+f.name+(f.id==='exam'?' · '+exam:''));
      detail.append(node('div',{class:'room-meta'},node('span',{},pool.length.toLocaleString()+' 題可練習'),node('span',{},'每次最多 5 題'),node('span',{},'閱讀 → 理解 → 挑戰')),btn(pool.length?'走進'+f.name+' →':'此樓層暫無符合題目',()=>launch?.(),'',!pool.length));
      if(f.id==='calculation')detail.append(note('包含計算相關觀念與推理題；分類依原題庫關鍵字整理。'));
      detail.append(btn('查看錯題修練',()=>go('review'),'secondary small'));
    }else {launch=()=>go(f.id);detail.append(btn('走進'+f.name+' →',launch,f.id==='duel'?'gold':''));}
    const scene=W.hall(f.name,b.id);
    if(!launch)scene.portals=scene.portals.filter(p=>p.id!=='room');
    const world=node('section',{class:'interior-scene interior-walk walk-world',tabindex:'0','aria-label':b.name+'可走動大廳：方向鍵移動，入口通往'+f.name+'或返回校園'},
      node('img',{class:'interior-backdrop',src:BASE+b.hall,alt:b.school+'校園風格啟發的原創'+b.name+'室內場景',width:1536,height:1024,draggable:'false'}),
      node('div',{class:'interior-sign'},node('span',{},'BUILDING '+b.number),node('h2',{id:'building-title'},b.name),node('p',{},b.subtitle)),
      node('div',{class:'interior-floor-badge'},node('strong',{},f.level),node('span',{},f.name)),
      sceneArt.props(scene),sceneArt.birds('hall'),portals(scene),node('span',{class:'walk-target',hidden:true,'aria-hidden':'true'}),actor());
    const walk=walkingScene(scene,world,hallPosition,p=>hallPosition=p,id=>{if(id==='exit')back();else if(id==='stairs')stairMenu();else {hallPosition={x:785,y:535};launch?.();}});
    return node('section',{class:'building-panel interior-panel '+b.color,'aria-labelledby':'building-title'},walk,node('div',{class:'floor-layout'},floorTabs,detail));
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
    const preview=node('section',{class:'wardrobe-hero'},node('div',{class:'wardrobe-stage'},node('div',{class:'wardrobe-orbit','aria-hidden':'true'}),portrait(look,'showcase'),node('span',{class:'wardrobe-stage-label'},'YOUR ORIGINAL ACADEMY LOOK')),node('div',{class:'wardrobe-copy'},node('p',{class:'eyebrow'},'CHOOSE YOUR OWN WAY TO EXPLORE'),node('h2',{},person.name),node('blockquote',{},person.line),note(person.story),node('div',{class:'wardrobe-tags'},node('span',{},person.role+'外觀'),node('span',{},person.traits),node('span',{},pet?pet.name:'不攜帶夥伴'),node('span',{},'自由選用')),node('p',{class:'cosmetic-promise'},'十位學院人物都是外觀選擇，年齡與職稱沒有稀有度或能力階級。換造型不會改變等級、裝備與戰鬥能力。'),btn('回到藥學學院 →',()=>go('home'),'gold')));
    const people=node('div',{class:'character-gallery'},A.CHARACTERS.map(c=>node('article',{class:'character-card '+c.color+(look.character===c.id?' chosen':'')},node('div',{class:'character-art'},art(c)),node('div',{class:'character-copy'},node('p',{class:'eyebrow'},c.role+' / ORIGINAL CHARACTER'),node('h3',{},c.name),node('p',{class:'character-traits'},c.traits),note(c.line),btn(look.character===c.id?'目前使用':'選用'+c.role+'外觀',()=>choose('character',c.id),look.character===c.id?'secondary full':'full',look.character===c.id)))));
    const pets=node('div',{class:'pet-gallery'},A.PETS.map(p=>node('article',{class:'pet-card'+(look.pet===p.id?' chosen':'')+(!s.companion.unlocked?' locked':'')},node('div',{class:'pet-art'+(s.companion.unlocked&&g.stage?' pet-evolved evo-'+g.stage:'')},art(p)),node('div',{class:'pet-copy'},node('p',{class:'eyebrow'},p.vessel+' / LAB COMPANION'),node('h3',{},p.name),note(p.line),btn(!s.companion.unlocked?(J.ready(s)?'領養'+p.name:'完成新手任務解鎖'):look.pet===p.id?'正在陪伴你':'邀請'+p.name,()=>s.companion.unlocked?choose('pet',p.id):adopt(p.id),look.pet===p.id?'secondary full':'full',look.pet===p.id||(!s.companion.unlocked&&!J.ready(s))),btn('認識這個器皿',()=>lore(p),'quiet-link')))));
    return [preview,btn('修改學院暱稱',()=>go('account'),'secondary small'),node('div',{class:'section-title'},node('h2',{},'選一位，代表今天的你'),node('p',{},A.CHARACTERS.length+' 位原創人物 · 青年、中年與長者 · 全部開放')),people,mission(),node('div',{class:'section-title'},node('h2',{},'實驗室裡的小小夥伴'),node('p',{},'4 種原創器皿 · 完成新手任務後自由換用 · 共用成長')),pets,node('div',{class:'wardrobe-footer'},note('人物和夥伴會出現在學院、個人資料與對戰畫面。選擇會自動存檔，也會包含在匯出的遊戲備份裡。'),btn(look.pet===null?'目前不攜帶夥伴':'讓夥伴在工坊休息',()=>choose('pet',null),'secondary small',look.pet===null))];
  }
  return {home,wardrobe,portrait,leave,mount,disconnect:lobby.disconnect};
};
