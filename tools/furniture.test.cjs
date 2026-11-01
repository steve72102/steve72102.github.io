const test=require('node:test'),assert=require('node:assert/strict'),P=require('../game/scene-play.js'),F=require('../game/furniture.js'),W=require('../game/campus-walk.js'),L=require('../game/lobby.js');
const id='a'.repeat(32),scene='classroom:pharmacology',table='seminar-table-0';
function pushFurniture(state,sid,prop,direction,steps=1,now=1000,players=1){
  for(let i=0;i<steps;i++){const s=P.scene(sid,state).surfaces.find(s=>s.id===prop),pos=direction==='up'?{x:s.x,y:Math.max(...s.polygon.map(p=>p.y))+2}:direction==='down'?{x:s.x,y:Math.min(...s.polygon.map(p=>p.y))-2}:direction==='left'?{x:Math.max(...s.polygon.map(p=>p.x))+2,y:s.y}:{x:Math.min(...s.polygon.map(p=>p.x))-2,y:s.y};
    assert(W.walkable(P.scene(sid,state),pos),'pusher stands on accessible floor');
    P.step(state,Array.from({length:players},(_,n)=>({id:n.toString(16).padStart(32,'0'),scene:sid,...pos,z:0,moving:true,direction})),now+i*100);
  }
}
test('the photographed seminar table moves its real footprint and carries all objects on that support',()=>{
  const state=P.fresh(),before=P.scene(scene,state).surfaces.find(s=>s.id===table),props=P.definitions(scene).filter(d=>d.surface===table),positions=props.map(d=>P.cup(state,scene,d.id));
  assert(props.length>=2);const book=props.find(d=>d.material==='paper');const c=P.cup(state,scene,book.id);assert(P.push(state,{id,scene,...c},{type:'push',scene,direction:'left'},100));
  const movedBook={...P.cup(state,scene,book.id)};pushFurniture(state,scene,table,'up',2);
  const after=P.scene(scene,state).surfaces.find(s=>s.id===table),delta=after.y-before.y;assert(delta<0);assert.equal(after.polygon[0].y-before.polygon[0].y,delta);
  for(let i=0;i<props.length;i++){const carried=P.cup(state,scene,props[i].id);assert.equal(carried.y,(props[i].id===book.id?movedBook.y:positions[i].y)+delta);}
  const bound={...W.classrooms.pharmacology};P.applyScene(bound,scene,state);assert.equal(bound.surfaces.find(s=>s.id===table).y,after.y);assert.equal(W.classrooms.pharmacology.surfaces.find(s=>s.id===table).y,before.y);
});
test('real wooden seats can be pushed while built-in stone benches and cabinets remain fixed',()=>{
  const state=P.fresh(),seat='herb-chair-left-6',sid='classroom:herbal',before=P.scene(sid,state).surfaces.find(s=>s.id===seat);pushFurniture(state,sid,seat,'down',2);assert(P.scene(sid,state).surfaces.find(s=>s.id===seat).y>before.y);
  const fixedScene='hall:pharmacology:practice',fixed=P.scene(fixedScene,state).surfaces.find(s=>s.id==='window-bench');P.step(state,[{id,scene:fixedScene,x:fixed.x,y:Math.max(...fixed.polygon.map(p=>p.y))+2,z:0,moving:true,direction:'up'}],2000);assert(!state.furniture[fixedScene+'#window-bench']);
  assert.throws(()=>P.restore({cups:[],injuries:[],furniture:[{scene:fixedScene,id:'window-bench',dx:1,dy:0}]},0));
});
test('distant or airborne players cannot move furniture and forged or blocked offsets are rejected',()=>{
  const state=P.fresh();P.step(state,[{id,scene,x:500,y:620,z:0,moving:true,direction:'up'}],0);const s=P.scene(scene,state).surfaces.find(s=>s.id===table);P.step(state,[{id,scene,x:s.x,y:s.y+s.d/2+2,z:80,moving:true,direction:'up'}],100);assert.deepEqual(state.furniture,{});
  for(const row of [{scene,id:table,dx:141,dy:0},{scene,id:table,dx:NaN,dy:0},{scene,id:table,dx:0,dy:Infinity},{scene,id:'table',dx:0,dy:0},{scene,id:table,dx:0,dy:40}])assert.throws(()=>P.restore({cups:[],injuries:[],furniture:[row]},0));
});
test('room snapshots preserve real furniture and portable objects while separate floors remain independent',()=>{
  const state=P.fresh(),sid='hall:pharmaceutics:practice',prop='ntu-stool-front',before=P.scene(sid,state).surfaces.find(s=>s.id===prop);pushFurniture(state,sid,prop,'down',2);assert(P.scene(sid,state).surfaces.find(s=>s.id===prop).y>before.y);const raw=P.snapshot(state,2000),copy=P.restore(raw,2000);assert.deepEqual(P.snapshot(copy,2000),raw);assert.equal(P.scene('hall:pharmaceutics:calculation',copy).surfaces.find(s=>s.id===prop).y,before.y);assert.doesNotThrow(()=>L.packet(JSON.stringify({v:L.VERSION,type:'motion',rows:[],environment:raw})));
});
test('moving a support over existing floor shards leaves those shards on the floor and valid in shared state',()=>{
  const state=P.fresh(),s=P.scene(scene,state).surfaces.find(s=>s.id===table),d=P.definitions(scene).find(d=>d.surface===table&&d.breakable),point={x:s.x,y:Math.max(...s.polygon.map(p=>p.y))+1};state.cups[scene+'#'+d.id]={...point,z:0,support:null,brokenUntil:61000,removed:false,fallUntil:0,fromZ:0};pushFurniture(state,scene,table,'down',1);assert(P.scene(scene,state).surfaces.find(s=>s.id===table).y>s.y);assert.deepEqual({x:state.cups[scene+'#'+d.id].x,y:state.cups[scene+'#'+d.id].y},point);assert.equal(state.cups[scene+'#'+d.id].z,0);assert.doesNotThrow(()=>P.restore(P.snapshot(state,2000),2000));
});
test('sixty simultaneous pushers have bounded combined force and cannot accelerate furniture sixtyfold',()=>{
  const one=P.fresh(),many=P.fresh(),sid='classroom:herbal',prop='herb-chair-left-6';pushFurniture(one,sid,prop,'down',1,1000,1);pushFurniture(many,sid,prop,'down',1,1000,60);const a=one.furniture[sid+'#'+prop],b=many.furniture[sid+'#'+prop];assert(a&&b);assert(b.dy>=a.dy);assert(b.dy<=a.dy*2+.002);
});

test('snapshot validation checks the final combined furniture layout, independent of row ordering',()=>{
  const scene='classroom:herbal',a={scene,id:'herb-chair-left-6',dx:42,dy:0},b={scene,id:'herb-chair-left-7',dx:-42,dy:0};
  for(const row of [a,b])assert.doesNotThrow(()=>P.restore({cups:[],injuries:[],furniture:[row]},0),'each chair alone can enter the gap');
  for(const rows of [[a,b],[b,a]])assert.throws(()=>P.restore({cups:[],injuries:[],furniture:rows},0),'the two final footprints must not overlap');
});
