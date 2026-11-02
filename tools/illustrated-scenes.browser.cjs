/* Actual game/index.html integration of all painted scenes.
 * Localhost routes serve this checkout; external network and service workers
 * are blocked. Test-only wrappers observe the real production controllers and
 * invoke their existing portal callbacks to select each scene. Keyboard/touch
 * movement then uses the original controls. No production accounts or saves.
 * PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome
 * SCENES_BROWSER_OUT=/path/to/evidence node tools/illustrated-scenes.browser.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.SCENES_BROWSER_OUT||path.join(root,'../stage4-evidence/scenes'));
const origin='http://127.0.0.1:4173',digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const W=require('../game/campus-walk.js');
const targets=[...Object.keys(W.outdoors),...['pharmaceutics','pharmacology','herbal','battle','life'].map(id=>'hall:'+id),...Object.keys(W.classrooms).map(id=>'classroom:'+id)];
const tracked=['academy-ui.js','world-layout.js','scene-objects.js','scene-play-ui.js','scene-ambient.js','scene-ambient.css','campus-walk.js','campus-walk-ui.js','native-avatar.js'];
const report={kind:'actual game/index.html; all illustrated scenes',createdAt:new Date().toISOString(),scope:{productionHTML:true,localFixture:true,portalSelection:'existing production onPortal handlers observed by test-only factory wrappers',movement:'Playwright keyboard and CDP touch',productionAccounts:false,externalNetworkAllowed:false,serviceWorkers:'blocked',realMultiplayer:false,physicalMobileDevice:false,clock:'real RAF and keyboard/touch; Date.now offset used only to expire the existing 60s glass fragments'},sourceSHA256:Object.fromEntries(tracked.map(f=>[f,digest(fs.readFileSync(path.join(root,'game',f)))])),checks:[],screenshots:[],scenes:[],requests:{local:0,external:[],missing:[],intentional404:[]},pageErrors:[],consoleErrors:[]};
function check(condition,label,data){report.checks.push({pass:!!condition,label,...(data===undefined?{}:{data})});if(!condition)console.error('FAIL '+label+' '+JSON.stringify(data));}
async function shot(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:false});const data=fs.readFileSync(file);report.screenshots.push({file:path.basename(file),bytes:data.length,sha256:digest(data),source:'actual production game screenshot with disposable local fixture'});}
async function createPage(browser,{mobile=false,width=390,missing=false}={}){
  const context=await browser.newContext({viewport:mobile?{width,height:width===320?568:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    Object.defineProperty(Navigator.prototype,'onLine',{configurable:true,get:()=>false});
    const realNow=Date.now.bind(Date),audit={ctx:null,ui:null,walk:null,nextInitial:null,states:{},offsetMs:0,samples:[]};Date.now=()=>realNow()+audit.offsetMs;
    function observe(name,decorate){let value;Object.defineProperty(window,name,{configurable:true,get:()=>value,set:next=>{value=decorate(next);}});}
    observe('MindAcademyUI',factory=>function(ctx){audit.ctx=ctx;const result=factory(ctx);audit.ui=result;return result;});
    observe('MindWalkUI',factory=>function(options){const actual={...options,initial:audit.nextInitial||options.initial,onMotion(pose){audit.samples.push({...pose});if(audit.samples.length>2000)audit.samples.shift();options.onMotion?.(pose);}};audit.nextInitial=null;const controller=factory(actual);audit.walk={options:actual,controller};return controller;});
    observe('MindSceneUI',factory=>function(ctx){const ui=factory(ctx),render=ui.render;ui.render=function(world,scene,state,...rest){audit.states[scene]=state;return render(world,scene,state,...rest);};return ui;});
    audit.pose=()=>{const actor=document.querySelector('.walk-world>.local-actor');return actor?{x:Number(actor.dataset.x),y:Number(actor.dataset.y),z:Number(actor.dataset.z),direction:actor.dataset.direction}:null;};
    audit.reposition=point=>{audit.nextInitial=point;audit.samples=[];audit.ctx.render();document.querySelector('.walk-world')?.focus({preventScroll:true});};
    window.__paintedScenesAudit=audit;
  });
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){report.requests.external.push(url.origin+url.pathname);await route.abort('blockedbyclient');return;}
    report.requests.local++;
    if(missing&&/\/illustrated-scenes\/(campus-plaza-motion-base|campus-taiwan|classroom-herbal)\.webp$/.test(url.pathname)){
      report.requests.intentional404.push(url.pathname);await route.fulfill({status:404,body:'Intentional missing-art fixture'});return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(path.join(root,'game')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      report.requests.missing.push(url.pathname);await route.fulfill({status:404,body:'Missing asset'});return;
    }
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.pageErrors.push({missing,message:error.message}));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({intentional404:missing&&m.text().includes('404'),message:m.text()});});
  await page.goto(origin+'/game/index.html');await page.waitForFunction(()=>window.__paintedScenesAudit?.ctx&&window.MindWalk&&window.MindAdventure);
  await page.evaluate(()=>{
    const a=__paintedScenesAudit,s=a.ctx.getState();s.profile={...s.profile,name:'本機原創場景驗收',enrolled:true};s.appearance={...s.appearance,character:'doctor',pet:null};
    const ids=MindAdventure.setIds('pineapple');for(const id of ids)MindAdventure.grant(s,id);MindAdventure.equipSet(s,ids);a.ctx.go('home');
  });await ready(page);return {page,context};
}
async function ready(page){
  await page.waitForFunction(()=>{const im=document.querySelector('.walk-world>img');return im?.complete&&im.naturalWidth>0;});
  await page.waitForFunction(()=>{const a=document.querySelector('.walk-world>.local-actor');return a&&!a.classList.contains('native-actor')||a?.dataset.nativeAssetStatus==='ready';});
  await page.waitForTimeout(100);
}
async function go(page,target){
  await page.evaluate(target=>{
    const a=__paintedScenesAudit;
    if(a.walk.options.sceneId.startsWith('classroom:'))a.walk.options.onPortal('class-exit');
    if(a.walk.options.sceneId.startsWith('hall:'))a.walk.options.onPortal('exit');
    const kind=target.split(':')[0],building=target.split(':')[1],destination=['hall','classroom'].includes(kind)?'district:'+building:target;
    const route=MindWalk.travelRoute(a.walk.options.sceneId,destination);if(!route)throw Error('No original portal route to '+target);
    for(const step of route)a.walk.options.onPortal(step.portal);
    if(['hall','classroom'].includes(kind))a.walk.options.onPortal('door');
    if(kind==='classroom'){
      const day=MindEconomy.day(),room={id:day+'_'+building+'_1',number:1,day},state=a.ctx.getState();
      state.arena.economy.wallet ||= MindEconomy.freshWallet();state.arena.economy.wallet.rooms[building]=room.id;a.ui.openClass(building,room);
    }
  },target);await ready(page);
}
async function sceneSnapshot(page){return page.evaluate(()=>{
  const a=__paintedScenesAudit,scene=a.walk.options.scene,world=document.querySelector('.walk-world'),image=world.querySelector(':scope>img');
  return {id:a.walk.options.sceneId,kind:scene.kind,src:new URL(image.src).pathname,native:[image.naturalWidth,image.naturalHeight],artStatus:image.dataset.sceneArtStatus,pose:a.pose(),legal:MindWalk.walkable(scene,a.pose(),a.pose().z),movable:scene.surfaces.filter(s=>s.movable).length,props:scene.glass?.length||0,occlusions:[...world.querySelectorAll('.photo-occlusion')].map(el=>getComputedStyle(el).backgroundImage),orb:world.querySelectorAll('.plaza-orb').length,rings:world.querySelectorAll('.armillary-ring').length,jets:world.querySelectorAll('.fountain-jet').length,birds:world.querySelectorAll('.flight-bird').length,trees:world.querySelectorAll('.living-tree').length};
});}
async function keyboard(page,label){
  const heading=await page.evaluate(()=>{const a=__paintedScenesAudit,p=a.pose(),scene=a.walk.options.scene;const t=Math.SQRT1_2;return [{keys:['ArrowRight'],x:1,y:0},{keys:['ArrowLeft'],x:-1,y:0},{keys:['ArrowDown'],x:0,y:1},{keys:['ArrowUp'],x:0,y:-1},{keys:['ArrowDown','ArrowLeft'],x:-t,y:t},{keys:['ArrowDown','ArrowRight'],x:t,y:t},{keys:['ArrowUp','ArrowLeft'],x:-t,y:-t},{keys:['ArrowUp','ArrowRight'],x:t,y:-t}].find(d=>MindWalk.clear(scene,p,{x:p.x+d.x*40,y:p.y+d.y*40},p.z));});
  if(!heading)throw Error('No clear keyboard segment for '+label);
  await page.locator('.walk-world').focus();const before=await page.evaluate(()=>__paintedScenesAudit.pose());
  for(const key of heading.keys)await page.keyboard.down(key);await page.waitForTimeout(180);for(const key of heading.keys)await page.keyboard.up(key);await page.waitForTimeout(25);
  const stopped=await page.evaluate(()=>__paintedScenesAudit.pose());await page.waitForTimeout(100);const settled=await page.evaluate(()=>__paintedScenesAudit.pose());
  check(Math.hypot(stopped.x-before.x,stopped.y-before.y)>5&&stopped.x===settled.x&&stopped.y===settled.y,label+' original keyboard movement and release remain functional',{before,stopped,settled});
}
async function desktop(browser){
  const {page,context}=await createPage(browser);
  try{
    for(const target of targets){
      await go(page,target);const snapshot=await sceneSnapshot(page);report.scenes.push(snapshot);
      const expected=target==='campus'?'campus-plaza-motion-base':target.startsWith('trail:')?{south:'campus-south',west:'campus-west-garden',east:'campus-east-river'}[target.split(':')[1]]:target.replace(':','-');
      check(snapshot.src==='/game/assets/illustrated-scenes/'+expected+'.webp'&&snapshot.native.join('x')==='1536x1024'&&snapshot.artStatus==='primary',target+' actual game uses its intended original native-size plate',snapshot);
      check(snapshot.legal&&snapshot.occlusions.every(src=>src.includes('/illustrated-scenes/'+expected+'.webp')),target+' spawn is legal and fixed occlusion art comes from that same plate');
      await keyboard(page,target);await shot(page,target.replaceAll(':','-'));
    }
    await herbalInteractions(page);
    await go(page,'campus');const ambient=await sceneSnapshot(page);
    const transforms=await page.evaluate(async()=>{const selectors=['.turning-sphere>i','.ring-outer','.jet-column','.tree-crown'],properties=['backgroundPosition','transform','transform','transform'],sample=()=>selectors.map((s,i)=>getComputedStyle(document.querySelector(s))[properties[i]]),a=sample();await new Promise(r=>setTimeout(r,3500));return {selectors,properties,before:a,after:sample()};});
    check(ambient.orb===1&&ambient.rings===3&&ambient.jets===5&&ambient.birds===28&&ambient.trees===4&&transforms.before.every((value,i)=>value!==transforms.after[i]),'the new plaza retains the independently animated sphere, three rings, five jets, four tree kinds and birds',transforms);
    await page.locator('.world-minimap').click();await page.waitForSelector('.world-map-preview');
    const overview=await page.locator('.world-map-preview').evaluate(img=>({src:new URL(img.src).pathname,width:img.naturalWidth,height:img.naturalHeight}));
    check(overview.src==='/game/assets/illustrated-scenes/campus-taiwan.webp'&&overview.width===1536,'overview map uses the original painted five-district composition',overview);await shot(page,'campus-overview-modal');
  }finally{await context.close();}
}
async function herbalInteractions(page){
  await go(page,'classroom:herbal');
  await page.evaluate(()=>__paintedScenesAudit.reposition({x:159,y:440}));await ready(page);await page.locator('.walk-world').focus();
  await page.keyboard.down('ArrowUp');await page.keyboard.press('Space');await page.waitForFunction(()=>__paintedScenesAudit.pose().y<=344);await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>__paintedScenesAudit.pose().z===47&&!document.querySelector('.local-actor').classList.contains('jumping'));
  const landing=await page.evaluate(()=>{const a=__paintedScenesAudit,p=a.pose(),s=MindWalk.surface(a.walk.options.scene,p,p.z);return {pose:p,support:s?.id,height:s?.height,peak:Math.max(...a.samples.map(p=>p.z)),background:document.querySelector('.walk-world>img').src};});
  check(landing.support==='herb-sample-table-left'&&landing.height===47&&landing.peak>47,'real keyboard jump lands on the herbal sample table aligned with its drawn surface',landing);await shot(page,'herbal-classroom-on-sample-table');
  const target='herb-jar-left-2';await page.keyboard.down('ArrowDown');await page.waitForFunction(target=>MindScenePlay.cup(__paintedScenesAudit.states['classroom:herbal'],'classroom:herbal',target,Date.now()).fallUntil>Date.now(),target);await page.keyboard.up('ArrowDown');
  const falling=await page.evaluate(target=>MindScenePlay.cup(__paintedScenesAudit.states['classroom:herbal'],'classroom:herbal',target,Date.now()),target);
  await page.waitForFunction(target=>!document.querySelector('.photo-shards[data-prop-id="'+target+'"]').hidden,target);
  const broken=await page.evaluate(target=>MindScenePlay.cup(__paintedScenesAudit.states['classroom:herbal'],'classroom:herbal',target,Date.now()),target);
  check(falling.support===null&&falling.fromZ===47&&broken.brokenUntil===falling.fallUntil+60000,'contact pushes the herbal glass jar off its table; real fall creates sixty-second fragments',{falling,broken});await shot(page,'herbal-classroom-glass-shards');
  await page.evaluate(()=>{__paintedScenesAudit.offsetMs+=60001;});await page.waitForFunction(target=>document.querySelector('.photo-shards[data-prop-id="'+target+'"]').hidden,target);
  check(await page.evaluate(target=>MindScenePlay.cup(__paintedScenesAudit.states['classroom:herbal'],'classroom:herbal',target,Date.now()).removed,target),'test-only clock advance expires the fragments without replacing any player save');
  const chair='herb-chair-left-0';await page.evaluate(()=>__paintedScenesAudit.reposition({x:83,y:327}));await ready(page);await page.locator('.walk-world').focus();
  const before=await page.evaluate(chair=>({top:document.querySelector('[data-furniture-id="'+chair+'"]').style.top,surface:MindScenePlay.scene('classroom:herbal',__paintedScenesAudit.states['classroom:herbal']).surfaces.find(s=>s.id===chair)}),chair);
  await page.keyboard.down('ArrowUp');await page.waitForFunction(chair=>(__paintedScenesAudit.states['classroom:herbal'].furniture['classroom:herbal#'+chair]?.dy||0)<0,chair);await page.keyboard.up('ArrowUp');
  await page.waitForFunction(({chair,top})=>document.querySelector('[data-furniture-id="'+chair+'"]').style.top!==top,{chair,top:before.top});
  const after=await page.evaluate(chair=>({top:document.querySelector('[data-furniture-id="'+chair+'"]').style.top,surface:MindScenePlay.scene('classroom:herbal',__paintedScenesAudit.states['classroom:herbal']).surfaces.find(s=>s.id===chair)}),chair);
  check(after.surface.y<before.surface.y&&parseFloat(after.top)<parseFloat(before.top),'the movable herbal chair art follows its collision footprint after physical keyboard contact',{before,after});await shot(page,'herbal-classroom-chair-pushed');
}
async function mobile(browser,width){
  const {page,context}=await createPage(browser,{mobile:true,width});
  try{
    await go(page,'classroom:herbal');
    const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,startDisplay:getComputedStyle(document.querySelector('.classroom-start')).display,controls:['.walk-joystick','.walk-jump','.world-attend-button','.world-exit-button'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})}));
    check(!layout.overflow&&layout.startDisplay==='none'&&layout.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=layout.height+1&&r.width>0&&r.height>0),width+'px illustrated herbal classroom controls remain visible',layout);
    const start=await page.evaluate(()=>__paintedScenesAudit.pose()),direction=await page.evaluate(p=>[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].find(d=>MindWalk.clear(__paintedScenesAudit.walk.options.scene,p,{x:p.x+d.x*45,y:p.y+d.y*45})),start);
    const box=await page.locator('.walk-joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+direction.x*40,y:y+direction.y*40,id:1}]});await page.waitForTimeout(220);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(25);const stopped=await page.evaluate(()=>__paintedScenesAudit.pose());await page.waitForTimeout(100);const settled=await page.evaluate(()=>__paintedScenesAudit.pose());await cdp.detach();
    check(Math.hypot(stopped.x-start.x,stopped.y-start.y)>5&&stopped.x===settled.x&&stopped.y===settled.y,width+'px real touch joystick moves and stops on release',{start,stopped,settled});
    await page.locator('.walk-jump').tap();await page.waitForFunction(()=>__paintedScenesAudit.pose().z>5);await page.waitForFunction(()=>__paintedScenesAudit.pose().z===0);await shot(page,'herbal-classroom-mobile-'+width);
    await page.locator('.world-attend-button').tap();await page.waitForFunction(()=>__paintedScenesAudit.ctx.getState().session?.ids?.length===5);check(true,width+'px original attend button opens the five-question session');
    await page.evaluate(()=>__paintedScenesAudit.ctx.go('home'));await page.locator('.world-exit-button').tap();check(await page.locator('.interior-walk[data-building="herbal"]').count()===1,width+'px original leave button returns to the painted herbal hall');
  }finally{await context.close();}
}
async function failure(browser){
  const {page,context}=await createPage(browser,{missing:true});
  try{
    let state=await sceneSnapshot(page);check(state.artStatus==='fallback'&&state.src.endsWith('/assets/academy/campus-plaza-motion-base.webp'),'missing new plaza artwork falls back to the existing playable plate',state);
    await go(page,'classroom:herbal');state=await sceneSnapshot(page);
    check(state.artStatus==='fallback'&&state.src.endsWith('/assets/scene-objects/classroom-herbal-clean.webp')&&state.occlusions.length>0&&state.occlusions.every(s=>s.includes('/scene-objects/classroom-herbal-clean.webp')),'missing new classroom plate and fixed occlusions fall back together',state);
    await keyboard(page,'intentional missing-art classroom');
  }finally{await context.close();}
}
async function main(){
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try{await desktop(browser);for(const width of [320,390])await mobile(browser,width);await failure(browser);check(report.requests.external.length===0&&report.requests.missing.length===0,'all normal requests use present local assets; intentional failure scenarios are recorded separately',report.requests);check(report.pageErrors.length===0&&report.consoleErrors.filter(e=>!e.intentional404).length===0,'no unexpected JavaScript or console errors',{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors});}
  catch(error){report.executionError=error.stack||String(error);throw error;}
  finally{await browser.close();report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({summary:report.summary,report:path.join(out,'report.json')}));if(report.summary.failed)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
