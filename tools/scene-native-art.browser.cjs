/* Actual game/index.html acceptance for the first illustrated classroom.
 * Localhost requests are fulfilled from this checkout. Every external request
 * is blocked; a clean context reports navigator.onLine=false. No account,
 * production save, Firebase transaction or multiplayer connection is used.
 * Factory wrappers below only expose existing UI callbacks and observe the
 * production scene state in this test browser. They are not shipped by index.
 *
 * CHROMIUM_EXECUTABLE=/path/to/chrome-headless-shell node tools/scene-native-art.browser.cjs
 * Optional: PLAYWRIGHT_MODULE, SCENE_ART_BROWSER_OUT, SCENE_ART_CHARACTER.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.SCENE_ART_BROWSER_OUT||path.join(root,'../stage3-evidence'));
const origin='http://127.0.0.1:4173',sid='classroom:pharmaceutics',character=process.env.SCENE_ART_CHARACTER||'professor';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const files=['index.html','scene-objects.js','campus-walk.js','campus-walk-ui.js','scene-play.js','scene-play-ui.js','academy-ui.js','academy-controls.css','assets/illustrated-scenes/classroom-pharmaceutics.webp'];
if(character==='doctor')files.push('native-avatar.js','native-avatar.css',...fs.readdirSync(path.join(root,'game/assets/native-avatar/pineapple-doctor')).filter(file=>file.endsWith('.webp')).sort().map(file=>'assets/native-avatar/pineapple-doctor/'+file));
const report={kind:'actual game index; first illustrated classroom; localhost Chromium acceptance',createdAt:new Date().toISOString(),character,sourceSHA256:Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,'game',file)))])),scope:{productionHTML:true,syntheticScene:false,localFixtureSave:true,productionAccounts:false,externalNetworkAllowed:false,multiplayer:false,physicalMobileDevice:false,performanceBenchmark:false,clock:'real RAF and keyboard/touch; Date.now offset used only to expire existing 8s/60s scene effects'},checks:[],screenshots:[],requests:{local:0,external:[],missing:[]},pageErrors:[],consoleErrors:[],scenarios:{}};
function check(condition,label,data){report.checks.push({label,pass:!!condition,...(data===undefined?{}:{data})});if(!condition)console.error('FAIL '+label+' '+JSON.stringify(data));}
async function screenshot(page,name){
  if(character==='doctor')await page.waitForFunction(()=>{const actor=document.querySelector('.walk-world>.walk-actor:not(.remote-player)');return actor?.dataset.nativeAssetStatus==='ready'&&actor.dataset.nativePose==='idle';});
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.walk-world')].flatMap(el=>el.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))));
  const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:false});const bytes=fs.readFileSync(file);
  report.screenshots.push({file:path.basename(file),bytes:bytes.length,sha256:sha(bytes),source:'actual game/index.html screenshot'});
}
async function makePage(browser,viewport,isMobile=false){
  const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile,deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    Object.defineProperty(Navigator.prototype,'onLine',{configurable:true,get:()=>false});
    const realDateNow=Date.now.bind(Date),A={ctx:null,ui:null,walk:null,environment:null,network:null,nextInitial:null,samples:[],offsetMs:0};
    Date.now=()=>realDateNow()+A.offsetMs;
    const observe=(name,wrap)=>{let current;Object.defineProperty(window,name,{configurable:true,get:()=>current,set:value=>{current=wrap(value);}});};
    observe('MindAcademyUI',factory=>function(ctx){A.ctx=ctx;const api=factory(ctx);A.ui=api;return api;});
    observe('MindWalkUI',factory=>function(options){
      const initial=A.nextInitial||options.initial;A.nextInitial=null;
      const wrapped={...options,initial,onMotion(pose){A.samples.push({...pose,scene:options.sceneId,time:performance.now()});if(A.samples.length>2000)A.samples.shift();options.onMotion?.(pose);}};
      const controller=factory(wrapped);A.walk={options:wrapped,controller};return controller;
    });
    observe('MindSceneUI',factory=>function(ctx){const ui=factory(ctx),render=ui.render;ui.render=function(world,scene,state,...rest){if(scene==='classroom:pharmaceutics')A.environment=state;return render(world,scene,state,...rest);};return ui;});
    observe('MindLobbyNetwork',factory=>function(options){const network=factory(options);A.network=network;return network;});
    A.pose=()=>{const el=document.querySelector('.walk-world>.walk-actor:not(.remote-player)');return el?{x:Number(el.dataset.x),y:Number(el.dataset.y),z:Number(el.dataset.z),walking:el.classList.contains('walking'),direction:el.dataset.direction,action:el.dataset.motionAction,lift:parseFloat(el.style.getPropertyValue('--lift'))||0}:null;};
    A.reposition=point=>{A.nextInitial=point;A.samples=[];A.ctx.render();document.querySelector('.walk-world')?.focus({preventScroll:true});};
    window.__sceneArtAudit=A;
  });
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){report.requests.external.push(url.origin+url.pathname);await route.abort('blockedbyclient');return;}
    report.requests.local++;const absolute=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!absolute.startsWith(path.join(root,'game')+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){
      report.requests.missing.push(url.pathname);await route.fulfill({status:404,body:'Not found'});return;
    }
    await route.fulfill({status:200,contentType:mime[path.extname(absolute)]||'application/octet-stream',body:fs.readFileSync(absolute)});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  await page.goto(origin+'/game/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sceneArtAudit?.ctx&&window.MindWalk&&window.MindAdventure);
  await page.evaluate(character=>{
    const A=__sceneArtAudit,state=A.ctx.getState();
    state.profile={...state.profile,name:'本機教室驗收學者',enrolled:true};state.appearance={...state.appearance,character,pet:null};
    const set=MindAdventure.FRUIT_SETS.find(s=>s.key==='pineapple');
    const ids=MindAdventure.setIds(set);for(const id of ids)MindAdventure.grant(state,id);MindAdventure.equipSet(state,ids);
    A.ctx.go('home');
    for(const step of MindWalk.travelRoute('campus','district:pharmaceutics'))A.walk.options.onPortal(step.portal);
    A.walk.options.onPortal('door');
    const day=MindEconomy.day(),room={id:day+'_pharmaceutics_1',number:1,day};
    state.arena.economy.wallet=MindEconomy.freshWallet();state.arena.economy.wallet.rooms.pharmaceutics=room.id;
    A.ui.openClass('pharmaceutics',room);
  },character);
  await page.waitForFunction(()=>document.querySelector('.classroom-scene img.campus-backdrop')?.complete&&document.querySelector('.classroom-scene img.campus-backdrop')?.naturalWidth>0);
  await page.waitForFunction(()=>__sceneArtAudit.environment);
  if(character==='doctor')await page.waitForFunction(()=>document.querySelector('.walk-world>.walk-actor:not(.remote-player)')?.dataset.nativeAssetStatus==='ready');
  await page.locator('.walk-world').focus();
  return {page,context};
}
async function readPose(page){return page.evaluate(()=>__sceneArtAudit.pose());}
async function reposition(page,point){await page.evaluate(point=>__sceneArtAudit.reposition(point),point);await page.waitForFunction(()=>!!__sceneArtAudit.pose());await page.locator('.walk-world').focus();}
async function desktop(page){
  const art=await page.evaluate(()=>{
    const A=__sceneArtAudit,scene=A.walk.options.scene,image=document.querySelector('.classroom-scene img.campus-backdrop');
    return {url:location.href,src:new URL(image.src).pathname,dimensions:[image.naturalWidth,image.naturalHeight],sceneId:A.walk.options.sceneId,fixed:scene.surfaces.filter(s=>!s.movable).map(s=>({id:s.id,hasVisual:!!s.visual,occlusion:s.occlusion})),movable:scene.surfaces.filter(s=>s.movable).length,props:scene.glass.length,occlusionImages:[...document.querySelectorAll('.photo-occlusion')].map(el=>getComputedStyle(el).backgroundImage),worldStartVisible:getComputedStyle(document.querySelector('.classroom-start')).display!=='none',network:A.network.snapshot().status,renderer:document.querySelector('.native-avatar-sprite')?'native frame atlas':document.querySelector('.equipped-sprite')?'existing equipped artwork':'existing character artwork'};
  });
  check(art.url.endsWith('/game/index.html')&&art.sceneId===sid&&art.worldStartVisible,'the real game index navigates to the pharmaceutics classroom and retains its desktop class button',art);
  check(art.src==='/game/assets/illustrated-scenes/classroom-pharmaceutics.webp'&&art.dimensions.join('x')==='1536x1024','the original painted classroom file is decoded at its native dimensions',art);
  check(art.fixed.length===3&&art.fixed.every(s=>!s.hasVisual)&&art.occlusionImages.every(url=>url.includes('/assets/illustrated-scenes/classroom-pharmaceutics.webp')),'all three fixed bench occlusions use the same new plate without duplicate furniture sprites',art.fixed);
  check(art.movable===21&&art.props===20&&art.network!=='connected','original loose objects remain and the scene does not claim real multiplayer',{movable:art.movable,props:art.props,network:art.network});
  await screenshot(page,'classroom-desktop-original-redraw');report.scenarios.desktopArt=art;

  await reposition(page,{x:208,y:430});
  await page.keyboard.down('ArrowUp');await page.keyboard.press('Space');
  await page.waitForFunction(()=>__sceneArtAudit.pose().y<=345);
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>Math.abs(__sceneArtAudit.pose().z-52)<.1&&!document.querySelector('.walk-actor').classList.contains('jumping'));
  const jump=await page.evaluate(()=>{
    const A=__sceneArtAudit,p=A.pose(),world=document.querySelector('.walk-world'),r=world.getBoundingClientRect(),support=MindWalk.surface(A.walk.options.scene,p,p.z),sprite=document.querySelector('.walk-world>.walk-actor:not(.remote-player) .native-avatar-sprite'),rect=sprite?.getBoundingClientRect();
    return {pose:p,support:support?{id:support.id,height:support.height}:null,peak:Math.max(...A.samples.map(p=>p.z)),expectedLift:p.z*world.offsetHeight/667,projectedFoot:{x:r.left+p.x/1000*r.width,y:r.top+(p.y-p.z)/667*r.height},nativeFoot:rect?{x:rect.left+rect.width*128/256,y:rect.top+rect.height*372/384,aspectRatio:rect.width/rect.height}:null,inside:MindWalk.walkable(A.walk.options.scene,p,p.z)};
  });
  check(jump.support?.id==='prep-left-island'&&jump.pose.z===52&&jump.peak>52&&jump.inside,'actual keyboard movement and Space jump land on the drawn left laboratory island',jump);
  check(Math.abs(jump.pose.lift-jump.expectedLift)<.2&&(character!=='doctor'||jump.nativeFoot&&Math.hypot(jump.nativeFoot.x-jump.projectedFoot.x,jump.nativeFoot.y-jump.projectedFoot.y)<1&&Math.abs(jump.nativeFoot.aspectRatio-256/384)<.002),'the actor foot elevation uses the same scene projection as its supporting bench; native cell keeps its drawn aspect ratio',jump);
  await screenshot(page,'classroom-desktop-on-bench');report.scenarios.jump=jump;

  const target='prep-left-glass-5';
  const cupBefore=await page.evaluate(target=>MindScenePlay.cup(__sceneArtAudit.environment,'classroom:pharmaceutics',target),target);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(target=>MindScenePlay.cup(__sceneArtAudit.environment,'classroom:pharmaceutics',target,Date.now()).fallUntil>Date.now(),target);
  await page.keyboard.up('ArrowDown');
  const falling=await page.evaluate(target=>MindScenePlay.cup(__sceneArtAudit.environment,'classroom:pharmaceutics',target,Date.now()),target);
  await page.waitForFunction(target=>MindScenePlay.cup(__sceneArtAudit.environment,'classroom:pharmaceutics',target,Date.now()).brokenUntil>Date.now(),target);
  await page.waitForFunction(target=>document.querySelector('.photo-portable[data-prop-id="'+target+'"]').hidden&&!document.querySelector('.photo-shards[data-prop-id="'+target+'"]').hidden,target);
  const broken=await page.evaluate(target=>{
    const A=__sceneArtAudit,c=MindScenePlay.cup(A.environment,'classroom:pharmaceutics',target,Date.now());
    const prop=document.querySelector('.photo-portable[data-prop-id="'+target+'"]'),shards=document.querySelector('.photo-shards[data-prop-id="'+target+'"]');return {cup:c,propHidden:prop.hidden,shardsVisible:!shards.hidden};
  },target);
  check(falling.support===null&&falling.fromZ===52&&falling.brokenUntil===0&&broken.cup.brokenUntil===falling.fallUntil+60000,'walking into the actual glass pushes it off the island, then it falls and shatters for sixty seconds',{cupBefore,falling,broken});
  check(broken.propHidden&&broken.shardsVisible,'the real scene replaces the dropped vessel with independent glass fragments',broken);
  await screenshot(page,'classroom-desktop-glass-shards');
  await page.evaluate(()=>{__sceneArtAudit.offsetMs+=60001;});
  await page.waitForFunction(target=>MindScenePlay.cup(__sceneArtAudit.environment,'classroom:pharmaceutics',target,Date.now()).removed,target);
  await page.waitForFunction(target=>document.querySelector('.photo-shards[data-prop-id="'+target+'"]').hidden,target);
  const removed=await page.evaluate(target=>{const A=__sceneArtAudit,state=MindScenePlay.restore(MindScenePlay.snapshot(A.environment,Date.now()),Date.now());return MindScenePlay.cup(state,'classroom:pharmaceutics',target,Date.now());},target);
  check(removed.removed&&removed.brokenUntil===0,'after a test-only clock advance the fragments disappear and the production snapshot retains removal',removed);
  report.scenarios.glass={target,cupBefore,falling,broken,removed,clockAdvanceMs:60001};

  const stool='prep-left-stool-8';await reposition(page,{x:185,y:420.5});
  const before=await page.evaluate(stool=>({top:document.querySelector('[data-furniture-id="'+stool+'"]').style.top,surface:MindScenePlay.scene('classroom:pharmaceutics',__sceneArtAudit.environment).surfaces.find(s=>s.id===stool)}),stool);
  await page.keyboard.down('ArrowDown');await page.waitForFunction(stool=>(__sceneArtAudit.environment.furniture['classroom:pharmaceutics#'+stool]?.dy||0)>0,stool);await page.keyboard.up('ArrowDown');
  await page.waitForFunction(({stool,top})=>document.querySelector('[data-furniture-id="'+stool+'"]').style.top!==top,{stool,top:before.top});
  const after=await page.evaluate(stool=>({top:document.querySelector('[data-furniture-id="'+stool+'"]').style.top,surface:MindScenePlay.scene('classroom:pharmaceutics',__sceneArtAudit.environment).surfaces.find(s=>s.id===stool)}),stool);
  check(after.surface.y>before.surface.y&&parseFloat(after.top)>parseFloat(before.top),'keyboard contact pushes the real lab stool and its visible atlas art follows its collision footprint',{before,after});
  await screenshot(page,'classroom-desktop-stool-pushed');report.scenarios.stool={before,after};
}
function overlaps(a,b){return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;}
async function mobile(page,width){
  const layout=await page.evaluate(()=>{
    const selectors=['.walk-joystick','.walk-jump','.walk-enter','.world-attend-button','.world-exit-button','.world-hotbar','.world-minimap','.world-zoom','.world-route-guide summary','.world-identity','.world-top-actions'];
    return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,touchAction:getComputedStyle(document.querySelector('.walk-world')).touchAction,worldStartDisplay:getComputedStyle(document.querySelector('.classroom-start')).display,rects:selectors.map(selector=>{const el=document.querySelector(selector);if(!el)return {selector,missing:true};const r=el.getBoundingClientRect();return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})};
  });
  const collisions=[];for(let i=0;i<layout.rects.length;i++)for(let j=i+1;j<layout.rects.length;j++)if(overlaps(layout.rects[i],layout.rects[j]))collisions.push([layout.rects[i].selector,layout.rects[j].selector]);
  check(!layout.overflow&&layout.touchAction==='none'&&layout.worldStartDisplay==='none'&&layout.rects.every(r=>!r.missing&&r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1&&r.right<=layout.width+1&&r.bottom<=layout.height+1)&&!collisions.length,width+'px fixed HUD controls remain visible without mutual overlap or an obscured duplicate classroom button',{layout,collisions});
  const start=await readPose(page),heading=await page.evaluate(start=>[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].find(d=>MindWalk.clear(__sceneArtAudit.walk.options.scene,start,{x:start.x+d.x*45,y:start.y+d.y*45})),start);
  if(!heading)throw Error('No open joystick direction from the real classroom spawn');
  const box=await page.locator('.walk-joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+heading.x*40,y:y+heading.y*40,id:1}]});
  await page.waitForTimeout(220);const moved=await readPose(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const stopped=await readPose(page);await page.waitForTimeout(130);const after=await readPose(page);await cdp.detach();
  check((moved.x-start.x)*heading.x+(moved.y-start.y)*heading.y>5&&after.x===stopped.x&&after.y===stopped.y&&!after.walking,width+'px real touch joystick moves and release stops immediately',{start,moved,stopped,after,heading});
  await page.locator('.walk-jump').tap();await page.waitForFunction(()=>__sceneArtAudit.pose().z>5);await page.waitForFunction(()=>__sceneArtAudit.pose().z===0&&!document.querySelector('.walk-actor').classList.contains('jumping'));
  await screenshot(page,'classroom-mobile-'+width);
  await page.locator('.world-attend-button').tap();await page.waitForFunction(()=>__sceneArtAudit.ctx.getState().session?.ids?.length===5);
  check(await page.evaluate(()=>__sceneArtAudit.ctx.getState().session.ids.length===5),width+'px attend opens the actual five-question classroom session');
  await page.evaluate(()=>__sceneArtAudit.ctx.go('home'));await page.locator('.world-exit-button').tap();
  check(await page.locator('.interior-walk[data-building="pharmaceutics"]').count()===1,width+'px leave returns to the real pharmaceutics hall');
  report.scenarios['mobile'+width]={layout,collisions,start,moved,stopped,after};
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try{
    let host=await makePage(browser,{width:1440,height:1000});try{await desktop(host.page);}finally{await host.context.close();}
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){host=await makePage(browser,viewport,true);try{await mobile(host.page,viewport.width);}finally{await host.context.close();}}
    check(report.requests.external.length===0&&report.requests.missing.length===0,'every requested game asset is local and present; no external account or multiplayer traffic',report.requests);
    check(report.pageErrors.length===0&&report.consoleErrors.length===0,'the actual game reports no JavaScript or console errors',{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors});
  }catch(error){report.executionError=error.stack||String(error);throw error;}
  finally{await browser.close();report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};fs.writeFileSync(path.join(out,'scene-browser-report.json'),JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({summary:report.summary,report:path.join(out,'scene-browser-report.json')}));if(report.summary.failed)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
