'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../game/character-motion.js');
function fixture(){
  const media={matches:false},window={MindCharacterMotion:model,matchMedia:()=>media};let writes=0;
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/avatar-motion.js'),'utf8'),{window});
  function actor(){
    const values=new Map(),classes=new Set();
    return {dataset:{direction:'down'},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},style:{left:'25%',top:'60%',transform:'world-position',setProperty(name,value){writes++;values.set(name,value);},removeProperty:name=>values.delete(name)},values};
  }
  return {M:window.MindAvatarMotion,media,actor,writes:()=>writes};
}
const sample=changes=>({x:100,y:100,z:0,groundZ:0,time:0,scene:'hall:herbal:practice',direction:'down',scale:1,intent:false,...changes});

test('visual motion never writes world position, wire direction or the input sample',()=>{
  const f=fixture(),a=f.actor(),input=Object.freeze(sample({direction:'right'}));f.M.register(a);f.M.update(a,input);
  f.M.update(a,Object.freeze(sample({x:142,time:200,direction:'right',intent:true})));
  assert.equal(a.style.left,'25%');assert.equal(a.style.top,'60%');assert.equal(a.style.transform,'world-position');assert.equal(a.dataset.direction,'down');
  assert.equal(input.x,100);assert.equal(a.dataset.motionView,'right');assert.equal(a.dataset.motionAction,'run');assert.equal(a.values.get('--motion-row'),'100%');
});

test('a stopped remote receives one final presentation sample and cannot keep running in place',()=>{
  const f=fixture(),a=f.actor();f.M.update(a,sample({direction:'right'}));
  f.M.update(a,sample({x:104,time:40,direction:'right',intent:false}));assert(a.classList.contains('walking'));assert(f.M.needsFrame(a));
  f.M.update(a,sample({x:104,time:80,direction:'right',intent:false}));assert.equal(a.dataset.motionAction,'idle');assert(!a.classList.contains('walking'));assert(!f.M.needsFrame(a));
  const writes=f.writes();f.M.update(a,sample({x:104,time:120,direction:'right',intent:false}));assert.equal(f.writes(),writes);
});

test('blocked intent braces without autonomous gait and release restores a neutral pose',()=>{
  const f=fixture(),a=f.actor();f.M.update(a,sample({direction:'left'}));
  f.M.update(a,sample({time:40,direction:'left',intent:true}));assert.equal(a.dataset.motionAction,'push');assert(!a.classList.contains('walking'));assert.equal(a.values.get('--motion-row'),'0%');
  f.M.update(a,sample({time:80,direction:'left',intent:false}));assert.equal(a.dataset.motionAction,'idle');assert.equal(a.values.get('--motion-lean'),'0.000deg');assert(!f.M.needsFrame(a));
});

test('turns use cardinal artwork without flattening the character or resetting the stride',()=>{
  const f=fixture(),a=f.actor();f.M.update(a,sample({direction:'right'}));
  let visual=f.M.update(a,sample({x:107,time:40,direction:'right',intent:true})),phase=visual.phase;
  visual=f.M.update(a,sample({x:100,time:80,direction:'left',intent:true}));assert(visual.phase>phase);assert.equal(a.values.get('--motion-scale-x'),'1.0000');
  for(let time=120;time<=600;time+=40)f.M.update(a,sample({time,direction:'left'}));
  assert.equal(a.dataset.motionView,'left');assert.equal(a.values.get('--motion-mirror'),'-1');assert.equal(a.style.transform,'world-position');assert(!f.M.needsFrame(a));
});

test('jump and landing deformation is bounded, then returns exactly to rest',()=>{
  const f=fixture(),a=f.actor();f.M.update(a,sample());
  f.M.update(a,sample({z:12,time:40,airborne:true,verticalVelocity:200}));assert.equal(a.dataset.motionAction,'rise');
  assert.equal(Number(a.values.get('--motion-scale-y')),1.012);assert.equal(a.values.get('--motion-row'),'0%');
  f.M.update(a,sample({z:52,groundZ:52,time:100,airborne:false,verticalVelocity:0}));assert.equal(a.dataset.motionAction,'land');
  assert(Number(a.values.get('--motion-scale-y'))>=.965);assert(Number(a.values.get('--motion-scale-x'))<=1.018);
  f.M.update(a,sample({z:52,groundZ:52,time:240,airborne:false,verticalVelocity:0}));assert.equal(a.dataset.motionAction,'idle');assert.equal(a.values.get('--motion-scale-y'),'1.0000');assert.equal(a.values.get('--motion-scale-x'),'1.0000');
});

test('a live reduced-motion preference updates an idle actor once and keeps facing readable',()=>{
  const f=fixture(),a=f.actor();f.M.update(a,sample({direction:'right'}));assert(!f.M.needsFrame(a));
  f.media.matches=true;assert(f.M.needsFrame(a));f.M.update(a,sample({time:40,direction:'left',intent:true}));
  assert.equal(a.dataset.motionView,'left');assert.equal(a.dataset.motionReduced,'true');assert.equal(a.values.get('--motion-row'),'0%');assert.equal(a.values.get('--motion-lean'),'0.000deg');assert(!f.M.needsFrame(a));
});

test('60 synthetic idle actors do not keep writing CSS and disposal is idempotent',()=>{
  const f=fixture(),actors=Array.from({length:60},()=>f.actor());for(const a of actors)f.M.update(a,sample());const writes=f.writes();
  for(let time=40;time<=200;time+=40)for(const a of actors){assert(!f.M.needsFrame(a));f.M.update(a,sample({time}));}
  assert.equal(f.writes(),writes);
  for(const a of actors){f.M.dispose(a);f.M.dispose(a);assert(!f.M.needsFrame(a));assert(!a.classList.contains('motion-managed'));assert.equal(a.values.size,0);assert.equal(a.dataset.motionAction,undefined);}
});

test('reduced motion still keeps the cardinal dead band at a noisy diagonal boundary',()=>{
  const f=fixture(),a=f.actor();f.media.matches=true;let x=100,y=100,time=0;f.M.update(a,sample({direction:'right'}));
  for(const angle of [44,46,44,46,48,45]){x+=3*Math.cos(angle*Math.PI/180);y+=3*Math.sin(angle*Math.PI/180);time+=20;f.M.update(a,sample({x,y,time,intent:true}));assert.equal(a.dataset.motionView,'right');}
  x+=3*Math.cos(Math.PI/3);y+=3*Math.sin(Math.PI/3);f.M.update(a,sample({x,y,time:time+20,intent:true}));assert.equal(a.dataset.motionView,'down');
});
