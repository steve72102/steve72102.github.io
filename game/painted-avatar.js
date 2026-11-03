(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MindPaintedAvatar=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  // Independent, authored frame layers only. This renderer never manufactures
  // poses, moves joints, mirrors a direction, or reads/writes gameplay saves.
  const SLOTS=Object.freeze(['jacket','cape','shirt','pants','shoes','hat','accessory','handheld']);
  const DIRECTIONS=Object.freeze(['down','up','left','right']);
  const SHEETS=Object.freeze(['actions','run']);
  const ATLAS=Object.freeze({columns:4,rows:2,frameWidth:256,frameHeight:384,width:1024,height:768,anchorX:128,anchorY:372});
  const COMPACT=Object.freeze({columns:4,rows:2,frameWidth:96,frameHeight:144,width:384,height:288,anchorX:48,anchorY:139.5});
  const CELL=Object.freeze({...ATLAS,columns:1,rows:1,width:256,height:384});
  const COMPACT_CELL=Object.freeze({...COMPACT,columns:1,rows:1,width:96,height:144});
  const SOURCE_BYTES=48*1024*1024,FRAME_BYTES=48*1024*1024;
  const PILOT_LOAD_TIMEOUT_MS=12000;
  const own=(value,key)=>value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key)?.value:undefined;
  const direction=value=>DIRECTIONS.includes(value)?value:'down';
  const sheet=value=>SHEETS.includes(value)?value:'actions';
  const identifier=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,95}$/.test(value);
  const aborted=()=>Object.assign(Error('角色圖像載入已取消。'),{name:'AbortError'});
  function copyJSON(value,depth=0){
    if(depth>16)throw Error('原畫清單層級過深。');
    if(value===null||typeof value==='boolean'||typeof value==='string')return value;
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(!value||typeof value!=='object'||Object.getOwnPropertySymbols(value).length)throw Error('原畫清單必須是純 JSON 資料。');
    const isArray=Array.isArray(value),proto=Object.getPrototypeOf(value);
    if(!isArray&&proto!==null&&Object.getPrototypeOf(proto)!==null)throw Error('原畫清單不得含自訂原型。');
    const result=isArray?[]:Object.create(null),keys=Object.keys(value);
    if(keys.length>2048)throw Error('原畫清單項目過多。');
    for(const key of keys){
      if(['__proto__','prototype','constructor'].includes(key))throw Error('原畫清單含不安全的鍵。');
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||descriptor.get||descriptor.set)throw Error('原畫清單不得含存取器。');
      result[key]=copyJSON(descriptor.value,depth+1);
    }
    return result;
  }
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  function sameSet(values,expected){return Array.isArray(values)&&values.length===expected.length&&new Set(values).size===values.length&&expected.every(value=>values.includes(value));}
  function box(value,name){if(!Array.isArray(value)||value.length!==4||!value.every(Number.isInteger)||value[0]<0||value[1]<0||value[2]<=0||value[3]<=0||value[0]+value[2]>256||value[1]+value[3]>384)throw Error(name+'超出固定原畫格。');return value;}
  function safeURL(url,id,extension='image'){
    if(!identifier(id)||typeof url!=='string')return false;
    const prefix='./assets/painted-avatar/'+id+'/';
    if(!url.startsWith(prefix))return false;
    const name=url.slice(prefix.length);
    return extension==='json'?name==='manifest.json':/^[a-z0-9][a-z0-9-]*\.(?:webp|png)$/.test(name);
  }
  function checkImages(images,id,complete){
    if(!images||typeof images!=='object'||Array.isArray(images))throw Error('原畫層缺少方向圖集。');
    for(const view of Object.keys(images)){
      if(!DIRECTIONS.includes(view)||!images[view]||typeof images[view]!=='object')throw Error('原畫方向不合法。');
      for(const type of Object.keys(images[view]))if(!SHEETS.includes(type)||!safeURL(images[view][type],id))throw Error('原畫來源必須是此清單登錄的本機圖集。');
    }
    if(complete&&DIRECTIONS.some(view=>SHEETS.some(type=>!safeURL(images[view]?.[type],id))))throw Error('完整原畫層必須有四方向 run/actions 圖集。');
  }
  const cellKey=(view,type,frame)=>view+'/'+type+'/'+frame;
  const validCell=c=>!!c&&DIRECTIONS.includes(c.direction)&&SHEETS.includes(c.sheet)&&Number.isInteger(c.frame)&&c.frame>=0&&c.frame<8;
  function checkPilotCoverage(m){
    const cells=m.coverage?.cells;
    if(m.storage!=='single-cells'||m.coverage?.version!==1||!Array.isArray(cells)||!cells.length||cells.length>=64||cells.some(c=>!validCell(c)))throw Error('試作原畫必須明列 1 至 63 個實際單格；不得冒充完整圖集。');
    const keys=cells.map(c=>cellKey(c.direction,c.sheet,c.frame));if(new Set(keys).size!==keys.length)throw Error('試作原畫格不可重複。');
    return keys;
  }
  function checkPilotFrames(frames,id,coverage){
    if(!Array.isArray(frames)||frames.length!==coverage.length)throw Error('每個試作分件都必須有明列的實際單格。');
    const keys=[];
    for(const f of frames){
      if(!validCell(f)||!safeURL(f.image,id)||!safeURL(f.compactImage,id)||f.image===f.compactImage)throw Error('試作單格與 compact 必須使用各自安全且明列的本機素材。');
      keys.push(cellKey(f.direction,f.sheet,f.frame));
    }
    if(!sameSet(keys,coverage))throw Error('試作分件與實際覆蓋格不一致。');
  }
  function checkPilotLoadouts(m){
    const rules=m.loadoutCoverage,entries=rules?.entries;
    if(rules?.mode!=='allowlist'||!Array.isArray(entries)||!entries.length||entries.length>256)throw Error('試作原畫必須明列已驗證的穿戴組合。');
    const keys=[];
    for(const entry of entries){
      if(!entry||Array.isArray(entry)||!sameSet(Object.keys(entry),SLOTS)||SLOTS.some(slot=>entry[slot]!==null&&!m.items[slot].includes(entry[slot])))throw Error('試作穿戴組合必須明列八欄的合法裝備或 null。');
      keys.push(JSON.stringify(SLOTS.map(slot=>entry[slot])));
    }
    if(new Set(keys).size!==keys.length)throw Error('試作穿戴組合不可重複。');
  }
  function validateManifest(raw){
    const m=copyJSON(raw),complete=m.schema===1&&m.status==='complete',pilot=m.schema===2&&m.status==='pilot';
    if((!(m.schema===1&&['draft','complete'].includes(m.status))&&!pilot)||!identifier(m.id)||!identifier(m.character)||!identifier(m.revision))throw Error('原畫清單版本、角色或狀態不合法。');
    if(!m.atlas||Object.entries(ATLAS).some(([key,value])=>m.atlas[key]!==value))throw Error('原畫清單必須使用固定 256×384 影格與 (128,372) 錨點。');
    const pilotCells=pilot?checkPilotCoverage(m):null;
    if(!pilot){
      if(!m.coverage||!Array.isArray(m.coverage.directions)||m.coverage.directions.some(view=>!DIRECTIONS.includes(view))||!m.coverage.sheets)throw Error('原畫清單缺少影格覆蓋記錄。');
      for(const type of SHEETS){const cells=m.coverage.sheets[type];if(!Array.isArray(cells)||cells.some(n=>!Number.isInteger(n)||n<0||n>7)||new Set(cells).size!==cells.length)throw Error('原畫影格覆蓋不合法。');}
      if(complete&&(!sameSet(m.coverage.directions,DIRECTIONS)||SHEETS.some(type=>!sameSet(m.coverage.sheets[type],[0,1,2,3,4,5,6,7]))))throw Error('未完成四方向 64 格不得標示完整支援。');
    }
    m.previewBox=box(m.previewBox||[0,0,256,384],'預覽範圍');m.portraitBox=box(m.portraitBox||[0,0,256,384],'頭像範圍');
    if(!m.items||Object.keys(m.items).some(slot=>!SLOTS.includes(slot)))throw Error('原畫裝備欄位不合法。');
    for(const slot of SLOTS){const ids=m.items[slot];if(!Array.isArray(ids)||ids.some(id=>!identifier(id))||new Set(ids).size!==ids.length||((complete||pilot)&&!ids.length))throw Error('原畫裝備支援清單不完整。');}
    if(pilot)checkPilotLoadouts(m);
    if(!Array.isArray(m.passes)||m.passes.length>64)throw Error('原畫繪製層不合法。');
    const ids=new Set();
    for(const p of m.passes){
      if(!identifier(p.id)||ids.has(p.id)||!Number.isInteger(p.z)||Math.abs(p.z)>1024)throw Error('原畫層識別或順序不合法。');ids.add(p.id);
      if(p.ownerSlot===null){if(p.itemId!==null)throw Error('固定人體層不可隸屬裝備。');}
      else if(!SLOTS.includes(p.ownerSlot)||(p.itemId!==null&&!m.items[p.ownerSlot].includes(p.itemId)))throw Error('原畫層的裝備所有權不合法。');
      if(p.requires!==undefined){
        if(p.ownerSlot===null||!p.requires||typeof p.requires!=='object'||Array.isArray(p.requires)||!Object.keys(p.requires).length)throw Error('補顯示層必須隸屬裝備並明列穿戴條件。');
        for(const [slot,item] of Object.entries(p.requires))if(!SLOTS.includes(slot)||(item!==null&&!m.items[slot].includes(item))||(slot===p.ownerSlot&&item!==p.itemId))throw Error('補顯示層的穿戴條件不合法。');
      }
      if(p.zByDirection){if(Object.keys(p.zByDirection).some(view=>!DIRECTIONS.includes(view))||Object.values(p.zByDirection).some(z=>!Number.isInteger(z)||Math.abs(z)>1024))throw Error('方向遮擋順序不合法。');}
      if(pilot){
        if(p.images!==undefined||p.compactImages!==undefined)throw Error('試作單格不可偽裝成完整圖集欄位。');
        checkPilotFrames(p.frames,m.id,pilotCells);
      }else{checkImages(p.images,m.id,complete);if(p.compactImages)checkImages(p.compactImages,m.id,complete);}
    }
    if(complete||pilot){
      for(const id of ['base-under','body-front'])if(!m.passes.some(p=>p.id===id&&p.ownerSlot===null))throw Error('完整分層必須保留固定底稿與原臉髮手前景。');
      for(const slot of SLOTS)for(const id of m.items[slot])if(!m.passes.some(p=>p.ownerSlot===slot&&p.itemId===id))throw Error('已宣告裝備缺少獨立原畫層。');
    }
    if(m.itemBoxes){for(const [slot,rect] of Object.entries(m.itemBoxes)){if(!SLOTS.includes(slot))throw Error('單件裁切欄位不合法。');box(rect,'單件範圍');}}
    return freeze(m);
  }
  function publicState(state){
    const appearance=own(state,'appearance'),character=own(appearance,'character'),rpg=own(state,'rpg'),loadout=own(rpg,'loadout');
    if(!identifier(character)||(loadout!==undefined&&loadout!==null&&(typeof loadout!=='object'||Array.isArray(loadout))))return null;
    const wear=Object.create(null);
    for(const slot of SLOTS){const id=own(loadout,slot);if(id!==undefined&&id!==null&&!identifier(id))return null;wear[slot]=id??null;}
    return freeze({appearance:{character},rpg:{loadout:wear}});
  }
  // Ref-counted budgets include pending reservations, so simultaneous actors
  // cannot bypass a limit by starting all decodes before the first one resolves.
  function createCache(limit,disposeValue=()=>{},Controller=root.AbortController){
    const entries=new Map();let bytes=0,serial=0;
    function trim(required=0){for(const [key,e] of [...entries].filter(([,e])=>e.refs===0&&e.value).sort((a,b)=>a[1].used-b[1].used)){if(bytes+required<=limit)break;entries.delete(key);bytes-=e.cost;disposeValue(e.value);}}
    async function acquire(key,cost,produce,{signal}={}){
      if(signal?.aborted)throw aborted();if(!Number.isSafeInteger(cost)||cost<=0||cost>limit)throw Error('原畫快取尺寸超出限制。');
      let e=entries.get(key);
      if(!e){trim(cost);if(bytes+cost>limit)throw Error('原畫快取使用中，改用既有穿戴圖。');e={refs:0,cost,used:++serial,value:null,retired:false,controller:Controller?new Controller():null};entries.set(key,e);bytes+=cost;
        e.promise=Promise.resolve().then(()=>produce(()=>e.refs>0&&!e.retired,e.controller?.signal)).then(value=>{if(e.retired){disposeValue(value);throw aborted();}e.value=value;trim();return value;},error=>{if(entries.get(key)===e){entries.delete(key);bytes-=cost;}throw error;});
      }
      e.refs++;e.used=++serial;let released=false,onAbort;
      // A consumer cancels only its own reservation. The producer is canceled
      // after the last pending consumer leaves, so shared downloads stay alive.
      const release=()=>{if(released)return;released=true;e.refs--;e.used=++serial;if(!e.refs&&!e.value&&entries.get(key)===e){e.retired=true;entries.delete(key);bytes-=e.cost;e.controller?.abort();}trim();};
      try{const value=signal?await Promise.race([e.promise,new Promise((resolve,reject)=>{onAbort=()=>{release();reject(aborted());};signal.addEventListener('abort',onAbort,{once:true});})]):await e.promise;if(signal?.aborted)throw aborted();return {value,release};}
      catch(error){release();throw error;}finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
    }
    function acquireReady(key){
      const e=entries.get(key);if(!e?.value||e.retired)return null;
      e.refs++;e.used=++serial;let released=false;
      return {value:e.value,release(){if(released)return;released=true;e.refs--;e.used=++serial;trim();}};
    }
    return {acquire,acquireReady,stats:()=>({bytes,limit,entries:entries.size,pinned:[...entries.values()].filter(e=>e.refs>0).length}),clear(){for(const [key,e] of entries)if(!e.refs&&e.value){entries.delete(key);bytes-=e.cost;disposeValue(e.value);}}};
  }
  function createRuntime(env={}){
    const E={document:root.document,Image:root.Image,AbortController:root.AbortController,locationProtocol:root.location?.protocol||'',now:root.performance?.now?.bind(root.performance)||Date.now};
    for(const name of ['fetch','createImageBitmap','setTimeout','clearTimeout'])if(typeof root[name]==='function')E[name]=root[name].bind(root);
    Object.assign(E,env);
    const manifests=new Map(),frameManifests=new Map(),registered=new Map(),actors=new WeakMap(),bodies=new WeakMap(),previews=new WeakMap(),failures=new Set();
    const sourceCache=createCache(env.sourceBytes||SOURCE_BYTES,value=>{value.image.close?.();if(value.image.getContext){value.image.width=1;value.image.height=1;}},E.AbortController);
    const frameCache=createCache(env.frameBytes||FRAME_BYTES,value=>{value.canvas.width=1;value.canvas.height=1;},E.AbortController);
    let jobs=Promise.resolve(),sequence=0,lastLocalSnapshot=null;
    const native=()=>E.MindNativeAvatar||root.MindNativeAvatar;
    const makeCanvas=(width,height)=>{const c=E.createCanvas?E.createCanvas(width,height):E.document?.createElement('canvas');if(!c)throw Error('此環境沒有畫布。');c.width=width;c.height=height;return c;};
    const queue=job=>{const result=jobs.catch(()=>{}).then(job);jobs=result.catch(()=>{});return result;};
    async function yieldTask(){if(E.yieldTask)return E.yieldTask();if(E.setTimeout)return new Promise(resolve=>E.setTimeout(resolve,0));}
    function clearDeadline(record){if(record.deadline!==null&&record.deadline!==undefined){E.clearTimeout?.(record.deadline);record.deadline=null;}}
    function pilotTimeout(){return Error('試作原畫載入逾時，已使用原有裝備外觀。');}
    const manifestKey=m=>m.id+'@'+m.revision;
    const coversCell=(m,view,type,frame)=>m.status==='complete'||m.status==='pilot'&&m.coverage.cells.some(c=>c.direction===view&&c.sheet===type&&c.frame===frame);
    const matchesLoadout=(m,clean)=>!!m&&!!clean&&['complete','pilot'].includes(m.status)&&SLOTS.every(slot=>clean.rpg.loadout[slot]===null||m.items[slot].includes(clean.rpg.loadout[slot]))&&(m.status!=='pilot'||m.loadoutCoverage.entries.some(entry=>SLOTS.every(slot=>entry[slot]===clean.rpg.loadout[slot])));
    function registerManifest(raw){
      const manifest=validateManifest(raw),key=manifestKey(manifest),serialized=JSON.stringify(manifest),old=registered.get(key);
      if(manifest.extensionOf!==undefined)throw Error('分格增量必須使用 registerFrameManifest，不可覆寫角色底稿。');
      if(old){if(old.serialized!==serialized)throw Error('同一原畫版本不可悄悄改變來源。');return old.manifest;}
      if((frameManifests.get(manifest.character)||[]).some(record=>record.manifest.extensionOf.id!==manifest.id||record.manifest.extensionOf.revision!==manifest.revision))throw Error('已有分格增量依賴此角色的封版底稿，請重新載入相符版本。');
      const record={manifest,serialized,token:++sequence};registered.set(key,record);manifests.set(manifest.character,record);return manifest;
    }
    // Add authored cells without replacing the sealed idle registration. The
    // base owns the body/loadout contract; an extension owns only disjoint cells.
    // A new revision is installed on reload, never over live cached source URLs.
    function registerFrameManifest(raw){
      const manifest=validateManifest(raw),ref=manifest.extensionOf,base=manifests.get(manifest.character)?.manifest;
      if(manifest.status!=='pilot'||!ref||Array.isArray(ref)||!sameSet(Object.keys(ref),['id','revision'])||!identifier(ref.id)||!identifier(ref.revision)||ref.id===manifest.id)throw Error('分格增量必須是試作單格並明列不同的封版底稿 id/revision。');
      if(!base||!['complete','pilot'].includes(base.status)||base.id!==ref.id||base.revision!==ref.revision)throw Error('分格增量缺少相符的封版底稿，已保留原有外觀。');
      if(SLOTS.some(slot=>manifest.items[slot].some(id=>!base.items[slot].includes(id)))||manifest.loadoutCoverage.entries.some(loadout=>!matchesLoadout(base,{rpg:{loadout}})))throw Error('分格增量不得擴張底稿未宣告的裝備或穿戴組合。');
      const key=manifestKey(manifest),serialized=JSON.stringify(manifest),old=registered.get(key);
      if(old){if(old.serialized!==serialized)throw Error('同一原畫版本不可悄悄改變來源。');return old.manifest;}
      const records=frameManifests.get(manifest.character)||[];
      if([...registered.values()].some(record=>record.manifest.id===manifest.id))throw Error('此分格增量 id 已登記其他版本或角色，請重新載入相符版本。');
      if(manifest.coverage.cells.some(c=>coversCell(base,c.direction,c.sheet,c.frame)||records.some(record=>coversCell(record.manifest,c.direction,c.sheet,c.frame))))throw Error('分格增量不可重疊封版底稿或其他增量的實際影格。');
      const record={manifest,serialized,token:++sequence};registered.set(key,record);frameManifests.set(manifest.character,[...records,record]);return manifest;
    }
    async function loadManifest(url){
      const match=typeof url==='string'&&/^\.\/assets\/painted-avatar\/([a-z0-9][a-z0-9-]{0,95})\/manifest\.json$/.exec(url);
      if(!match||!E.fetch)throw Error('只可載入登錄格式的本機原畫清單。');
      const response=await E.fetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('原畫清單載入失敗。');const raw=await response.json();if(own(raw,'id')!==match[1])throw Error('原畫清單資料夾不相符。');return registerManifest(raw);
    }
    function availableProfile(state){
      const clean=publicState(state),m=clean&&manifests.get(clean.appearance.character)?.manifest;
      return matchesLoadout(m,clean)?m:null;
    }
    // The original API still means full 64-frame support. Pilot use is always
    // frame-aware and never changes movement to fit the one available picture.
    function profile(state){const m=availableProfile(state);return m?.status==='complete'?m:null;}
    const supports=state=>!!profile(state);
    function frameProfile(state,view='down',type='actions',frame=0){
      if(!validCell({direction:view,sheet:type,frame}))return null;
      const clean=publicState(state),m=availableProfile(clean);if(!m)return null;
      if(coversCell(m,view,type,frame))return m;
      return (frameManifests.get(m.character)||[]).find(record=>matchesLoadout(record.manifest,clean)&&coversCell(record.manifest,view,type,frame))?.manifest||null;
    }
    const supportsFrame=(state,view='down',type='actions',frame=0)=>!!frameProfile(state,view,type,frame);
    function plan(state,view='down',type='actions',options={}){
      const clean=publicState(state),candidate=availableProfile(clean),pilot=candidate?.status==='pilot',frame=options.frame??0;
      if(!pilot){view=direction(view);type=sheet(type);}
      const m=frameProfile(clean,view,type,pilot?frame:0);if(!m)throw Error('此角色、裝備或影格尚無支援的逐格分層原畫。');
      const tier=options.tier==='art'?'art':'scene',onlySlot=options.onlySlot||null;if(onlySlot&&!SLOTS.includes(onlySlot))throw Error('原畫單件欄位不合法。');
      const selected=m.passes.filter(p=>(onlySlot?p.ownerSlot===onlySlot&&p.itemId===clean.rpg.loadout[onlySlot]:p.ownerSlot===null||p.itemId===clean.rpg.loadout[p.ownerSlot])&&Object.entries(p.requires||{}).every(([slot,item])=>clean.rpg.loadout[slot]===item));
      const passes=selected.map(p=>{
        const index=m.passes.indexOf(p),compact=tier==='scene'&&(pilot||!!p.compactImages),f=pilot?p.frames.find(c=>c.direction===view&&c.sheet===type&&c.frame===frame):null;
        return {id:p.id,ownerSlot:p.ownerSlot,itemId:p.itemId,requires:p.requires||null,z:p.zByDirection?.[view]??p.z,index,url:pilot?(compact?f.compactImage:f.image):(compact?p.compactImages:p.images)[view][type],sourceWidth:pilot?(compact?COMPACT_CELL.width:CELL.width):(compact?COMPACT.width:ATLAS.width),sourceHeight:pilot?(compact?COMPACT_CELL.height:CELL.height):(compact?COMPACT.height:ATLAS.height)};
      }).sort((a,b)=>a.z-b.z||a.index-b.index);
      const atlas=pilot?(tier==='scene'?COMPACT_CELL:CELL):(tier==='scene'?COMPACT:ATLAS),parts=[m.id,m.revision,registered.get(manifestKey(m)).token,view,type,tier,onlySlot,...SLOTS.map(slot=>clean.rpg.loadout[slot])];
      if(pilot)parts.push('single-cell',frame);
      const key=JSON.stringify(parts);
      return freeze({key,id:m.id,revision:m.revision,character:m.character,direction:view,sheet:type,tier,onlySlot,loadout:clean.rpg.loadout,passes,atlas,anchor:[128,372],previewBox:m.previewBox,portraitBox:m.portraitBox,...(pilot?{storage:'single-cells',frame}: {})});
    }
    async function decode(pass,signal){
      if(signal?.aborted)throw aborted();if(failures.has(pass.url))throw Error('原畫層目前無法使用。');let image;
      try{
        if(E.loadImage)image=await E.loadImage(pass.url,pass.sourceWidth,pass.sourceHeight,{signal});
        // Offline exports can be opened directly from disk. A file image can
        // decode through Image even when fetch(file://...) is CORS-blocked.
        else if(E.locationProtocol!=='file:'&&E.fetch&&E.createImageBitmap){const response=await E.fetch(pass.url,{credentials:'same-origin',signal});if(!response.ok)throw Error('原畫層下載失敗。');image=await E.createImageBitmap(await response.blob());}
        else image=await new Promise((resolve,reject)=>{
          if(!E.Image){reject(Error('此環境無法解碼圖像。'));return;}
          const picture=new E.Image(),cleanup=()=>{picture.onload=picture.onerror=null;signal?.removeEventListener('abort',cancel);};
          const cancel=()=>{cleanup();picture.src='';reject(aborted());};
          picture.decoding='async';picture.onload=()=>{cleanup();resolve(picture);};picture.onerror=()=>{cleanup();reject(Error('原畫層下載失敗。'));};
          signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();else picture.src=pass.url;
        });
        if(signal?.aborted)throw aborted();
        if((image.naturalWidth||image.width)!==pass.sourceWidth||(image.naturalHeight||image.height)!==pass.sourceHeight)throw Error('原畫層尺寸不符，已停止此合成。');
        if(typeof image.decode==='function')await image.decode();if(signal?.aborted)throw aborted();return {image};
      }catch(error){image?.close?.();if(signal?.aborted)throw aborted();if(error.name!=='AbortError')failures.add(pass.url);throw error;}
    }
    async function acquire(state,view='down',type='actions',options={}){
      const p=plan(state,view,type,options),{width,height}=p.atlas;
      return frameCache.acquire(p.key,width*height*4,(alive,signal)=>queue(async()=>{
        if(!alive())throw aborted();const canvas=makeCanvas(width,height),ctx=canvas.getContext('2d');if(!ctx)throw Error('此環境無法合成角色原畫。');
        ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';let started=E.now(),sources=[],firstError=null;
        const group=E.AbortController?new E.AbortController():null,cancel=()=>group?.abort(),sourceConsumerSignal=group?.signal||signal;
        signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
        try{
          // These independent layers share one bounded reservation pool. Start
          // their downloads together so a first turn does not pay one network
          // round trip per garment. All settled handles are released even when
          // one source fails; no partial composite becomes visible.
          // A failed or abandoned composite must not wait for an unrelated
          // slow layer. Cancel this group's consumers, not a shared producer.
          const settled=await Promise.allSettled(p.passes.map(pass=>sourceCache.acquire(pass.url,pass.sourceWidth*pass.sourceHeight*4,(_,sourceSignal)=>decode(pass,sourceSignal),{signal:sourceConsumerSignal}).catch(error=>{if(!firstError)firstError=error;cancel();throw error;})));
          sources=settled.filter(result=>result.status==='fulfilled').map(result=>result.value);
          const failed=settled.find(result=>result.status==='rejected');if(failed)throw firstError||failed.reason;
          for(let index=0;index<p.passes.length;index++){
            if(!alive())throw aborted();
            const pass=p.passes[index],source=sources[index];
            ctx.drawImage(source.value.image,0,0,pass.sourceWidth,pass.sourceHeight,0,0,width,height);
            if(E.now()-started>=5){await yieldTask();started=E.now();}
          }
          if(!alive())throw aborted();return {canvas,key:p.key,direction:p.direction,sheet:p.sheet,width:p.atlas.frameWidth,height:p.atlas.frameHeight,columns:p.atlas.columns,plan:p};
        }catch(error){canvas.width=1;canvas.height=1;throw error;}
        finally{signal?.removeEventListener('abort',cancel);for(const source of sources)source.release();}
      }),options);
    }
    function rememberLocal(record){
      if(!record?.painted||record.failed||record.coverageFallback||!record.actor.classList?.contains?.('local-actor'))return;
      const previous=lastLocalSnapshot?.canvas,canvas=previous||makeCanvas(96,144);
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,96,144);ctx.drawImage(record.surface,0,0,96,144);
      lastLocalSnapshot={canvas,id:availableProfile(record.state)?.id,at:E.now()};
    }
    function retainLocal(canvas,manifest){
      const existing=E.document?.querySelector?.('.local-actor[data-painted-avatar="'+manifest.id+'"]');
      const record=existing&&actors.get(existing);
      if(record?.painted&&!record.failed)rememberLocal(record);
      if(lastLocalSnapshot?.id!==manifest.id||E.now()-lastLocalSnapshot.at>2000)return false;
      canvas.getContext('2d').drawImage(lastLocalSnapshot.canvas,0,0,96,144);
      canvas.dataset.paintedRetainedFrame='true';return true;
    }
    function createBody(node,state,options={}){
      const p=availableProfile(state);if(!p||!native()?.selectFrame)return null;
      const canvas=node('canvas',{class:'painted-avatar-canvas','aria-hidden':'true',width:96,height:144,'data-painted-atlas':p.id,'data-art-method':'painted-frame-layers'});
      if(p.status==='pilot')canvas.dataset.paintedCoverage='pilot';
      // A single equipment click must not flash an unrelated legacy body while
      // its new layers decode. Reuse only this local player's last painted
      // frame, briefly and explicitly as loading; never borrow a remote avatar.
      if(options.local===true)retainLocal(canvas,p);
      bodies.set(canvas,publicState(state));return canvas;
    }
    function register(actor,fallback=null,options={}){
      if(actors.has(actor)){const r=actors.get(actor);if(fallback)r.fallback=fallback;if(options.coverageFallback)r.coverageFactory=options.coverageFallback;return true;}
      const surface=actor?.querySelector?.('.painted-avatar-canvas'),state=bodies.get(surface);if(!surface||!state)return false;
      const p=availableProfile(state);if(!p)return false;
      actor.dataset.paintedAvatar=p.id;
      if(p.status==='pilot')actor.dataset.paintedCoverage='pilot';
      actors.set(actor,{actor,surface,state,fallback,pilot:p.status==='pilot',blockedFrameKeys:new Set(),cellRequest:null,coverageFactory:options.coverageFallback||null,coverageFallback:null,retaining:false,visual:null,input:null,previousVisual:null,previousInput:null,selected:null,handle:null,controller:null,deadline:null,epoch:0,pending:false,requested:null,painted:null,failed:false});return true;
    }
    function hideCoverageFallback(record){
      record.retaining=false;
      const f=record.coverageFallback;if(!f)return;
      f.api?.dispose?.(record.actor);f.element?.remove?.();record.coverageFallback=null;
      for(const name of ['native-actor','layered-actor'])record.actor.classList.remove(name);
      for(const name of ['nativeAvatar','layeredPose','layeredFrame','layeredDirection','layeredAssetStatus'])delete record.actor.dataset[name];
    }
    function coverageFallbackReady(record){
      const f=record.coverageFallback;
      return !!f&&(f.kind==='legacy'||(f.kind==='native'&&record.actor.dataset.nativeAssetStatus==='ready')||(f.kind==='layered'&&record.actor.dataset.layeredAssetStatus==='ready'));
    }
    function showCoverageFallback(record,status){
      let f=record.coverageFallback;
      if(!f){
        const created=record.coverageFactory?.();
        f=created?.element?created:{element:record.fallback?.(),kind:'legacy',api:null};
        if(f.element){
          record.coverageFallback=f;record.actor.appendChild(f.element);
          if(f.kind==='native'){
            record.actor.classList.add('native-actor');record.actor.dataset.nativeAvatar=f.element.dataset.nativeAtlas;
          }else if(f.kind==='layered')record.actor.classList.add('layered-actor');
          const restore=()=>{
            const element=record.fallback?.();
            if(element){
              f.element=element;f.kind='legacy';f.api=null;element.style.display=record.retaining?'none':'';
              if(!record.retaining)record.actor.querySelector?.('.painted-loading-body')?.remove?.();
            }
            return element;
          };
          f.api?.register?.(record.actor,restore);
          // Re-enter the old renderer from the actual preceding sample, so its
          // own start/stop/turn selection continues instead of freezing on idle.
          if(f.api&&record.previousVisual&&record.previousInput)f.api.update?.(record.actor,record.previousVisual,record.previousInput);
        }
      }
      // Only a supported, still-loading local idle may retain its previous
      // painted cell. A real turn/run must never keep that static picture.
      const retaining=status==='loading-fallback'&&record.selected?.pose==='idle'&&record.actor.classList.contains('local-actor')&&record.surface.dataset.paintedRetainedFrame==='true';
      record.retaining=retaining;record.surface.style.display=retaining?'':'none';
      record.actor.classList.toggle('painted-actor',retaining);
      for(const kind of ['native','layered'])record.actor.classList.toggle(kind+'-actor',!retaining&&f?.kind===kind);
      record.actor.dataset.paintedAssetStatus=status;record.actor.dataset.paintedSource=retaining?'retained-loading':'fallback';
      for(const key of ['paintedDirection','paintedSheet','paintedFrame','paintedPose','paintedPlan'])delete record.actor.dataset[key];
      const ready=coverageFallbackReady(record);
      // Keep exactly one visible body. The native/layered renderer can prepare
      // its surface while hidden; reveal it only after its actual ready signal.
      if(f?.element)f.element.style.display=retaining||!ready?'none':'';
      let loader=record.actor.querySelector?.('.painted-loading-body');
      if(retaining){if(loader)loader.style.display='none';}
      else if(ready)loader?.remove?.();
      else{
        if(!loader){loader=record.fallback?.();if(loader){loader.classList.add('painted-loading-body');record.actor.appendChild(loader);}}
        if(loader)loader.style.display='';
      }
      return false;
    }
    function suspendPilot(record,status){
      cancelCellRequest(record);
      clearDeadline(record);
      if(record.requested!==null||record.pending||record.handle){record.epoch++;record.controller?.abort();record.handle?.release();record.handle=null;record.pending=false;record.requested=null;record.painted=null;}
      return showCoverageFallback(record,status);
    }
    function paint(record){
      if(!record.handle||!record.selected||record.failed)return;
      const atlas=record.handle.value,frame=record.selected.frame;if(atlas.direction!==record.selected.direction||atlas.sheet!==record.selected.sheet)return;
      if(atlas.plan.storage==='single-cells'&&atlas.plan.frame!==frame)return;
      const key=atlas.key+':'+frame;if(record.painted===key)return;
      const index=atlas.plan.storage==='single-cells'?0:frame;
      const ctx=record.surface.getContext('2d');ctx.clearRect(0,0,record.surface.width,record.surface.height);ctx.drawImage(atlas.canvas,index%atlas.columns*atlas.width,Math.floor(index/atlas.columns)*atlas.height,atlas.width,atlas.height,0,0,record.surface.width,record.surface.height);
      if(record.pilot){hideCoverageFallback(record);record.surface.style.display='';record.actor.classList.add('painted-actor');record.actor.dataset.paintedSource='painted';record.actor.dataset.paintedAssetStatus='ready';}
      record.actor.querySelector?.('.painted-loading-body')?.remove?.();record.painted=key;
      delete record.actor.dataset.paintedFailure;
      delete record.surface.dataset.paintedRetainedFrame;
      Object.assign(record.actor.dataset,{paintedDirection:atlas.direction,paintedSheet:atlas.sheet,paintedFrame:String(frame),paintedPose:record.selected.pose,paintedPlan:atlas.plan.id+'@'+atlas.plan.revision});
    }
    function failure(record,error){
      if(record.pilot){
        const cell=record.selected,m=cell&&frameProfile(record.state,cell.direction,cell.sheet,cell.frame);
        // An additive cell cannot poison the sealed idle or the other authored
        // cells. Remember the failed cell so a running actor never retries it
        // every tick. Existing base-profile failure semantics remain unchanged.
        if(m?.extensionOf)record.blockedFrameKeys.add(cellKey(cell.direction,cell.sheet,cell.frame));else record.failed=true;
        record.actor.dataset.paintedFailure=error?.message||'asset-unavailable';suspendPilot(record,'asset-fallback');return;
      }
      record.failed=true;record.pending=false;record.actor.querySelector?.('.painted-loading-body')?.remove?.();
      const replacement=record.fallback?.();if(replacement)record.actor.replaceChild(replacement,record.surface);else record.surface.getContext('2d')?.clearRect(0,0,record.surface.width,record.surface.height);
      dispose(record.actor);record.actor.classList.remove('painted-actor');delete record.actor.dataset.paintedAvatar;record.actor.dataset.paintedAssetStatus='fallback';record.actor.dataset.paintedFailure=error?.message||'asset-unavailable';
    }
    function cancelCellRequest(record){
      const job=record.cellRequest;if(!job)return;record.cellRequest=null;clearDeadline(job);job.controller?.abort();
    }
    function resumeSelected(record){
      const cell=record.selected;
      if(actors.get(record.actor)!==record||record.failed||!cell||record.blockedFrameKeys.has(cellKey(cell.direction,cell.sheet,cell.frame))||!supportsFrame(record.state,cell.direction,cell.sheet,cell.frame))return;
      request(record,cell.direction,cell.sheet,cell.frame);paint(record);
      if(!record.painted)showCoverageFallback(record,'loading-fallback');
    }
    function requestCell(record,view,type,frame,key){
      if(record.requested!==key){
        record.requested=key;record.epoch++;clearDeadline(record);record.controller?.abort();record.controller=null;
        record.handle?.release();record.handle=null;record.painted=null;
      }
      if(record.handle)return;
      const p=plan(record.state,view,type,{frame}),ready=frameCache.acquireReady(p.key);
      if(ready){record.handle=ready;record.pending=false;paint(record);return;}
      record.pending=true;record.actor.dataset.paintedAssetStatus='loading';
      // A single authored cell can take longer to decode than one gait step.
      // Finish at most ONE already-requested extension cell per actor instead
      // of aborting/restarting it every step. No preload, queue, or extra RAF.
      // Other current cells use only a ready cache entry or truthful fallback.
      if(record.cellRequest)return;
      const job={key,view,type,frame,controller:E.AbortController?new E.AbortController():null,deadline:null};record.cellRequest=job;
      const current=()=>actors.get(record.actor)===record&&record.cellRequest===job;
      const failed=error=>{
        if(!current())return;record.cellRequest=null;clearDeadline(job);job.controller?.abort();
        if(error.name==='AbortError')return;
        // The rejected source belongs to job A, even when B is now selected.
        // Never let a late A error poison or erase an already-ready B.
        record.blockedFrameKeys.add(cellKey(view,type,frame));
        const selected=record.selected;
        if(selected?.direction===view&&selected.sheet===type&&selected.frame===frame){record.actor.dataset.paintedFailure=error.message||'asset-unavailable';suspendPilot(record,'asset-fallback');}
        else resumeSelected(record);
      };
      if(E.setTimeout&&E.clearTimeout)job.deadline=E.setTimeout(()=>failed(pilotTimeout()),PILOT_LOAD_TIMEOUT_MS);
      acquire(record.state,view,type,{frame,signal:job.controller?.signal}).then(handle=>{
        if(!current()){handle.release();return;}record.cellRequest=null;clearDeadline(job);
        const selected=record.selected;
        if(record.requested===key&&selected?.direction===view&&selected.sheet===type&&selected.frame===frame){
          record.handle?.release();record.handle=handle;record.pending=false;record.painted=null;paint(record);
        }else handle.release();
        resumeSelected(record);
      }).catch(failed);
    }
    function request(record,view,type,frame=0){
      const key=view+':'+type+(record.pilot?':'+frame:'');
      if(record.pilot&&frameProfile(record.state,view,type,frame)?.extensionOf){requestCell(record,view,type,frame,key);return;}
      if(record.requested===key)return;
      record.requested=key;record.pending=true;record.actor.dataset.paintedAssetStatus='loading';record.controller?.abort();record.controller=E.AbortController?new E.AbortController():null;
      record.handle?.release();record.handle=null;const epoch=++record.epoch;
      // A partial-art supplement may not keep a stationary actor/preview in
      // permanent loading. This deadline is not an animation clock and never
      // applies to the delivered complete professor renderer.
      clearDeadline(record);
      if(record.pilot){
        record.painted=null;const ready=frameCache.acquireReady(plan(record.state,view,type,{frame}).key);
        if(ready){record.handle=ready;record.pending=false;paint(record);return;}
      }
      if(record.pilot&&E.setTimeout&&E.clearTimeout)record.deadline=E.setTimeout(()=>{if(actors.has(record.actor)&&record.epoch===epoch&&record.pending)failure(record,pilotTimeout());},PILOT_LOAD_TIMEOUT_MS);
      acquire(record.state,view,type,{frame,signal:record.controller?.signal}).then(handle=>{
        if(!actors.has(record.actor)||record.epoch!==epoch){handle.release();return;}clearDeadline(record);record.handle=handle;record.pending=false;record.painted=null;record.actor.dataset.paintedAssetStatus='ready';paint(record);
      }).catch(error=>{if(record.epoch!==epoch||!actors.has(record.actor)||error.name==='AbortError')return;clearDeadline(record);failure(record,error);});
    }
    function update(actor,visual,input={}){
      if(!actors.has(actor)&&!register(actor))return false;const r=actors.get(actor);
      r.previousVisual=r.visual;r.previousInput=r.input;r.visual=visual;r.input={...input};
      if(r.failed)return r.pilot?showCoverageFallback(r,'asset-fallback'):false;
      r.selected=native().selectFrame(r.selected,visual,input);
      if(r.pilot&&r.blockedFrameKeys.has(cellKey(r.selected.direction,r.selected.sheet,r.selected.frame)))return suspendPilot(r,'asset-fallback');
      if(r.pilot&&!supportsFrame(r.state,r.selected.direction,r.selected.sheet,r.selected.frame))return suspendPilot(r,'coverage-fallback');
      request(r,r.selected.direction,r.selected.sheet,r.selected.frame);paint(r);
      if(r.pilot&&!r.painted)return showCoverageFallback(r,'loading-fallback');
      return true;
    }
    function needsFrame(actor){
      const r=actors.get(actor);if(!r)return false;
      // A ready fallback may have completed after this frame's dispatch. Give
      // the shared clock one final handoff tick instead of leaving its loader.
      const handoff=r.pilot&&!r.retaining&&coverageFallbackReady(r)&&r.coverageFallback.element?.style.display==='none';
      return !!handoff||!r.failed&&(r.pending||r.selected?.needsFrame);
    }
    function dispose(element){
      const r=actors.get(element);if(r){rememberLocal(r);r.epoch++;cancelCellRequest(r);clearDeadline(r);r.controller?.abort();r.handle?.release();r.handle=null;r.pending=false;hideCoverageFallback(r);bodies.delete(r.surface);actors.delete(element);}
      const p=previews.get(element);if(p){p.dead=true;p.epoch++;clearDeadline(p);p.controller?.abort();p.dialog?.removeEventListener?.('close',p.close);previews.delete(element);}
    }
    function setFrame(canvas,options={}){
      const r=previews.get(canvas);if(!r||r.dead)return Promise.reject(Error('原畫預覽已關閉。'));
      const view=direction(options.direction??r.direction),type=sheet(options.sheet),frame=Number.isInteger(options.frame)?Math.max(0,Math.min(7,options.frame)):0;
      r.direction=view;clearDeadline(r);r.timeoutError=null;r.controller?.abort();r.controller=E.AbortController?new E.AbortController():null;const epoch=++r.epoch;canvas.dataset.renderStatus='loading';canvas.dataset.view=view;
      if(!supportsFrame(r.state,view,type,frame)){
        canvas.dataset.renderStatus='fallback';canvas.dataset.paintedFailure='unsupported-frame';
        const fallback=r.fallback?.({direction:view,sheet:type,frame,reason:'unsupported-frame'});
        if(fallback){const classes=canvas.getAttribute?.('class');if(classes)fallback.setAttribute('class',classes.replace(/\bpainted-(?:outfit|item|hud)-preview\b/g,'').trim());fallback.setAttribute('data-painted-fallback','unsupported-frame');dispose(canvas);canvas.replaceWith(fallback);}
        else canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
        r.promise=Promise.resolve(canvas);return r.promise;
      }
      if(r.pilot&&E.setTimeout&&E.clearTimeout)r.deadline=E.setTimeout(()=>{if(!r.dead&&r.epoch===epoch){r.timeoutError=pilotTimeout();r.controller?.abort();}},PILOT_LOAD_TIMEOUT_MS);
      r.promise=acquire(r.state,view,type,{frame,tier:'art',onlySlot:r.onlySlot,signal:r.controller?.signal}).then(handle=>{
        try{
          if(r.dead||r.epoch!==epoch)return canvas;clearDeadline(r);const [x,y,w,h]=r.box,ctx=canvas.getContext('2d'),index=handle.value.plan.storage==='single-cells'?0:frame;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(handle.value.canvas,index%handle.value.columns*256+x,Math.floor(index/handle.value.columns)*384+y,w,h,0,0,canvas.width,canvas.height);
          Object.assign(canvas.dataset,{renderStatus:'ready',paintedSheet:type,paintedFrame:String(frame),paintedPlan:handle.value.plan.id+'@'+handle.value.plan.revision});
          delete canvas.dataset.paintedRetainedFrame;
          const dialog=canvas.closest?.('dialog');if(dialog&&dialog!==r.dialog){r.dialog?.removeEventListener?.('close',r.close);r.dialog=dialog;r.close=()=>dispose(canvas);dialog.addEventListener?.('close',r.close,{once:true});}
          return canvas;
        }finally{handle.release();}
      }).catch(error=>{
        if(r.dead||r.epoch!==epoch||(error.name==='AbortError'&&!r.timeoutError))return canvas;clearDeadline(r);error=r.timeoutError||error;canvas.dataset.renderStatus='error';canvas.dataset.paintedFailure=error.message;
        const fallback=r.fallback?.({direction:view,sheet:type,frame,reason:'asset-unavailable'});if(fallback){const classes=canvas.getAttribute?.('class');if(classes)fallback.setAttribute('class',classes.replace(/\bpainted-(?:outfit|item|hud)-preview\b/g,'').trim());fallback.setAttribute('data-painted-fallback','asset-unavailable');dispose(canvas);canvas.replaceWith(fallback);}return canvas;
      });return r.promise;
    }
    function preview(state,options={}){
      const p=frameProfile(state,direction(options.direction),sheet(options.sheet),Number.isInteger(options.frame)?Math.max(0,Math.min(7,options.frame)):0);if(!p||(!E.document&&!E.createCanvas))return null;
      const cropSlot=options.cropSlot||options.onlySlot;
      const rect=options.portrait?p.portraitBox:cropSlot?p.itemBoxes?.[cropSlot]||p.previewBox:p.previewBox;
      const canvas=makeCanvas(options.portrait?96:rect[2],options.portrait?96:rect[3]);canvas.className=options.portrait?'world-face painted-hud-preview':cropSlot?'painted-item-preview':'outfit-preview painted-outfit-preview';
      canvas.setAttribute?.('role','img');canvas.setAttribute?.('aria-label',options.label||'同底稿逐格原畫實際穿戴圖');
      Object.assign(canvas.dataset,{character:state.appearance.character,view:direction(options.direction),paintedAvatar:p.id,artMethod:'painted-frame-layers',renderStatus:'loading'});
      if(p.status==='pilot')canvas.dataset.paintedCoverage='pilot';
      if(!cropSlot){
        const selector=options.portrait?'.painted-hud-preview':'.bag-avatar .painted-outfit-preview';
        const previous=E.document?.querySelector?.(selector);
        if(previous?.dataset?.paintedAvatar===p.id&&previous.dataset.renderStatus==='ready'&&previous.width===canvas.width&&previous.height===canvas.height){
          canvas.getContext('2d').drawImage(previous,0,0);canvas.dataset.paintedRetainedFrame='true';
        }
      }
      const r={state:publicState(state),direction:direction(options.direction),onlySlot:options.onlySlot||null,box:rect,fallback:options.fallback,pilot:p.status==='pilot',epoch:0,dead:false,controller:null,deadline:null,timeoutError:null,promise:null,dialog:null,close:null};previews.set(canvas,r);setFrame(canvas,options);return canvas;
    }
    function portrait(state,options={}){return preview(state,{...options,direction:'down',portrait:true});}
    function itemPreview(state,item,options={}){
      if(!SLOTS.includes(item?.slot)||!identifier(item?.id))return null;
      const clean=publicState(state);if(!clean)return null;const itemState={appearance:clean.appearance,rpg:{loadout:{[item.slot]:item.id}}};if(!supportsFrame(itemState,direction(options.direction),sheet(options.sheet),Number.isInteger(options.frame)?Math.max(0,Math.min(7,options.frame)):0))return null;
      // A catalogue crop shows the actual item on this same fixed body. The
      // hand/hair occlusion cutouts are not presented as holes in a flat garment.
      // Other equipment slots are empty, so no unowned outfit is implied.
      const canvas=preview(itemState,{...options,cropSlot:item.slot});if(canvas){canvas.dataset.gearId=item.id;canvas.dataset.equipmentSlot=item.slot;canvas.dataset.previewContext='same-body-item-crop';}return canvas;
    }
    return {registerManifest,registerFrameManifest,loadManifest,profile,supports,supportsFrame,plan,describe:plan,acquire,createBody,register,update,needsFrame,dispose,preview,portrait,itemPreview,setFrame,ready:canvas=>previews.get(canvas)?.promise||Promise.resolve(canvas),stats:()=>({sources:sourceCache.stats(),frames:frameCache.stats(),failedSources:failures.size}),clearUnused(){sourceCache.clear();frameCache.clear();},clearFailures(){failures.clear();}};
  }
  return {SLOTS,DIRECTIONS,SHEETS,ATLAS,COMPACT,CELL,COMPACT_CELL,SOURCE_BYTES,FRAME_BYTES,PILOT_LOAD_TIMEOUT_MS,publicState,direction,safeURL,validateManifest,createCache,createRuntime,...createRuntime()};
});
