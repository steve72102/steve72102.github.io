(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MindNativeAvatar=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  // Every painted set is deliberately exact-match. Independent original frames
  // never stand in for another scholar or an unequipped garment. Mixed outfits
  // use the separate measured-parts renderer.
  const ID='pineapple-doctor';
  const SLOTS=Object.freeze(['jacket','cape','shirt','pants','shoes','hat','accessory','handheld']);
  const DIRECTIONS=Object.freeze(['down','up','left','right']);
  const ATLAS=Object.freeze({columns:4,rows:2,frameWidth:256,frameHeight:384,width:1024,height:768,anchorX:128,anchorY:372});
  // All four final idle alpha bounds fit this padded frame crop. The HUD uses
  // the same down-idle drawing, cropped to its head and shoulders.
  const PREVIEW_BOX=Object.freeze([50,60,156,324]),PORTRAIT_BOX=Object.freeze([80,68,96,120]);
  // BEGIN GENERATED NATIVE CAST
  const CAST=Object.freeze({
    doctor:Object.freeze({id:ID,previewBox:PREVIEW_BOX,portraitBox:PORTRAIT_BOX,label:'青年學者',compact:false}),
    "professor":Object.freeze({id:"pineapple-professor",previewBox:Object.freeze([31,66,193,318]),portraitBox:Object.freeze([74,74,106,106]),label:"苔光教授",compact:true}),
    "herbal-mentor":Object.freeze({id:"pineapple-herbal-mentor",previewBox:Object.freeze([39,90,179,294]),portraitBox:Object.freeze([79,101,98,97]),label:"藥圃導師",compact:true}),
    "cedar-dean":Object.freeze({id:"pineapple-cedar-dean",previewBox:Object.freeze([38,60,179,324]),portraitBox:Object.freeze([82,69,94,108]),label:"杉庭院士",compact:true}),
    "balance-analyst":Object.freeze({id:"pineapple-balance-analyst",previewBox:Object.freeze([48,56,161,328]),portraitBox:Object.freeze([85,78,86,105]),label:"沐衡分析師",compact:true}),
    "graduate":Object.freeze({id:"pineapple-graduate",previewBox:Object.freeze([50,78,155,306]),portraitBox:Object.freeze([86,86,83,102]),label:"流墨研究生",compact:true}),
    "dawn-intern":Object.freeze({id:"pineapple-dawn-intern",previewBox:Object.freeze([47,93,161,290]),portraitBox:Object.freeze([90,103,78,96]),label:"晨芽實習生",compact:true}),
    "researcher":Object.freeze({id:"pineapple-researcher",previewBox:Object.freeze([52,78,153,306]),portraitBox:Object.freeze([87,94,82,99]),label:"璃砂研究員",compact:true}),
    "river-fellow":Object.freeze({id:"pineapple-river-fellow",previewBox:Object.freeze([46,62,165,322]),portraitBox:Object.freeze([83,70,89,108]),label:"溯溪學者",compact:true}),
    "lab-engineer":Object.freeze({id:"pineapple-lab-engineer",previewBox:Object.freeze([33,68,188,316]),portraitBox:Object.freeze([76,83,104,103]),label:"砥石技師",compact:true})
  });
  // END GENERATED NATIVE CAST
  const ACTIONS=Object.freeze({idle:0,start:1,stop:2,turn:3,rise:4,apex:5,fall:6,land:7});
  const DURATIONS=Object.freeze({start:90,stop:110,turn:80,apex:60});
  const BASE='./assets/native-avatar/'+ID+'/';
  const CATALOG=Object.freeze({url:BASE+'catalog.webp',width:1024,height:1536,crops:Object.freeze(Object.fromEntries(Object.entries({shirt:[4,24,254,192],jacket:[2,216,265,225],pants:[24,453,219,327],shoes:[13,778,240,122],cape:[10,915,252,175],hat:[33,1090,207,127],accessory:[98,1219,70,114],handheld:[80,1339,109,168]}).map(([slot,box])=>[slot,Object.freeze(box)])))});
  const actors=new WeakMap(),images=new Map();let previewSequence=0,catalogFailed=false;
  const direction=value=>DIRECTIONS.includes(value)?value:'down';
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const knownCharacter=value=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(CAST,value);
  function profile(state){
    const key=state?.appearance?.character,p=knownCharacter(key)?CAST[key]:null;
    return p&&SLOTS.every(slot=>state.rpg?.loadout?.[slot]==='fruit-pineapple-'+slot)?p:null;
  }
  function matches(state){
    return !!profile(state);
  }
  function asset(view,sheet='actions',character='doctor',tier='art'){
    const p=knownCharacter(character)?CAST[character]:CAST.doctor;
    return './assets/native-avatar/'+p.id+'/'+(tier==='actor'&&p.compact?'actor-':'')+direction(view)+'-'+(sheet==='run'?'run':'actions')+'.webp';
  }
  function frameRect(frame){
    const i=clamp(Number.isFinite(frame)?Math.floor(frame):0,0,7);
    return {x:i%ATLAS.columns*ATLAS.frameWidth,y:Math.floor(i/ATLAS.columns)*ATLAS.frameHeight,width:ATLAS.frameWidth,height:ATLAS.frameHeight};
  }
  function create(){
    return {time:null,z:0,velocity:0,direction:'down',baseAction:'idle',turning:false,transient:null,remaining:0,apexRemaining:0,sheet:'actions',frame:0,pose:'idle',needsFrame:false};
  }
  // Pure, presentation-only state. The existing movement model owns distance,
  // airborne state and the gait phase. frameMs advances only short drawn poses.
  function selectFrame(previous,visual,input={}){
    const old=previous||create(),time=Number.isFinite(input.time)?input.time:0;
    const elapsed=Number.isFinite(input.frameMs)?Math.max(0,input.frameMs):old.time===null?0:Math.max(0,time-old.time);
    const reset=old.time===null||input.teleport===true||elapsed>250||time<old.time;
    const dt=clamp(elapsed,0,250),view=direction(input.direction),base=visual.action||'idle';
    const z=Number.isFinite(input.z)?input.z:0,seconds=old.time===null?0:(time-old.time)/1000;
    const velocity=Number.isFinite(input.verticalVelocity)?input.verticalVelocity:seconds>0?(z-old.z)/seconds:old.velocity;
    let remaining=reset?0:Math.max(0,old.remaining-dt),transient=remaining?old.transient:null;
    let apexRemaining=reset?0:Math.max(0,old.apexRemaining-dt),sheet='actions',pose='idle';
    const begin=name=>{transient=name;remaining=DURATIONS[name];};
    if(visual.reducedMotion){
      // Keep the real outfit and cardinal direction without running a gait.
      transient=null;remaining=0;apexRemaining=0;
    }else if(base==='rise'||base==='fall'){
      transient=null;remaining=0;
      if(!reset&&old.baseAction==='rise'&&base==='fall')apexRemaining=DURATIONS.apex;
      const nearApex=!reset&&Math.abs(velocity)<=45&&(base==='rise'||old.baseAction==='rise'||apexRemaining>0);
      pose=nearApex||apexRemaining>0?'apex':base;
    }else if(base==='land'){
      transient=null;remaining=0;apexRemaining=0;pose='land';
    }else{
      apexRemaining=0;
      if(!reset){
        if(base==='run'&&!['run','rise','fall','land'].includes(old.baseAction))begin('start');
        else if(base!=='run'&&old.baseAction==='run')begin('stop');
        else if(view!==old.direction||visual.turning&&!old.turning){
          if(!transient||transient==='turn')begin('turn');
        }
      }
      if(transient)pose=transient;
      else if(base==='run'){sheet='run';pose='run';}
      // A blocked movement intent has no distance and uses the standing frame.
    }
    const phase=Number.isFinite(visual.phase)?((visual.phase%1)+1)%1:0;
    const frame=sheet==='run'?Math.min(7,Math.floor(phase*8)):ACTIONS[pose];
    return {time,z,velocity,direction:view,baseAction:base,turning:!!visual.turning,transient,remaining,apexRemaining,sheet,frame,pose,needsFrame:remaining>0};
  }
  function createBody(node,state){
    const p=profile(state);if(!p)return null;
    return node('span',{class:'native-avatar-sprite','aria-hidden':'true','data-native-atlas':p.id});
  }
  function preview(state,options={}){
    const p=profile(state);if(!p||!root.document)return null;
    const url=asset(options.direction,'actions',state.appearance.character);if(images.get(url)?.failed)return null;
    const ns='http://www.w3.org/2000/svg',svg=root.document.createElementNS(ns,'svg');
    const attrs={xmlns:ns,viewBox:p.previewBox.join(' '),width:256,height:384,class:'outfit-preview native-outfit-preview','data-character':state.appearance.character,'data-view':direction(options.direction),'data-native-avatar':p.id,role:'img','aria-label':options.label||p.label+'穿戴鳳梨工裝完整八件套'};
    for(const [key,value] of Object.entries(attrs))svg.setAttribute(key,String(value));
    // The surrounding shop may letterbox this SVG. Clip in artwork coordinates
    // as well as the CSS viewport so adjacent cells cannot leak into that margin.
    const defs=root.document.createElementNS(ns,'defs'),clip=root.document.createElementNS(ns,'clipPath'),rect=root.document.createElementNS(ns,'rect'),clipId='native-avatar-cell-'+(++previewSequence);
    clip.setAttribute('id',clipId);clip.setAttribute('clipPathUnits','userSpaceOnUse');rect.setAttribute('width',String(ATLAS.frameWidth));rect.setAttribute('height',String(ATLAS.frameHeight));
    clip.appendChild(rect);defs.appendChild(clip);svg.appendChild(defs);
    const picture=root.document.createElementNS(ns,'image');
    for(const [key,value] of Object.entries({href:url,x:0,y:0,width:ATLAS.width,height:ATLAS.height,preserveAspectRatio:'none','clip-path':'url(#'+clipId+')'}))picture.setAttribute(key,String(value));
    picture.addEventListener('error',()=>{
      images.set(url,{ready:false,failed:true,image:null});
      const fallback=options.fallback?.();if(!fallback)return;
      const classes=svg.getAttribute('class');if(classes)fallback.setAttribute('class',classes.replace(/\bnative-outfit-preview\b/g,'').trim());
      fallback.setAttribute('data-native-fallback','asset-unavailable');svg.replaceWith(fallback);
    },{once:true});
    svg.appendChild(picture);
    return svg;
  }
  function portrait(state,options={}){
    const svg=preview(state,{...options,direction:'down'});if(!svg)return null;
    const p=profile(state);svg.setAttribute('viewBox',p.portraitBox.join(' '));svg.setAttribute('preserveAspectRatio','xMidYMin slice');svg.setAttribute('data-native-portrait',p.id);return svg;
  }
  function itemPreview(state,item,options={}){
    if(catalogFailed||!root.document||!SLOTS.includes(item?.slot)||item.id!=='fruit-pineapple-'+item.slot)return null;
    // These are the approved independent garment pieces, not a full character
    // disguised as one purchased hat or a claim of completed mixed-outfit art.
    const ns='http://www.w3.org/2000/svg',svg=root.document.createElementNS(ns,'svg'),[x,y,width,height]=CATALOG.crops[item.slot];
    const attrs={xmlns:ns,viewBox:[x,y,width,height].join(' '),class:'native-item-preview',role:'img','aria-label':item.name+'：鳳梨工裝原創單件材質圖','data-gear-id':item.id,'data-equipment-slot':item.slot,'data-native-catalog':ID};
    for(const [key,value] of Object.entries(attrs))svg.setAttribute(key,String(value));
    const defs=root.document.createElementNS(ns,'defs'),clip=root.document.createElementNS(ns,'clipPath'),rect=root.document.createElementNS(ns,'rect'),clipId='native-item-cell-'+(++previewSequence);
    clip.setAttribute('id',clipId);clip.setAttribute('clipPathUnits','userSpaceOnUse');for(const [key,value] of Object.entries({x,y,width,height}))rect.setAttribute(key,String(value));
    clip.appendChild(rect);defs.appendChild(clip);svg.appendChild(defs);
    const picture=root.document.createElementNS(ns,'image');
    for(const [key,value] of Object.entries({href:CATALOG.url,x:0,y:0,width:CATALOG.width,height:CATALOG.height,'clip-path':'url(#'+clipId+')'}))picture.setAttribute(key,String(value));
    picture.addEventListener('error',()=>{catalogFailed=true;const fallback=options.fallback?.();if(fallback){const classes=svg.getAttribute('class');if(classes)fallback.setAttribute('class',classes.replace(/\bnative-item-preview\b/g,'').trim());fallback.setAttribute('data-native-fallback','catalog-unavailable');svg.replaceWith(fallback);}},{once:true});
    svg.appendChild(picture);return svg;
  }
  // Shared resources load only for a visible direction. New cast world actors
  // use 384x288 derivatives of the authored 1024x768 atlases; the shop retains
  // the large original crops. No per-actor atlas allocation or animation clock.
  function imageFor(url){
    if(images.has(url))return images.get(url);
    const entry={ready:typeof root.Image!=='function',failed:false,image:null};images.set(url,entry);
    if(entry.ready)return entry;
    const image=new root.Image();entry.image=image;image.decoding='async';
    image.onload=()=>{
      const compact=/\/actor-(?:down|up|left|right)-(?:run|actions)\.webp$/.test(url);
      if(image.naturalWidth!==(compact?384:ATLAS.width)||image.naturalHeight!==(compact?288:ATLAS.height)){entry.failed=true;entry.image=null;return;}
      const ready=()=>{entry.ready=true;entry.image=null;},failed=()=>{entry.failed=true;entry.image=null;};
      if(typeof image.decode==='function')image.decode().then(ready,failed);
      else ready();
    };
    image.onerror=()=>{entry.failed=true;entry.image=null;};image.src=url;return entry;
  }
  function register(actor,fallback=null){
    const character=Object.keys(CAST).find(key=>CAST[key].id===actor?.dataset?.nativeAvatar);if(!character)return false;
    if(actors.has(actor)){if(fallback)actors.get(actor).fallback=fallback;return true;}
    const surface=actor.querySelector?.('.native-avatar-sprite');if(!surface)return false;
    actors.set(actor,{character,surface,state:create(),styles:new Map(),pending:false,fallback});return true;
  }
  function attribute(actor,key,value){if(actor.dataset[key]!==value)actor.dataset[key]=value;}
  function style(record,key,value){
    if(record.styles.get(key)===value)return;
    record.styles.set(key,value);record.surface.style.setProperty(key,value);
  }
  function update(actor,visual,input){
    if(!actors.has(actor)&&!register(actor))return false;
    const record=actors.get(actor);record.state=selectFrame(record.state,visual,input);
    const frame=record.state,url=asset(frame.direction,frame.sheet,record.character,'actor'),entry=imageFor(url);
    // The short start pose gives this same direction's run sheet a head start.
    if(frame.pose==='start')imageFor(asset(frame.direction,'run',record.character,'actor'));
    record.pending=!entry.ready&&!entry.failed;
    attribute(actor,'nativeAssetStatus',entry.failed?'unavailable':record.pending?'loading':'ready');
    if(entry.failed&&record.fallback){
      // A missing/corrupt download must not make a player invisible. This exact
      // equipment loadout is redrawn by the established SVG renderer on demand.
      const replacement=record.fallback();actor.replaceChild(replacement,record.surface);dispose(actor);
      actor.classList.remove('native-actor');delete actor.dataset.nativeAvatar;
      attribute(actor,'nativeAssetStatus','fallback');return false;
    }
    if(entry.ready){
      style(record,'background-image','url("'+url+'")');
      style(record,'background-position',(frame.frame%4*100/3)+'% '+(Math.floor(frame.frame/4)*100)+'%');
      attribute(actor,'nativeDirection',frame.direction);attribute(actor,'nativePose',frame.pose);attribute(actor,'nativeFrame',String(frame.frame));
    }
    return true;
  }
  function needsFrame(actor){const record=actors.get(actor);return !!record&&(record.state.needsFrame||record.pending);}
  function dispose(actor){
    const record=actors.get(actor);if(!record)return;
    for(const key of record.styles.keys())record.surface.style.removeProperty?.(key);
    for(const key of ['nativeDirection','nativePose','nativeFrame','nativeAssetStatus'])delete actor.dataset[key];
    actors.delete(actor);
  }
  return {ID,CAST,SLOTS,DIRECTIONS,ATLAS,PREVIEW_BOX,PORTRAIT_BOX,ACTIONS,DURATIONS,CATALOG,profile,matches,asset,frameRect,create,selectFrame,createBody,preview,portrait,itemPreview,register,update,needsFrame,dispose};
});
