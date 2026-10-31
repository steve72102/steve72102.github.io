(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./campus-walk.js'):root.MindWalk,typeof module==='object'&&module.exports?require('./academy.js'):root.MindAcademy,typeof module==='object'&&module.exports?require('./furniture.js'):root.MindFurniture);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindScenePlay=api;})(typeof window==='object'?window:globalThis,function(W,A,F){
  'use strict';
  const GLASS_MS=60000,BLEED_MS=8000,scenes=[...A.BUILDINGS.flatMap(b=>A.floors(b.id).map(f=>'hall:'+b.id+':'+f.id)),...Object.keys(W.classrooms).map(id=>'classroom:'+id)];
  const fresh=()=>({cups:{},injuries:{},hits:{},lastPose:{},furniture:{}}),scene=(id,state)=>F.scene(id,state);
  const definitions=id=>scenes.includes(id)?scene(id).glass:[];
  const key=(id,prop='cup')=>prop==='cup'?id:id+'#'+prop;
  const definition=(id,prop)=>definitions(id).find(d=>d.id===prop);
  const support=(id,d,state)=>scene(id,state).surfaces.find(s=>s.id===d.surface);
  const MAX_PROPS=scenes.reduce((n,id)=>n+definitions(id).length,0);
  function cup(state,id,prop='cup'){
    const d=definition(id,prop);
    const shift=state.furniture?.[id+'#'+d?.surface]||{dx:0,dy:0};return state.cups[key(id,prop)]||{x:(d?.x||480)+shift.dx,y:(d?.y||510)+shift.dy,z:d?support(id,d,state).height:52,brokenUntil:0};
  }
  function shatter(state,id,d,c,now,onSurface=false){
    const position=onSurface?{x:c.x,y:c.y}:W.nearest(scene(id,state),c);
    state.cups[key(id,d.id)]={...position,z:onSurface?support(id,d,state).height:0,brokenUntil:now+GLASS_MS};
  }
  function nudge(state,p,now){
    const before=state.lastPose[p.id];state.lastPose[p.id]={...p};
    if(!before||before.scene!==p.scene||!scenes.includes(p.scene))return false;
    const dx=p.x-before.x,dy=p.y-before.y,length=Math.hypot(dx,dy);
    if(length>80)return false;
    let changed=false;
    for(const d of definitions(p.scene)){
      const c=cup(state,p.scene,d.id),table=support(p.scene,d,state),height=table.height,z=p.z||0;
      if(c.brokenUntil)continue;
      // A descending foot can smash a vessel even when no horizontal key is held.
      const landed=d.fragile&&(before.z||0)>height+4&&z<=height+4&&z>=height-.1&&W.distance(p,c)<13;
      const touching=p.moving&&length>0&&Math.abs(z-height)<=18&&W.distance(c,W.projection(c,before,p))<=(d.fragile?13:23);
      if(d.fragile){if(landed||touching&&z>=height-.1){shatter(state,p.scene,d,c,now,true);changed=true;}continue;}
      if(!touching)continue;
      const amount=Math.min(22,length+3),next={x:c.x+dx/length*amount,y:c.y+dy/length*amount,z:height,brokenUntil:0};
      if(!W.inside(next,table.polygon))shatter(state,p.scene,d,next,now);else state.cups[key(p.scene,d.id)]=next;
      changed=true;
    }
    return changed;
  }
  function push(state,player,action,now){
    if(!scenes.includes(action?.scene)||player.scene!==action.scene||action.type!=='push'||!['up','down','left','right'].includes(action.direction))return false;
    const c=cup(state,player.scene),d=definition(player.scene,'cup');
    if(c.brokenUntil||W.distance(player,c)>85)return false;
    const [dx,dy]={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[action.direction],next={x:c.x+dx*22,y:c.y+dy*22,z:support(player.scene,d,state).height,brokenUntil:0};
    if(!W.inside(next,support(player.scene,d,state).polygon))shatter(state,player.scene,d,next,now);else state.cups[player.scene]=next;
    return true;
  }
  function step(state,players,now){
    let changed=F.step(state,players.filter(p=>scenes.includes(p.scene)),now);
    for(const [id,c] of Object.entries(state.cups))if(c.brokenUntil&&c.brokenUntil<=now){delete state.cups[id];changed=true;}
    for(const p of players)if(nudge(state,p,now))changed=true;
    for(const p of players)for(const d of definitions(p.scene)){
      const k=key(p.scene,d.id),c=state.cups[k],hit=p.id+':'+k;
      // Shelf fragments cannot injure someone walking on the floor below them.
      if(c?.brokenUntil>now&&Math.abs((p.z||0)-c.z)<6&&W.distance(p,c)<(d.fragile?16:22)&&state.hits[hit]!==c.brokenUntil){state.hits[hit]=c.brokenUntil;state.injuries[p.id]=now+BLEED_MS;changed=true;}
    }
    const ids=new Set(players.map(p=>p.id));
    for(const [id,end] of Object.entries(state.injuries))if(end<=now||!ids.has(id)){delete state.injuries[id];changed=true;}
    for(const k of Object.keys(state.hits))if(!ids.has(k.slice(0,32))||!state.cups[k.slice(33)])delete state.hits[k];
    for(const id of Object.keys(state.lastPose))if(!ids.has(id))delete state.lastPose[id];
    return changed;
  }
  function snapshot(state,now){
    return {furniture:F.snapshot(state),cups:Object.entries(state.cups).filter(([,c])=>!c.brokenUntil||c.brokenUntil>now).map(([k,c])=>{const [scene,id='cup']=k.split('#');return {scene,id,x:c.x,y:c.y,z:c.z,remaining:Math.max(0,c.brokenUntil?c.brokenUntil-now:0)};}),injuries:Object.entries(state.injuries).filter(([,end])=>end>now).map(([id,end])=>({id,remaining:Math.max(0,end-now)}))};
  }
  function restore(raw,now){
    if(!raw||!Array.isArray(raw.cups)||raw.cups.length>MAX_PROPS||!Array.isArray(raw.injuries)||raw.injuries.length>60)throw Error('場景資料不正確');
    const state=fresh();F.restore(state,raw.furniture,scenes);
    for(const c of raw.cups){
      const id=c.id===undefined?'cup':c.id,d=definition(c.scene,id),k=key(c.scene,id);
      if(!d||state.cups[k]||!Number.isFinite(c.x)||!Number.isFinite(c.y)||!Number.isFinite(c.remaining)||c.remaining<0||c.remaining>GLASS_MS)throw Error('玻璃器皿資料不正確');
      const world=scene(c.scene,state),table=support(c.scene,d,state),z=c.z===undefined?(c.remaining?0:table.height):c.z;
      if(!Number.isFinite(z)||![0,table.height].includes(z)||(!c.remaining&&z!==table.height)||
        (c.remaining&&z===0?!W.ground(world,c):!W.inside(c,table.polygon))||
        (d.fragile&&(!c.remaining||z>0)&&W.distance(c,d)>.1))throw Error('玻璃器皿位置不正確');
      state.cups[k]={x:c.x,y:c.y,z,brokenUntil:c.remaining?now+c.remaining:0};
    }
    for(const i of raw.injuries){if(!/^[a-f0-9]{32}$/.test(i.id)||state.injuries[i.id]||!Number.isFinite(i.remaining)||i.remaining<0||i.remaining>BLEED_MS)throw Error('恢復資料不正確');state.injuries[i.id]=now+i.remaining;}
    return state;
  }
  return {GLASS_MS,BLEED_MS,MAX_PROPS,scenes,definitions,fresh,scene,cup,push,step,snapshot,restore,applyScene:F.apply};
});
