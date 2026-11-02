/* Stage4 real index/app browser acceptance; isolated disposable save, no real peers/accounts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const E=require('../game/engine.js'),C=require('../game/combat.js'),A=require('../game/academy.js'),J=require('../game/journey.js'),R=require('../game/adventure.js'),Wishes=require('../game/wish.js');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.LAYERED_BROWSER_OUT||path.join(root,'../stage4-evidence/layered'));
const origin='https://layered-avatar.local',mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const report={kind:'Stage4 actual game UI with original segmented artwork and skeletal animation',createdAt:new Date().toISOString(),scope:{productionNetwork:false,productionSaves:false,physicalDevice:false,realMultiplayer:false,live60FPSClaim:false,serviceWorker:'blocked; post-publication cache integration remains a separate gate'},checks:[],screenshots:[],requests:{local:0,blockedExternal:[],missing:[],intentional404:[]},pageErrors:[],consoleErrors:[],scenarios:{}};
function check(pass,label,data){report.checks.push({label,pass:!!pass,...(data===undefined?{}:{data})});if(!pass)console.error('FAIL '+label);}
const styles=['berry','pomelo','schumann','pineapple','citrus','grape','haydn','cherry'];
const mixed=Object.fromEntries(Object.keys(R.SLOTS).map((slot,i)=>[slot,R.setIds(styles[i]).find(id=>R.gear(id).slot===slot)]));
function seed(){const s=Object.assign(E.fresh(),{arena:C.fresh(),appearance:{...A.fresh(),character:'herbal-mentor'},profile:{...J.profile(),name:'分件原畫驗收',enrolled:true},rpg:R.fresh(),wishes:Wishes.fresh()});s.xp=8900;s.companion=J.companion(undefined,s);for(const gear of R.GEAR)R.grant(s,gear.id);for(const item of E.ITEMS)s.inventory[item.id]=1;for(const [slot,id] of Object.entries(mixed))R.equip(s,id);return s;}
async function createPage(browser,{mobile=false,missing=false,equipped=false}={}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  await context.addInitScript(({save})=>{
    localStorage.setItem('mind-quest-save-v4',JSON.stringify(save));
    const audit={trace:[],imageAllocations:[],backgroundWrites:0,record:true,ui:null,ctx:null,controller:null,walk:null};window.__layeredAudit=audit;
    const OriginalImage=window.Image,src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    window.Image=function(...args){const img=new OriginalImage(...args);Object.defineProperty(img,'src',{get(){return src.get.call(img);},set(value){if(String(value).includes('/native-avatar/'))audit.imageAllocations.push(String(value));src.set.call(img,value);},configurable:true});return img;};window.Image.prototype=OriginalImage.prototype;
    audit.decode=async url=>{const image=new OriginalImage();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight};};
    const set=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(name,value,priority){if(name==='background-image'||name==='background-position')audit.backgroundWrites++;return set.call(this,name,value,priority);};
    function observe(name,decorate){let value;Object.defineProperty(window,name,{configurable:true,get:()=>value,set:next=>{value=decorate(next);}});}
    observe('MindAcademyUI',factory=>function(ctx){audit.ctx=ctx;const ui=factory(ctx);audit.ui=ui;return ui;});
    observe('MindWalkUI',factory=>function(options){audit.walk=options;const controller=factory(options);audit.controller=controller;return controller;});
    observe('MindNativeAvatar',api=>{const update=api.update;api.update=function(actor,visual,input){const handled=update(actor,visual,input);if(audit.record&&actor.classList.contains('local-actor')&&actor.dataset.nativeAssetStatus==='ready'){const body=actor.querySelector('.native-avatar-sprite'),css=body&&getComputedStyle(body);audit.trace.push({x:input.x,y:input.y,z:input.z,view:actor.dataset.nativeDirection,pose:actor.dataset.nativePose,frame:Number(actor.dataset.nativeFrame),background:css?.backgroundImage,position:css?.backgroundPosition,transform:css?.transform});}return handled;};return api;});
    observe('MindLayeredAvatar',api=>{const update=api.update;api.update=function(actor,visual,input){const handled=update(actor,visual,input);if(audit.record&&actor.classList.contains('local-actor')&&actor.dataset.layeredAssetStatus==='ready')audit.trace.push({x:input.x,y:input.y,z:input.z,view:actor.dataset.layeredDirection,pose:actor.dataset.layeredPose,frame:Number(actor.dataset.layeredFrame)});return handled;};return api;});
    audit.snap=()=>{const a=document.querySelector('.local-actor');return a?{x:Number(a.dataset.x),y:Number(a.dataset.y),z:Number(a.dataset.z),layered:a.classList.contains('layered-actor'),status:a.dataset.layeredAssetStatus,view:a.dataset.layeredDirection,pose:a.dataset.layeredPose,frame:Number(a.dataset.layeredFrame)}:null;};
  },{save:seed(equipped)});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin){report.requests.blockedExternal.push(url.origin+url.pathname);await route.abort('blockedbyclient');return;}
    report.requests.local++;
    if(missing&&url.pathname.endsWith('/avatar-raster/fruit-berry.webp')){report.requests.intentional404.push(url.pathname);await route.fulfill({status:404,body:'Intentional missing-asset fixture'});return;}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(path.join(root,'game')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){report.requests.missing.push(url.pathname);await route.fulfill({status:404,body:'Not found'});return;}
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push({scenario:missing?'intentional-404':mobile?'mobile':'desktop',message:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({scenario:missing?'intentional-404':mobile?'mobile':'desktop',message:m.text()});});
  await page.goto(origin+'/game/index.html');await page.waitForSelector('.local-actor');return {context,page};
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.layeredAssetStatus==='ready',{},{timeout:90000});}
async function shot(page,name,locator=null){const filename=name+'.png',file=path.join(out,filename);await (locator||page).screenshot({path:file,...(locator?{}:{fullPage:false})});const bytes=fs.readFileSync(file);report.screenshots.push({file:filename,bytes:bytes.length,sha256:digest(bytes)});}
async function snap(page){return page.evaluate(()=>__layeredAudit.snap());}
async function settle(page,selector='canvas.raster-outfit-preview'){
  return page.locator(selector).evaluateAll(async elements=>Promise.all(elements.map(async element=>{
    let c=element,status=element.dataset.renderStatus;
    if(element.tagName.toLowerCase()==='canvas'){await MindRasterOutfit.ready(element);status=element.dataset.renderStatus;}
    else{const image=new Image();image.src=element.querySelector('image').getAttribute('href');await image.decode();const box=element.viewBox.baseVal;c=document.createElement('canvas');c.width=Math.ceil(box.width);c.height=Math.ceil(box.height);c.getContext('2d').drawImage(image,box.x,box.y,box.width,box.height,0,0,c.width,c.height);status='ready';}
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>16)n++;return {status,painted:n,method:element.tagName.toLowerCase()};
  })));
}
async function desktop(browser){
  const {page,context}=await createPage(browser);await ready(page);
  const start=await page.evaluate(()=>({state:JSON.stringify(__layeredAudit.ctx.getState()),plan:MindRasterOutfit.describe(__layeredAudit.ctx.getState()),snapshot:__layeredAudit.snap()}));
  check(start.snapshot.layered&&Object.entries(mixed).every(([s,id])=>start.plan.items[s]===id),'real game loads the eight independently equipped items on the elder scholar',start.snapshot);
  await page.waitForFunction(()=>document.querySelector('.layered-hud-preview')?.dataset.renderStatus==='ready');
  check(await page.locator('.layered-hud-preview').count()===1,'HUD is cropped from the shared currently worn artwork');
  await shot(page,'mixed-elder-campus');
  await page.evaluate(()=>__layeredAudit.ctx.go('bag'));const bag=await settle(page,'.bag-avatar > canvas.raster-outfit-preview');
  check(bag.length===1&&bag[0].status==='ready'&&bag[0].painted>1000,'actual backpack/wardrobe preview renders the same mixed elder outfit',bag);await shot(page,'mixed-elder-wardrobe',page.locator('.bag-avatar'));
  await page.locator('.bag-sections').getByRole('button',{name:/一般背包/}).click();
  const knowledge=await settle(page,'.bag-cell canvas');
  check(knowledge.length===12&&knowledge.every(c=>c.status==='ready'&&c.painted>100),'all 12 existing knowledge-item bag icons use their actual detailed handheld artwork',knowledge);
  await page.evaluate(()=>__layeredAudit.ctx.go('shop'));
  const cards=await settle(page,'.fruit-set-card .outfit-preview');
  check(cards.length===6&&cards.every(c=>c.status==='ready'&&c.painted>1000),'all six fruit shop full-set cards use actual detailed wearable parts',cards);
  const card=page.locator('.fruit-set-card[data-outfit-set="berry"]');
  const beforeViews=await page.evaluate(()=>JSON.stringify(__layeredAudit.ctx.getState())),views=[];
  for(const direction of ['down','up','left','right']){
    await card.locator('[data-outfit-view="'+direction+'"]').click();await settle(page,'.fruit-set-card[data-outfit-set="berry"] canvas.outfit-preview');
    views.push(await card.locator('canvas.outfit-preview').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(const v of d)h=Math.imul(h^v,16777619);return {view:c.dataset.view,status:c.dataset.renderStatus,hash:h>>>0};}));
    check(await card.locator('[data-outfit-view="'+direction+'"]').getAttribute('aria-pressed')==='true','shop '+direction+' direction control reflects the displayed view');
  }
  check(views.every((v,i)=>v.view===['down','up','left','right'][i]&&v.status==='ready')&&new Set(views.map(v=>v.hash)).size===4,'four real shop direction buttons render independently authored views',views);
  check(beforeViews===await page.evaluate(()=>JSON.stringify(__layeredAudit.ctx.getState())),'turning shop previews leaves all saved state unchanged');
  await card.locator('[data-outfit-view="down"]').click();await settle(page,'.fruit-set-card[data-outfit-set="berry"] canvas.outfit-preview');
  await card.locator('details').evaluate(el=>{el.open=true;});
  const items=await settle(page,'.fruit-set-card[data-outfit-set="berry"] .fruit-piece-list canvas');
  check(items.length===8&&items.every(c=>c.status==='ready'&&c.painted>100),'all eight berry store item images contain their actual independent part pixels',items);
  await shot(page,'berry-eight-items',card);await card.locator('details').evaluate(el=>{el.open=false;});
  const coinsBefore=await page.evaluate(()=>__layeredAudit.ctx.getState().arena.coins);
  await card.getByRole('button',{name:'穿上已購整套',exact:true}).click();
  const equipped=await page.evaluate(()=>({wear:{...__layeredAudit.ctx.getState().rpg.loadout},coins:__layeredAudit.ctx.getState().arena.coins}));
  check(Object.keys(R.SLOTS).every(s=>equipped.wear[s]==='fruit-berry-'+s)&&equipped.coins===coinsBefore,'actual shop equip button wears only the owned berry set and leaves coins unchanged',equipped);
  await page.evaluate(()=>__layeredAudit.ctx.go('home'));await ready(page);await shot(page,'berry-elder-actual-game');
  const identities=[];
  for(const c of A.CHARACTERS){
    await page.evaluate(()=>__layeredAudit.ctx.go('wardrobe'));
    const row=page.locator('.character-card').filter({has:page.getByRole('heading',{name:c.name,exact:true})});
    const button=row.getByRole('button');if(await button.isEnabled())await button.click();
    await page.evaluate(()=>__layeredAudit.ctx.go('home'));await ready(page);
    identities.push(await page.evaluate(()=>({id:__layeredAudit.ctx.getState().appearance.character,body:MindRasterOutfit.body(__layeredAudit.ctx.getState().appearance.character),ready:document.querySelector('.local-actor')?.dataset.layeredAssetStatus,character:MindRasterOutfit.describe(__layeredAudit.ctx.getState()).character})));
  }
  check(identities.length===10&&identities.every((r,i)=>r.id===A.CHARACTERS[i].id&&r.id===r.character&&r.ready==='ready'),'all ten actual wardrobe character buttons reach their own detailed in-game renderer',identities);
  check(new Set(identities.map(r=>JSON.stringify(r.body))).size===10,'ten fitted skeletons retain distinct height/shoulder/hip/limb dimensions');
  await actualMotion(page);await componentCoverage(page);await context.close();
}
async function actualMotion(page){
  // Warm four views before measuring input so asynchronous image preparation is
  // not confused with movement responsiveness. The real keyboard still drives it.
  await page.evaluate(async()=>{const s=__layeredAudit.ctx.getState();for(const d of ['down','up','left','right']){const h=await MindRasterOutfit.acquire(s,d);h.release();}});
  const route=await page.evaluate(()=>{const p=__layeredAudit.snap(),scene=__layeredAudit.walk.scene;return [{key:'ArrowRight',dx:1,dy:0},{key:'ArrowLeft',dx:-1,dy:0},{key:'ArrowDown',dx:0,dy:1},{key:'ArrowUp',dx:0,dy:-1}].find(d=>MindWalk.clear(scene,p,{x:p.x+d.dx*140/(scene.scale||1),y:p.y+d.dy*140/(scene.scale||1)},p.z));});
  if(!route)throw Error('No clear keyboard test route');await page.locator('.walk-world').focus();await page.evaluate(()=>{__layeredAudit.trace=[];});
  const before=await snap(page);await page.keyboard.down(route.key);await page.waitForTimeout(700);await shot(page,'layered-keyboard-run');await page.keyboard.up(route.key);const release=await snap(page);await page.waitForTimeout(220);const stop=await snap(page),trace=await page.evaluate(()=>__layeredAudit.trace);
  check(Math.hypot(release.x-before.x,release.y-before.y)>20&&release.x===stop.x&&release.y===stop.y,'real keyboard motion stops position immediately on key release',{before,release,stop});
  check(new Set(trace.filter(f=>f.pose==='run').map(f=>f.frame)).size===8,'real distance-driven running reaches all eight articulated strides');
  check(trace.some(f=>f.pose==='start')&&trace.some(f=>f.pose==='stop')&&stop.pose==='idle','real start and stop transitions settle into idle');
  await page.evaluate(()=>{__layeredAudit.trace=[];});await page.keyboard.down('Space');await page.waitForTimeout(65);await page.keyboard.up('Space');await page.waitForTimeout(80);await shot(page,'layered-keyboard-jump');await page.waitForTimeout(900);
  const jump=await page.evaluate(()=>__layeredAudit.trace);check(['rise','apex','fall','land'].every(p=>jump.some(f=>f.pose===p)),'actual jump uses ascent, apex, descent and landing skeletal poses',Array.from(new Set(jump.map(f=>f.pose))));
}
async function componentCoverage(page){
  const result=await page.evaluate(async()=>{
    const R=MindRasterOutfit,A=__layeredAudit,base=JSON.parse(JSON.stringify(A.ctx.getState())),walletBefore=base.arena.coins;
    const variants=[],frameCoverage=[];
    for(const direction of R.DIRECTIONS){
      const handle=await R.acquire(base,direction);try{const a=handle.value,ctx=a.canvas.getContext('2d'),hashes=[];for(let i=0;i<a.count;i++){const d=ctx.getImageData(i%a.columns*a.width,Math.floor(i/a.columns)*a.height,a.width,a.height).data;let h=2166136261,n=0,edge=0;for(let p=0;p<d.length;p+=4){if(d[p+3]>16){n++;const px=p/4,x=px%a.width,y=Math.floor(px/a.width);if(x===0||y===0||x===a.width-1||y===a.height-1)edge++;}h=Math.imul(h^d[p],16777619);h=Math.imul(h^d[p+1],16777619);}hashes.push({pose:R.POSES[i][0],hash:h>>>0,painted:n,edge});}frameCoverage.push({direction,frames:hashes});}finally{handle.release();}
    }
    for(const character of MindAcademy.CHARACTERS)for(const direction of R.DIRECTIONS){const state={...base,appearance:{...base.appearance,character:character.id}};const p=R.describe(state,{direction});variants.push({character:character.id,direction,head:p.parts.head.rect,atlas:p.parts.head.atlas,items:p.items});}
    const singles=[];
    for(const item of [...MindAdventure.GEAR,...MindEngine.ITEMS.map(i=>({...i,slot:'handheld'}))])for(const direction of R.DIRECTIONS){const state={appearance:base.appearance,rpg:{loadout:{[item.slot]:item.id}}};const full=R.describe(state,{direction}),single=R.describe(state,{direction,onlySlot:item.slot});singles.push({id:item.id,direction,same:R.PARTS[item.slot].every(k=>JSON.stringify(full.parts[k])===JSON.stringify(single.parts[k]))});}
    const stateBefore=JSON.stringify(A.ctx.getState()),node=A.ctx.node,world=document.querySelector('.walk-world'),actors=[];
    A.record=false;
    for(let i=0;i<60;i++){const actor=MindAvatar({node,appearance:base.appearance,loadout:base.rpg.loadout,name:'合成外觀・非連線 '+i,remote:true});world.append(actor);actors.push(actor);MindAvatarMotion.update(actor,{x:400,y:500,z:0,time:1000,frameMs:0,scene:'synthetic-only',scale:1,direction:'down',intent:false});}
    await new Promise(resolve=>setTimeout(resolve,100));const sixty={ready:actors.filter(a=>a.dataset.layeredAssetStatus==='ready').length,cache:R.stats()};
    for(const actor of actors){MindAvatarMotion.dispose(actor);actor.remove();}A.record=true;
    return {variants,frameCoverage,singles,sixty,stateUnchanged:stateBefore===JSON.stringify(A.ctx.getState()),walletUnchanged:walletBefore===A.ctx.getState().arena.coins};
  });
  check(result.frameCoverage.every(r=>r.frames.length===24&&r.frames.every(f=>f.painted>100)),'all four views contain 24 nonblank articulated pose cells',result.frameCoverage);
  check(result.frameCoverage.every(r=>new Set(r.frames.filter(f=>f.pose==='run').map(f=>f.hash)).size===8),'all directions have eight distinct rendered stride images');
  check(result.frameCoverage.every(r=>r.frames.every(f=>f.edge===0)),'all generated actor cells preserve transparent outer padding');
  check(result.variants.length===40,'ten identities use four separately authored head views');
  check(result.singles.length===560&&result.singles.every(r=>r.same),'all 140 equipment items share the same measured wearable parts in single-item and fullwear plans, four directions');
  check(result.sixty.ready===60&&result.sixty.cache.frames.bytes<=64*1024*1024,'60 identical synthetic actors share bounded baked artwork without a real multiplayer claim',result.sixty);
  check(result.stateUnchanged&&result.walletUnchanged,'appearance probes leave the test save and coins unchanged');report.scenarios.component=result;
}
async function mobile(browser){
  const {page,context}=await createPage(browser,{mobile:true});await ready(page);
  const box=await page.locator('.walk-joystick').boundingBox(),before=await snap(page),direction=await page.evaluate(()=>{const s=__layeredAudit.snap(),scene=__layeredAudit.walk.scene;return [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].find(d=>MindWalk.clear(scene,s,{x:s.x+d.x*50,y:s.y+d.y*50},s.z));});
  const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+direction.x*42,y:y+direction.y*42,id:1}]});await page.waitForTimeout(280);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const released=await snap(page);await page.waitForTimeout(220);const after=await snap(page);
  check(Math.hypot(released.x-before.x,released.y-before.y)>3&&released.x===after.x&&released.y===after.y,'emulated mobile touch moves the actual layered character and stops on release',{before,released,after});
  await ready(page);await shot(page,'mixed-mobile-390');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.layeredAssetStatus==='ready'&&document.querySelector('.local-actor')?.dataset.layeredFrame==='0');const reduced=await snap(page);check(reduced.layered&&reduced.frame===0,'reduced-motion keeps the true equipment and neutral pose',reduced);
  await cdp.detach();await context.close();
}
async function missing(browser){
  const {page,context}=await createPage(browser,{missing:true});await page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.layeredAssetStatus==='fallback');
  const result=await page.locator('.local-actor').evaluate(el=>({fallback:el.dataset.layeredAssetStatus,layered:el.classList.contains('layered-actor'),wear:JSON.parse(el.querySelector('.equipped-sprite').dataset.loadout),images:[...el.querySelectorAll('.outfit-facing')].map(img=>img.src.startsWith('data:image/svg+xml'))}));
  check(result.fallback==='fallback'&&!result.layered&&result.images.every(Boolean)&&Object.entries(mixed).every(([slot,id])=>result.wear[slot]===id),'missing original part restores visible exact-loadout SVG without resetting the player',result);
  await page.evaluate(()=>__layeredAudit.ctx.go('bag'));await page.waitForSelector('[data-layered-fallback="asset-unavailable"]');check(await page.locator('[data-layered-fallback="asset-unavailable"]').count()>0,'failed wardrobe preview restores the same truthful SVG');await context.close();
}
async function crowd(browser){
  const {page,context}=await createPage(browser);await ready(page);
  const result=await page.evaluate(async()=>{
    const audit=__layeredAudit,R=MindRasterOutfit,base=JSON.parse(JSON.stringify(audit.ctx.getState())),before=JSON.stringify(audit.ctx.getState()),world=document.querySelector('.walk-world'),actors=[],slots=Object.keys(MindAdventure.SLOTS),styles=['berry','pomelo','citrus','grape','cherry','pineapple'],start=performance.now();audit.record=false;
    for(let i=0;i<60;i++){
      const appearance={...base.appearance,character:MindAcademy.CHARACTERS[i%10].id},loadout=Object.fromEntries(slots.map((slot,j)=>[slot,'fruit-'+styles[(Math.floor(i/10)+j)%styles.length]+'-'+slot]));
      const actor=MindAvatar({node:audit.ctx.node,appearance,loadout,name:'合成外觀測試 '+i,remote:true});world.append(actor);actors.push(actor);MindAvatarMotion.update(actor,{x:200+i%10*35,y:300+Math.floor(i/10)*35,z:0,time:1000,frameMs:0,scene:'synthetic-only',scale:1,direction:'down',intent:false});
    }
    const initiallyVisible=actors.every(a=>a.querySelector('.layered-loading-body')||a.dataset.layeredAssetStatus==='ready');
    while(actors.some(a=>a.dataset.layeredAssetStatus==='loading')&&performance.now()-start<180000)await new Promise(r=>setTimeout(r,50));
    const preparedMs=performance.now()-start,ready=actors.filter(a=>a.dataset.layeredAssetStatus==='ready').length,cache=R.stats(),costs=[];
    if(ready===60)for(let frame=0;frame<90;frame++){
      await new Promise(requestAnimationFrame);const t=performance.now();for(let i=0;i<actors.length;i++)MindAvatarMotion.update(actors[i],{x:200+i%10*35,y:300+Math.floor(i/10)*35+frame,z:0,time:2000+frame*16.7,frameMs:16.7,scene:'synthetic-only',scale:1,direction:'down',intent:true});costs.push(performance.now()-t);
    }
    const distinct=new Set(actors.map(a=>a.querySelector('canvas')?.dataset.artMethod+':'+a.dataset.layeredDirection+':'+a.dataset.layeredPose)).size;
    for(const actor of actors){MindAvatarMotion.dispose(actor);actor.remove();}audit.record=true;costs.sort((a,b)=>a-b);
    return {ready,initiallyVisible,preparedMs,cache,afterDispose:R.stats(),stateUnchanged:before===JSON.stringify(audit.ctx.getState()),updates:costs.length,p95UpdateMs:costs[Math.floor(costs.length*.95)],maximumUpdateMs:costs.at(-1),scope:'60 distinct locally constructed appearances, no network users, no FPS guarantee'};
  });
  check(result.ready===60&&result.updates===90,'60 distinct synthetic mixed outfits prepare and animate through the real avatar adapter',result);
  check(result.initiallyVisible,'first-seen outfits remain visible through the truthful existing renderer while detailed frames prepare');
  check(result.cache.frames.bytes<=64*1024*1024&&result.cache.sources.bytes<=64*1024*1024,'60 distinct appearances stay within explicit 64 MiB frame and source budgets');
  check(result.afterDispose.frames.pinned<=1&&result.stateUnchanged,'disposing synthetic crowd releases actor references and preserves the isolated test save');report.scenarios.crowd=result;await context.close();
}
async function main(){
  fs.mkdirSync(out,{recursive:true});report.sourceSHA256=Object.fromEntries(['index.html','raster-art.js','raster-outfit.js','layered-avatar.js','layered-avatar.css','cast-outfit.js','lobby-ui.js','avatar-motion.js'].map(n=>[n,digest(fs.readFileSync(path.join(root,'game',n)))]));
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try{const only=process.env.LAYERED_BROWSER_ONLY||'all';if(only==='all'||only==='desktop')await desktop(browser);if(only==='all'||only==='mobile')await mobile(browser);if(only==='all'||only==='missing')await missing(browser);if(only==='all'||only==='crowd')await crowd(browser);}finally{await browser.close();}
  check(report.requests.missing.length===0,'no unintended missing local resource',report.requests.missing);check(report.pageErrors.length===0,'no uncaught errors in actual game modules',report.pageErrors);check(report.requests.blockedExternal.every(u=>/^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-(app|auth|firestore)\.js$/.test(u)),'external requests were blocked; only the expected Firebase SDK load was attempted',report.requests.blockedExternal);report.pass=report.checks.every(c=>c.pass);if(!report.pass)process.exitCode=1;
}
main().catch(error=>{report.fatal=error.stack||String(error);report.pass=false;process.exitCode=1;console.error(report.fatal);}).finally(()=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,report:path.join(out,'report.json')}));});
