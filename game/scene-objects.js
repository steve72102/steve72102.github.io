(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindSceneObjects=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Hand-authored against the nine original room illustrations. Coordinates are
  // physical ground coordinates in the existing 1000 x 667 scene, not image boxes.
  // Clean plates keep built-in cabinets/stone benches; only their loose objects
  // and freestanding furniture are drawn from the transparent atlas below.
  const SPRITES=Object.freeze({'wood-chair':0,'lab-stool':1,'modern-chair-blue':2,'modern-chair-sage':3,'wood-table':4,'white-table':5,'modular-table':6,beaker:7,flask:8,cylinder:9,'amber-jar':10,mortar:11,books:12,plant:13,instrument:14,'specimen-tray':15});
  // The generated transparent sheet has unequal row heights. Exact source
  // rectangles keep chair feet and tall vessels inside their own sprite.
  const ATLAS_SIZE=Object.freeze([1254,1254]),rectangles=[[16,0,299,358],[338,0,286,358],[630,0,310,358],[942,0,312,358],[0,360,336,267],[336,360,318,267],[654,360,310,267],[964,360,290,267],[0,628,324,298],[326,628,301,298],[627,628,313,298],[940,628,314,298],[0,926,335,328],[335,926,323,328],[658,926,278,328],[936,926,318,328]];
  const SPRITE_RECTS=Object.freeze(Object.fromEntries(Object.entries(SPRITES).map(([name,index])=>[name,Object.freeze(rectangles[index])])));
  const feet=[.978,.933,.964,.969,.874,.898,.902,.895,.895,.915,.915,.914,.837,.866,.909,.884];
  const SPRITE_ANCHORS=Object.freeze(Object.fromEntries(Object.entries(SPRITES).map(([name,index])=>[name,feet[index]])));
  const MATERIALS=Object.freeze({
    wood:{mass:6,friction:.65,breakable:false,sharp:false},metal:{mass:5,friction:.35,breakable:false,sharp:false},
    stone:{mass:500,friction:.9,breakable:false,sharp:false},glass:{mass:.3,friction:.25,breakable:true,sharp:true},
    ceramic:{mass:1.5,friction:.6,breakable:true,sharp:true},paper:{mass:.7,friction:.7,breakable:false,sharp:false},
    plant:{mass:3,friction:.7,breakable:false,sharp:false}
  });
  const rect=(x,y,w,d)=>[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]];
  const visual=(sprite,x,y,size,flipX=false)=>({sprite,x,y,width:size,height:size,anchorX:.5,anchorY:SPRITE_ANCHORS[sprite],flipX});
  function surface(id,name,x,y,w,d,height,options={}){
    const material=options.material||'wood',movable=options.movable===true;
    return {id,name,x,y,w,d,height,polygon:rect(x,y,w,d),...MATERIALS[material],material,movable,hidden:!movable,...options};
  }
  function chair(id,x,y,sprite='wood-chair',flipX=false,size=65){
    const material=sprite==='wood-chair'?'wood':'metal';
    return surface(id,'原景'+(sprite==='lab-stool'?'實作圓凳':'座椅'),x,y,26,15,22,{jumpAssist:true,material,mass:sprite==='lab-stool'?4:6,movable:true,visual:visual(sprite,x,y+7,size,flipX)});
  }
  function table(id,name,x,y,w,d,height,sprite,size,options={}){
    return surface(id,name,x,y,w,d,height,{jumpAssist:true,mass:24,material:'wood',movable:true,visual:visual(sprite,x,y+d/2,size),...options});
  }
  function prop(id,name,sprite,support,x,y,size,material,options={}){
    return {id,name,kind:sprite,surface:support,x,y,width:Math.max(10,size*.35),...MATERIALS[material],material,movable:true,visual:visual(sprite,x,y,size),...options};
  }
  const fixture=(id,name,material,x,y,description)=>({id,name,material,movable:false,interaction:'inspect',x,y,description});
  function room(key,source,surfaces,props,fixtures=[],extra={}){
    return {key,source:'./assets/academy/'+source,background:'./assets/scene-objects/'+key+'-clean.webp',atlas:'./assets/scene-objects/props.png',surfaces,props,fixtures,...extra};
  }
  const rooms={};

  // NTU-inspired brick hall: furniture follows the illustrated left edge. The
  // central passage is intentionally empty; there is no universal centre table.
  // Foreground wood-table footprints follow the measured atlas tabletop translated
  // by its leg height. Prop ground anchors use that same plane, so glass rests on
  // the drawn top and the visible outer legs are inside the physical footprint.
  rooms['hall-pharmaceutics']=room('hall-pharmaceutics','hall-ntu.webp',[
    table('ntu-foreground-desk','左側木質觀察桌',112,518,236,102,83,'wood-table',280,{arrival:true,polygon:[[5,517.84],[188.5,465.2],[241,505.2],[21,566.87],[5,550.87]],visual:visual('wood-table',106,550,280)}),
    table('ntu-window-desk','拱窗邊研習桌',250,380,145,37,48,'wood-table',190,{polygon:[[180,365],[308,365],[313,398],[180,398]],visual:visual('wood-table',248,410,185)}),
    chair('ntu-stool-front',151,548,'wood-chair',false,71),chair('ntu-stool-window',227,424,'wood-chair',false,56),chair('ntu-stool-side',335,411,'wood-chair',true,57),
    surface('ntu-window-cabinet','窗下固定書櫃',310,350,135,29,50,{material:'wood'}),
    surface('ntu-right-cabinet','右側固定書櫃',920,385,150,28,55,{material:'wood'})
  ],[
    prop('ntu-desk-flask','觀察桌錐形瓶','flask','ntu-foreground-desk',103,516.8,52,'glass'),
    prop('ntu-desk-beaker','觀察桌燒杯','beaker','ntu-foreground-desk',145,504.9,43,'glass'),
    prop('ntu-desk-cylinder','觀察桌量筒','cylinder','ntu-foreground-desk',78,523.9,44,'glass'),
    prop('ntu-desk-books','觀察桌筆記','books','ntu-foreground-desk',33,536.7,48,'paper'),
    prop('ntu-window-flask','窗邊玻璃瓶','flask','ntu-window-desk',237,380,36,'glass'),
    prop('ntu-window-jar','窗邊標本瓶','amber-jar','ntu-window-desk',282,380,33,'glass')
  ],[fixture('ntu-bookcase','左牆藏書與植物展示','wood',55,270,'書櫃、牆面與固定層架保留原景；遠處書脊屬展示細節。')],{extraAreas:[[[5,620],[205,620],[205,405],[175,405],[175,450],[5,450]],[[165,450],[365,450],[365,350],[165,350]]]});

  // The actual cabinet/bench remain fixed architecture. Shelf elevations retain
  // the established jump reach, but the former twelve prefab vessels are gone.
  const labShelf=[[90,0],[170,1],[237,2],[309,3]].map(([height,index])=>surface('lab-shelf-'+index,'左側固定展示架 '+(index+1),57.5,469,105,26,height,{material:'wood',oneWay:index>0}));
  rooms['hall-pharmacology']=room('hall-pharmacology','hall-nthu-interactive.webp',[
    ...labShelf,surface('window-bench','窗邊固定長椅',256,447,183,27,55,{jumpAssist:true,material:'stone',arrival:true,polygon:[[164,439],[345,432],[346,450],[174,459]]}),
    surface('pharma-right-cabinet','右側固定展示櫃',971,391,48,28,75,{material:'wood'})
  ],[
    prop('pharma-shelf-plant-low','低層架陶盆','plant','lab-shelf-0',30,469,47,'ceramic',{mass:3}),
    prop('pharma-shelf-plant-mid','中層架陶盆','plant','lab-shelf-2',55,469,44,'ceramic',{mass:2.5}),
    prop('pharma-shelf-plant-high','上層架陶盆','plant','lab-shelf-3',78,469,43,'ceramic',{mass:2.5}),
    prop('pharma-window-pot','窗邊獨立白色陶盆','plant',null,142,460,103,'ceramic',{mass:6})
  ],[fixture('pharma-window-planters','建築花槽與階梯旁固定景觀','stone',535,389,'建築花槽及根植景觀固定；架上與窗邊的獨立陶盆可碰觸。'),fixture('pharma-distant-display','遠處藥瓶展示櫃','wood',838,298,'遠景微小瓶罐合併為固定展示，不建立不可辨認的獨立碰撞點。')],{extraAreas:[[[5,482],[119,482],[146,500],[146,535],[5,535]],[[174,459],[346,450],[346,485],[174,490]],[[125,505],[175,505],[175,435],[125,435]]]});

  rooms['hall-herbal']=room('hall-herbal','hall-ncku.webp',[
    table('herbal-front-desk','廊邊木質標本桌',94,538,186,89,77,'wood-table',260,{arrival:true,polygon:[[5,532.66],[142.61,493.19],[191.36,530.33],[5,582.56]],visual:visual('wood-table',66,572,260)}),
    table('herbal-mid-desk','廊邊研缽木桌',120,442,145,57,46,'wood-table',155,{polygon:[[47.88,447.33],[163.67,414.11],[192.73,436.25],[70.95,470.39]],visual:visual('wood-table',118,461,155)}),
    chair('herbal-front-chair',146,579,'wood-chair',false,76),chair('herbal-mid-chair',210,489,'wood-chair',true,56),
    surface('herbal-rear-cabinet','廊邊固定標本櫃',105,366,100,35,75,{material:'wood'})
  ],[
    prop('herbal-front-mortar','木桌上的石質研缽','mortar','herbal-front-desk',57,542.9,63,'stone',{mass:5}),
    prop('herbal-front-flask','木桌玻璃燒瓶','flask','herbal-front-desk',83,535.5,47,'glass'),
    prop('herbal-front-jar','木桌藥材玻璃罐','amber-jar','herbal-front-desk',21,553.1,42,'glass'),
    prop('herbal-mid-jar','廊邊標本罐','amber-jar','herbal-mid-desk',118,442.2,35,'glass'),
    prop('herbal-mid-tray','廊邊木製採樣盤','specimen-tray','herbal-mid-desk',145,434.5,40,'wood')
  ],[fixture('herbal-fixed-cases','木質藥材櫥櫃','wood',35,286,'連牆櫃體、固定層架與遠景瓶罐保留於背景。'),fixture('herbal-garden','庭院樹木與石造花台','stone',775,360,'庭院建築與根植樹木不會被角色推走。')],{extraAreas:[[[5,655],[185,655],[185,440],[165,422],[125,420],[125,440],[5,450]],[[70,460],[185,460],[185,380],[70,380]],[[40,470],[85,470],[85,435],[40,445]]]});

  rooms['hall-battle']=room('hall-battle','hall-battle.webp',[
    surface('battle-left-bench','入口石造長椅',66,421,125,28,40,{jumpAssist:true,material:'stone',arrival:true,polygon:[[5,407],[107,407],[125,427],[5,442]]}),
    surface('battle-display-counter','右側分子展示櫃',959,393,70,35,35,{material:'wood'})
  ],[
    prop('battle-display-plant','展示櫃陶製花盆','plant','battle-display-counter',965,392,40,'ceramic',{mass:3}),
    prop('battle-display-vessel','展示櫃玻璃瓶','flask','battle-display-counter',935,397,32,'glass')
  ],[fixture('battle-orbit-installation','懸掛星軌裝置','metal',500,118,'懸掛結構固定於建築，不是可推動的地面家具。'),fixture('battle-molecule-model','固定分子展示模型','metal',967,294,'固定於展示櫃的分子裝置保留原景。'),fixture('battle-built-planters','入口及樓梯建築花槽','stone',871,421,'石造花槽與玻璃欄杆維持固定碰撞邊界。')],{extraAreas:[[[920,410],[995,410],[995,435],[920,435]]]});

  rooms['hall-life']=room('hall-life','hall-life.webp',[
    surface('life-left-counter','左側木質工作櫃',66,410,120,35,82,{material:'wood',arrival:true}),
    surface('life-right-counter','右側木質工作櫃',940,416,105,40,78,{material:'wood'}),
    surface('life-back-workbench','後方固定工坊桌',354,348,110,31,52,{jumpAssist:true,material:'wood'}),
    chair('life-work-stool',385,379,'wood-chair',false,45)
  ],[
    prop('life-left-flask','工作櫃玻璃瓶','flask','life-left-counter',38,409,44,'glass'),
    prop('life-left-beaker','工作櫃燒杯','beaker','life-left-counter',78,411,37,'glass'),
    prop('life-right-jar','工坊玻璃收納罐','amber-jar','life-right-counter',917,416,35,'glass'),
    prop('life-right-books','工坊裝訂筆記','books','life-right-counter',963,414,44,'paper'),
    prop('life-back-mortar','工坊陶製研缽','mortar','life-back-workbench',349,348,33,'ceramic')
  ],[fixture('life-looms','靠牆織具與固定收納櫃','wood',973,267,'織具、連牆櫃體與摺疊布匹為背景固定工作設施。')]);

  // Teaching benches retain their original fixed stone/wood carcasses. Chairs
  // and individual instruments are independent layers anchored to the same art.
  const labLeft=surface('prep-left-island','左側固定製劑實作台',238,340,198,118,52,{jumpAssist:true,material:'stone',arrival:true,polygon:[[217,280],[336,280],[303,398],[139,398]]});
  const labRight=surface('prep-right-island','右側固定製劑實作台',762,340,198,118,52,{jumpAssist:true,material:'stone',polygon:[[664,280],[783,280],[861,398],[697,398]]});
  const prepSurfaces=[labLeft,labRight,surface('prep-teacher-bench','固定教師實作台',500,174,185,20,40,{jumpAssist:true,material:'stone'})];
  const prepProps=[];
  for(const [side,mirror] of [['left',false],['right',true]]){
    const x=value=>mirror?1000-value:value,id='prep-'+side+'-island';
    [[181,293],[164,326],[145,361],[125,395],[350,296],[344,328],[337,361],[329,395],[185,430],[250,430]].forEach(([px,py],i)=>prepSurfaces.push(chair('prep-'+side+'-stool-'+i,x(px),py,'lab-stool',mirror,59)));
    [[244,299,'flask'],[272,303,'cylinder'],[300,301,'beaker'],[226,330,'amber-jar'],[268,339,'beaker'],[208,371,'cylinder'],[244,374,'flask']].forEach(([px,py,sprite],i)=>prepProps.push(prop('prep-'+side+'-glass-'+i,'實作台玻璃器皿 '+(i+1),sprite,id,x(px),py,31,'glass')));
    prepProps.push(prop('prep-'+side+'-mortar','實作台陶製研缽','mortar',id,x(278),371,41,'ceramic'),prop('prep-'+side+'-instrument','實作台金屬儀器','instrument',id,x(184),373,47,'metal',{mass:7}));
  }
  prepSurfaces.push(chair('prep-teacher-stool',560,201,'lab-stool',false,45));
  prepProps.push(prop('prep-teacher-instrument','講台金屬量測儀器','instrument','prep-teacher-bench',550,174,37,'metal',{mass:4}),prop('prep-teacher-beaker','講台玻璃燒杯','beaker','prep-teacher-bench',463,174,27,'glass'));
  rooms['classroom-pharmaceutics']=room('classroom-pharmaceutics','classroom-pharmaceutics.webp',prepSurfaces,prepProps,[fixture('prep-builtins','連牆製劑櫥櫃與水槽','stone',68,310,'石檯、水槽、櫃體、壁架及遠處密集藥瓶固定於原景。')]);

  const seminarSurfaces=[surface('seminar-lectern','固定講桌',500,157,85,32,40,{jumpAssist:true,material:'wood',arrival:true})],seminarProps=[];
  for(const [index,x,y,w,d,size] of [[0,215,244,177,63,220],[1,164,388,206,78,263],[2,785,244,177,63,220],[3,836,388,206,78,263]]){
    const id='seminar-table-'+index;seminarSurfaces.push(table(id,'原景圓角研討桌 '+(index+1),x,y,w,d,44,'white-table',size,{material:'metal',mass:22}));
    const dx=w/2+21,dy=d/2+21;[[x-dx,y-10],[x-dx,y+24],[x+dx,y-10],[x+dx,y+24],[x-36,y+dy],[x+36,y+dy],[x-37,y-dy],[x+37,y-dy]].forEach(([cx,cy],i)=>seminarSurfaces.push(chair('seminar-chair-'+index+'-'+i,cx,cy,'modern-chair-blue',cx>x,index%2?58:51)));
    seminarProps.push(prop('seminar-plant-'+index,'研討桌陶盆','plant',id,x,y-3,43,'ceramic',{mass:3}),prop('seminar-books-'+index,'研討桌筆記本','books',id,x+(index<2?43:-43),y+9,34,'paper'));
  }
  seminarProps.push(prop('seminar-lectern-device','講桌金屬教學器材','instrument','seminar-lectern',494,157,30,'metal',{mass:2}));
  rooms['classroom-pharmacology']=room('classroom-pharmacology','classroom-pharmacology.webp',seminarSurfaces,seminarProps,[fixture('seminar-molecule-display','後牆分子展示與收納櫃','wood',500,115,'固定收納及遠景模型保留原有清大靈感室內風格。')],{extraAreas:[[[20,450],[20,365],[80,300],[80,205],[140,155],[180,155],[180,450]],[[980,450],[980,365],[920,300],[920,205],[860,155],[820,155],[820,450]]]});

  const herbSurfaces=[surface('herb-teacher-bench','固定標本講台',500,174,215,22,47,{jumpAssist:true,material:'wood'})],herbProps=[];
  for(const [side,x] of [['left',201],['right',799]]){
    const id='herb-sample-table-'+side;herbSurfaces.push(table(id,'原景木質標本長桌',x,337,194,113,47,'wood-table',260,{arrival:side==='left',mass:28}));
    [[x-118,303],[x-118,343],[x-118,383],[x+118,303],[x+118,343],[x+118,383],[x-42,414],[x+42,414]].forEach(([cx,cy],i)=>herbSurfaces.push(chair('herb-chair-'+side+'-'+i,cx,cy,'wood-chair',cx>x,65)));
    [[-36,-28],[39,17],[-42,34]].forEach(([dx,dy],i)=>herbProps.push(prop('herb-jar-'+side+'-'+i,'藥材玻璃標本罐','amber-jar',id,x+dx,337+dy,33,'glass')));
    herbProps.push(prop('herb-mortar-'+side,'石質植物研缽','mortar',id,x+26,313,40,'stone',{mass:5}),prop('herb-plant-'+side,'桌上植物陶盆','plant',id,x-27,329,45,'ceramic',{mass:3}),prop('herb-tray-'+side,'木質植物採樣盤','specimen-tray',id,x+31,365,46,'wood'),prop('herb-notes-'+side,'紙本植物觀察紀錄','books',id,x-65,361,35,'paper'));
  }
  herbProps.push(prop('herb-teacher-jar','講台藥材標本罐','amber-jar','herb-teacher-bench',555,174,30,'glass'),prop('herb-teacher-mortar','講台石質研缽','mortar','herb-teacher-bench',526,174,34,'stone',{mass:5}));
  rooms['classroom-herbal']=room('classroom-herbal','classroom-herbal.webp',herbSurfaces,herbProps,[fixture('herb-wall-cases','藥材標本櫃與植物圖譜','wood',500,108,'連牆櫥櫃、遠處標本罐及植物圖譜保留於背景。')],{extraAreas:[[[45,450],[45,410],[55,290],[160,155],[200,155],[200,450]],[[955,450],[955,410],[945,290],[840,155],[800,155],[800,450]]]});

  const battleSurfaces=[surface('arena-left-lectern','左側固定競技講台',306,139,70,32,43,{jumpAssist:true,material:'wood',arrival:true}),surface('arena-right-lectern','右側固定競技講台',687,139,70,32,43,{jumpAssist:true,material:'wood'})],battleProps=[];
  for(const [index,x,y,w,d,size] of [[0,250,244,154,55,210],[1,210,350,179,70,240],[2,750,244,154,55,210],[3,790,350,179,70,240]]){
    const id='arena-study-table-'+index;battleSurfaces.push(table(id,'原景拼接研討桌 '+(index+1),x,y,w,d,42,'modular-table',size,{mass:20}));
    [[x-w/2-21,y-9],[x-w/2-21,y+23],[x+w/2+21,y-9],[x+w/2+21,y+23],[x-34,y+d/2+22],[x+34,y+d/2+22]].forEach(([cx,cy],i)=>battleSurfaces.push(chair('arena-chair-'+index+'-'+i,cx,cy,'modern-chair-sage',cx>x,index%2?56:51)));
    battleProps.push(prop('arena-plant-'+index,'競技桌陶盆','plant',id,x,y-9,35,'ceramic',{mass:2.5}),prop('arena-notes-'+index+'-a','競技桌筆記','books',id,x-44,y+8,30,'paper'),prop('arena-notes-'+index+'-b','競技桌講義','books',id,x+43,y+8,30,'paper'));
  }
  rooms['classroom-battle']=room('classroom-battle','classroom-battle.webp',battleSurfaces,battleProps,[fixture('arena-side-seats','靠牆固定長座與展示','wood',61,297,'兩側固定長座、牆面裝飾與花台保留於背景。')],{extraAreas:[[[65,470],[70,360],[120,240],[220,145],[265,145],[265,480]],[[935,470],[930,360],[880,240],[780,145],[735,145],[735,480]]],portalPositions:{'class-lesson':{x:450,y:220},'class-duel':{x:550,y:220}}});

  // These manually traced solid silhouettes redraw pixels from the SAME clean
  // plate above grounded actors behind a built-in bench. No duplicate movable
  // item is painted here; elevated actors retain the established higher layer.
  const occlusions={
    'hall-pharmaceutics':{'ntu-window-cabinet':[[218,316],[378,316],[378,379],[218,379]],'ntu-right-cabinet':[[846,321],[1000,321],[1000,394],[846,389]]},
    'hall-pharmacology':{'lab-shelf-0':[[0,375],[110,370],[110,455],[0,481]],'lab-shelf-1':[[0,293],[112,301],[112,307],[0,300]],'lab-shelf-2':[[0,224],[112,240],[112,246],[0,230]],'lab-shelf-3':[[0,146],[112,174],[112,180],[0,152]],'window-bench':[[174,386],[342,378],[346,394],[178,403]]},
    'hall-battle':{'battle-left-bench':[[0,376],[107,369],[125,379],[125,402],[0,436]],'battle-display-counter':[[923,358],[983,358],[983,403],[923,397]]},
    'hall-life':{'life-left-counter':[[0,315],[132,317],[132,412],[0,440]],'life-right-counter':[[881,320],[1000,326],[1000,437],[881,412]],'life-back-workbench':[[320,300],[389,300],[389,352],[320,352]]},
    'classroom-pharmaceutics':{'prep-left-island':[[217,228],[336,228],[303,346],[303,401],[139,401],[139,346]],'prep-right-island':[[664,228],[783,228],[861,346],[861,401],[697,401],[697,346]],'prep-teacher-bench':[[407,122],[596,122],[596,186],[407,186]]},
    'classroom-pharmacology':{'seminar-lectern':[[456,116],[544,116],[544,178],[456,178]]},
    'classroom-herbal':{'herb-teacher-bench':[[390,117],[612,117],[612,187],[390,187]]},
    'classroom-battle':{'arena-left-lectern':[[273,79],[344,79],[344,131],[273,131]],'arena-right-lectern':[[651,79],[724,79],[724,131],[651,131]]}
  };
  for(const [key,items] of Object.entries(occlusions))for(const [id,polygon] of Object.entries(items))rooms[key].surfaces.find(s=>s.id===id).occlusion=polygon;

  // Player-facing observations are separate from authoring/provenance notes.
  // They describe the academy without explaining discovery-based interactions.
  const inspectionText={
    'ntu-bookcase':'木質書架收納製劑、劑型與實作筆記，盆栽和攀藤讓閱讀角帶著庭院的綠意。',
    'pharma-window-planters':'石造花槽沿著窗邊與階梯排列，明亮的窗景陪著學院師生休息、整理課堂筆記。',
    'pharma-distant-display':'木框展示櫃收藏教學瓶罐與模型。不同形狀的器皿，留下了學院實作課的日常痕跡。',
    'herbal-fixed-cases':'木質櫥櫃收納藥材標本與植物紀錄，從走廊可以細看整齊的瓶罐與書冊。',
    'herbal-garden':'石砌花台圍出庭院邊界，大片樹冠為紅磚長廊留下一片綠蔭。',
    'battle-orbit-installation':'金屬星軌懸在挑高大廳裡，幾何環線把競技學院的視線引向中央。',
    'battle-molecule-model':'金屬分子模型陳列在木質展示櫃上，球與連桿組成了這處競技廳的科學裝飾。',
    'battle-built-planters':'石造花槽與玻璃欄杆沿著入口和階梯展開，清楚分出休息處與上下樓的通道。',
    'life-looms':'木製織具、布料與收納櫃沿牆排列，保留了生活工坊溫暖而忙碌的工作氣息。',
    'prep-builtins':'石質檯面、水槽與連牆櫥櫃圍住實作區，中央留出走道，方便小組來回觀察。',
    'seminar-molecule-display':'木質收納櫃和分子展示組成教室後牆，中央講桌與分組座位朝向同一個討論空間。',
    'herb-wall-cases':'木質標本櫃與植物圖譜環繞長桌，葉形、枝條與瓶罐讓這間教室充滿植物觀察的氣息。',
    'arena-side-seats':'木質長座沿著教室兩側排列，搭配牆面展示與花台，留出中央的分組交流空間。'
  };
  for(const room of Object.values(rooms))for(const item of room.fixtures)item.inspectionText=inspectionText[item.id];

  function get(id){if(typeof id!=='string')return null;const [kind,building]=id.split(':');return rooms[id]||rooms[kind+'-'+building]||null;}
  return {VERSION:1,WIDTH:1000,HEIGHT:667,ATLAS:'./assets/scene-objects/props.png',ATLAS_SIZE,SPRITE_SIZE:1254,SPRITES,SPRITE_RECTS,SPRITE_ANCHORS,MATERIALS,rooms,get};
});
