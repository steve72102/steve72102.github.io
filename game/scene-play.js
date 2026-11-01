(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./campus-walk.js'):root.MindWalk,typeof module==='object'&&module.exports?require('./academy.js'):root.MindAcademy,typeof module==='object'&&module.exports?require('./furniture.js'):root.MindFurniture);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindScenePlay=api;})(typeof window==='object'?window:globalThis,function(W,A,F){
  'use strict';
  const GLASS_MS=60000,BLEED_MS=8000,MAX_FALL_MS=1500,scenes=[...A.BUILDINGS.flatMap(b=>A.floors(b.id).map(f=>'hall:'+b.id+':'+f.id)),...Object.keys(W.classrooms).map(id=>'classroom:'+id)];
  const fresh=()=>({cups:{},injuries:{},hits:{},lastPose:{},furniture:{}}),scene=(id,state)=>F.scene(id,state);
  const definitions=id=>scenes.includes(id)?F.base(id).glass:[];
  const definition=(id,prop)=>prop===undefined?definitions(id)[0]:definitions(id).find(d=>d.id===prop);
  const key=(id,prop)=>id+'#'+prop,round=n=>Math.round(n*1000)/1000;
  const brittle=d=>!!d&&['glass','ceramic'].includes(d.material)&&d.breakable!==false;
  const sharp=d=>brittle(d)&&d.sharp!==false;
  const MAX_PROPS=scenes.reduce((n,id)=>n+definitions(id).length,0);
  function support(id,surface,state){const raw=F.base(id)?.surfaces.find(s=>s.id===surface);if(!raw)return null;const shift=state?.furniture?.[id+'#'+surface]||{dx:0,dy:0};return {...raw,x:raw.x+shift.dx,y:raw.y+shift.dy,polygon:raw.polygon.map(p=>({x:p.x+shift.dx,y:p.y+shift.dy}))};}
  function fallDuration(height){return Math.min(MAX_FALL_MS,Math.max(90,Math.ceil(Math.sqrt(2*height/900)*1000)));}
  function elevation(c,now){if(!c)return 0;if(c.fallUntil>now){const progress=Math.max(0,Math.min(1,1-(c.fallUntil-now)/fallDuration(c.fromZ)));return c.z+c.fromZ*(1-progress*progress);}return c.z;}
  function settled(c,d,now){
    let next=c;
    if(next.fallUntil&&next.fallUntil<=now){const landedAt=next.fallUntil;next={...next,fallUntil:0,fromZ:0,brokenUntil:brittle(d)?landedAt+GLASS_MS:0};}
    if(next.brokenUntil&&next.brokenUntil<=now)next={...next,brokenUntil:0,removed:true};
    return next;
  }
  function cup(state,id,prop,now){
    const d=definition(id,prop);if(!d)return null;
    const shift=state.furniture?.[id+'#'+d.surface]||{dx:0,dy:0},height=F.base(id).surfaces.find(s=>s.id===d.surface)?.height||0;
    const c=state.cups[key(id,d.id)]||{x:d.x+shift.dx,y:d.y+shift.dy,z:height,support:d.surface||null,brokenUntil:0,removed:false,fallUntil:0,fromZ:0};
    return Number.isFinite(now)?settled(c,d,now):c;
  }
  function shatter(state,id,d,c,now){state.cups[key(id,d.id)]={...c,brokenUntil:now+GLASS_MS,removed:false,fallUntil:0,fromZ:0};}
  function translate(state,id,d,c,dx,dy,now){
    const next={...c,x:round(c.x+dx),y:round(c.y+dy)},table=c.support?support(id,c.support,state):null;
    if(table&&W.inside(next,table.polygon)){state.cups[key(id,d.id)]=next;return true;}
    const world=scene(id,state);
    if(table){
      const position=W.nearest(world,next);if(!position)return false;
      state.cups[key(id,d.id)]={...next,x:round(position.x),y:round(position.y),z:0,support:null,fallUntil:now+fallDuration(c.z),fromZ:c.z};
      return true;
    }
    // Books, metal and wood remain intact and can slide on the floor; they cannot cross walls.
    const choices=[next,{...next,x:c.x},{...next,y:c.y}],position=choices.find(p=>W.distance(c,p)>.01&&W.clear(world,c,p));
    if(!position)return false;state.cups[key(id,d.id)]=position;return true;
  }
  function pushAmount(d,length){const m=F.mobility(d);return Math.min(22,Math.max(4,(length+3)*.65/(Math.sqrt(m.mass)*m.friction)));}
  function nudge(state,p,now){
    const before=state.lastPose[p.id];state.lastPose[p.id]={...p};
    if(!before||before.scene!==p.scene||!scenes.includes(p.scene))return false;
    const dx=p.x-before.x,dy=p.y-before.y,length=Math.hypot(dx,dy);if(length>80)return false;
    let changed=false;
    for(const d of definitions(p.scene)){
      const c=cup(state,p.scene,d.id,now),z=p.z||0;if(c.removed||c.brokenUntil||c.fallUntil>now)continue;
      const radius=Math.max(10,Math.min(24,d.width*.55));
      const landed=brittle(d)&&(before.z||0)>c.z+4&&z<=c.z+4&&z>=c.z-.1&&W.distance(p,c)<radius;
      if(landed){shatter(state,p.scene,d,c,now);changed=true;continue;}
      const touching=p.moving&&length>0&&Math.abs(z-c.z)<=18&&W.distance(c,W.projection(c,before,p))<=radius;
      if(!touching)continue;
      const amount=pushAmount(d,length);if(translate(state,p.scene,d,c,dx/length*amount,dy/length*amount,now))changed=true;
    }
    return changed;
  }
  function push(state,player,action,now){
    if(!scenes.includes(action?.scene)||player.scene!==action.scene||action.type!=='push'||!['up','down','left','right'].includes(action.direction))return false;
    const nearby=definitions(player.scene).map(d=>({d,c:cup(state,player.scene,d.id,now)})).filter(({c})=>!c.removed&&!c.brokenUntil&&!(c.fallUntil>now)&&Math.abs((player.z||0)-c.z)<=90&&W.distance(player,c)<=85).sort((a,b)=>W.distance(player,a.c)-W.distance(player,b.c));
    if(!nearby.length)return false;
    const {d,c}=nearby[0],[dx,dy]={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[action.direction],amount=pushAmount(d,22);
    return translate(state,player.scene,d,c,dx*amount,dy*amount,now);
  }
  function step(state,players,now){
    let changed=false;
    for(const [k,c] of Object.entries(state.cups)){const [id,prop]=k.split('#'),next=settled(c,definition(id,prop),now);if(next!==c){state.cups[k]=next;changed=true;}}
    if(F.step(state,players.filter(p=>scenes.includes(p.scene)),now))changed=true;
    for(const p of players)if(nudge(state,p,now))changed=true;
    for(const p of players)for(const d of definitions(p.scene)){
      const k=key(p.scene,d.id),c=state.cups[k],hit=p.id+':'+k;
      if(sharp(d)&&!c?.removed&&c?.brokenUntil>now&&Math.abs((p.z||0)-c.z)<6&&W.distance(p,c)<22&&state.hits[hit]!==c.brokenUntil){state.hits[hit]=c.brokenUntil;state.injuries[p.id]=now+BLEED_MS;changed=true;}
    }
    const ids=new Set(players.map(p=>p.id));
    for(const [id,end] of Object.entries(state.injuries))if(end<=now||!ids.has(id)){delete state.injuries[id];changed=true;}
    for(const k of Object.keys(state.hits))if(!ids.has(k.slice(0,32))||!state.cups[k.slice(33)]?.brokenUntil)delete state.hits[k];
    for(const id of Object.keys(state.lastPose))if(!ids.has(id))delete state.lastPose[id];
    return changed;
  }
  function snapshot(state,now){
    return {furniture:F.snapshot(state),cups:Object.entries(state.cups).map(([k,raw])=>{const [scene,id]=k.split('#'),c=settled(raw,definition(scene,id),now);return {scene,id,x:c.x,y:c.y,z:c.z,support:c.support,removed:c.removed,remaining:Math.max(0,c.brokenUntil?c.brokenUntil-now:0),fallRemaining:Math.max(0,c.fallUntil?c.fallUntil-now:0),fromZ:c.fromZ};}),injuries:Object.entries(state.injuries).filter(([,end])=>end>now).map(([id,end])=>({id,remaining:Math.max(0,end-now)}))};
  }
  // Only the transport uses tuples. The UI keeps descriptive object snapshots.
  const surfaceIds=scenes.map(id=>F.base(id).surfaces.map(s=>s.id)),propIds=scenes.map(id=>definitions(id).map(d=>d.id));
  const MAX_FURNITURE=scenes.reduce((n,id)=>n+F.base(id).surfaces.filter(s=>s.movable===true).length,0);
  function knownIndex(list,value){const index=list.indexOf(value);if(index<0)throw Error('未知場景物件索引');return index;}
  function pack(raw){
    return {v:2,f:(raw.furniture||[]).map(row=>{const scene=knownIndex(scenes,row.scene);return [scene,knownIndex(surfaceIds[scene],row.id),row.dx,row.dy];}),o:raw.cups.map(row=>{const scene=knownIndex(scenes,row.scene);return [scene,knownIndex(propIds[scene],row.id),row.x,row.y,row.z,row.support===null?-1:knownIndex(surfaceIds[scene],row.support),row.removed?1:0,row.remaining,row.fallRemaining||0,row.fromZ||0];}),i:raw.injuries.map(row=>[row.id,row.remaining])};
  }
  function unpack(raw){
    if(!raw||raw.v!==2||!Array.isArray(raw.f)||raw.f.length>MAX_FURNITURE||!Array.isArray(raw.o)||raw.o.length>MAX_PROPS||!Array.isArray(raw.i)||raw.i.length>60)throw Error('精簡場景資料不正確');
    const sceneIndex=n=>Number.isInteger(n)&&n>=0&&n<scenes.length;
    const index=(n,list)=>Number.isInteger(n)&&n>=0&&n<list.length;
    const furniture=raw.f.map(row=>{if(!Array.isArray(row)||row.length!==4||!row.every(Number.isFinite)||!sceneIndex(row[0])||!index(row[1],surfaceIds[row[0]])||Math.abs(row[2])>F.LIMIT||Math.abs(row[3])>F.LIMIT)throw Error('精簡家具資料不正確');return {scene:scenes[row[0]],id:surfaceIds[row[0]][row[1]],dx:row[2],dy:row[3]};});
    const cups=raw.o.map(row=>{if(!Array.isArray(row)||row.length!==10||!row.every(Number.isFinite)||!sceneIndex(row[0])||!index(row[1],propIds[row[0]])||row[2]<0||row[2]>W.WIDTH||row[3]<0||row[3]>W.HEIGHT||row[4]<0||!(row[5]===-1||index(row[5],surfaceIds[row[0]]))||![0,1].includes(row[6])||row[7]<0||row[7]>GLASS_MS||row[8]<0||row[8]>MAX_FALL_MS||row[9]<0)throw Error('精簡道具資料不正確');return {scene:scenes[row[0]],id:propIds[row[0]][row[1]],x:row[2],y:row[3],z:row[4],support:row[5]===-1?null:surfaceIds[row[0]][row[5]],removed:!!row[6],remaining:row[7],fallRemaining:row[8],fromZ:row[9]};});
    const injuries=raw.i.map(row=>{if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||!/^[a-f0-9]{32}$/.test(row[0])||!Number.isFinite(row[1])||row[1]<0||row[1]>BLEED_MS)throw Error('精簡恢復資料不正確');return {id:row[0],remaining:row[1]};});
    return {furniture,cups,injuries};
  }
  function restore(raw,now){
    if(raw?.v!==undefined)raw=unpack(raw);
    if(!raw||!Array.isArray(raw.cups)||raw.cups.length>MAX_PROPS||!Array.isArray(raw.injuries)||raw.injuries.length>60)throw Error('場景資料不正確');
    const state=fresh(),worlds=F.restore(state,raw.furniture,scenes),frames=new Map();
    for(const c of raw.cups){
      const d=definition(c?.scene,c?.id),k=key(c?.scene,d?.id);
      if(!d||state.cups[k]||!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>W.WIDTH||c.y<0||c.y>W.HEIGHT||!Number.isFinite(c.remaining)||c.remaining<0||c.remaining>GLASS_MS)throw Error('場景道具資料不正確');
      if(!frames.has(c.scene)){const world=worlds.get(c.scene)||scene(c.scene,state);frames.set(c.scene,{world,supports:new Map(world.surfaces.map(s=>[s.id,s])),ceiling:W.maxElevation(world)});}
      const removed=c.removed??false,fallRemaining=c.fallRemaining??0,fromZ=c.fromZ??0,{world,supports,ceiling}=frames.get(c.scene);
      const supportId=c.support===undefined?(c.z===0||c.z===undefined&&c.remaining?null:d.surface||null):c.support,table=supportId?supports.get(supportId):null,z=c.z===undefined?(table?.height||0):c.z;
      if(typeof removed!=='boolean'||!Number.isFinite(z)||!Number.isFinite(fallRemaining)||fallRemaining<0||fallRemaining>MAX_FALL_MS||!Number.isFinite(fromZ)||fromZ<0||fromZ>ceiling||
        supportId!==null&&supportId!==d.surface||supportId!==null&&!table||
        (table?z!==table.height||!W.inside(c,table.polygon):z!==0||!W.ground(world,c))||
        (fallRemaining?removed||c.remaining>0||supportId!==null||fromZ<=0||fallRemaining>fallDuration(fromZ):fromZ!==0)||
        (c.remaining>0&&(!brittle(d)||removed))||removed&&(!brittle(d)||c.remaining>0||fallRemaining>0)||
        (brittle(d)&&d.surface&&supportId===null&&!removed&&!c.remaining&&!fallRemaining))throw Error('場景道具位置或材質狀態不正確');
      state.cups[k]={x:c.x,y:c.y,z,support:supportId,brokenUntil:c.remaining?now+c.remaining:0,removed,fallUntil:fallRemaining?now+fallRemaining:0,fromZ};
    }
    for(const i of raw.injuries){if(!/^[a-f0-9]{32}$/.test(i.id)||state.injuries[i.id]||!Number.isFinite(i.remaining)||i.remaining<0||i.remaining>BLEED_MS)throw Error('恢復資料不正確');state.injuries[i.id]=now+i.remaining;}
    return state;
  }
  return {GLASS_MS,BLEED_MS,MAX_FALL_MS,MAX_PROPS,MAX_FURNITURE,scenes,definitions,fresh,scene,cup,push,step,snapshot,pack,unpack,restore,elevation,fallDuration,applyScene:F.apply};
});
