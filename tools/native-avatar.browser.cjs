/* Stage 3 local acceptance against the real index.html and app.js.
 * All production-origin traffic is blocked. The wardrobe is a disposable test
 * save. Public-profile probes and the 60-avatar workload are synthetic and do
 * not establish real multiplayer, server security or physical-device FPS.
 * Run: CHROMIUM_EXECUTABLE=/path/to/chrome node tools/native-avatar.browser.cjs
 * Optional: PLAYWRIGHT_MODULE, NATIVE_BROWSER_OUT,
 * NATIVE_BROWSER_ONLY=desktop|mobile|missing (default: all).
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const E=require('../game/engine.js'),C=require('../game/combat.js'),A=require('../game/academy.js'),J=require('../game/journey.js'),R=require('../game/adventure.js'),Wishes=require('../game/wish.js');
const Native=require('../game/native-avatar.js');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.NATIVE_BROWSER_OUT||path.join(root,'../stage3-evidence/avatars'));
const selection=process.env.NATIVE_BROWSER_ONLY||'all';
const origin='https://native-avatar.local',mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const report={kind:'actual game UI with local test wardrobe; painted sprite acceptance',createdAt:new Date().toISOString(),selection,scope:{productionNetwork:false,productionSaves:false,physicalDevice:false,realMultiplayer:false,live60FPSClaim:false,remoteProfiles:'synthetic public appearance only',serviceWorker:'blocked here; lazy caching has a separate unit test'},checks:[],screenshots:[],requests:{local:0,blockedExternal:[],missing:[],intentional404:[]},pageErrors:[],consoleErrors:[],scenarios:{}};
function check(pass,label,data){report.checks.push({label,pass:!!pass,...(data===undefined?{}:{data})});if(!pass)console.error('FAIL '+label);}
function seed(equipped=false){
  const s=Object.assign(E.fresh(),{arena:C.fresh(),appearance:{...A.fresh(),character:'doctor'},profile:{...J.profile(),name:'鳳梨原畫驗收',enrolled:true},rpg:R.fresh(),wishes:Wishes.fresh()});
  s.companion=J.companion(undefined,s);for(const id of R.setIds('pineapple'))R.grant(s,id);if(equipped)R.equipSet(s,R.setIds('pineapple'));return s;
}
async function createPage(browser,{mobile=false,missing=false,equipped=false}={}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  await context.addInitScript(({save})=>{
    localStorage.setItem('mind-quest-save-v4',JSON.stringify(save));
    const audit={trace:[],imageAllocations:[],backgroundWrites:0,record:true,ui:null,ctx:null,controller:null,walk:null};window.__nativeAudit=audit;
    const OriginalImage=window.Image,src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    window.Image=function(...args){const img=new OriginalImage(...args);Object.defineProperty(img,'src',{get(){return src.get.call(img);},set(value){if(String(value).includes('/native-avatar/'))audit.imageAllocations.push(String(value));src.set.call(img,value);},configurable:true});return img;};window.Image.prototype=OriginalImage.prototype;
    audit.decode=async url=>{const image=new OriginalImage();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight};};
    const set=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(name,value,priority){if(name==='background-image'||name==='background-position')audit.backgroundWrites++;return set.call(this,name,value,priority);};
    function observe(name,decorate){let value;Object.defineProperty(window,name,{configurable:true,get:()=>value,set:next=>{value=decorate(next);}});}
    observe('MindAcademyUI',factory=>function(ctx){audit.ctx=ctx;const ui=factory(ctx);audit.ui=ui;return ui;});
    observe('MindWalkUI',factory=>function(options){audit.walk=options;const controller=factory(options);audit.controller=controller;return controller;});
    observe('MindNativeAvatar',api=>{const update=api.update;api.update=function(actor,visual,input){const handled=update(actor,visual,input);if(audit.record&&actor.classList.contains('local-actor')&&actor.dataset.nativeAssetStatus==='ready'){const body=actor.querySelector('.native-avatar-sprite'),css=body&&getComputedStyle(body);audit.trace.push({x:input.x,y:input.y,z:input.z,view:actor.dataset.nativeDirection,pose:actor.dataset.nativePose,frame:Number(actor.dataset.nativeFrame),background:css?.backgroundImage,position:css?.backgroundPosition,transform:css?.transform});}return handled;};return api;});
    audit.snap=()=>{const actor=document.querySelector('.local-actor'),body=actor?.querySelector('.native-avatar-sprite');if(!actor)return null;const css=body&&getComputedStyle(body);return {x:Number(actor.dataset.x),y:Number(actor.dataset.y),z:Number(actor.dataset.z),native:actor.classList.contains('native-actor'),status:actor.dataset.nativeAssetStatus,view:actor.dataset.nativeDirection,pose:actor.dataset.nativePose,frame:Number(actor.dataset.nativeFrame),background:css?.backgroundImage,position:css?.backgroundPosition,transform:css?.transform};};
  },{save:seed(equipped)});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin){report.requests.blockedExternal.push(url.origin+url.pathname);await route.abort('blockedbyclient');return;}
    report.requests.local++;
    if(missing&&/\/(down-actions|catalog)\.webp$/.test(url.pathname)&&url.pathname.includes('/native-avatar/')){report.requests.intentional404.push(url.pathname);await route.fulfill({status:404,body:'Intentional missing-asset fixture'});return;}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(path.join(root,'game')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){report.requests.missing.push(url.pathname);await route.fulfill({status:404,body:'Not found'});return;}
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push({scenario:missing?'intentional-404':mobile?'mobile':'desktop',message:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({scenario:missing?'intentional-404':mobile?'mobile':'desktop',message:m.text()});});
  await page.goto(origin+'/game/index.html');await page.waitForSelector('.local-actor');return {context,page};
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.nativeAssetStatus==='ready');}
async function shot(page,name,locator=null){const filename=name+'.png',file=path.join(out,filename);await (locator||page).screenshot({path:file,...(locator?{}:{fullPage:false})});const bytes=fs.readFileSync(file);report.screenshots.push({file:filename,bytes:bytes.length,sha256:digest(bytes)});}
async function snap(page){return page.evaluate(()=>__nativeAudit.snap());}
async function desktop(browser){
  const {page,context}=await createPage(browser);const first=await page.evaluate(()=>({requests:__nativeAudit.imageAllocations.slice(),wallet:__nativeAudit.ctx.getState().arena.coins}));
  check(first.requests.length===0,'unworn initial character does not preload native atlases');
  await page.getByRole('button',{name:'▱ 商城',exact:true}).click();const card=page.locator('.fruit-set-card[data-outfit-set="pineapple"]');await card.waitFor();
  const shop=await card.evaluate(async element=>{const svg=element.querySelector('.native-outfit-preview'),href=svg?.querySelector('image')?.getAttribute('href');return {native:!!svg,href,decoded:href?await __nativeAudit.decode(href):null};});
  check(shop.native&&shop.href===MindPath('down','actions')&&shop.decoded.width===1024,'real shop full-set preview uses the shipped idle atlas',shop);
  await card.locator('details').evaluate(el=>{el.open=true;});
  const catalog=await card.evaluate(async element=>{await __nativeAudit.decode(MindNativeAvatar.CATALOG.url);return [...element.querySelectorAll('[data-native-catalog]')].map(svg=>({id:svg.dataset.gearId,box:svg.getAttribute('viewBox'),href:svg.querySelector('image').getAttribute('href')}));});
  check(catalog.length===8&&catalog.every(item=>item.href===Native.CATALOG.url),'all eight real store cards use their approved garment crops',catalog);
  await shot(page,'shop-pineapple-eight-items',card);
  await card.locator('details').evaluate(el=>{el.open=false;});await shot(page,'shop-pineapple-wearable',card);
  await card.getByRole('button',{name:'穿上已購整套',exact:true}).click();
  const wearing=await page.evaluate(()=>({loadout:{...__nativeAudit.ctx.getState().rpg.loadout},wallet:__nativeAudit.ctx.getState().arena.coins}));
  check(Native.SLOTS.every(slot=>wearing.loadout[slot]==='fruit-pineapple-'+slot)&&wearing.wallet===first.wallet,'actual shop equip action wears exactly the owned eight pieces without a currency change',wearing);
  await page.locator('#nav [data-page="bag"]').click();await page.waitForSelector('.bag-avatar .native-outfit-preview');
  const wardrobe=await page.locator('.bag-avatar .native-outfit-preview image').getAttribute('href');check(wardrobe===shop.href,'wardrobe and shop share the same painted character source');await shot(page,'wardrobe-equipped',page.locator('.bag-avatar'));
  await page.locator('#nav [data-page="home"]').click();await ready(page);await page.waitForTimeout(350);
  const hud=await page.locator('.world-face[data-native-portrait] image').getAttribute('href');check(hud===shop.href,'HUD head-and-shoulders crop uses the same currently worn idle artwork');
  await shot(page,'campus-equipped');
  await actualMotion(page);await probes(page);await context.close();
}
const MindPath=(view,sheet)=>Native.asset(view,sheet);
async function actualMotion(page){
  const route=await page.evaluate(()=>{const a=__nativeAudit.snap(),W=MindWalk,scene=__nativeAudit.walk.scene,length=140/(scene.scale||1);return [{key:'ArrowRight',view:'right',dx:1,dy:0},{key:'ArrowLeft',view:'left',dx:-1,dy:0},{key:'ArrowDown',view:'down',dx:0,dy:1},{key:'ArrowUp',view:'up',dx:0,dy:-1}].find(d=>W.clear(scene,a,{x:a.x+d.dx*length,y:a.y+d.dy*length},a.z));});
  if(!route)throw Error('No clear real-game route for the keyboard motion fixture');
  await page.locator('.walk-world').focus();await page.evaluate(()=>{__nativeAudit.trace=[];});const before=await snap(page);
  await page.keyboard.down(route.key);await page.waitForTimeout(650);await shot(page,'keyboard-running');await page.keyboard.up(route.key);const released=await snap(page);await page.waitForTimeout(180);const settled=await snap(page);
  const run=await page.evaluate(()=>__nativeAudit.trace.slice());
  check(Math.hypot(released.x-before.x,released.y-before.y)>20&&released.x===settled.x&&released.y===settled.y,'real keyboard movement stops its world position immediately on release',{before,released,settled});
  check(run.some(f=>f.pose==='start')&&run.some(f=>f.pose==='run')&&run.some(f=>f.pose==='stop')&&settled.pose==='idle','actual movement uses start, run, stop and settled idle painted poses');
  check(new Set(run.filter(f=>f.pose==='run').map(f=>f.frame)).size===8,'actual traveled distance reaches all eight run cells');
  const reverse={ArrowRight:'ArrowLeft',ArrowLeft:'ArrowRight',ArrowDown:'ArrowUp',ArrowUp:'ArrowDown'}[route.key];
  // Establish a run, then deliver the reversal key pair in one browser job.
  // Separate CDP round-trips can insert a physics frame with both keys held,
  // which is an intentional stop/start and not this uninterrupted-turn case.
  // These two synthetic events still enter the unmodified production handlers;
  // ordinary movement above and jump below use Playwright's keyboard directly.
  await page.keyboard.down(reverse);await page.waitForTimeout(240);await page.evaluate(()=>{__nativeAudit.trace=[];});
  await page.evaluate(({from,to})=>{const world=document.querySelector('.walk-world');world.dispatchEvent(new KeyboardEvent('keydown',{key:to,code:to,bubbles:true,cancelable:true}));world.dispatchEvent(new KeyboardEvent('keyup',{key:from,code:from,bubbles:true,cancelable:true}));},{from:reverse,to:route.key});
  await page.keyboard.up(reverse);await page.waitForTimeout(330);
  await page.evaluate(key=>document.querySelector('.walk-world').dispatchEvent(new KeyboardEvent('keyup',{key,code:key,bubbles:true,cancelable:true})),route.key);await page.waitForTimeout(180);
  const turn=await page.evaluate(()=>__nativeAudit.trace.slice());check(turn.some(f=>f.pose==='turn')&&turn.some(f=>f.pose==='run'&&f.view===route.view),'actual mid-run reversal uses a drawn turn then the new direction run atlas');
  await page.locator('.walk-world').focus();await page.evaluate(()=>{__nativeAudit.trace=[];});await page.keyboard.press('Space');await page.waitForTimeout(360);await shot(page,'keyboard-jump');await page.waitForTimeout(1100);
  const jump=await page.evaluate(()=>__nativeAudit.trace.slice()),poses=[...new Set(jump.map(f=>f.pose))];check(['rise','apex','fall','land'].every(name=>poses.includes(name)),'real physics reaches rise, apex, fall and landing drawings',poses);
  check([...run,...turn,...jump].every(f=>f.transform==='none'),'native body uses no mirror or whole-body CSS deformation');
  report.scenarios.actualMotion={before,released,settled,reversalInput:'Atomic synthetic keydown/up pair through the production DOM handlers; ordinary movement and jump use Playwright keyboard.',runFrames:[...new Set(run.filter(f=>f.pose==='run').map(f=>f.frame))],turnPoses:[...new Set(turn.map(f=>f.pose))],jumpPoses:poses};
}
async function probes(page){
  const result=await page.evaluate(async()=>{
    const audit=__nativeAudit,api=MindNativeAvatar,state=audit.ctx.getState(),node=audit.ctx.node,world=document.querySelector('.walk-world');audit.record=false;
    const actor=MindAvatar({node,appearance:state.appearance,loadout:state.rpg.loadout,name:'合成外觀・非連線',remote:true}),self=document.querySelector('.local-actor');
    // Place the explicit synthetic sample beside the real avatar using the same
    // perspective depth, so the evidence does not compare two different scales.
    actor.style.left=(Number(self.dataset.x)+64)/MindWalk.WIDTH*100+'%';actor.style.top=Number(self.dataset.y)/MindWalk.HEIGHT*100+'%';actor.style.setProperty('--depth',self.style.getPropertyValue('--depth')||'1');actor.style.zIndex=self.style.zIndex;world.append(actor);const directions=[];
    for(const direction of api.DIRECTIONS){
      await audit.decode(api.asset(direction,'actions'));await audit.decode(api.asset(direction,'run'));let time=1000;
      const update=(action,extra={},duration=16)=>{time+=duration;api.update(actor,{action,moving:action==='run',turning:false,phase:0,reducedMotion:false,...extra},{time,frameMs:duration,z:0,direction,verticalVelocity:extra.velocity??0});};
      update('idle');for(let attempt=0;attempt<40;attempt++){await new Promise(requestAnimationFrame);update('idle',{},0);if(actor.dataset.nativeAssetStatus==='ready'&&actor.dataset.nativeDirection===direction)break;}
      const captures=[],capture=()=>{const body=actor.querySelector('.native-avatar-sprite'),css=getComputedStyle(body);captures.push({pose:actor.dataset.nativePose,frame:Number(actor.dataset.nativeFrame),view:actor.dataset.nativeDirection,url:css.backgroundImage,position:css.backgroundPosition,transform:css.transform});};
      update('idle',{},100);capture();update('run');await new Promise(requestAnimationFrame);update('run',{},16);capture();update('run',{},120);
      for(let i=0;i<8;i++){update('run',{phase:i/8});capture();}
      update('idle');capture();update('idle',{},120);update('idle',{turning:true});capture();update('idle',{},100);
      update('rise',{velocity:220});capture();update('rise',{velocity:10});capture();update('fall',{velocity:-30});update('fall',{velocity:-220},90);capture();update('land');capture();
      directions.push({direction,captures});
    }
    // Same public profile, no peers or server calls. This is a component load test.
    const beforeImages=audit.imageAllocations.length,actors=[];
    for(let i=0;i<60;i++){const remote=MindAvatar({node,appearance:state.appearance,loadout:state.rpg.loadout,name:'本地負載 '+i,remote:true});world.append(remote);actors.push(remote);MindAvatarMotion.update(remote,{x:400+i,y:500,z:0,time:1000,frameMs:0,scene:'synthetic-only',scale:1,groundZ:0,direction:'down',intent:false});}
    await new Promise(requestAnimationFrame);for(const remote of actors)MindAvatarMotion.update(remote,{x:400,y:500,z:0,time:1001,frameMs:0,scene:'synthetic-only',scale:1,groundZ:0,direction:'down',intent:false,teleport:true});
    const beforeWrites=audit.backgroundWrites;for(let tick=1;tick<=10;tick++)for(const remote of actors)MindAvatarMotion.update(remote,{x:400,y:500,z:0,time:1001+tick*16,frameMs:16,scene:'synthetic-only',scale:1,groundZ:0,direction:'down',intent:false});
    const idleWrites=audit.backgroundWrites-beforeWrites,newImages=audit.imageAllocations.length-beforeImages;for(const remote of actors){MindAvatarMotion.dispose(remote);remote.remove();}
    const local=document.querySelector('.local-actor');api.update(actor,{action:'idle',moving:false,turning:false,phase:0},{time:2000,frameMs:250,direction:'down',z:0,teleport:true});
    audit.syntheticActor=actor;return {directions,idleWrites,newImages,allocations:audit.imageAllocations.slice(),sameIdentity:local.dataset.nativeAvatar===actor.dataset.nativeAvatar};
  });
  for(const dir of result.directions){const runs=dir.captures.filter(c=>c.pose==='run'),actions=dir.captures.filter(c=>c.pose!=='run');check(new Set(runs.map(c=>c.frame)).size===8&&runs.every(c=>c.url.includes('/'+dir.direction+'-run.webp')),'synthetic public-profile renderer uses eight real run cells for '+dir.direction,dir);check(new Set(actions.map(c=>c.frame)).size===8&&actions.every(c=>c.url.includes('/'+dir.direction+'-actions.webp')),'synthetic public-profile renderer uses all eight action cells for '+dir.direction);check(dir.captures.every(c=>c.transform==='none'),'no mirrored or warped native cells for '+dir.direction);}
  check(result.sameIdentity,'self and synthetic remote component select the same exact appearance');check(result.newImages===0&&result.idleWrites===0,'60 identical synthetic avatars reuse decoded images and make no stationary background writes',{newImages:result.newImages,idleWrites:result.idleWrites,allocatedAtlasImages:result.allocations.length});
  await shot(page,'self-and-synthetic-remote');await page.evaluate(()=>{MindAvatarMotion.dispose(__nativeAudit.syntheticActor);__nativeAudit.syntheticActor.remove();__nativeAudit.record=true;});report.scenarios.synthetic=result;
}
async function mobile(browser){
  const {page,context}=await createPage(browser,{mobile:true,equipped:true});await ready(page);await page.waitForTimeout(300);
  const stick=await page.locator('.walk-joystick').boundingBox(),before=await snap(page),direction=await page.evaluate(()=>{const s=__nativeAudit.snap(),scene=__nativeAudit.walk.scene;return [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].find(d=>MindWalk.clear(scene,s,{x:s.x+d.x*50,y:s.y+d.y*50},s.z));});
  if(!stick||!direction)throw Error('Mobile fixture has no open joystick route');const cdp=await context.newCDPSession(page),x=stick.x+stick.width/2,y=stick.y+stick.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+direction.x*42,y:y+direction.y*42,id:1}]});await page.waitForTimeout(260);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const released=await snap(page);await page.waitForTimeout(180);const after=await snap(page);
  check(Math.hypot(released.x-before.x,released.y-before.y)>3&&released.x===after.x&&released.y===after.y,'real emulated touch joystick moves the painted character and stops on release',{before,released,after});check(after.native&&after.transform==='none'&&stick.width>=44&&stick.height>=44,'mobile keeps the full outfit and usable joystick without body deformation');await shot(page,'mobile-painted-character');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);const reduced=await snap(page);check(reduced.native&&reduced.pose==='idle'&&reduced.frame===0,'live reduced-motion setting retains the native outfit and neutral frame',reduced);
  report.scenarios.mobile={before,released,after,reduced,joystick:stick};await cdp.detach();await context.close();
}
async function unavailable(browser){
  const {page,context}=await createPage(browser,{missing:true,equipped:true});await page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.nativeAssetStatus==='fallback');
  const actor=await page.locator('.local-actor').evaluate(async el=>{const imgs=[...el.querySelectorAll('.outfit-facing')];await Promise.all(imgs.map(img=>img.decode()));return {fallback:el.dataset.nativeAssetStatus,legacy:!!el.querySelector('.equipped-sprite'),native:!!el.querySelector('.native-avatar-sprite'),directions:imgs.length,wear:JSON.parse(el.querySelector('.equipped-sprite').dataset.loadout)};});
  check(actor.fallback==='fallback'&&actor.legacy&&!actor.native&&actor.directions===3&&Native.SLOTS.every(slot=>actor.wear[slot]==='fruit-pineapple-'+slot),'intentional missing atlas falls back to visible, exact-loadout legacy artwork',actor);
  await page.getByRole('button',{name:'▱ 商城',exact:true}).click();const card=page.locator('.fruit-set-card[data-outfit-set="pineapple"]');await card.waitFor();await card.locator('details').evaluate(el=>{el.open=true;});await page.waitForFunction(()=>document.querySelectorAll('[data-native-fallback="catalog-unavailable"]').length>0);
  check(await card.locator('[data-native-catalog]').count()===0,'missing approved catalog also falls back instead of leaving blank shop cards');report.scenarios.intentional404=actor;await context.close();
}
async function main(){
  fs.mkdirSync(out,{recursive:true});const expected=[Native.CATALOG.url,...Native.DIRECTIONS.flatMap(view=>['run','actions'].map(sheet=>Native.asset(view,sheet)))];
  if(!['all','desktop','mobile','missing'].includes(selection))throw Error('Unknown NATIVE_BROWSER_ONLY selection');
  const missing=expected.filter(file=>!fs.existsSync(path.join(root,'game',file)));if(missing.length&&selection!=='missing')throw Error('Required painted assets are not yet present: '+missing.join(', '));
  report.sourceSHA256=Object.fromEntries(['index.html','app.js','academy-ui.js','native-avatar.js','native-avatar.css','avatar-motion.js','cast-outfit.js','lobby-ui.js',...expected.filter(file=>!missing.includes(file))].map(file=>[file,digest(fs.readFileSync(path.join(root,'game',file)))]));
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try{if(selection==='all'||selection==='desktop')await desktop(browser);if(selection==='all'||selection==='mobile')await mobile(browser);if(selection==='all'||selection==='missing')await unavailable(browser);}finally{await browser.close();}
  check(report.requests.missing.length===0,'no unintended missing production asset');check(report.pageErrors.length===0,'no uncaught browser errors in the actual app',report.pageErrors);
  report.pass=report.checks.every(row=>row.pass);if(!report.pass)process.exitCode=1;
}
main().catch(error=>{report.fatal=error.stack||String(error);report.pass=false;console.error(report.fatal);process.exitCode=1;}).finally(()=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,screenshots:report.screenshots.length,report:path.join(out,'report.json')}));});
