const test=require('node:test'),assert=require('node:assert/strict'),P=require('../game/scene-play.js'),W=require('../game/campus-walk.js'),A=require('../game/academy.js');
const sid='hall:battle:arena',id='a'.repeat(32),p={id,scene:sid,x:480,y:560,z:0};
test('pushing stays on the tabletop until the rim, then glass lasts exactly 60 seconds',()=>{const s=P.fresh();assert(P.push(s,p,{type:'push',scene:sid,direction:'right'},1000));assert.equal(P.cup(s,sid).brokenUntil,0);assert(P.push(s,p,{type:'push',scene:sid,direction:'down'},1100));const c=P.cup(s,sid);assert.equal(c.brokenUntil,61100);assert(W.walkable(P.scene(sid),c));assert.equal(P.push(s,p,{type:'push',scene:sid,direction:'down'},1200),false);P.step(s,[],61099);assert(s.cups[sid]);P.step(s,[],61100);assert(!s.cups[sid]);});
test('another grounded player bleeds for eight seconds, jumping avoids glass and the same pile does not retrigger',()=>{const s=P.fresh();P.push(s,p,{type:'push',scene:sid,direction:'down'},0);P.push(s,p,{type:'push',scene:sid,direction:'down'},0);const c=P.cup(s,sid),other={id:'b'.repeat(32),scene:sid,...c,z:20};P.step(s,[other],1000);assert(!s.injuries[other.id]);other.z=0;P.step(s,[other],2000);assert.equal(s.injuries[other.id],10000);P.step(s,[other],9999);assert(s.injuries[other.id]);P.step(s,[other],10000);assert(!s.injuries[other.id]);P.step(s,[other],20000);assert(!s.injuries[other.id]);});
test('proximity, scene and restored bounds prevent remote prop manipulation and invalid timers',()=>{const s=P.fresh();assert.equal(P.push(s,{...p,x:0},{type:'push',scene:sid,direction:'down'},0),false);assert.equal(P.push(s,p,{type:'push',scene:'hall:life:shop',direction:'down'},0),false);assert.throws(()=>P.restore({cups:[{scene:sid,x:480,y:510,remaining:60001}],injuries:[]},0));assert.throws(()=>P.restore({cups:[{scene:sid,x:0,y:0,remaining:0}],injuries:[]},0));P.push(s,p,{type:'push',scene:sid,direction:'down'},0);P.push(s,p,{type:'push',scene:sid,direction:'down'},0);assert.doesNotThrow(()=>P.restore(P.snapshot(s,60001),60001));});
test('all five campus entrances connect through clear floor, and water and planters block even jumping',()=>{const s=W.campus;for(const from of [s.spawn,...s.portals])for(const to of s.portals){const path=W.route(s,from,to);assert(path.length,from.id+' to '+to.id);let prev=from;for(const p of path){assert(W.clear(s,prev,p));prev=p;}}for(const p of [{x:500,y:342},{x:170,y:290},{x:600,y:220},{x:930,y:440}]){assert(!W.walkable(s,p));assert(!W.walkable(s,p,100));}});
test('every hall has connected stairs and rooms, clear lower floors, solid desks and elevated tabletop support',()=>{for(const b of A.BUILDINGS){const s=W.hall('room',b.id);for(const p of s.portals){assert(W.walkable(s,p),b.id+':'+p.id);assert(W.route(s,s.spawn,p).length,b.id+':'+p.id);}assert(!W.walkable(s,{x:480,y:510}));assert(W.walkable(s,{x:480,y:510},52));assert.equal(W.surface(s,{x:480,y:510}).height,52);}assert.equal(new Set(A.BUILDINGS.map(b=>b.hall)).size,5);});

const lab='hall:pharmacology:'+A.floors('pharmacology')[0].id;
test('touching one laboratory vessel shatters only that shelf and vessel; a vertical landing also works',()=>{
  const state=P.fresh(),person={id,scene:lab,x:56,y:490,z:90,moving:true};P.step(state,[person],100);person.y=469;P.step(state,[person],200);
  assert.equal(P.cup(state,lab,'lab-0-1').brokenUntil,60200);assert.equal(P.cup(state,lab,'lab-0-1').z,90);
  assert.equal(P.cup(state,lab,'lab-1-1').brokenUntil,0);assert.equal(P.cup(state,lab,'lab-0-0').brokenUntil,0);
  person.z=180;person.moving=false;P.step(state,[person],300);person.z=170;P.step(state,[person],500);assert.equal(P.cup(state,lab,'lab-1-1').brokenUntil,60500);
  assert.equal(Object.keys(state.cups).length,2);assert.equal(P.cup(state,'hall:pharmacology:'+A.floors('pharmacology')[1].id,'lab-0-1').brokenUntil,0);
});
test('shelf shards injure only at their elevation, recover after eight seconds and reset at sixty seconds',()=>{
  const state=P.fresh(),person={id,scene:lab,x:56,y:469,z:120,moving:false};P.step(state,[person],0);person.z=90;P.step(state,[person],100);
  const below={id:'b'.repeat(32),scene:lab,x:56,y:469,z:0,moving:false};P.step(state,[person,below],200);assert(!state.injuries[below.id]);assert.equal(state.injuries[id],8100);
  P.step(state,[person,below],8100);assert(!state.injuries[id]);P.step(state,[person,below],60100);assert.equal(P.cup(state,lab,'lab-0-1').brokenUntil,0);assert.equal(Object.keys(state.cups).length,0);
});
test('multiple shelves round-trip through the network and reject invented vessels, heights and duplicates',()=>{
  const raw={cups:[0,1,2,3].map(level=>({scene:lab,id:'lab-'+level+'-1',x:P.definitions(lab).find(d=>d.id==='lab-'+level+'-1').x,y:P.definitions(lab).find(d=>d.id==='lab-'+level+'-1').y,z:[90,170,237,309][level],remaining:40000})),injuries:[]};
  const restored=P.restore(raw,1000);assert.deepEqual(P.snapshot(restored,1000),{...raw,furniture:[]});
  for(const change of [{id:'missing'},{z:91},{x:800},{scene:'hall:battle:arena'}])assert.throws(()=>P.restore({...raw,cups:[{...raw.cups[0],...change}]},1000));
  assert.throws(()=>P.restore({...raw,cups:[raw.cups[0],raw.cups[0]]},1000));
});
