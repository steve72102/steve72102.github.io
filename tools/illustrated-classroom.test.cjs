'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../game/scene-objects.js'),W=require('../game/campus-walk.js'),P=require('../game/scene-play.js');
const scene='classroom:pharmaceutics',playerId='d'.repeat(32);

test('the painted classroom reaches the live scene with one fixed drawing per bench and a clear central aisle',()=>{
  const room=O.get(scene),world=P.scene(scene,P.fresh());
  assert.equal(room.background,'./assets/illustrated-scenes/classroom-pharmaceutics.webp');
  assert.equal(W.classrooms.pharmaceutics.background,room.background);assert.equal(world.background,room.background);
  for(const id of ['prep-left-island','prep-right-island','prep-teacher-bench']){
    const bench=world.surfaces.find(s=>s.id===id);assert(bench&&!bench.movable&&bench.hidden);
    assert.equal(bench.visual,undefined,'the background already paints '+id);assert(bench.occlusion.length>=4);
    assert(!W.walkable(world,bench),'the fixed bench is solid at ground height');
    assert(W.walkable(world,bench,bench.height),'the same bench supports a tabletop landing');
  }
  const front={x:500,y:610},back={x:500,y:220};assert(W.clear(world,front,back),'the painted middle aisle has no invisible desk');
  const arrival=W.deskArrival(world);assert(W.walkable(world,arrival));
  assert(arrival.y>Math.max(...world.surfaces.find(s=>s.arrival).polygon.map(p=>p.y)));
});

test('a real lab stool in the painted room can move while the new plate and stone islands remain fixed',()=>{
  const state=P.fresh(),stoolId='prep-left-stool-8',before=P.scene(scene,state).surfaces.find(s=>s.id===stoolId);
  const stand={x:before.x,y:Math.min(...before.polygon.map(p=>p.y))-2};assert(W.walkable(P.scene(scene,state),stand));
  P.step(state,[{id:playerId,scene,...stand,z:0,moving:true,direction:'down'}],1000);
  const world=P.scene(scene,state),after=world.surfaces.find(s=>s.id===stoolId);
  assert(after.y>before.y,'the stool has a real movable footprint');
  assert.equal(after.polygon[0].y-before.polygon[0].y,after.y-before.y);
  assert.equal(world.background,'./assets/illustrated-scenes/classroom-pharmaceutics.webp');
  for(const id of ['prep-left-island','prep-right-island','prep-teacher-bench'])assert.equal(state.furniture[scene+'#'+id],undefined);
  const restored=P.restore(P.snapshot(state,1100),1100);assert.equal(P.scene(scene,restored).surfaces.find(s=>s.id===stoolId).y,after.y);
});

test('the illustrated bench glass still falls, shatters for exactly sixty seconds and keeps its removal across a snapshot',()=>{
  const state=P.fresh(),object='prep-left-glass-2',initial=P.cup(state,scene,object);assert.equal(initial.support,'prep-left-island');assert.equal(initial.z,52);
  let falling=null,now=1000;
  for(let n=0;n<40;n++,now+=10){
    const cup=P.cup(state,scene,object,now);if(cup.fallUntil>now){falling=cup;break;}
    assert(P.push(state,{id:playerId,scene,...cup},{type:'push',scene,direction:'right'},now));
  }
  assert(falling,'the visible beaker can actually leave its real support');assert.equal(falling.support,null);assert.equal(falling.brokenUntil,0);
  assert(P.elevation(falling,now)>0);P.step(state,[],falling.fallUntil);
  const broken=P.cup(state,scene,object);assert.equal(broken.z,0);assert.equal(broken.brokenUntil,falling.fallUntil+60000);
  P.step(state,[],broken.brokenUntil-1);assert.equal(P.cup(state,scene,object).removed,false);
  P.step(state,[],broken.brokenUntil);assert.equal(P.cup(state,scene,object).removed,true);
  const restored=P.restore(P.snapshot(state,broken.brokenUntil),broken.brokenUntil);
  assert.equal(P.cup(restored,scene,object).removed,true);assert.equal(P.cup(restored,scene,'prep-right-glass-2').removed,false);
});
