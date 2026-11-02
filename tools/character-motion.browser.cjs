/* Local Chromium acceptance for the production avatar, movement UI and motion
 * adapter. Requests are served from this checkout; external traffic is blocked.
 * The deterministic RAF clock tests input/state order, not real-device FPS.
 * The 60-avatar case is a synthetic rendering workload, not multiplayer.
 *
 * node tools/character-motion.browser.cjs
 * Optional: PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE, MOTION_BROWSER_OUT.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.MOTION_BROWSER_OUT||path.join(root,'../step2-browser-evidence'));
const read=file=>fs.readFileSync(path.join(root,'game',file),'utf8');
const index=read('index.html'),csp=index.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const styles=[...index.matchAll(/<link rel="stylesheet" href="([^"?]+)(?:[^"]*)"/g)].map(m=>m[1]);
if(!styles.some(file=>file.endsWith('character-motion.css')))styles.push('./character-motion.css');
const modules=['engine.js','social-economy.js','wish.js','adventure.js','combat.js','academy.js','cast-outfit.js','world-layout.js','classroom.js','scene-objects.js','campus-walk.js','furniture.js','scene-play.js','scene-ambient.js','scene-play-ui.js','lobby.js','character-motion.js','avatar-motion.js','lobby-ui.js','campus-walk-ui.js'];
const fixtureBytes=new Map();
for(const file of [...modules,...styles,'index.html']){const absolute=path.resolve(root,'game',file);fixtureBytes.set(absolute,fs.readFileSync(absolute));}
const auditCSS=`
body{margin:0;background:#eef2e9;color:#294d3c;font-family:system-ui,sans-serif}
#motion-main{max-width:1040px;margin:0 auto;padding:18px}
.motion-heading{margin:0 0 16px;font-size:23px;color:#294d3c}.motion-subtitle{font-size:13px;margin:8px 0 15px}
#motion-stage .walk-world{width:1000px;height:667px;max-width:100%;min-height:0;aspect-ratio:auto;border-radius:16px}
#motion-stage .walk-console{margin:8px 0}.motion-synthetic{position:relative;width:1000px;height:667px;overflow:hidden;border:1px solid #c6d7bb;border-radius:16px;background:linear-gradient(#edf6e7,#f8f0dc)}
.motion-synthetic .walk-actor{width:80px}.motion-synthetic .player-name{font-size:8px;padding:2px 5px}
`;
const html='<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'">'+styles.map(src=>'<link rel="stylesheet" href="'+src+'">').join('')+'<link rel="stylesheet" href="./__motion-audit.css">'+modules.map(src=>'<script defer src="./'+src+'"></script>').join('')+'</head><body><main id="motion-main"><h1 class="motion-heading">第二步 · 角色轉向與移動驗收</h1><p class="motion-subtitle">本機真實角色渲染，使用既有美術；測試控制器不連線到正式服務。</p><div id="motion-stage"></div></main></body></html>';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const report={kind:'production avatar and movement UI; local Chromium acceptance',createdAt:new Date().toISOString(),node:process.version,sourceSHA256:Object.fromEntries([...modules,'character-motion.css'].map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')])),scope:{externalNetworkAllowed:false,productionAccounts:false,networkMultiplayer:false,physicalDevice:false,live60FPSClaim:false,clock:'deterministic RAF; browser-generated keyboard events',renderer:'production original 4x2 sprites and three authored outfit SVG views'},checks:[],scenarios:{},screenshots:[],requests:{local:0,external:[],missing:[]},pageErrors:[],consoleErrors:[],cspViolations:[]};
function check(condition,label,data){report.checks.push({label,pass:!!condition,...(data===undefined?{}:{data})});if(!condition)console.error('FAIL '+label+' '+JSON.stringify(data));}
async function createPage(browser){
  const context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    let now=1000,next=0;const callbacks=new Map();
    window.__realMotionNow=performance.now.bind(performance);
    Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
    window.requestAnimationFrame=callback=>{const id=++next;callbacks.set(id,callback);return id;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.__motionClock={now:()=>now,pending:()=>callbacks.size,step(dt=1000/60){now+=dt;const work=[...callbacks.values()];callbacks.clear();for(const callback of work)callback(now);return now;}};
    window.__motionBrowserTelemetry={violations:[],styleWrites:0};
    const set=CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty=function(name,value,priority){if(name.startsWith('--motion-'))window.__motionBrowserTelemetry.styleWrites++;return set.call(this,name,value,priority);};
    document.addEventListener('securitypolicyviolation',event=>window.__motionBrowserTelemetry.violations.push({directive:event.effectiveDirective,blockedURI:event.blockedURI}));
  });
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://local.test'){report.requests.external.push(url.origin+url.pathname);await route.abort('blockedbyclient');return;}
    report.requests.local++;
    if(url.pathname==='/game/__motion-test.html'){await route.fulfill({status:200,contentType:'text/html',body:html});return;}
    if(url.pathname==='/game/__motion-audit.css'){await route.fulfill({status:200,contentType:'text/css',body:auditCSS});return;}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(path.join(root,'game')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){report.requests.missing.push(url.pathname);await route.fulfill({status:404,body:'Not found'});return;}
    if(!fixtureBytes.has(file))fixtureBytes.set(file,fs.readFileSync(file));
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fixtureBytes.get(file)});
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  await page.goto('https://local.test/game/__motion-test.html');
  await page.evaluate(()=>{
    const node=(tag,attrs={},...children)=>{
      const el=document.createElement(tag);
      for(const [key,value]of Object.entries(attrs)){
        if(key.startsWith('on')&&typeof value==='function')el.addEventListener(key.slice(2).toLowerCase(),value);
        else if(typeof value==='boolean'){if(value)el.setAttribute(key,'');}
        else if(value!=null)el.setAttribute(key,String(value));
      }
      for(const child of children.flat(Infinity))if(child!=null&&child!==false)el.append(child instanceof Node?child:document.createTextNode(String(child)));
      return el;
    };
    const A={node,actor:null,world:null,scene:null,controller:null,trace:[],animationFaults:[],childMutations:0,previewCalls:0,visuals:new WeakMap(),identity:[],sourceIdentity:[],pendingPortals:[]};
    const preview=MindCastOutfit.preview;MindCastOutfit.preview=function(...args){A.previewCalls++;return preview.apply(this,args);};
    const update=MindAvatarMotion.update;MindAvatarMotion.update=function(actor,sample){const visual=update(actor,sample);A.visuals.set(actor,visual);return visual;};
    const sceneArt=MindSceneUI({node}),stage=document.getElementById('motion-stage');
    A.loadout=()=>Object.fromEntries(MindAdventure.setIds(MindAdventure.FRUIT_SETS[0]).map(id=>[MindAdventure.gear(id).slot,id]));
    A.sceneFor=(kind='hall',building='herbal')=>kind==='classroom'?MindWalk.classrooms[building]:MindWalk.hall('動作驗收',building);
    A.snapshot=()=>{
      const actor=A.actor,body=actor?.querySelector('.run-sprite,.equipped-sprite'),visual=A.visuals.get(actor);
      if(!actor)return null;
      const css=body?getComputedStyle(body):null;
      return {x:Number(actor.dataset.x),y:Number(actor.dataset.y),z:Number(actor.dataset.z),action:actor.dataset.motionAction,view:actor.dataset.motionView,reduced:actor.dataset.motionReduced,walking:actor.classList.contains('walking'),animationName:css?.animationName,bodyTransform:css?.transform,bodyBackgroundPosition:css?.backgroundPosition,bodyBox:body?{width:body.getBoundingClientRect().width,height:body.getBoundingClientRect().height}:null,row:actor.style.getPropertyValue('--motion-row'),lean:actor.style.getPropertyValue('--motion-lean'),scaleY:actor.style.getPropertyValue('--motion-scale-y'),visual:visual?{...visual}:null};
    };
    A.advance=(frames=1,dt=1000/60)=>{
      const snapshots=[];
      for(let frame=0;frame<frames;frame++){
        __motionClock.step(dt);const snap=A.snapshot();if(!snap)continue;snapshots.push(snap);A.trace.push(snap);
        if(snap.animationName!=='none')A.animationFaults.push(snap.animationName);
      }
      return snapshots;
    };
    A.mount=({kind='hall',building='herbal',equipped=false,initial=null}={})=>{
      A.controller?.destroy();A.observer?.disconnect();A.trace=[];A.animationFaults=[];A.childMutations=0;A.pendingPortals=[];
      A.scene=A.sceneFor(kind,building);
      A.actor=MindAvatar({node,appearance:{version:1,character:equipped?'professor':'doctor',pet:null},name:equipped?'彩色裝備學者':'原始服裝學者',loadout:equipped?A.loadout():{}});
      A.world=node('section',{class:'interior-scene interior-walk walk-world',tabindex:'0','aria-label':'本地角色動作驗收場景'},node('img',{class:'interior-backdrop',src:A.scene.background,alt:'原專案大廳或教室背景',width:1536,height:1024,draggable:false}),sceneArt.props(A.scene),node('span',{class:'walk-target',hidden:true}),A.actor);
      const root=node('section',{class:'walk-section'},A.world,node('div',{class:'walk-console'},node('p',{class:'walk-status'}),node('button',{type:'button',class:'walk-enter'},'互動'),node('button',{type:'button',class:'walk-jump'},'跳躍')));
      stage.replaceChildren(root);
      A.identity=[A.actor.querySelector('.run-sprite,.equipped-sprite'),...A.actor.querySelectorAll('.outfit-facing')];
      A.sourceIdentity=[...A.actor.querySelectorAll('.outfit-facing')].map(img=>img.src);
      A.observer=new MutationObserver(records=>{A.childMutations+=records.filter(record=>record.type==='childList').length;});A.observer.observe(A.actor,{childList:true,subtree:true});
      A.controller=MindWalkUI({root,scene:A.scene,initial:initial||A.scene.spawn,onPosition(){},onPortal:id=>A.pendingPortals.push(id)});
      A.world.focus();A.advance(2);return A.snapshot();
    };
    A.stableArt=()=>{
      const current=[A.actor.querySelector('.run-sprite,.equipped-sprite'),...A.actor.querySelectorAll('.outfit-facing')];
      return {nodesUnchanged:current.length===A.identity.length&&current.every((el,i)=>el===A.identity[i]),sourcesUnchanged:JSON.stringify([...A.actor.querySelectorAll('.outfit-facing')].map(img=>img.src))===JSON.stringify(A.sourceIdentity),childMutations:A.childMutations,previewCalls:A.previewCalls};
    };
    A.ready=async()=>{
      const images=[...stage.querySelectorAll('img')];await Promise.all(images.map(img=>img.decode()));
      const body=A.actor?.querySelector('.run-sprite');let originalSprite=null;
      if(body){const match=getComputedStyle(body).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);if(match){const img=new Image();img.src=match[1];await img.decode();originalSprite={width:img.naturalWidth,height:img.naturalHeight,url:img.src};}}
      return {images:images.map(img=>({width:img.naturalWidth,height:img.naturalHeight,source:img.src.startsWith('data:')?'original wardrobe SVG':new URL(img.src).pathname})),originalSprite};
    };
    A.findCollision=(slide=true)=>{
      const scene=A.sceneFor('hall','herbal'),W=MindWalk,vectors=slide?[[1,-1],[-1,-1],[1,1],[-1,1]]:[[1,0],[-1,0],[0,1],[0,-1]];
      for(let y=410;y<=620;y+=3)for(let x=145;x<=945;x+=3){const start={x,y};if(!W.walkable(scene,start)||W.near(scene,start,55))continue;
        for(const [dx,dy]of vectors){let p={...start};const deltas=[];for(let i=0;i<14;i++){const next=W.move(scene,p,dx,dy,1/60,false,0);deltas.push({x:next.x-p.x,y:next.y-p.y});p=next;}
          const total={x:p.x-x,y:p.y-y};
          if(slide&&((Math.abs(total.x)>20&&Math.abs(total.y)<.01)||(Math.abs(total.y)>20&&Math.abs(total.x)<.01)))return {initial:start,vector:[dx,dy],expected:Math.abs(total.x)>Math.abs(total.y)?total.x<0?'left':'right':total.y<0?'up':'down'};
          if(!slide&&Math.hypot(total.x,total.y)<.001)return {initial:start,vector:[dx,dy]};
        }
      }throw Error('No collision fixture found on the actual hall geometry');
    };
    window.__motionAudit=A;
  });
  return {page,context};
}
async function advance(page,frames=1){return page.evaluate(frames=>__motionAudit.advance(frames),frames);}
async function snap(page){return page.evaluate(()=>__motionAudit.snapshot());}
async function keys(page,vector,down){for(const [key,active]of [['ArrowRight',vector[0]>0],['ArrowLeft',vector[0]<0],['ArrowDown',vector[1]>0],['ArrowUp',vector[1]<0]])if(active)await page.keyboard[down?'down':'up'](key);}
async function shot(page,name){
  // Let the unchanged room-arrival fade finish; do not mistake a mid-fade
  // screenshot for altered avatar colors or suppress production animations.
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.walk-world')].flatMap(el=>el.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))));
  const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true});report.screenshots.push({file:name+'.png',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
}
async function locomotion(page,equipped){
  const label=equipped?'equipped':'original';
  const start=await page.evaluate(equipped=>__motionAudit.mount({equipped,initial:{x:450,y:590}}),equipped);
  const art=await page.evaluate(()=>__motionAudit.ready()),initialCalls=await page.evaluate(()=>__motionAudit.previewCalls);
  check(art.images.every(image=>image.width>0&&image.height>0)&&(!art.originalSprite||art.originalSprite.width>0),label+' real original art successfully decoded',art);
  await page.keyboard.down('ArrowRight');const run=await advance(page,30),right=run.at(-1);
  check(right.x>start.x+45&&right.action==='run'&&right.view==='right',label+' actual keyboard moves and settles to the right',right);
  if(equipped)check(new Set(run.map(s=>s.lean)).size>3&&run.every(s=>Math.abs(parseFloat(s.lean))<=1.75),'equipped static art receives a bounded, distance-driven weight shift');
  else check(new Set(run.map(s=>s.row)).size>1,'original two-frame sprite advances by traveled distance');
  await page.keyboard.up('ArrowRight');const stopped=await snap(page);await advance(page,12);const afterStop=await snap(page);
  check(stopped.x===right.x&&stopped.y===right.y&&afterStop.x===stopped.x&&afterStop.y===stopped.y&&!stopped.walking&&stopped.action==='idle',label+' key release immediately stops world movement and run state',{right,stopped,afterStop});
  await page.keyboard.down('ArrowLeft');const firstLeft=(await advance(page,1))[0];const left=(await advance(page,30)).at(-1);
  check(firstLeft.x<stopped.x&&firstLeft.visual?.turning===true&&firstLeft.view!=='left'&&left.view==='left',label+' left input moves immediately while visual orientation blends',{firstLeft,left});
  await page.keyboard.up('ArrowLeft');await advance(page,20);
  const stable=await page.evaluate(()=>__motionAudit.stableArt()),faults=await page.evaluate(()=>__motionAudit.animationFaults);
  check(stable.nodesUnchanged&&stable.sourcesUnchanged&&stable.childMutations===0&&stable.previewCalls===initialCalls,label+' running and turning reuse the same avatar nodes and SVG sources',stable);
  check(faults.length===0,label+' body uses no independent CSS animation throughout the sequence',faults);
  await shot(page,'hall-'+label+'-after-turn');
  report.scenarios[label]={start,right,stopped,firstLeft,left,stable,art};
}
async function collisions(page){
  const slide=await page.evaluate(()=>__motionAudit.findCollision(true));
  await page.evaluate(initial=>__motionAudit.mount({equipped:true,initial}),slide.initial);await page.evaluate(()=>__motionAudit.ready());
  await keys(page,slide.vector,true);const samples=await advance(page,14);await keys(page,slide.vector,false);
  const last=samples.at(-1);
  check(last.visual?.targetHeading===slide.expected&&last.action==='run','wall slide faces actual displacement, not blocked diagonal input',{fixture:slide,last});
  const blocked=await page.evaluate(()=>__motionAudit.findCollision(false));
  const start=await page.evaluate(initial=>__motionAudit.mount({equipped:true,initial}),blocked.initial);
  await keys(page,blocked.vector,true);const push=(await advance(page,25)).at(-1);await keys(page,blocked.vector,false);
  check(push.x===start.x&&push.y===start.y&&push.action==='push'&&!push.walking&&push.row==='0%','holding into a wall does not run in place',{fixture:blocked,start,push});
  const stable=await page.evaluate(()=>__motionAudit.stableArt());check(stable.nodesUnchanged&&stable.childMutations===0,'collision states do not rebuild wardrobe images',stable);
  report.scenarios.collisions={slide:{fixture:slide,last},blocked:{fixture:blocked,start,push}};
}
async function jump(page){
  const initial=await page.evaluate(()=>MindWalk.deskArrival(MindWalk.classrooms.pharmaceutics));
  const start=await page.evaluate(initial=>__motionAudit.mount({kind:'classroom',building:'pharmaceutics',equipped:true,initial}),initial);await page.evaluate(()=>__motionAudit.ready());
  await page.keyboard.down('ArrowUp');await page.keyboard.press('Space');const ascent=await advance(page,28);await page.keyboard.up('ArrowUp');const horizontalStop=await snap(page);const descent=await advance(page,55),final=descent.at(-1),trace=[...ascent,...descent];
  const actions=[...new Set(trace.map(s=>s.action))],support=await page.evaluate(()=>MindWalk.surface(__motionAudit.scene,{x:Number(__motionAudit.actor.dataset.x),y:Number(__motionAudit.actor.dataset.y)},Number(__motionAudit.actor.dataset.z)));
  check(actions.includes('rise')&&actions.includes('fall')&&actions.includes('land'),'jump has distinct rise, fall and brief landing states',actions);
  check(final.z>0&&support&&Math.abs(final.z-support.height)<.2&&final.action==='idle','actual movement lands and rests on the original classroom table',{start,final,support:support?{id:support.id,height:support.height}:null});
  check(descent.every(s=>s.x===horizontalStop.x&&s.y===horizontalStop.y),'releasing direction in the air does not add horizontal animation inertia',{horizontalStop,final});
  check(trace.every(s=>s.animationName==='none'),'jump and landing have no independent body CSS loop');
  check(trace.filter(s=>s.action==='land').some(s=>Number(s.scaleY)<1)&&final.scaleY==='1.0000','landing weight shift settles to the unchanged body proportions');
  await shot(page,'classroom-equipped-table-landing');
  report.scenarios.jump={start,horizontalStop,final,actions,support:support?{id:support.id,height:support.height}:null};
}
async function reduced(page){
  await page.emulateMedia({reducedMotion:'reduce'});
  const start=await page.evaluate(()=>__motionAudit.mount({initial:{x:450,y:590}}));await page.evaluate(()=>__motionAudit.ready());
  await page.keyboard.down('ArrowRight');const samples=await advance(page,30);await page.keyboard.up('ArrowRight');await advance(page,12);const stopped=await snap(page);
  check(samples.at(-1).x>start.x+45&&samples.every(s=>s.reduced==='true'&&s.lean==='0.000deg'&&s.row==='0%'),'reduced motion preserves real movement while disabling decorative stride and lean',{start,last:samples.at(-1)});
  check(stopped.action==='idle'&&!stopped.walking&&stopped.animationName==='none','reduced motion stops with no residual body animation',stopped);
  await page.emulateMedia({reducedMotion:'no-preference'});await advance(page,2);const restored=await snap(page);
  check(restored.reduced==='false','live reduced-motion preference changes are observed without rebuilding the avatar',restored);
  report.scenarios.reduced={start,last:samples.at(-1),stopped,restored};
}
async function synthetic(page){
  const result=await page.evaluate(async()=>{
    const A=__motionAudit;A.controller.destroy();A.controller=null;A.observer.disconnect();
    const stage=document.getElementById('motion-stage'),world=A.node('section',{class:'motion-synthetic'});stage.replaceChildren(A.node('p',{class:'motion-subtitle'},'60 個合成角色 · 僅本地渲染工作量，並非真實多人或 FPS 證明'),world);
    const actors=[],nodes=[];
    for(let i=0;i<60;i++){
      const actor=MindAvatar({node:A.node,appearance:{version:1,character:MindAcademy.CHARACTERS[i%10].id,pet:null},name:'本地測試 '+(i+1),loadout:i%2?A.loadout():{},remote:true});
      const x=50+i%10*94,y=140+Math.floor(i/10)*85;
      actor.style.left=x/10+'%';actor.style.top=y/667*100+'%';actor.style.setProperty('--depth','1');world.append(actor);actors.push({actor,x,y});nodes.push([actor.querySelector('.run-sprite,.equipped-sprite'),...actor.querySelectorAll('.outfit-facing')]);
    }
    await Promise.all([...world.querySelectorAll('img')].map(img=>img.decode()));
    let mutations=0;const observer=new MutationObserver(records=>{mutations+=records.filter(r=>r.type==='childList').length;});observer.observe(world,{childList:true,subtree:true});
    const calls=A.previewCalls,started=__realMotionNow();let time=__motionClock.now();__motionBrowserTelemetry.styleWrites=0;
    for(let frame=0;frame<61;frame++){time+=1000/60;for(const {actor,x,y}of actors){const nextX=x+frame*.45;actor.style.left=nextX/10+'%';MindAvatarMotion.update(actor,{x:nextX,y,z:0,time,scene:'local-synthetic',scale:1,groundZ:0,verticalVelocity:0,intent:frame>0,direction:'right'});}}
    const movingStyleWrites=__motionBrowserTelemetry.styleWrites,movingAdapterLoopMs=__realMotionNow()-started;
    for(let frame=0;frame<40;frame++){time+=1000/60;for(const {actor,x,y}of actors)MindAvatarMotion.update(actor,{x:x+27,y,z:0,time,scene:'local-synthetic',scale:1,groundZ:0,verticalVelocity:0,intent:false,direction:'right'});}
    __motionBrowserTelemetry.styleWrites=0;
    for(let frame=0;frame<120;frame++){time+=1000/60;for(const {actor,x,y}of actors)MindAvatarMotion.update(actor,{x:x+27,y,z:0,time,scene:'local-synthetic',scale:1,groundZ:0,verticalVelocity:0,intent:false,direction:'right'});}
    await Promise.resolve();
    const result={actors:actors.length,equipped:actors.filter(({actor})=>actor.classList.contains('geared-actor')).length,movingStyleWrites,movingAdapterLoopMs,loopTimingScope:'synchronous JS adapter/style updates only; excludes paint, composite and network',idleStyleWrites:__motionBrowserTelemetry.styleWrites,childMutations:mutations,previewCallsDuringUpdates:A.previewCalls-calls,nodesUnchanged:actors.every(({actor},i)=>[actor.querySelector('.run-sprite,.equipped-sprite'),...actor.querySelectorAll('.outfit-facing')].every((el,j)=>el===nodes[i][j])),needsFrameAfterSettling:actors.filter(({actor})=>MindAvatarMotion.needsFrame(actor)).length,bodyAnimations:[...new Set(actors.map(({actor})=>getComputedStyle(actor.querySelector('.run-sprite,.equipped-sprite')).animationName))],pendingRAF:__motionClock.pending()};
    observer.disconnect();A.syntheticActors=actors;return result;
  });
  check(result.actors===60&&result.equipped===30,'synthetic workload contains 60 actual avatars, half equipped',result);
  check(result.childMutations===0&&result.previewCallsDuringUpdates===0&&result.nodesUnchanged,'synthetic motion reuses original avatar and clothing DOM',result);
  check(result.idleStyleWrites===0&&result.needsFrameAfterSettling===0,'settled synthetic avatars perform no repeated adapter style writes',result);
  check(result.bodyAnimations.length===1&&result.bodyAnimations[0]==='none','synthetic avatars have no competing body CSS loops',result);
  await shot(page,'synthetic-60-avatars');report.scenarios.synthetic=result;
  const cleanup=await page.evaluate(()=>{for(const {actor}of __motionAudit.syntheticActors){MindAvatarMotion.dispose(actor);MindAvatarMotion.dispose(actor);}return {pendingRAF:__motionClock.pending(),managed:document.querySelectorAll('.motion-managed').length};});
  check(cleanup.pendingRAF===0&&cleanup.managed===0,'disposal leaves no adapter-owned RAF or managed avatars',cleanup);
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});let host;
  try{
    host=await createPage(browser);const {page}=host;
    await locomotion(page,false);await locomotion(page,true);await collisions(page);await jump(page);await reduced(page);await synthetic(page);
    report.cspViolations.push(...await page.evaluate(()=>__motionBrowserTelemetry.violations));
    check(report.pageErrors.length===0&&report.consoleErrors.length===0,'browser reports no JavaScript or console errors',{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors});
    check(report.requests.external.length===0&&report.requests.missing.length===0&&report.cspViolations.length===0,'all requested assets remain local, present and CSP-compatible',{requests:report.requests,violations:report.cspViolations});
  }catch(error){report.executionError=error.stack||String(error);throw error;}
  finally{if(host)await host.context.close();await browser.close();report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({summary:report.summary,report:path.join(out,'report.json'),scope:report.scope}));
  if(report.summary.failed)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
