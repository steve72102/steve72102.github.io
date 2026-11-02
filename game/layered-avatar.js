(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MindLayeredAvatar=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  // Original directional parts + articulated skeleton. Full painted NativeAvatar
  // sets retain priority. This adapter never changes gameplay state or position.
  const actors=new WeakMap(),bodies=new WeakMap();
  const SLOTS=['jacket','cape','shirt','pants','shoes','hat','accessory','handheld'];
  const ranges={idle:[0,1],run:[2,9],start:[10,11],stop:[12,13],turn:[14,15],rise:[16,17],apex:[18,18],fall:[19,20],land:[21,23]};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function publicState(state){return {appearance:{character:state?.appearance?.character},rpg:{loadout:Object.fromEntries(SLOTS.map(s=>[s,state?.rpg?.loadout?.[s]||null]))}};}
  function available(state){
    if(!root.MindRasterOutfit||!root.document)return false;
    try{root.MindRasterOutfit.describe(state);return true;}catch{return false;}
  }
  function cell(selected,visual){
    const pose=selected.pose,range=ranges[pose]||ranges.idle;
    if(visual.reducedMotion)return 0;
    if(pose==='run')return 2+Math.min(7,Math.floor((((visual.phase||0)%1+1)%1)*8));
    let progress=0;
    if(['start','stop','turn'].includes(pose))progress=1-selected.remaining/root.MindNativeAvatar.DURATIONS[pose];
    else if(pose==='land')progress=visual.landProgress||0;
    else if(pose==='rise')progress=selected.velocity<140?1:0;
    else if(pose==='fall')progress=selected.velocity<-160?1:0;
    return range[0]+Math.min(range[1]-range[0],Math.floor(clamp(progress,0,1)*(range[1]-range[0]+1)));
  }
  function createBody(node,state){
    if(!available(state))return null;
    const canvas=node('canvas',{class:'layered-avatar-canvas','aria-hidden':'true',width:72,height:120,'data-art-method':'authored-parts-skeletal-poses'});
    bodies.set(canvas,publicState(state));return canvas;
  }
  function register(actor,fallback=null){
    if(actors.has(actor)){if(fallback)actors.get(actor).fallback=fallback;return true;}
    const surface=actor?.querySelector?.('.layered-avatar-canvas'),state=bodies.get(surface);
    if(!surface||!state)return false;
    actors.set(actor,{actor,surface,state,fallback,selected:null,visual:{},handle:null,controller:null,warmController:null,warmed:false,epoch:0,pending:false,requested:null,painted:null,failed:false});return true;
  }
  function paint(record){
    if(!record.handle||record.failed)return;
    const atlas=record.handle.value,index=cell(record.selected,record.visual),key=atlas.key+':'+index;
    if(key===record.painted)return;
    const ctx=record.surface.getContext('2d');ctx.clearRect(0,0,record.surface.width,record.surface.height);
    ctx.drawImage(atlas.canvas,index%atlas.columns*atlas.width,Math.floor(index/atlas.columns)*atlas.height,atlas.width,atlas.height,0,0,record.surface.width,record.surface.height);
    record.actor.querySelector?.('.layered-loading-body')?.remove?.();
    record.painted=key;record.actor.dataset.layeredPose=record.selected.pose;record.actor.dataset.layeredFrame=String(index);record.actor.dataset.layeredDirection=atlas.direction;
  }
  function failure(record){
    record.failed=true;record.pending=false;record.actor.dataset.layeredAssetStatus='fallback';
    record.actor.querySelector?.('.layered-loading-body')?.remove?.();
    const replacement=record.fallback?.();if(replacement)record.actor.replaceChild(replacement,record.surface);
    record.actor.classList.remove('layered-actor');dispose(record.actor);
  }
  function warmLocalViews(record){
    if(record.warmed||!record.actor.classList?.contains?.('local-actor'))return;
    record.warmed=true;record.warmController=root.AbortController?new root.AbortController():null;
    // Only the local wearer prepares unseen views. Remote players stay lazy.
    // The same cooperative queue/cache is reused; disposal aborts queued work.
    for(const view of ['right','left','up','down'])if(view!==record.requested)
      root.MindRasterOutfit.acquire(record.state,view,{signal:record.warmController?.signal}).then(handle=>handle.release()).catch(()=>{});
  }
  function request(record,direction){
    if(record.requested===direction)return;
    record.requested=direction;record.pending=true;record.actor.dataset.layeredAssetStatus='loading';
    record.controller?.abort();record.controller=root.AbortController?new root.AbortController():null;
    // The previous cell is already copied to the actor canvas; its atlas can be
    // unpinned before the new view bakes. This bounds 60 simultaneous turns.
    record.handle?.release();record.handle=null;
    const epoch=++record.epoch;
    root.MindRasterOutfit.acquire(record.state,direction,{signal:record.controller?.signal}).then(handle=>{
      if(!actors.has(record.actor)||record.epoch!==epoch){handle.release();return;}
      record.handle=handle;record.pending=false;record.painted=null;record.actor.dataset.layeredAssetStatus='ready';paint(record);warmLocalViews(record);
    }).catch(error=>{if(record.epoch!==epoch||!actors.has(record.actor)||error.name==='AbortError')return;failure(record);});
  }
  function update(actor,visual,input={}){
    if(!actors.has(actor)&&!register(actor))return false;
    const r=actors.get(actor);if(r.failed)return false;
    r.selected=root.MindNativeAvatar.selectFrame(r.selected,visual,input);r.visual=visual;
    request(r,r.selected.direction);paint(r);return true;
  }
  function needsFrame(actor){const r=actors.get(actor);return !!r&&(r.pending||r.selected?.needsFrame);}
  function dispose(actor){
    const r=actors.get(actor);if(!r)return;r.epoch++;r.controller?.abort();r.warmController?.abort();r.handle?.release();r.handle=null;r.pending=false;bodies.delete(r.surface);actors.delete(actor);
  }
  function restorePreview(canvas,fallback){
    root.MindRasterOutfit.ready(canvas).then(()=>{
      if(canvas.dataset.renderStatus!=='error')return;
      const original=fallback?.();if(!original)return;
      const classes=canvas.getAttribute('class');if(classes)original.setAttribute('class',classes.replace(/\braster-outfit-preview\b/g,'').trim());
      original.setAttribute('data-layered-fallback','asset-unavailable');root.MindRasterOutfit.dispose(canvas);canvas.replaceWith(original);
    });return canvas;
  }
  function preview(state,options={}){
    if(!available(state))return null;
    const canvas=root.MindRasterOutfit.preview(publicState(state),options);
    canvas.dataset.character=state.appearance.character;canvas.dataset.view=root.MindRasterOutfit.direction(options.direction);canvas.dataset.artMethod='authored-parts-skeletal-poses';
    if(options.label)canvas.setAttribute('aria-label',options.label);
    return restorePreview(canvas,options.fallback);
  }
  function itemPreview(state,item,options={}){
    if(!root.MindRasterOutfit||!root.document)return null;
    try{return restorePreview(root.MindRasterOutfit.itemPreview(publicState(state),item.id,options),options.fallback);}catch{return null;}
  }
  function portrait(state,options={}){
    if(!available(state))return null;
    const source=root.MindRasterOutfit.preview(publicState(state),{direction:'down'}),canvas=root.document.createElement('canvas');
    canvas.width=96;canvas.height=96;canvas.className='world-face layered-hud-preview';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',options.label||'目前穿戴的角色頭像');
    root.MindRasterOutfit.ready(source).then(()=>{
      if(source.dataset.renderStatus==='error'){const fallback=options.fallback?.();if(fallback)canvas.replaceWith(fallback);root.MindRasterOutfit.dispose(source);return;}
      const p=root.MindRasterOutfit.pose(state.appearance.character,'down'),size=p.body.head*2;
      canvas.getContext('2d').drawImage(source,160-size/2,p.neck.y-p.body.head*1.4,size,size,0,0,96,96);
      canvas.dataset.renderStatus='ready';root.MindRasterOutfit.dispose(source);
    });return canvas;
  }
  return {SLOTS,ranges,publicState,available,cell,createBody,register,update,needsFrame,dispose,preview,itemPreview,portrait};
});
