/* Actual game UI acceptance for the ten original painted pineapple characters.
   No peers, production accounts, save reset or deployment. External requests
   are blocked by the reused Stage3 local route fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
process.env.NATIVE_BROWSER_OUT=process.env.CAST_BROWSER_OUT||path.resolve(__dirname,'../../stage4-evidence/native-cast');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPage,ready,shot,actualMotion,check,report,out,root,digest}=require('./native-avatar.browser.cjs');
const N=require('../game/native-avatar.js'),A=require('../game/academy.js');
report.kind='Stage4 ten original painted characters in actual game UI';
async function choose(page,person){
  await page.evaluate(()=>__nativeAudit.ctx.go('wardrobe'));
  const card=page.locator('.character-card').filter({has:page.getByRole('heading',{name:person.name,exact:true})}),button=card.getByRole('button');
  if(await button.isEnabled())await button.click();await page.evaluate(()=>__nativeAudit.ctx.go('home'));await ready(page);
}
async function poseProbe(page,character){
  return page.evaluate(async character=>{
    const audit=__nativeAudit,state=audit.ctx.getState(),api=MindNativeAvatar,world=document.querySelector('.walk-world'),actor=MindAvatar({node:audit.ctx.node,appearance:state.appearance,loadout:state.rpg.loadout,name:'方向姿勢檢查・合成外觀',remote:true});world.append(actor);const views=[];let time=1000;
    for(const direction of api.DIRECTIONS){
      for(const sheet of ['actions','run'])await audit.decode(api.asset(direction,sheet,character,'actor'));
      const captures=[];
      const step=async(action,extra={},duration=16,save=true)=>{time+=duration;const visual={action,moving:action==='run',turning:false,phase:0,reducedMotion:false,...extra},input={time,frameMs:duration,z:0,direction,verticalVelocity:extra.velocity??0};api.update(actor,visual,input);for(let n=0;n<40&&actor.dataset.nativeAssetStatus==='loading';n++){await new Promise(requestAnimationFrame);api.update(actor,visual,{...input,frameMs:0});}if(save)captures.push({view:actor.dataset.nativeDirection,pose:actor.dataset.nativePose,frame:Number(actor.dataset.nativeFrame),url:getComputedStyle(actor.querySelector('.native-avatar-sprite')).backgroundImage});};
      await step('idle',{},400);await step('run');await step('run',{},100,false);for(let frame=0;frame<8;frame++)await step('run',{phase:frame/8});
      await step('idle');await step('idle',{},120,false);await step('idle',{turning:true});await step('idle',{},100,false);
      await step('rise',{velocity:220});await step('rise',{velocity:10});await step('fall',{velocity:-30},16,false);await step('fall',{velocity:-220},90);await step('land');
      views.push({direction,captures});
    }
    MindAvatarMotion.dispose(actor);actor.remove();return views;
  },character);
}
async function main(){
  fs.mkdirSync(out,{recursive:true});check(Object.keys(N.CAST).length===10,'ten completed painted character registries are enabled');
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try{
    const {context,page}=await createPage(browser,{equipped:true});await ready(page);const identities=[];
    for(const person of A.CHARACTERS){
      await choose(page,person);
      const state=await page.evaluate(()=>({character:__nativeAudit.ctx.getState().appearance.character,native:document.querySelector('.local-actor').dataset.nativeAvatar,url:getComputedStyle(document.querySelector('.local-actor .native-avatar-sprite')).backgroundImage,wallet:__nativeAudit.ctx.getState().arena.coins}));
      check(state.character===person.id&&state.native===N.CAST[person.id]?.id&&state.url.includes(new URL(N.asset('down','actions',person.id,'actor'),'https://native-avatar.local/game/').href),person.id+': real character selector renders its own painted world sprite',state);
      const hud=await page.locator('.world-face[data-native-portrait] image').getAttribute('href');
      await page.evaluate(()=>__nativeAudit.ctx.go('bag'));const bag=await page.locator('.bag-avatar .native-outfit-preview image').getAttribute('href');
      await page.evaluate(()=>__nativeAudit.ctx.go('shop'));const shop=page.locator('.fruit-set-card[data-outfit-set="pineapple"]'),views=[];
      for(const direction of N.DIRECTIONS){await shop.locator('[data-outfit-view="'+direction+'"]').click();views.push(await shop.locator('.native-outfit-preview image').getAttribute('href'));}
      check(hud===bag&&bag===N.asset('down','actions',person.id)&&views.every((url,i)=>url===N.asset(N.DIRECTIONS[i],'actions',person.id)),person.id+': HUD, wardrobe and all four actual shop directions use the same character originals');
      if(['professor','herbal-mentor'].includes(person.id)){await shop.locator('[data-outfit-view="down"]').click();await shot(page,'cast-'+person.id+'-shop',shop);}
      await page.evaluate(()=>__nativeAudit.ctx.go('home'));await ready(page);await shot(page,'cast-'+person.id+'-campus');
      const poses=await poseProbe(page,person.id);check(poses.every(v=>new Set(v.captures.filter(c=>c.pose==='run').map(c=>c.frame)).size===8&&['idle','start','stop','turn','rise','apex','fall','land'].every(p=>v.captures.some(c=>c.pose===p))&&v.captures.every(c=>c.view===v.direction&&c.url.includes('/'+N.CAST[person.id].id+'/'))),person.id+': remote appearance adapter selects all eight strides and eight action poses in each independent direction',poses);
      identities.push(state);
    }
    await choose(page,A.CHARACTERS.find(c=>c.id==='professor'));await actualMotion(page);
    await page.evaluate(()=>__nativeAudit.ctx.go('bag'));await page.locator('.loadout-slot').filter({hasText:'帽子'}).click();await page.getByRole('button',{name:'卸下',exact:true}).click();await page.evaluate(()=>__nativeAudit.ctx.go('home'));await page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.layeredAssetStatus==='ready');
    const mixed=await page.evaluate(()=>({native:document.querySelector('.local-actor').classList.contains('native-actor'),character:__nativeAudit.ctx.getState().appearance.character,hat:__nativeAudit.ctx.getState().rpg.loadout.hat,plan:MindRasterOutfit.describe(__nativeAudit.ctx.getState())}));
    check(!mixed.native&&mixed.character==='professor'&&!mixed.hat&&!mixed.plan.parts.hat,'actual unequip button removes the hat and returns to truthful original segmented mixing');await shot(page,'professor-hat-removed-mixed');
    report.scenarios.characters=identities;await context.close();
    const missing=await createPage(browser,{equipped:true});await missing.context.route('**/native-avatar/pineapple-professor/actor-down-actions.webp',route=>{report.requests.intentional404.push('professor/actor-down-actions.webp');return route.fulfill({status:404,body:'Intentional new-character missing sheet'});});
    await missing.page.evaluate(()=>__nativeAudit.ctx.go('wardrobe'));await missing.page.locator('.character-card').filter({has:missing.page.getByRole('heading',{name:A.CHARACTERS.find(c=>c.id==='professor').name,exact:true})}).getByRole('button').click();await missing.page.evaluate(()=>__nativeAudit.ctx.go('home'));await missing.page.waitForFunction(()=>document.querySelector('.local-actor')?.dataset.nativeAssetStatus==='fallback');
    const fallback=await missing.page.locator('.local-actor .equipped-sprite').evaluate(el=>({wear:JSON.parse(el.dataset.loadout),images:el.querySelectorAll('img').length}));
    check(fallback.images===3&&N.SLOTS.every(s=>fallback.wear[s]==='fruit-pineapple-'+s),'a new character compact-atlas 404 retains the exact outfit in a visible fallback');await missing.context.close();
  }finally{await browser.close();}
  check(report.requests.missing.length===0,'no unintended missing local art or code',report.requests.missing);check(report.pageErrors.length===0,'no uncaught errors in the real game',report.pageErrors);
  report.sourceSHA256=Object.fromEntries(['index.html','native-avatar.js','native-avatar.css','lobby-ui.js','layered-avatar.js','adventure-ui.js',...Object.values(N.CAST).flatMap(p=>N.DIRECTIONS.flatMap(v=>['run','actions'].flatMap(k=>['assets/native-avatar/'+p.id+'/'+v+'-'+k+'.webp',...(p.compact?['assets/native-avatar/'+p.id+'/actor-'+v+'-'+k+'.webp']:[])])))].map(f=>[f,digest(fs.readFileSync(path.join(root,'game',f)))]));
  report.pass=report.checks.every(c=>c.pass);if(!report.pass)process.exitCode=1;
}
main().catch(e=>{report.fatal=e.stack;report.pass=false;process.exitCode=1;console.error(e);}).finally(()=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,screenshots:report.screenshots.length,report:path.join(out,'report.json')}));});
