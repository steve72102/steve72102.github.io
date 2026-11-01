const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),W=require('../game/campus-walk.js');
function fixture(options={}){
  class El extends EventTarget{constructor(){super();this.dataset={};this.hidden=false;this.isConnected=true;this.style={setProperty(){}};this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,b)=>b?this.classes.add(v):this.classes.delete(v)};}closest(){return null;}focus(){}querySelectorAll(){return [];}setPointerCapture(){}getBoundingClientRect(){return {left:0,top:0,width:1000,height:667};}}
  const joystick=new El(),joyKnob=new El();joystick.querySelector=()=>joyKnob;joystick.getBoundingClientRect=()=>({left:0,top:0,width:114,height:114});
  const actor=new El(),world=new El(),root=new El(),label=new El(),action=new El(),target=new El(),main=new El(),buttons=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].map(d=>{const b=new El();b.dataset.direction=d;return b;});
  world.querySelector=s=>s==='.walk-actor'?actor:target;root.querySelector=s=>({'.walk-joystick':joystick,'.walk-world':world,'.walk-status':label,'.walk-enter':action})[s];root.querySelectorAll=s=>s==='.walk-direction'?buttons:[];root.contains=e=>[world,root,action,...buttons].includes(e);
  const document=new El(),window=new El();window.MindWalk=W;document.body=new El();document.hidden=false;document.modal=false;document.querySelector=()=>document.modal?{}:null;document.getElementById=()=>main;
  let time=0,id=0,position=null,portals=[];const frames=new Map();
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/campus-walk-ui.js'),'utf8'),{window,document,AbortController,requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  const ui=window.MindWalkUI({root,scene:options.scene||W.hall('room'),initial:options.initial,onPosition:p=>position=p,onPortal:id=>portals.push(id)});
  function fire(el,type,attrs={}){const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries(attrs))Object.defineProperty(e,k,{value:v});el.dispatchEvent(e);return e;}
  function tick(n=30){for(let i=0;i<n;i++){time+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));}}
  return {ui,root,world,actor,joystick,joyKnob,document,window,buttons,fire,tick,frames,portals,point:()=>({x:Number(actor.dataset.x),y:Number(actor.dataset.y)}),position:()=>position};
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

test('jumping reaches the tabletop, lands on it and drops back to the ground when walking off',()=>{const f=fixture({initial:{x:480,y:565}});f.fire(f.document,'keydown',{key:' ',target:f.world});f.fire(f.document,'keydown',{key:'ArrowUp',target:f.world});f.tick(23);f.fire(f.document,'keyup',{key:'ArrowUp'});assert(Number(f.actor.dataset.z)>52);assert(W.surface(W.hall('room'),f.point()));f.tick(65);assert.equal(Number(f.actor.dataset.z),52);f.fire(f.document,'keydown',{key:'ArrowDown',target:f.world});f.tick(30);f.fire(f.document,'keyup',{key:'ArrowDown'});f.tick(60);assert.equal(Number(f.actor.dataset.z),0);f.ui.destroy();});

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
