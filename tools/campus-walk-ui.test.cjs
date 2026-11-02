const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),W=require('../game/campus-walk.js'),M=require('../game/character-motion.js');
function fixture(options={}){
  class El extends EventTarget{constructor(){super();this.dataset={};this.hidden=false;this.isConnected=true;this.style={setProperty(){}};this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,b)=>b?this.classes.add(v):this.classes.delete(v)};}closest(){return null;}focus(){}querySelectorAll(){return [];}setPointerCapture(){}getBoundingClientRect(){return {left:0,top:0,width:1000,height:667};}}
  const joystick=new El(),joyKnob=new El();joystick.querySelector=()=>joyKnob;joystick.getBoundingClientRect=()=>({left:0,top:0,width:114,height:114});
  const jumpButton=new El();
  const actor=new El(),world=new El(),root=new El(),label=new El(),action=new El(),target=new El(),main=new El(),buttons=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].map(d=>{const b=new El();b.dataset.direction=d;return b;});
  world.querySelector=s=>s==='.walk-actor'?actor:target;root.querySelector=s=>({'.walk-jump':jumpButton,'.walk-joystick':joystick,'.walk-world':world,'.walk-status':label,'.walk-enter':action})[s];root.querySelectorAll=s=>s==='.walk-direction'?buttons:[];root.contains=e=>[world,root,action,jumpButton,...buttons].includes(e);
  const document=new El(),window=new El();window.MindWalk=W;document.body=new El();document.hidden=false;document.modal=false;document.querySelector=()=>document.modal?{}:null;document.getElementById=()=>main;
  let time=0,id=0,position=null,portals=[],verticalChange=0,motionState=M.create(),disposals=0;const frames=new Map(),wire=[],motionInputs=[];
  const motionPreference=new El();motionPreference.matches=options.reducedMotion===true;
  window.performance={now:()=>time};window.matchMedia=()=>motionPreference;
  if(options.motion!==false)window.MindAvatarMotion={update(node,input){assert.equal(node,actor);assert.equal(disposals,0);motionInputs.push({...input});motionState=M.update(motionState,input);actor.classList.toggle('walking',motionState.visual.moving&&!motionState.visual.reducedMotion);return motionState.visual;},needsFrame:()=>motionState.visual.needsFrame,dispose(node){assert.equal(node,actor);disposals++;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/campus-walk-ui.js'),'utf8'),{window,document,AbortController,requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  const ui=window.MindWalkUI({root,scene:options.scene||W.hall('room'),sceneId:options.sceneId,initial:options.initial,onPosition:p=>position=p,onPortal:id=>portals.push(id),onMotion:p=>wire.push({...p})});
  function fire(el,type,attrs={}){const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries(attrs))Object.defineProperty(e,k,{value:v});el.dispatchEvent(e);return e;}
  function tick(n=30){for(let i=0;i<n;i++){const before=Number(actor.dataset.z);time+=1000/(options.hz||60);const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));verticalChange=Number(actor.dataset.z)-before;}}
  return {ui,root,world,actor,action,label,jumpButton,joystick,joyKnob,document,window,buttons,fire,tick,frames,portals,wire,motionInputs,motion:()=>motionState.visual,disposals:()=>disposals,setReduced(value){motionPreference.matches=value;fire(motionPreference,'change');},verticalChange:()=>verticalChange,point:()=>({x:Number(actor.dataset.x),y:Number(actor.dataset.y)}),position:()=>position};
}
test('held keyboard moves; keyup, blur and modal opening stop movement without a stuck key',()=>{
  const f=fixture(),start=f.point();f.fire(f.document,'keydown',{key:'ArrowLeft',target:f.world});f.tick(20);assert.ok(f.point().x<start.x);
  f.fire(f.document,'keyup',{key:'ArrowLeft'});const released=f.point();f.tick(20);assert.deepEqual(f.point(),released);
  f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});f.tick(10);f.fire(f.window,'blur');const blurred=f.point();f.tick(20);assert.deepEqual(f.point(),blurred);
  f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});f.document.modal=true;f.tick();f.document.modal=false;const paused=f.point();f.tick();assert.deepEqual(f.point(),paused);f.ui.destroy();
});
test('touch cancellation and leaving a scene release input and animation listeners',()=>{
  const f=fixture(),start=f.point(),b=f.buttons[3];f.fire(b,'pointerdown',{button:0,pointerId:1});f.tick(20);assert.ok(f.point().x>start.x);f.fire(b,'pointercancel',{pointerId:1});const canceled=f.point();f.tick();assert.deepEqual(f.point(),canceled);
  f.ui.destroy();assert.equal(f.frames.size,0);assert.ok(f.position());f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick();assert.deepEqual(f.point(),canceled);
});
test('walking through an exit activates once and cancels the old animation loop',()=>{
  const f=fixture();f.ui.toward(W.hall('room').portals.find(p=>p.id==='exit'));f.tick(250);assert.deepEqual(f.portals,['exit']);assert.equal(f.frames.size,0);f.tick();assert.deepEqual(f.portals,['exit']);
});

test('jumping reaches the actual window desk, lands on it and drops back to the ground when walking off',()=>{const scene=W.hall('room'),desk=scene.surfaces.find(s=>s.id==='ntu-window-desk'),f=fixture({scene,initial:{x:desk.x,y:Math.max(...desk.polygon.map(p=>p.y))+45}});f.fire(f.document,'keydown',{key:' ',target:f.world});f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick(23);f.fire(f.document,'keyup',{key:'ArrowUp'});assert(Number(f.actor.dataset.z)>desk.height);assert(W.surface(scene,f.point()));f.tick(65);assert.equal(Number(f.actor.dataset.z),desk.height);f.fire(f.document,'keydown',{key:'ArrowDown',target:f.world});f.tick(30);f.fire(f.document,'keyup',{key:'ArrowDown'});f.tick(60);assert.equal(Number(f.actor.dataset.z),0);f.ui.destroy();});

test('the left laboratory counter is reachable and repeated jumps land on each shelf without teleporting upward',()=>{
  const scene=W.hall('room','pharmacology'),f=fixture({scene,initial:{x:56,y:500}}),jump=()=>f.fire(f.document,'keydown',{key:' ',target:f.world});
  f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick(15);assert.equal(Number(f.actor.dataset.z),0);assert(f.point().y>=482); // Cannot walk into the cabinet.
  jump();f.tick(31);f.fire(f.document,'keyup',{key:'ArrowUp'});assert(W.inside(f.point(),scene.surfaces.find(s=>s.id==='lab-shelf-0').polygon));f.tick(65);assert.equal(Number(f.actor.dataset.z),90);
  for(const height of [170,237,309]){jump();f.tick(6);assert(Number(f.actor.dataset.z)<height);f.tick(80);assert.equal(Number(f.actor.dataset.z),height);}
  f.fire(f.document,'keydown',{key:'ArrowDown',target:f.world});f.tick(35);f.fire(f.document,'keyup',{key:'ArrowDown'});f.tick(110);assert.equal(Number(f.actor.dataset.z),0);assert(W.walkable(scene,f.point()));f.ui.destroy();
});
test('the illustrated window bench also supports a jump and blocks floor-level walking',()=>{
  const scene=W.hall('room','pharmacology'),f=fixture({scene,initial:{x:250,y:480}});
  f.fire(f.document,'keydown',{key:' ',target:f.world});f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick(18);f.fire(f.document,'keyup',{key:'ArrowUp'});f.tick(70);assert.equal(Number(f.actor.dataset.z),55);assert.equal(W.surface(scene,f.point(),55).id,'window-bench');f.ui.destroy();
});

test('selecting the market stall walks to it and activates once',()=>{const shop=W.campus.portals.find(p=>p.id==='shop'),f=fixture({scene:W.campus,initial:W.campus.spawn});f.ui.toward(shop);f.tick(350);assert.deepEqual(f.portals,['shop']);assert(W.distance(f.point(),shop)<10);f.tick(180);assert.deepEqual(f.portals,['shop']);f.ui.destroy();assert.equal(f.frames.size,0);});
test('walking past the market does not open it; Enter at the counter does',()=>{const shop=W.campus.portals.find(p=>p.id==='shop'),f=fixture({scene:W.campus,initial:W.campus.spawn});f.ui.toward({x:shop.x,y:shop.y});f.tick(350);assert.deepEqual(f.portals,[]);f.fire(f.document,'keydown',{key:'Enter',target:f.world});assert.deepEqual(f.portals,['shop']);f.tick(120);assert.deepEqual(f.portals,['shop']);f.ui.destroy();});

test('drag anywhere touch movement stops on release, cancellation, modal and blur without a synthetic click restart',()=>{
 const f=fixture(),down=(id=10)=>f.fire(f.world,'pointerdown',{pointerType:'touch',pointerId:id,clientX:500,clientY:550}),drag=(x,y,id=10)=>f.fire(f.world,'pointermove',{pointerType:'touch',pointerId:id,clientX:x,clientY:y});
 const start=f.point();down();drag(560,550);f.tick(15);assert(f.point().x>start.x);f.fire(f.world,'pointerup',{pointerId:10});const stopped=f.point();f.fire(f.world,'click',{clientX:560,clientY:550});f.tick(20);assert.deepEqual(f.point(),stopped);
 down();drag(440,550);f.tick(10);f.fire(f.world,'pointercancel',{pointerId:10});const canceled=f.point();f.tick(20);assert.deepEqual(f.point(),canceled);
 down();drag(560,550);f.fire(f.window,'blur');const blurred=f.point();f.tick();assert.deepEqual(f.point(),blurred);
 down();drag(560,550);f.document.modal=true;f.tick();f.document.modal=false;const paused=f.point();f.tick();assert.deepEqual(f.point(),paused);f.ui.destroy();
});
test('a stationary long press does not start an unintended route; UI buttons do not start steering',()=>{
 const f=fixture(),start=f.point();f.fire(f.world,'pointerdown',{pointerType:'touch',pointerId:9,clientX:500,clientY:550});f.tick(20);f.fire(f.world,'pointerup',{pointerId:9});f.tick();assert.deepEqual(f.point(),start);
 const button={closest:()=>({})};f.fire(f.world,'pointerdown',{target:button,pointerType:'touch',pointerId:8,clientX:500,clientY:550});f.fire(f.world,'pointermove',{pointerId:8,clientX:600,clientY:550});f.tick();assert.deepEqual(f.point(),start);f.ui.destroy();
});
test('a short tap still walks to ground and ignores the second finger during an active drag',()=>{
 const f=fixture();f.fire(f.world,'pointerdown',{pointerType:'touch',pointerId:4,clientX:540,clientY:590});f.fire(f.world,'pointerup',{pointerId:4});f.tick(50);assert(Math.abs(f.point().x-540)<1);
 f.fire(f.world,'pointerdown',{pointerType:'touch',pointerId:4,clientX:500,clientY:550});f.fire(f.world,'pointermove',{pointerId:4,clientX:450,clientY:550});f.fire(f.world,'pointerdown',{pointerType:'touch',pointerId:5,clientX:600,clientY:550});f.fire(f.world,'pointerup',{pointerId:5});const old=f.point();f.tick(10);assert(f.point().x<old.x);f.fire(f.world,'pointerup',{pointerId:4});f.ui.destroy();
});

test('targeting the herbal stairs does not activate the neighboring classroom first',()=>{const scene=W.hall('知識教室','herbal'),f=fixture({scene});f.ui.toward(scene.portals.find(p=>p.id==='stairs'));f.tick(400);assert.deepEqual(f.portals,['stairs']);f.ui.destroy();});

test('closing a classroom entrance menu preserves movement and can reach stairs',()=>{const scene=W.hall('知識教室','herbal'),f=fixture({scene});f.ui.toward(scene.portals.find(p=>p.id==='room'));f.tick(400);assert.deepEqual(f.portals,['room']);f.document.modal=true;f.tick();f.document.modal=false;f.ui.toward(scene.portals.find(p=>p.id==='stairs'));f.tick(400);assert.deepEqual(f.portals,['room','stairs']);f.ui.destroy();});

test('fixed joystick moves diagonally, clamps knob and returns to center on release',()=>{
 const f=fixture(),down=(id=1)=>f.fire(f.joystick,'pointerdown',{pointerType:'touch',pointerId:id,clientX:57,clientY:57}),move=(x,y,id=1)=>f.fire(f.joystick,'pointermove',{pointerId:id,clientX:x,clientY:y});
 const start=f.point();down();f.tick(10);assert.deepEqual(f.point(),start);move(200,200);f.tick(10);assert(f.point().x>start.x&&f.point().y>start.y);assert(f.joystick.classes.has('held'));
 const offsets=f.joyKnob.style.transform.match(/[-\d.]+/g).map(Number);assert(Math.hypot(...offsets)<=34.01);
 f.fire(f.joystick,'pointerup',{pointerId:1});const end=f.point();f.tick(15);assert.deepEqual(f.point(),end);assert.equal(f.joyKnob.style.transform,'');assert(!f.joystick.classes.has('held'));f.ui.destroy();
});
test('fixed joystick ignores other fingers and stops on cancellation, modal, blur and scene exit',()=>{
 const f=fixture(),down=()=>f.fire(f.joystick,'pointerdown',{pointerType:'touch',pointerId:1,clientX:57,clientY:57}),move=()=>f.fire(f.joystick,'pointermove',{pointerId:1,clientX:100,clientY:57});
 down();move();f.fire(f.joystick,'pointerdown',{pointerType:'touch',pointerId:2,clientX:0,clientY:57});f.fire(f.joystick,'pointerup',{pointerId:2});const initial=f.point();f.tick(8);assert(f.point().x>initial.x);
 for(const type of ['pointercancel','lostpointercapture']){f.fire(f.joystick,type,{pointerId:1});const p=f.point();f.tick(8);assert.deepEqual(f.point(),p);assert.equal(f.joyKnob.style.transform,'');down();move();}
 f.fire(f.window,'blur');const blur=f.point();f.tick();assert.deepEqual(f.point(),blur);down();move();f.document.modal=true;f.tick();f.document.modal=false;const paused=f.point();f.tick();assert.deepEqual(f.point(),paused);down();move();f.ui.destroy();assert.equal(f.frames.size,0);assert.equal(f.joyKnob.style.transform,'');
});


test('cancelled doorway navigation cannot reopen an interaction after Escape or blur',()=>{
 for(const type of ['Escape','blur']){const scene=W.hall('room'),door=scene.portals.find(p=>p.id==='room'),f=fixture({scene,initial:door});f.ui.toward(door);if(type==='Escape')f.fire(f.document,'keydown',{key:'Escape',target:f.world});else f.fire(f.window,'blur');f.tick(5);assert.deepEqual(f.portals,[],type);f.ui.destroy();}
});
test('a newly moved table cannot be crossed by the final route snap',()=>{
 const scene={kind:'hall',spawn:{x:500,y:590},areas:[[{x:0,y:0},{x:1000,y:0},{x:1000,y:667},{x:0,y:667}]],surfaces:[],paths:[],nodes:[],portals:[]},f=fixture({scene});
 f.ui.toward({x:502,y:590});f.tick(1);
 scene.surfaces.push({id:'table',x:502,y:590,height:52,polygon:[{x:501,y:589},{x:503,y:589},{x:503,y:591},{x:501,y:591}]});
 f.tick(1);assert(W.walkable(scene,f.point()),'the last step must recheck the live furniture footprint');f.tick(20);assert(W.walkable(scene,f.point()));f.ui.destroy();
});
test('autowalking recalculates a route when a moved table blocks an existing segment',()=>{
 const scene={kind:'hall',spawn:{x:500,y:590},areas:[[{x:0,y:0},{x:1000,y:0},{x:1000,y:667},{x:0,y:667}]],surfaces:[],paths:[],nodes:[],portals:[]},f=fixture({scene});
 f.ui.toward({x:610,y:590});f.tick(1);scene.surfaces.push({id:'table',x:550,y:590,height:52,polygon:[{x:535,y:575},{x:565,y:575},{x:565,y:605},{x:535,y:605}]});
 for(let i=0;i<150;i++){f.tick(1);assert(W.walkable(scene,f.point()));}assert(W.distance(f.point(),{x:610,y:590})<.2);f.ui.destroy();
});
test('selecting a destination releases an earlier joystick gesture',()=>{
 const f=fixture();f.fire(f.joystick,'pointerdown',{pointerType:'touch',pointerId:1,clientX:57,clientY:57});f.fire(f.joystick,'pointermove',{pointerId:1,clientX:100,clientY:57});f.tick(6);const start=f.point();f.ui.toward({x:start.x-20,y:start.y});f.tick(40);assert(f.point().x<start.x);assert.equal(f.joyKnob.style.transform,'');f.ui.destroy();
});

test('Space on a focused button keeps native keyboard activation instead of jumping',()=>{
 const f=fixture(),button=f.buttons[0];button.closest=selector=>selector.includes('button')?{}:null;
 const event=f.fire(f.document,'keydown',{key:' ',target:button});f.tick(12);assert.equal(event.defaultPrevented,false);assert.equal(Number(f.actor.dataset.z),0);f.ui.destroy();
});

test('fixed-fixture observations reuse the contextual button and E/Enter without automatic activation or ending movement',()=>{
 const base=W.hall('room'),scene={...base,portals:[],inspections:[{...base.spawn,id:'fixture:wood-cabinet',name:'木質櫥櫃',kind:'inspect',verb:'觀察',auto:false}]},f=fixture({scene});
 assert.equal(f.action.disabled,false);assert.equal(f.action.textContent,'觀察 木質櫥櫃');f.tick(100);assert.deepEqual(f.portals,[],'standing nearby must not open a dialog');
 f.fire(f.document,'keydown',{key:'Enter',target:f.world});assert.deepEqual(f.portals,['fixture:wood-cabinet']);assert(f.frames.size>0);f.document.modal=true;f.tick(3);f.document.modal=false;
 f.fire(f.action,'click');assert.equal(f.portals.length,2);f.fire(f.document,'keydown',{key:'e',target:f.world});assert.equal(f.portals.length,3);f.fire(f.document,'keydown',{key:'e',target:f.world,repeat:true});assert.equal(f.portals.length,3,'a held interaction key cannot reopen the observation');
 const before=f.point();f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});f.tick(10);f.fire(f.document,'keyup',{key:'ArrowRight'});assert(f.point().x>before.x);f.ui.destroy();
});

test('entrance actions take precedence over a closer fixed-fixture observation',()=>{
 const base=W.hall('room'),scene={...base,portals:[{...base.spawn,x:base.spawn.x+8,id:'room',name:'教室入口',kind:'inspect',auto:false}],inspections:[{...base.spawn,id:'fixture:cabinet',name:'固定書櫃',kind:'inspect',verb:'觀察',auto:false}]},f=fixture({scene});
 assert.equal(f.action.textContent,'進入 教室入口');f.fire(f.document,'keydown',{key:'Enter',target:f.world});assert.deepEqual(f.portals,['room']);f.ui.destroy();
});

test('opening an observation releases held movement and closing it cannot resume an old keyboard or touch gesture',()=>{
 for(const input of ['keyboard','joystick','drag','direction']){
  const base=W.hall('room'),scene={...base,portals:[],inspections:[{...base.spawn,id:'fixture:cabinet',name:'固定書櫃',kind:'inspect',verb:'觀察',auto:false}]},f=fixture({scene});
  if(input==='keyboard')f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});
  else if(input==='joystick'){f.fire(f.joystick,'pointerdown',{pointerType:'touch',pointerId:5,clientX:57,clientY:57});f.fire(f.joystick,'pointermove',{pointerId:5,clientX:100,clientY:57});}
  else if(input==='drag'){f.fire(f.world,'pointerdown',{pointerType:'touch',pointerId:5,clientX:500,clientY:550});f.fire(f.world,'pointermove',{pointerId:5,clientX:550,clientY:550});}
  else f.fire(f.buttons[3],'pointerdown',{button:0,pointerId:5});
  f.tick(3);f.fire(f.action,'click');assert.deepEqual(f.portals,['fixture:cabinet'],input);const stopped=f.point();
  f.document.modal=true;f.tick(8);assert.deepEqual(f.point(),stopped);f.document.modal=false;f.tick(8);assert.deepEqual(f.point(),stopped);
  f.fire(f.world,'pointerup',{pointerId:5});f.fire(f.joystick,'pointerup',{pointerId:5});f.fire(f.buttons[3],'pointerup',{pointerId:5});f.fire(f.document,'keyup',{key:'ArrowRight'});f.tick(8);assert.deepEqual(f.point(),stopped);assert.equal(f.joyKnob.style.transform,'');assert(!f.actor.classes.has('walking'));assert(f.frames.size>0);
  f.fire(f.document,'keydown',{key:'ArrowLeft',target:f.world});f.tick(8);assert(f.point().x<stopped.x);f.ui.destroy();
 }
});

test('keyboard activation of a direction button takes one step and clears walking and movement on the next frame',()=>{
 const f=fixture(),start=f.point();f.fire(f.buttons[3],'click',{detail:0});assert(f.point().x>start.x);assert(f.actor.classes.has('walking'));assert.equal(f.wire.at(-1).moving,true);assert.equal(f.motionInputs.at(-1).frameMs,50);
 const end=f.point();f.tick(1);assert.deepEqual(f.point(),end);assert(!f.actor.classes.has('walking'));assert.equal(f.wire.at(-1).moving,false);
 f.tick(20);assert.deepEqual(f.point(),end);assert(!f.actor.classes.has('walking'));f.ui.destroy();
});

test('releasing the final movement key publishes stopped state immediately without canceling another held direction',()=>{
 const f=fixture();f.fire(f.document,'keydown',{key:'ArrowLeft',target:f.world});f.fire(f.document,'keydown',{key:'ArrowDown',target:f.world});f.tick(8);
 f.fire(f.document,'keyup',{key:'ArrowLeft'});assert.equal(f.wire.at(-1).moving,true);assert(f.actor.classes.has('walking'));const turning=f.point();f.tick(4);assert(f.point().y>turning.y);
 const stopped=f.point(),before=f.wire.length;f.fire(f.document,'keyup',{key:'ArrowDown'});assert.equal(f.wire.length,before+1);assert.equal(f.wire.at(-1).moving,false);assert(!f.actor.classes.has('walking'));assert.deepEqual(f.point(),stopped);
 f.tick(20);assert.deepEqual(f.point(),stopped);f.ui.destroy();
});

function jumpTestRoom(withDesk=false){return {kind:'hall',scale:1,spawn:{x:500,y:540},areas:[[{x:0,y:0},{x:1000,y:0},{x:1000,y:667},{x:0,y:667}]],blocked:[],nodes:[],paths:[],portals:[],surfaces:withDesk?[{id:'training-chair',x:500,y:480,height:22,jumpAssist:true,movable:true,polygon:[{x:465,y:460},{x:535,y:460},{x:535,y:500},{x:465,y:500}]}]:[]};}
function until(f,predicate,limit=500){for(let i=0;i<limit&&!predicate();i++)f.tick(1);assert(predicate(),'simulation must reach the expected state');}
// Observe the displayed elevation between real animation ticks; do not expose
// internal vertical velocity or depend on a character renderer/motion adapter.
const elevation=f=>Number(f.actor.dataset.z),rising=f=>f.verticalChange()>0,falling=f=>f.verticalChange()<0;
function requestJump(f,method='keyboard'){if(method==='mobile')f.fire(f.jumpButton,'click');else f.fire(f.document,'keydown',{key:' ',target:f.world});}
function reachLedge(hz){const f=fixture({hz,scene:jumpTestRoom(true)});f.tick(1);requestJump(f);f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});until(f,()=>f.point().y<=490);f.fire(f.document,'keyup',{key:'ArrowUp'});f.tick(hz*2);assert.equal(elevation(f),22);f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});until(f,()=>f.point().x>535);f.fire(f.document,'keyup',{key:'ArrowRight'});assert(elevation(f)>0);return f;}

test('keyboard and mobile jump requests buffer once within 120 ms of landing at 30/60/120 Hz',()=>{
 for(const hz of [30,60,120])for(const method of ['keyboard','mobile']){
  const f=fixture({hz,scene:jumpTestRoom()});f.tick(1);requestJump(f,method);until(f,()=>falling(f)&&elevation(f)<24);
  requestJump(f,method);f.tick(Math.ceil(hz*.18));assert(rising(f)&&elevation(f)>0,`${method} ${hz}: buffered landing should launch once`);
  f.tick(hz*2);assert.equal(elevation(f),0);assert.equal(f.verticalChange(),0);f.ui.destroy();
 }
});

test('expired jump requests and held Space cannot create double jumps or repeated landing bounces',()=>{
 for(const hz of [30,60,120]){
  const f=fixture({hz,scene:jumpTestRoom()});f.tick(1);requestJump(f);f.tick(Math.ceil(hz*.07));requestJump(f);
  until(f,()=>falling(f)&&elevation(f)<70);requestJump(f);
  let peak=0;for(let i=0;i<hz*2;i++){f.fire(f.document,'keydown',{key:' ',target:f.world,repeat:true});f.tick(1);peak=Math.max(peak,elevation(f));}
  assert(peak<70,'a held key must not renew the buffered press');assert.equal(elevation(f),0);assert.equal(f.verticalChange(),0);f.ui.destroy();
 }
});

test('coyote jumping works briefly after leaving a chair, expires after 100 ms and adds no horizontal inertia',()=>{
 for(const hz of [30,60,120])for(const late of [false,true]){
  const f=reachLedge(hz),stop=f.point();f.tick(Math.ceil(hz*(late?.15:.05)));const before=elevation(f);assert(before>0);assert.deepEqual(f.point(),stop);
  requestJump(f,'mobile');f.tick(1);assert.deepEqual(f.point(),stop);
  if(late){assert(!rising(f),`${hz}: the 100 ms coyote window must expire`);assert(elevation(f)<before);}else{assert(rising(f),`${hz}: coyote jump should launch`);assert(elevation(f)>before);}
  f.ui.destroy();
 }
});

test('blur, modal opening and leaving the scene cancel a queued landing jump',()=>{
 for(const cancel of ['blur','modal','destroy']){
  const f=fixture({scene:jumpTestRoom()});f.tick(1);requestJump(f);until(f,()=>falling(f)&&elevation(f)<24);requestJump(f,'mobile');
  if(cancel==='blur')f.fire(f.window,'blur');else if(cancel==='modal'){f.document.modal=true;f.tick(3);f.document.modal=false;}else f.ui.destroy();
  if(cancel==='destroy'){const stopped=elevation(f);f.tick(150);assert.equal(elevation(f),stopped);assert.equal(f.frames.size,0);}
  else{f.tick(150);assert.equal(elevation(f),0);assert.equal(f.verticalChange(),0);assert.equal(f.wire.at(-1).moving,false);f.ui.destroy();}
 }
});

test('motion samples follow actual wall-slide displacement while movement packets retain input intent',()=>{
 const scene={...jumpTestRoom(),spawn:{x:500,y:500},blocked:[[{x:501,y:400},{x:600,y:400},{x:600,y:650},{x:501,y:650}]]},f=fixture({scene,sceneId:'hall:herbal:practice'}),start=f.point();
 f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});f.fire(f.document,'keydown',{key:'ArrowDown',target:f.world});f.tick(20);
 assert.equal(f.point().x,start.x);assert(f.point().y>start.y);assert.equal(f.motion().targetHeading,'down');assert.equal(f.motion().action,'run');assert.equal(f.wire.at(-1).direction,'right');assert.equal(f.wire.at(-1).moving,true);
 assert.equal(f.motionInputs.at(-1).x,f.wire.at(-1).x);assert.equal(f.motionInputs.at(-1).y,f.wire.at(-1).y);
 f.fire(f.document,'keyup',{key:'ArrowDown'});f.tick(3);assert.equal(f.wire.at(-1).moving,true);assert.equal(f.motion().moving,false);assert.equal(f.motion().action,'push');assert(!f.actor.classes.has('walking'));
 f.fire(f.document,'keyup',{key:'ArrowRight'});assert.equal(f.wire.at(-1).moving,false);assert.equal(f.motion().action,'idle');const stopped=f.point();f.tick(40);assert.deepEqual(f.point(),stopped);f.ui.destroy();
});

test('mount resets the visual scene and a stopped turn settles without extra movement packets or idle redraws',()=>{
 const f=fixture({sceneId:'hall:herbal:calculation'});assert.equal(f.motionInputs.length,1);assert.equal(f.motionInputs[0].teleport,true);assert.equal(f.motionInputs[0].scene,'hall:herbal:calculation');assert.equal(f.motion().phase,0);
 f.tick(12);assert.equal(f.motionInputs.length,1);f.fire(f.document,'keydown',{key:'ArrowLeft',target:f.world});f.tick(4);f.fire(f.document,'keyup',{key:'ArrowLeft'});
 const stopped=f.point(),packets=f.wire.length;assert.equal(f.motion().action,'idle');assert.equal(f.motion().needsFrame,true);f.tick(40);assert.equal(f.motion().needsFrame,false);assert.deepEqual(f.point(),stopped);assert.equal(f.wire.length,packets);
 const settled=f.motionInputs.length;f.tick(40);assert.equal(f.motionInputs.length,settled);assert(f.motionInputs.slice(1).every(input=>input.teleport===false));f.ui.destroy();assert.equal(f.disposals(),1);
 const next=fixture({sceneId:'hall:herbal:exam'});assert.equal(next.motionInputs[0].scene,'hall:herbal:exam');assert.equal(next.motionInputs[0].teleport,true);assert.equal(next.motion().phase,0);assert.equal(next.motion().needsFrame,false);next.ui.destroy();
});

test('reversing after idle uses one display frame and modal turn completion adds no movement packets',()=>{
 for(const idleFrames of [12,120]){
  const f=fixture({scene:jumpTestRoom()});f.tick(1);f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});f.tick(30);f.fire(f.document,'keyup',{key:'ArrowRight'});f.tick(40);
  assert.equal(f.motion().angle,0);assert.equal(f.motion().needsFrame,false);
  const samples=f.motionInputs.length,packets=f.wire.length,previous=f.motionInputs.at(-1),position=f.wire.at(-1),angle=f.motion().angle;
  f.tick(idleFrames);assert.equal(f.motionInputs.length,samples,'rest must not add presentation samples');assert.equal(f.wire.length,packets,'rest must not add movement packets');
  f.fire(f.document,'keydown',{key:'ArrowLeft',target:f.world});f.tick(1);
  const sample=f.motionInputs.at(-1),visual=f.motion(),turned=Math.abs(((visual.angle-angle+540)%360)-180),travel=W.distance(position,f.wire.at(-1));
  assert(sample.time-previous.time>=idleFrames*1000/60);assert(Math.abs(sample.frameMs-1000/60)<.001,'resume must carry only the latest RAF duration');assert.equal(sample.teleport,false);
  assert.equal(visual.targetHeading,'left');assert.equal(visual.turning,true);assert(turned>0&&turned<60,'the first reverse step must turn partially instead of snapping');assert(travel>0);assert(Math.abs(visual.speed-travel*60)<.001);
  f.fire(f.document,'keyup',{key:'ArrowLeft'});assert.equal(f.motionInputs.at(-1).frameMs,0,'a release event adds no display time');const stopped=f.point(),stoppedPackets=f.wire.length;
  f.document.modal=true;f.tick(40);assert.equal(f.motion().needsFrame,false,'a modal may stop physics while the current turn settles');assert.equal(f.motion().angle,180);assert.deepEqual(f.point(),stopped);assert.equal(f.wire.length,stoppedPackets);
  const settled=f.motionInputs.length;f.tick(20);assert.equal(f.motionInputs.length,settled);assert.equal(f.wire.length,stoppedPackets);f.ui.destroy();
 }
});

test('actual tabletop support produces a landing pose which completes without another physical movement',()=>{
 const scene=W.hall('room'),desk=scene.surfaces.find(s=>s.id==='ntu-window-desk'),f=fixture({scene,initial:{x:desk.x,y:Math.max(...desk.polygon.map(p=>p.y))+45}});
 requestJump(f);f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick(23);f.fire(f.document,'keyup',{key:'ArrowUp'});assert.equal(f.motionInputs.at(-1).airborne,true);assert(f.motionInputs.at(-1).z>desk.height);
 until(f,()=>f.motion().action==='land');assert.equal(f.motionInputs.at(-1).groundZ,desk.height);assert.equal(f.motionInputs.at(-1).z,desk.height);assert.equal(f.motionInputs.at(-1).airborne,false);
 const packets=f.wire.length,stopped=f.point();f.tick(20);assert.equal(f.motion().action,'idle');assert.equal(f.motion().landProgress,1);assert.equal(f.motion().needsFrame,false);assert.equal(f.wire.length,packets);assert.deepEqual(f.point(),stopped);f.ui.destroy();
});

test('changing reduced-motion preference updates a stationary actor and listeners are removed on disposal',()=>{
 const f=fixture();f.tick(20);const before=f.motionInputs.length,packets=f.wire.length;
 f.setReduced(true);assert.equal(f.motionInputs.length,before+1);assert.equal(f.motionInputs.at(-1).reducedMotion,true);assert.equal(f.motion().reducedMotion,true);assert.equal(f.motion().frame,0);assert.equal(f.motion().needsFrame,false);assert.equal(f.wire.length,packets);
 f.tick(4);assert.equal(f.motionInputs.length,before+1);f.setReduced(false);assert.equal(f.motionInputs.at(-1).reducedMotion,false);assert.equal(f.wire.length,packets);
 f.fire(f.document,'keydown',{key:'ArrowLeft',target:f.world});f.tick(4);f.fire(f.document,'keyup',{key:'ArrowLeft'});assert.equal(f.motion().turning,true);const stopped=f.point(),stoppedPackets=f.wire.length;
 f.setReduced(true);assert.equal(f.motion().turning,false);assert.equal(f.motion().needsFrame,false);assert.deepEqual(f.point(),stopped);assert.equal(f.wire.length,stoppedPackets);
 const calls=f.motionInputs.length;f.ui.destroy();f.ui.destroy();assert.equal(f.disposals(),1);f.setReduced(false);f.tick(20);assert.equal(f.motionInputs.length,calls);assert.equal(f.frames.size,0);
});

test('visual updates and reduced motion preserve identical jump collisions, positions and outgoing movement payloads',()=>{
 const runs=[fixture({scene:jumpTestRoom(true),motion:false}),fixture({scene:jumpTestRoom(true)}),fixture({scene:jumpTestRoom(true),reducedMotion:true})];
 for(const f of runs){f.tick(1);requestJump(f);f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick(25);f.fire(f.document,'keyup',{key:'ArrowUp'});f.tick(120);f.fire(f.document,'keydown',{key:'ArrowRight',target:f.world});f.tick(25);f.fire(f.document,'keyup',{key:'ArrowRight'});f.tick(90);}
 for(const f of runs.slice(1)){assert.deepEqual(f.wire,runs[0].wire);assert.deepEqual(f.point(),runs[0].point());assert.equal(elevation(f),elevation(runs[0]));}
 assert.equal(runs[2].motion().frame,0);assert.equal(runs[2].motion().needsFrame,false);for(const f of runs)f.ui.destroy();
});
