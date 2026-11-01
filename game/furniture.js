(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./campus-walk.js'):root.MindWalk);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindFurniture=api;})(typeof window==='object'?window:globalThis,function(W){
  'use strict';
  const LIMIT=140,bases=new Map();
  const MATERIALS=Object.freeze({wood:{mass:20,friction:.65},metal:{mass:40,friction:.7},glass:{mass:1,friction:.35},ceramic:{mass:2,friction:.55},paper:{mass:.3,friction:.6},book:{mass:.6,friction:.65},fabric:{mass:2,friction:.8},plant:{mass:4,friction:.7},stone:{mass:120,friction:.85}});
  const copy=s=>({...s,polygon:s.polygon.map(p=>({...p}))}),round=n=>Math.round(n*1000)/1000;
  function base(id){
    if(typeof id!=='string')return null;
    const [kind,building]=id.split(':');if(!['hall','classroom'].includes(kind))return null;
    const key=kind+':'+building;
    if(!bases.has(key)){const raw=kind==='hall'?W.hall('',building):W.classrooms[building];if(!raw)return null;bases.set(key,{...raw,surfaces:raw.surfaces.map(copy),glass:(raw.glass||[]).map(p=>({...p}))});}
    return bases.get(key);
  }
  // Capture each photograph's immutable geometry before a live scene receives shared offsets.
  for(const id of Object.keys(W.classrooms))base('classroom:'+id);
  function scene(id,state){const raw=base(id);if(!raw)return null;return {...raw,surfaces:raw.surfaces.map(s=>{const shift=state?.furniture?.[id+'#'+s.id]||{dx:0,dy:0};return {...s,x:s.x+shift.dx,y:s.y+shift.dy,polygon:s.polygon.map(p=>({x:p.x+shift.dx,y:p.y+shift.dy}))};})};}
  function apply(target,id,state){const world=scene(id,state);if(world)target.surfaces=world.surfaces;}
  function overlaps(a,b){
    for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],x=p.y-q.y,y=q.x-p.x;
      let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;
      for(const point of a){const projection=point.x*x+point.y*y;if(projection<minA)minA=projection;if(projection>maxA)maxA=projection;}
      for(const point of b){const projection=point.x*x+point.y*y;if(projection<minB)minB=projection;if(projection>maxB)maxB=projection;}
      if(maxA<minB-1||maxB<minA-1)return false;
    }
    return true;
  }
  function edgeDistance(p,polygon){return Math.min(...polygon.map((a,i)=>W.distance(p,W.projection(p,a,polygon[(i+1)%polygon.length]))));}
  function mobility(item){const defaults=MATERIALS[item.material]||MATERIALS.wood;return {mass:Number.isFinite(item.mass)&&item.mass>0?item.mass:defaults.mass,friction:Number.isFinite(item.friction)&&item.friction>0?item.friction:defaults.friction};}
  function validGeometry(world,prop,shift){
    const item=world?.surfaces.find(s=>s.id===prop);
    if(!item||item.movable!==true||!shift||!Number.isFinite(shift.dx)||!Number.isFinite(shift.dy)||Math.abs(shift.dx)>LIMIT||Math.abs(shift.dy)>LIMIT)return false;
    if(world.portals.some(p=>W.inside(p,item.polygon)||edgeDistance(p,item.polygon)<38))return false;
    const ground={...world,surfaces:[]};
    if(item.polygon.some((p,i)=>!W.clear(ground,p,item.polygon[(i+1)%item.polygon.length])))return false;
    return !world.surfaces.some(s=>s.id!==prop&&!s.oneWay&&overlaps(s.polygon,item.polygon));
  }
  function valid(state,id,prop){return validGeometry(scene(id,state),prop,state.furniture?.[id+'#'+prop]);}
  function step(state,players,now){
    const elapsed=state.furnitureTime===undefined?100:Math.max(0,Math.min(150,now-state.furnitureTime));state.furnitureTime=now;state.furniture??={};state.cups??={};let changed=false;
    const worlds=new Map(),forces=new Map();
    for(const p of players){
      if(!p.moving||(p.z||0)>5||!base(p.scene))continue;
      const direction={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[p.direction];if(!direction)continue;
      if(!worlds.has(p.scene))worlds.set(p.scene,scene(p.scene,state));
      const item=worlds.get(p.scene).surfaces.filter(s=>s.movable===true&&edgeDistance(p,s.polygon)<12&&((s.x-p.x)*direction[0]+(s.y-p.y)*direction[1])>0).sort((a,b)=>edgeDistance(p,a.polygon)-edgeDistance(p,b.polygon))[0];if(!item)continue;
      const key=p.scene+'#'+item.id,force=forces.get(key)||{scene:p.scene,item,dx:0,dy:0,count:0};force.dx+=direction[0];force.dy+=direction[1];force.count++;forces.set(key,force);
    }
    for(const [key,force] of Array.from(forces).sort(([a],[b])=>a.localeCompare(b))){
      const length=Math.hypot(force.dx,force.dy);if(!length)continue;
      const physical=mobility(force.item),amount=Math.min(9,elapsed*.12/(Math.sqrt(physical.mass)*physical.friction))*Math.min(2,Math.sqrt(force.count)),old=state.furniture[key],dx=round(force.dx/length*amount),dy=round(force.dy/length*amount);
      if(!dx&&!dy)continue;
      state.furniture[key]={dx:round((old?.dx||0)+dx),dy:round((old?.dy||0)+dy)};
      if(!valid(state,force.scene,force.item.id)){if(old)state.furniture[key]=old;else delete state.furniture[key];continue;}
      // Every portable object follows its actual support. Fallen objects and floor shards stay put.
      for(const d of base(force.scene).glass){const c=state.cups[force.scene+'#'+d.id];if(c&&c.support===force.item.id&&!c.fallUntil){c.x=round(c.x+dx);c.y=round(c.y+dy);}}
      changed=true;
    }
    return changed;
  }
  function snapshot(state){return Object.entries(state.furniture||{}).map(([key,p])=>{const [scene,id]=key.split('#');return {scene,id,dx:p.dx,dy:p.dy};});}
  function restore(state,rows,scenes){
    const worlds=new Map();if(rows===undefined)return worlds;
    const limit=scenes.reduce((n,id)=>n+(base(id)?.surfaces.filter(s=>s.movable===true).length||0),0);
    if(!Array.isArray(rows)||rows.length>limit)throw Error('場景物件資料過大');
    for(const row of rows){const source=base(row?.scene)?.surfaces.find(s=>s.id===row?.id);if(!row||!scenes.includes(row.scene)||!source||source.movable!==true||state.furniture[row.scene+'#'+row.id])throw Error('場景物件資料不正確');state.furniture[row.scene+'#'+row.id]={dx:row.dx,dy:row.dy};}
    // All offsets are installed first; one immutable geometry snapshot is then
    // shared by every validation in that scene, never across network requests.
    for(const row of rows){if(!worlds.has(row.scene))worlds.set(row.scene,scene(row.scene,state));if(!validGeometry(worlds.get(row.scene),row.id,state.furniture[row.scene+'#'+row.id]))throw Error('場景物件位置不正確');}
    return worlds;
  }
  return {LIMIT,MATERIALS,base,scene,apply,step,snapshot,restore,valid,mobility};
});
