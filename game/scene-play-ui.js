'use strict';
window.MindSceneUI=function({node}){
  const W=window.MindWalk,P=window.MindScenePlay,O=window.MindSceneObjects,worlds=new WeakMap(),injuryStates=new WeakMap();
  const source=O?.ATLAS||'./assets/scene-objects/props.png';
  function sprite(visual,width,height){
    const entry=O?.SPRITES?.[visual.sprite],index=Number.isInteger(visual.index)?visual.index:typeof entry==='number'?entry:entry?.index;
    if(!Number.isInteger(index)||index<0||index>15)throw Error('場景物件圖層不正確。');
    const art=node('span',{class:'photo-atlas-art','aria-hidden':'true'});
    art.style.backgroundImage='url("'+source+'")';
    const raw=visual.sourceRect||O?.SPRITE_RECTS?.[visual.sprite],size=visual.sourceSize||O?.ATLAS_SIZE;
    if(raw&&size){
      const [x,y,w,h]=Array.isArray(raw)?raw:[raw.x,raw.y,raw.width,raw.height], [sw,sh]=Array.isArray(size)?size:[size.width,size.height];
      if(![x,y,w,h,sw,sh].every(Number.isFinite)||w<=0||h<=0||x<0||y<0||x+w>sw||y+h>sh)throw Error('場景物件裁切範圍不正確。');
      art.style.backgroundSize=sw/w*100+'% '+sh/h*100+'%';art.style.backgroundPosition=(sw===w?0:x/(sw-w)*100)+'% '+(sh===h?0:y/(sh-h)*100)+'%';
      const scale=Math.min(width/w,height/h),dw=w*scale,dh=h*scale;
      art.style.width=dw/width*100+'%';art.style.height=dh/height*100+'%';
      art.style.left=(width-dw)*(visual.anchorX??.5)/width*100+'%';art.style.top=(height-dh)*(visual.anchorY??.9)/height*100+'%';
    }else art.style.backgroundPosition=(index%4/3*100)+'% '+(Math.floor(index/4)/3*100)+'%';
    if(visual.flipX)art.classList.add('photo-flipped');return art;
  }
  function object(def,furniture=false){
    const v=def.visual;if(!v)return null;
    const width=v.width||def.width||def.w||30,height=v.height||width;
    const el=node('div',{class:'photo-object '+(furniture?'photo-furniture':'photo-portable'),'data-material':def.material||'',...(furniture?{'data-furniture-id':def.id}:{'data-prop-id':def.id}),role:'img','aria-label':def.name||def.description||def.kind||'學院物件'},sprite(v,width,height));
    el.style.width=width/W.WIDTH*100+'%';el.style.height=height/W.HEIGHT*100+'%';
    el.style.setProperty('--anchor-x',String((v.anchorX??.5)*100)+'%');el.style.setProperty('--anchor-y',String((v.anchorY??.9)*100)+'%');
    const x=v.x??def.x,y=(v.y??def.y)-(furniture?0:def.z||0);
    el.style.left=x/W.WIDTH*100+'%';el.style.top=y/W.HEIGHT*100+'%';el.style.zIndex=String(30+Math.round((v.y??def.y)/10));return el;
  }
  function occlusion(scene,surface){
    const points=surface.occlusion;
    if(surface.movable||!scene.background||!Array.isArray(points)||points.length<3)return null;
    const el=node('div',{class:'photo-occlusion','data-occlusion-id':surface.id,'aria-hidden':'true'});
    el.style.backgroundImage='url("'+scene.background+'")';
    el.style.clipPath='polygon('+points.map(point=>{const [x,y]=Array.isArray(point)?point:[point.x,point.y];return x/W.WIDTH*100+'% '+y/W.HEIGHT*100+'%';}).join(',')+')';
    el.style.zIndex=String(30+Math.round(surface.y/10));return el;
  }
  function props(scene){
    if(!['hall','classroom'].includes(scene.kind))return [];
    const surfaces=new Map((scene.surfaces||[]).map(s=>[s.id,s]));
    return [
      ...(scene.surfaces||[]).map(s=>occlusion(scene,s)).filter(Boolean),
      ...(scene.surfaces||[]).filter(s=>!s.hidden&&s.visual).map(s=>object(s,true)),
      ...(scene.glass||[]).flatMap(d=>{
        const el=object({...d,z:surfaces.get(d.surface)?.height||0});if(!el)return [];
        if(!d.breakable||!['glass','ceramic'].includes(d.material))return [el];
        const shards=node('div',{class:'photo-shards','data-prop-id':d.id,'data-material':d.material,role:'img','aria-label':d.material==='ceramic'?'陶瓷碎片':'玻璃碎片',hidden:true},Array.from({length:7},(_,i)=>{
          const piece=node('i',{'aria-hidden':'true'});piece.style.left=(12+i*19%75)+'%';piece.style.top=(8+i*23%66)+'%';piece.style.transform='rotate('+(i*47)+'deg)';return piece;
        }));return [el,shards];
      }),
      node('div',{class:'scene-health',role:'status','aria-live':'polite',hidden:true})
    ];
  }
  function attach(world,sceneId){
    let cache=worlds.get(world);if(cache?.sceneId===sceneId)return cache;
    const base=P.scenes.includes(sceneId)?P.scene(sceneId):null,surfaces=new Map((base?.surfaces||[]).map(s=>[s.id,s])),portable=new Map(P.definitions(sceneId).map(d=>[d.id,d]));
    const furniture=new Map(),objects=new Map(),shards=new Map();
    for(const el of world.querySelectorAll('.photo-object')){
      const furnitureId=el.dataset.furnitureId,id=furnitureId||el.dataset.propId,def=(furnitureId?surfaces:portable).get(id);
      if(def)(furnitureId?furniture:objects).set(id,{el,def,last:null});
    }
    for(const el of world.querySelectorAll('.photo-shards'))shards.set(el.dataset.propId,{el,last:null});
    cache={sceneId,furniture,objects,shards,actors:[],childCount:-1,health:world.closest?.('.walk-section')?.querySelector('.scene-health')||world.querySelector('.scene-health'),healthText:null};
    worlds.set(world,cache);return cache;
  }
  function draw(record,x,y,z,hidden,falling=false,layer=0){
    if(!record)return;const {el}=record,key=[x,y,z,hidden,falling,layer].join('|');if(record.last===key)return;record.last=key;
    el.hidden=hidden;el.classList.toggle('is-falling',falling);el.style.left=x/W.WIDTH*100+'%';el.style.top=(y-z)/W.HEIGHT*100+'%';el.style.zIndex=String(layer||31+Math.round(y/10)+(z>0?15:0));
  }
  function render(world,sceneId,state,players,mine,now){
    if(!world)return;const cache=attach(world,sceneId);
    if(cache.furniture.size){const current=P.scene(sceneId,state);for(const s of current.surfaces){const record=cache.furniture.get(s.id);if(!record)continue;const d=record.def,v=d.visual;draw(record,(v.x??d.x)+s.x-d.x,(v.y??d.y)+s.y-d.y,0,false,false,30+Math.round(s.y/10));}}
    for(const [id,record] of cache.objects){
      const d=record.def,v=d.visual,c=P.cup(state,sceneId,id,now),height=P.elevation(c,now),broken=!c.removed&&c.brokenUntil>now,falling=!c.removed&&c.fallUntil>now;
      draw(record,c.x+(v.x??d.x)-d.x,c.y+(v.y??d.y)-d.y,height,!!c.removed||broken,falling);
      const fragment=cache.shards.get(id);if(fragment)draw(fragment,c.x,c.y,c.z,!broken,false,c.z>0?31+Math.round(c.y/10)+15:28);
    }
    // Direct children only; refresh after joins, departures or an avatar replacement.
    const childCount=world.childElementCount??world.children.length;
    if(cache.childCount!==childCount||cache.actors.some(actor=>actor.parentElement!==world)){
      cache.actors=Array.from(world.children).filter(el=>el.classList?.contains('walk-actor'));cache.childCount=childCount;
    }
    for(const actor of cache.actors){const id=actor.dataset.playerId||mine,bleeding=(state.injuries[id]||0)>now;if(injuryStates.get(actor)!==bleeding){actor.classList.toggle('bleeding',bleeding);injuryStates.set(actor,bleeding);}}
    const end=state.injuries[mine]||0,remaining=Math.max(0,Math.ceil((end-now)/1000)),message=remaining?'踩到碎片 · '+remaining+' 秒後止血':'';
    if(cache.health&&cache.healthText!==message){cache.health.hidden=!remaining;cache.health.textContent=message;cache.healthText=message;}
  }
  const ambient=window.MindAmbient({node});
  return {props,render,...ambient};
};
