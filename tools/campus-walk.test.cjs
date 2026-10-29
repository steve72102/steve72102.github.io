const test=require('node:test'),assert=require('node:assert/strict'),W=require('../game/campus-walk.js');
test('all five entrances and their return points are on walkable connected paths',()=>{
  for(const door of W.campus.portals){assert.ok(W.walkable(W.campus,door),door.id);assert.ok(W.walkable(W.campus,door.out),door.id+' return');assert.equal(W.near(W.campus,door.out,14),null);}
  for(const a of [W.campus.spawn,...W.campus.portals])for(const b of W.campus.portals){const path=W.route(W.campus,a,b);assert.ok(path.length);let prev=a;for(const p of path){assert.ok(W.clear(W.campus,prev,p));prev=p;}assert.ok(W.distance(prev,b)<.01);}
});
test('pond, flowerbeds and buildings block movement; routing goes around the fountain',()=>{
  assert.equal(W.walkable(W.campus,{x:500,y:330}),false);assert.equal(W.walkable(W.campus,{x:80,y:400}),false);assert.equal(W.walkable(W.campus,{x:500,y:100}),false);
  let p={...W.campus.spawn};for(let i=0;i<200;i++)p=W.move(W.campus,p,0,-1,.02);assert.ok(p.y>360);assert.ok(W.walkable(W.campus,p));
  const path=W.route(W.campus,W.campus.spawn,W.campus.portals[1]);assert.ok(path.length>1);
});
test('four directions move continuously; diagonal speed is normalized; frame stalls cannot teleport',()=>{
  const s=W.hall('test'),p=s.spawn;
  for(const k of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])assert.ok(W.distance(W.move(s,p,...W.direction(k),.02),p)>0);
  assert.ok(Math.abs(W.distance(W.move(s,p,1,1,.02),p)-W.distance(W.move(s,p,1,0,.02),p))<1e-8);
  assert.ok(W.distance(W.move(s,p,1,0,100),p)<=W.SPEED*.05+.001);
  assert.ok(W.distance(W.move(s,p,1,0,.02,true),p)>W.distance(W.move(s,p,1,0,.02),p));
});
test('a generated route can be followed using actual frame-sized movements without getting stuck',()=>{
  for(const door of W.campus.portals){let p={...W.campus.spawn},path=W.route(W.campus,p,door),steps=0;while(path.length&&steps++<1500){const next=path[0];if(W.distance(p,next)<=W.SPEED/60){p=next;path.shift();}else p=W.move(W.campus,p,next.x-p.x,next.y-p.y,1/60);assert.ok(W.walkable(W.campus,p));}assert.ok(steps<1500,door.id);assert.equal(W.near(W.campus,p,14).id,door.id);}
});
test('interior exits and room entrances work, invalid targets clamp safely',()=>{
  const s=W.hall('知識教室');for(const d of s.portals){assert.ok(W.walkable(s,d));assert.ok(W.route(s,s.spawn,d).length);assert.equal(W.near(s,d,14).id,d.id);}
  assert.deepEqual(W.nearest(s,{x:NaN,y:1}),s.spawn);assert.ok(W.walkable(s,W.nearest(s,{x:-100,y:9999})));assert.deepEqual(W.move(s,s.spawn,NaN,1,.02),s.spawn);
});
