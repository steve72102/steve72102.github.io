(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./campus-walk.js'):root.MindWalk);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindFurniture=api;})(typeof window==='object'?window:globalThis,function(W){
  'use strict';
  const LIMIT=140,IDS=['table','chair-left','chair-right'],bases=new Map();
  const copy=s=>({...s,polygon:s.polygon.map(p=>({...p}))});
  function base(id){
    const [kind,building]=id.split(':');if(!['hall','classroom'].includes(kind))return null;
    const key=kind+':'+building;if(!bases.has(key)){const raw=kind==='hall'?W.hall('',building):W.classrooms[building];if(!raw)return null;bases.set(key,{...raw,surfaces:raw.surfaces.map(copy)});}return bases.get(key);
  }
  // Capture immutable geometry before a live scene receives shared offsets.
  for(const id of Object.keys(W.classrooms))base('classroom:'+id);
  function scene(id,state){const raw=base(id);if(!raw)return null;return {...raw,surfaces:raw.surfaces.map(s=>{const shift=state?.furniture?.[id+'#'+s.id]||{dx:0,dy:0};return {...s,x:s.x+shift.dx,y:s.y+shift.dy,polygon:s.polygon.map(p=>({x:p.x+shift.dx,y:p.y+shift.dy}))};})};}
  function apply(target,id,state){const world=scene(id,state);if(world)target.surfaces=world.surfaces;}
  function overlaps(a,b){for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],axis={x:p.y-q.y,y:q.x-p.x},pa=a.map(p=>p.x*axis.x+p.y*axis.y),pb=b.map(p=>p.x*axis.x+p.y*axis.y);if(Math.max(...pa)<Math.min(...pb)-1||Math.max(...pb)<Math.min(...pa)-1)return false;}return true;}
  function edgeDistance(p,polygon){return Math.min(...polygon.map((a,i)=>W.distance(p,W.projection(p,a,polygon[(i+1)%polygon.length]))));}
  function valid(state,id,prop){
    const world=scene(id,state),item=world?.surfaces.find(s=>s.id===prop),shift=state.furniture[id+'#'+prop];
    if(!item||!IDS.includes(prop)||!shift||!Number.isFinite(shift.dx)||!Number.isFinite(shift.dy)||Math.abs(shift.dx)>LIMIT||Math.abs(shift.dy)>LIMIT)return false;
    // Keep entrances and marked stairs usable; furniture cannot enter walls or planters.
    if(world.portals.some(p=>W.inside(p,item.polygon)||edgeDistance(p,item.polygon)<38))return false;
    const ground={...world,surfaces:[]};
    if(item.polygon.some((p,i)=>!W.clear(ground,p,item.polygon[(i+1)%item.polygon.length])))return false;
    return !world.surfaces.some(s=>s.id!==prop&&overlaps(s.polygon,item.polygon));
  }
  function step(state,players,now){
    const elapsed=state.furnitureTime===undefined?100:Math.max(0,Math.min(150,now-state.furnitureTime));state.furnitureTime=now;state.furniture??={};let changed=false;
    for(const p of players){
      if(!p.moving||(p.z||0)>5||!base(p.scene))continue;
      const direction={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[p.direction];if(!direction)continue;
      const world=scene(p.scene,state),item=world.surfaces.filter(s=>IDS.includes(s.id)&&edgeDistance(p,s.polygon)<10&&((s.x-p.x)*direction[0]+(s.y-p.y)*direction[1])>0).sort((a,b)=>edgeDistance(p,a.polygon)-edgeDistance(p,b.polygon))[0];if(!item)continue;
      const key=p.scene+'#'+item.id,old=state.furniture[key],amount=elapsed*(item.id==='table'?.035:.05),dx=direction[0]*amount,dy=direction[1]*amount;
      state.furniture[key]={dx:(old?.dx||0)+dx,dy:(old?.dy||0)+dy};
      if(!valid(state,p.scene,item.id)){if(old)state.furniture[key]=old;else delete state.furniture[key];continue;}
      // A glass already moved on the tabletop follows that tabletop. Floor shards stay put.
      if(item.id==='table'&&state.cups[p.scene]?.z>0){state.cups[p.scene].x+=dx;state.cups[p.scene].y+=dy;}
      changed=true;
    }return changed;
  }
  function snapshot(state){return Object.entries(state.furniture||{}).map(([key,p])=>{const [scene,id]=key.split('#');return {scene,id,dx:p.dx,dy:p.dy};});}
  function restore(state,rows,scenes){if(rows===undefined)return;if(!Array.isArray(rows)||rows.length>scenes.length*IDS.length)throw Error('桌椅資料過大');for(const row of rows){if(!row||!scenes.includes(row.scene)||!IDS.includes(row.id)||state.furniture[row.scene+'#'+row.id])throw Error('桌椅資料不正確');state.furniture[row.scene+'#'+row.id]={dx:row.dx,dy:row.dy};}for(const row of rows)if(!valid(state,row.scene,row.id))throw Error('桌椅位置不正確');}
  return {LIMIT,IDS,scene,apply,step,snapshot,restore,valid};
});
