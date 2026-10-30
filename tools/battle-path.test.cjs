const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../game/campus-walk.js'),L=require('../game/lobby.js'),s=W.campus;
const point=([x,y])=>({x,y});
function follow(a,b){let p=W.nearest(s,a),route=W.route(s,p,b),steps=0;assert(route.length);while(route.length&&steps++<2400){const q=route[0];if(W.distance(p,q)<=W.speed(s)/60){assert(W.clear(s,p,q));p=q;route.shift();}else p=W.move(s,p,q.x-p.x,q.y-p.y,1/60);assert(W.walkable(s,p));}assert(steps<2400);assert(W.distance(p,b)<.01);return p;}
test('reported flowerbed position and the old battle marker are solid, including while jumping',()=>{
  for(const p of [[937,358.8],[970,368],[902,383],[860,368]])for(const z of [0,120])assert.equal(W.walkable(s,point(p),z),false,JSON.stringify({p,z}));
  let p={x:902,y:407};for(let i=0;i<100;i++)p=W.move(s,p,0,-1,1/60);
  assert(p.y>397,'Holding up must stop below the lamp, not climb through its pedestal');
});
test('the pictured paving remains open between the plaza and the battle entrance',()=>{
  const paving=[[786,395],[835,393],[860,400],[882,406],[902,407]].map(point);
  for(const p of paving)assert(W.walkable(s,p),JSON.stringify(p));
  for(let i=1;i<paving.length;i++){follow(paving[i-1],paving[i]);follow(paving[i],paving[i-1]);}
  let p={x:835,y:403.5};for(let i=0;i<30;i++)p=W.move(s,p,1,0,1/60);
  assert(p.x>879,'The plaza/path join must not leave an invisible gap when walking right');
  const gate=s.portals.find(p=>p.id==='battle');follow(s.spawn,gate);follow(gate,s.spawn);
});
test('all entrances still connect to battle and returning lands on the paving without bouncing back',()=>{
  const gate=s.portals.find(p=>p.id==='battle');
  for(const entrance of s.portals){follow(entrance,gate);follow(gate,entrance);}
  const back=W.arrival('district:battle','return');assert.equal(back.scene,'campus');
  assert(W.walkable(s,back.position));assert.equal(W.near(s,back.position,14),null);
  follow(back.position,gate);
  const recovered=W.nearest(s,{x:937,y:358.8});assert(W.walkable(s,recovered));follow(recovered,gate);
});
test('multiplayer accepts paving positions and rejects the former flowerbed shortcut',()=>{
  const pose={scene:'campus',x:902,y:407,z:0,direction:'right',moving:true};
  assert.equal(L.pose(pose).x,902);
  assert.throws(()=>L.pose({...pose,x:937,y:358.8}));
});
