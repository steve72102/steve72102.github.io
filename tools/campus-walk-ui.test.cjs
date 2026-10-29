const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),W=require('../game/campus-walk.js');
function fixture(options={}){
  class El extends EventTarget{constructor(){super();this.dataset={};this.hidden=false;this.isConnected=true;this.style={setProperty(){}};this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,b)=>b?this.classes.add(v):this.classes.delete(v)};}closest(){return null;}focus(){}querySelectorAll(){return [];}setPointerCapture(){}}
  const actor=new El(),world=new El(),root=new El(),label=new El(),action=new El(),target=new El(),main=new El(),buttons=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].map(d=>{const b=new El();b.dataset.direction=d;return b;});
  world.querySelector=s=>s==='.walk-actor'?actor:target;root.querySelector=s=>({'.walk-world':world,'.walk-status':label,'.walk-enter':action})[s];root.querySelectorAll=s=>s==='.walk-direction'?buttons:[];root.contains=e=>[world,root,action,...buttons].includes(e);
  const document=new El(),window=new El();window.MindWalk=W;document.body=new El();document.hidden=false;document.modal=false;document.querySelector=()=>document.modal?{}:null;document.getElementById=()=>main;
  let time=0,id=0,position=null,portals=[];const frames=new Map();
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/campus-walk-ui.js'),'utf8'),{window,document,AbortController,requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  const ui=window.MindWalkUI({root,scene:options.scene||W.hall('room'),initial:options.initial,onPosition:p=>position=p,onPortal:id=>portals.push(id)});
  function fire(el,type,attrs={}){const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries(attrs))Object.defineProperty(e,k,{value:v});el.dispatchEvent(e);return e;}
  function tick(n=30){for(let i=0;i<n;i++){time+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));}}
  return {ui,root,world,actor,document,window,buttons,fire,tick,frames,portals,point:()=>({x:Number(actor.dataset.x),y:Number(actor.dataset.y)}),position:()=>position};
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
test('walking through an entrance activates once and cancels the old animation loop',()=>{
  const f=fixture();f.ui.toward(W.hall('room').portals.find(p=>p.id==='room'));f.tick(250);assert.deepEqual(f.portals,['room']);assert.equal(f.frames.size,0);f.tick();assert.deepEqual(f.portals,['room']);
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
