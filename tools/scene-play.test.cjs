const test=require('node:test'),assert=require('node:assert/strict'),P=require('../game/scene-play.js'),W=require('../game/campus-walk.js');
const sid='hall:pharmaceutics:practice',id='a'.repeat(32),prop='ntu-desk-flask';
function drop(state,scene=sid,object=prop,start=1000){let now=start;for(let i=0;i<40;i++){const c=P.cup(state,scene,object,now);if(c.fallUntil>now)return {c,now};assert(P.push(state,{id,scene,...c,z:c.z},{type:'push',scene,direction:'right'},now),'nearby object can be pushed');now+=10;}throw Error('object never left support');}
function breakOnFloor(state){const falling=drop(state);P.step(state,[],falling.c.fallUntil);return P.cup(state,sid,prop,falling.c.fallUntil);}
test('touching a photographed glass vessel pushes it off its desk, then it falls before shattering for sixty seconds',()=>{
  const s=P.fresh(),original=P.cup(s,sid,prop),person={id,scene:sid,x:original.x-8,y:original.y,z:original.z,moving:true};P.step(s,[person],0);person.x=original.x+2;P.step(s,[person],100);assert(P.cup(s,sid,prop).x>original.x);assert.equal(P.cup(s,sid,prop).brokenUntil,0);
  const {c,now}=drop(s,sid,prop,1000);assert.equal(c.brokenUntil,0);assert.equal(c.support,null);assert(P.elevation(c,now)>0);assert(P.elevation(c,(now+c.fallUntil)/2)<c.fromZ);P.step(s,[],c.fallUntil);const broken=P.cup(s,sid,prop);assert.equal(broken.z,0);assert.equal(broken.brokenUntil,c.fallUntil+60000);P.step(s,[],broken.brokenUntil-1);assert(!P.cup(s,sid,prop).removed);P.step(s,[],broken.brokenUntil);assert(P.cup(s,sid,prop).removed);assert.equal(P.cup(s,sid,prop).brokenUntil,0);
  const restored=P.restore(P.snapshot(s,broken.brokenUntil),broken.brokenUntil);assert(P.cup(restored,sid,prop).removed,'removed vessel stays gone until the room is reset');assert(!P.cup(P.fresh(),sid,prop).removed,'a new room gets its original furnishings');
});
test('another grounded player bleeds for eight seconds, jumping avoids shards and the same pile cannot retrigger',()=>{
  const s=P.fresh(),c=breakOnFloor(s),start=c.brokenUntil-P.GLASS_MS,other={id:'b'.repeat(32),scene:sid,x:c.x,y:c.y,z:20,moving:false};P.step(s,[other],start+100);assert(!s.injuries[other.id]);other.z=0;P.step(s,[other],start+200);assert.equal(s.injuries[other.id],start+8200);P.step(s,[other],start+8199);assert(s.injuries[other.id]);P.step(s,[other],start+8200);assert(!s.injuries[other.id]);P.step(s,[other],start+20000);assert(!s.injuries[other.id]);
});
test('remote distance, other rooms and unreachable shelf elevations cannot manipulate a loose object',()=>{
  const s=P.fresh();assert(!P.push(s,{id,scene:sid,x:999,y:655,z:0},{type:'push',scene:sid,direction:'right'},0));assert(!P.push(s,{id,scene:sid,x:103,y:486,z:105},{type:'push',scene:'hall:life:shop',direction:'right'},0));const high='hall:pharmacology:practice',c=P.cup(s,high,'pharma-shelf-plant-high');P.push(s,{id,scene:high,x:c.x,y:c.y,z:0},{type:'push',scene:high,direction:'right'},0);assert.deepEqual(P.cup(s,high,'pharma-shelf-plant-high'),c,'ground-level reach cannot move the high shelf pot');
});
test('the five original campus entrances remain connected and landscape water blocks jumping',()=>{
  const s=W.campus;for(const from of [s.spawn,...s.portals])for(const to of s.portals){const route=W.route(s,from,to);assert(route.length);let previous=from;for(const point of route){assert(W.clear(s,previous,point));previous=point;}}
  for(const point of [{x:500,y:342},{x:170,y:290},{x:600,y:220},{x:930,y:440}]){assert(!W.walkable(s,point));assert(!W.walkable(s,point,100));}
});
test('the original fixed window bench has a solid ground footprint and supports a jumping player',()=>{
  const s=W.hall('藥理','pharmacology'),bench=s.surfaces.find(s=>s.id==='window-bench'),point={x:bench.x,y:bench.y};assert.equal(bench.movable,false);assert(!W.walkable(s,point));assert(W.walkable(s,point,bench.height));assert.equal(W.surface(s,point,bench.height).id,bench.id);
});
test('landing on a ceramic pot breaks only that pot at its actual shelf height',()=>{
  const scene='hall:pharmacology:practice',object='pharma-shelf-plant-mid',s=P.fresh(),c=P.cup(s,scene,object),person={id,scene,x:c.x,y:c.y,z:c.z+14,moving:false};P.step(s,[person],0);person.z=c.z;P.step(s,[person],100);const broken=P.cup(s,scene,object);assert.equal(broken.brokenUntil,60100);assert.equal(broken.z,c.z);assert.equal(P.cup(s,scene,'pharma-shelf-plant-high').brokenUntil,0);assert.equal(P.cup(s,'hall:pharmacology:calculation',object).brokenUntil,0);const below={id:'b'.repeat(32),scene,x:c.x,y:c.y,z:0,moving:false};P.step(s,[person,below],200);assert(s.injuries[id]);assert(!s.injuries[below.id]);
});
test('snapshot round trips pending falls and removal tombstones while rejecting invented or impossible object states',()=>{
  const s=P.fresh(),{c,now}=drop(s),raw=P.snapshot(s,now),restored=P.restore(raw,now);assert.deepEqual(P.snapshot(restored,now),raw);const row=raw.cups[0];for(const change of [{id:'missing'},{x:NaN},{x:-1},{remaining:60001},{fromZ:Infinity},{fallRemaining:1501},{support:'made-up'},{z:5},{removed:true}])assert.throws(()=>P.restore({...raw,cups:[{...row,...change}]},now));assert.throws(()=>P.restore({...raw,cups:[row,row]},now));
  const end=c.fallUntil+P.GLASS_MS;const snapshot=P.snapshot(s,end);assert.equal(snapshot.cups[0].removed,true,'snapshot canonicalizes an expired fall and shards even before a new animation frame');assert(P.cup(P.restore(snapshot,end),sid,prop).removed);
});
