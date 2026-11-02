/* Local DOM/layout acceptance only: no Firebase, PeerJS or production accounts.
 * Requires Playwright + an installed Chromium browser.
 * Run from the repository root: node tools/mobile-controls.browser.cjs
 * PLAYWRIGHT_MODULE may point to an existing Playwright package directory.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,'game',file),'utf8');
const styles=['style.css','academy.css','daylight.css','campus-walk.css','adventure.css','scene-play.css','social.css','academy-controls.css','wardrobe.css','outfit-scene.css','photo-scene.css','character-motion.css'].map(source).join('\n');
const modules=['world-layout.js','classroom.js','scene-objects.js','campus-walk.js','engine.js','social-economy.js','wish.js','combat.js','academy.js','adventure.js','journey.js','character-motion.js','avatar-motion.js','campus-walk-ui.js','academy-ui.js'];
async function harness(page){
  await page.setContent('<!doctype html><html lang="zh-Hant"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><main id="main"></main></body></html>');
  await page.addStyleTag({content:styles});
  for(const file of modules)await page.addScriptTag({content:source(file)});
  await page.evaluate(()=>{
    const node=(tag,attrs={},...children)=>{
      const el=document.createElement(tag);
      for(const [key,value] of Object.entries(attrs)){
        if(key.startsWith('on')&&typeof value==='function')el.addEventListener(key.slice(2).toLowerCase(),value);
        else if(typeof value==='boolean'){if(value)el.setAttribute(key,'');}
        else if(value!=null)el.setAttribute(key,String(value));
      }
      for(const child of children.flat(Infinity))if(child!=null&&child!==false)el.append(child instanceof Node?child:document.createTextNode(String(child)));
      return el;
    };
    const btn=(label,click,cls='',disabled=false)=>node('button',{type:'button',onClick:click,class:'button '+cls,disabled},label);
    const note=text=>node('p',{},text),main=document.getElementById('main');
    let walk,ui,starts=0;
    const realWalk=window.MindWalkUI;
    window.MindWalkUI=options=>{walk=options;return realWalk(options);};
    window.MindAvatar=()=>node('div',{class:'walk-actor'},node('span',{},'學者'));
    window.MindSceneUI=()=>({props:()=>[],water:()=>null,birds:()=>null});
    window.MindLobbyUI=()=>({
      button:()=>node('button',{class:'world-online'},node('i',{class:'online-dot'}),node('span',{},node('strong',{},'共同大廳'),node('small',{},'第 1 大廳 · 60 人'))),
      bind(){},move(){},hide(){},disconnect(){},joinClass(){},leaveClass(){},social(){},dialog(){}
    });
    const state={...MindEngine.fresh(),arena:MindCombat.fresh(),rpg:MindAdventure.fresh(),profile:{name:'完整十六字學院暱稱手機顯示測試者'},appearance:MindAcademy.fresh(),academyProgress:{herbal:3}};
    state.companion=MindJourney.companion(undefined,state);
    const questions=Array.from({length:10},(_,i)=>({id:'layout-'+i,subject:'herbal',exam:'test',calculation:i>=5,needsReview:false,answer:0}));
    const render=()=>{main.replaceChildren(...ui.home());ui.mount();};
    ui=MindAcademyUI({node,btn,note,title(){},go(){},render,save(){},toast(){},start(){starts++;},questions,getState:()=>state,daily(){},openModal(){},closeModal(){},
      adventure:()=>({questMini:()=>node('button',{class:'world-quest'},node('span',{class:'quest-mini-symbol'},'✦'),node('span',{},node('small',{},'六 · 主線任務'),node('strong',{},'把新的知識，寫進每一天'),node('span',{},'讓學習進度清楚可見')))}),
      wishing:()=>({badge:()=>null}),economy:()=>({brief:()=>'',classes(){}}),finance:()=>({enter:()=>Promise.resolve()})});
    render();
    for(const step of MindWalk.travelRoute('campus','district:herbal'))walk.onPortal(step.portal);
    Array.from(document.querySelectorAll('button')).find(el=>el.textContent.includes('進入生藥樓')).click();
    window.__controls={state,ui,get scene(){return walk.scene;},get starts(){return starts;},classroom(){const day=MindEconomy.day(),room={id:day+'_herbal_1',number:1,day};state.arena.economy.wallet={rooms:{herbal:room.id}};ui.openClass('herbal',room);}};
  });
}
function overlap(a,b){return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;}
async function check(page,label){
  const geometry=await page.evaluate(()=>{
    const selectors=['.walk-joystick','.walk-jump','.walk-enter','.world-attend-button','.world-exit-button','.world-hotbar','.world-minimap','.world-zoom','.world-route-guide summary','.world-identity','.world-top-actions'];
    const rects=selectors.map(selector=>{const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);const r=el.getBoundingClientRect();return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
    return {rects,width:innerWidth,height:innerHeight,touchAction:getComputedStyle(document.querySelector('.walk-world')).touchAction,guideOpen:document.querySelector('.world-route-guide').open,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(geometry.touchAction,'none',label+' browser must not intercept scene drag');
  assert.equal(geometry.guideOpen,false,label+' compact guide starts closed');
  assert.equal(geometry.overflow,false,label+' horizontal overflow');
  for(const r of geometry.rects){assert(r.width>0&&r.height>0,label+' visible '+r.selector);assert(r.left>=-1&&r.top>=-1&&r.right<=geometry.width+1&&r.bottom<=geometry.height+1,label+' inside viewport '+r.selector);}
  for(let i=0;i<geometry.rects.length;i++)for(let j=i+1;j<geometry.rects.length;j++)assert(!overlap(geometry.rects[i],geometry.rects[j]),label+' overlap: '+geometry.rects[i].selector+' / '+geometry.rects[j].selector);
  const p=await page.locator('.walk-joystick').boundingBox(),cx=p.x+p.width/2,cy=p.y+p.height/2;
  const actor=page.locator('.walk-actor').first(),position=()=>actor.evaluate(el=>({x:Number(el.dataset.x),y:Number(el.dataset.y)}));
  const start=await position(),heading=await page.evaluate(start=>{const scene=window.__controls.scene;return [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].find(d=>MindWalk.clear(scene,start,{x:start.x+d.x*45,y:start.y+d.y*45}));},start),cdp=await page.context().newCDPSession(page);
  assert(heading,label+' arrival leaves an unobstructed walking direction');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+heading.x*45,y:cy+heading.y*45,id:1}]});
  await page.waitForTimeout(200);
  const moved=await position();assert((moved.x-start.x)*heading.x+(moved.y-start.y)*heading.y>0,label+' actual touch input moves along an open route: '+JSON.stringify({start,moved,heading}));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const stopped=await position();await page.waitForTimeout(120);assert.deepEqual(await position(),stopped,label+' release stops movement');
  await cdp.detach();
  const before=await page.evaluate(()=>window.__controls.starts);
  await page.locator('.world-attend-button').click();
  assert.equal(await page.evaluate(()=>window.__controls.starts),before+1,label+' attend action');
  await page.locator('.world-exit-button').click();
}
async function main(){
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});let checked=0;
  try{
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:667,height:375},{width:844,height:390}]){
      const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
      await context.route('**/*',route=>route.abort()); // Explicitly exclude live network writes.
      const page=await context.newPage();
      await harness(page);await check(page,viewport.width+'×'+viewport.height+' hall');checked++;
      await harness(page);await page.evaluate(()=>window.__controls.classroom());await check(page,viewport.width+'×'+viewport.height+' classroom');checked++;
      await context.close();
    }
  }finally{await browser.close();}
  console.log('PASS '+checked+' local DOM/layout scenarios. Physical touch, safe-area cutouts and production multiplayer are not covered.');
}
module.exports={harness,check,source,styles};
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
