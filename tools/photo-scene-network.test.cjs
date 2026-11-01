'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../game/scene-play.js'),F=require('../game/furniture.js'),L=require('../game/lobby.js'),R=require('../game/adventure.js'),W=require('../game/campus-walk.js'),S=require('../game/social-economy.js');

test('a full 60-player wardrobe roster carries all visited-room object states within the bounded packet size',()=>{
  const state=P.fresh();
  for(const scene of P.scenes){
    for(const surface of P.scene(scene).surfaces.filter(s=>s.movable)){const key=scene+'#'+surface.id;state.furniture[key]={dx:.125,dy:.25};if(!F.valid(state,scene,surface.id))state.furniture[key]={dx:0,dy:0};}
    for(const prop of P.definitions(scene))state.cups[scene+'#'+prop.id]=P.cup(state,scene,prop.id,0);
  }
  for(let i=0;i<60;i++)state.injuries[i.toString(16).padStart(32,'0')]=8000;
  const environment=P.snapshot(state,0);assert.doesNotThrow(()=>P.restore(environment,0));
  const players=Array.from({length:60},(_,i)=>({id:i.toString(16).padStart(32,'0'),socialId:(i+80).toString(16).padStart(32,'0'),name:'甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳',appearance:{version:1,character:'balance-analyst',pet:null},loadout:Object.fromEntries(R.setIds('pineapple').map(id=>[R.gear(id).slot,id])),scene:'campus',...W.campus.spawn,z:0,direction:'down',moving:false,knowledge:null,counterAt:Date.now(),honor:{kind:'crown',region:'central',start:S.day(),until:S.day()+21,tier:'diamond'}}));
  const descriptive=JSON.stringify({v:L.VERSION,type:'world',players,environment,session:'a'.repeat(32),seq:1});
  assert(Buffer.byteLength(descriptive)>L.MAX_PACKET,'this regression must cover the descriptive state exceeding 64 KiB');
  const text=JSON.stringify({v:L.VERSION,type:'world',players,environment:P.pack(environment),session:'a'.repeat(32),seq:1});assert(Buffer.byteLength(text)<L.MAX_PACKET);const parsed=L.packet(text),restored=P.restore(parsed.environment,0);assert.equal(parsed.players.length,60);assert.equal(Object.keys(restored.cups).length,P.MAX_PROPS);assert.equal(F.snapshot(restored).length,F.snapshot(state).length);assert.equal(Object.keys(restored.injuries).length,60);
  const wide=JSON.stringify({v:L.VERSION,type:'ping',extra:'字'.repeat(25000)});assert(wide.length<L.MAX_PACKET&&Buffer.byteLength(wide)>L.MAX_PACKET);assert.throws(()=>L.packet(wide),/限制/);
  assert.throws(()=>L.packet(' '.repeat(L.MAX_PACKET+1)),/限制/);assert.throws(()=>L.packet(JSON.stringify({v:'mq-lobby-12',type:'ping'})),/更新/);
});

test('network pose validation keeps all fixed geometry even when the artwork is drawn separately',()=>{
  const scene='classroom:pharmacology',world=W.classrooms.pharmacology,solid=world.surfaces.find(s=>!s.movable&&W.inside({x:s.x,y:s.y},s.polygon));assert(solid);
  const pose={scene,x:solid.x,y:solid.y,z:0,direction:'down',moving:false};assert.throws(()=>L.pose(pose),/步道/);
  const movable=world.surfaces.find(s=>s.movable&&W.distance({x:s.x,y:s.y},W.nearest({...world,surfaces:world.surfaces.filter(s=>!s.movable)},{x:s.x,y:s.y}))<=3);assert(movable,'a moved chair or table can be absent from its original footprint');assert.doesNotThrow(()=>L.pose({...pose,x:movable.x,y:movable.y}));
});
