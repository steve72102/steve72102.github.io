'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../game/raster-outfit.js'),A=require('../game/academy.js'),R=require('../game/adventure.js'),E=require('../game/engine.js');
const env={MindAcademy:A,MindAdventure:R,MindEngine:E};
function manifest(){
 const parts=()=>Object.fromEntries([...new Set(Object.values(M.PARTS).flat()),'hand.L','hand.R'].map((key,i)=>[key,{atlas:'cloth',rect:[i%4*32,Math.floor(i/4)*32,30,30]}]));
 const kit={views:Object.fromEntries(M.DIRECTIONS.map((d,i)=>[d,{parts:Object.fromEntries(Object.entries(parts()).map(([k,v])=>[k,{...v,rect:[v.rect[0]+i*128,v.rect[1],30,30]}]))}]))};
 return {version:1,revision:'fixture-only',atlases:{cloth:{src:'cloth.png',width:512,height:256},head:{src:'head.png',width:400,height:100}},kits:{bach:kit,haydn:kit},heads:Object.fromEntries(A.CHARACTERS.map((c,i)=>[c.id,Object.fromEntries(M.DIRECTIONS.map((d,j)=>[d,{atlas:'head',rect:[j*100,i*10,40,10]}]))])),defaults:{shirt:'bach',pants:'bach',shoes:'bach'},catalog:Object.fromEntries(E.ITEMS.map(i=>[i.id,{kit:'bach',slot:'handheld'}]))};
}
const state=(character='doctor',loadout=Object.fromEntries(R.setIds('bach').map(id=>[R.gear(id).slot,id])))=>({appearance:{version:1,character,pet:null},rpg:{loadout}});

test('all 10 body fits have finite articulated limbs in four authored views and 8 distinct strides',()=>{
 const signatures=[];
 for(const c of A.CHARACTERS){const b=M.body(c.id);signatures.push(JSON.stringify([b.height,b.shoulders,b.waist,b.hips,b.leg,b.head]));for(const d of M.DIRECTIONS){const frames=[];for(let i=0;i<8;i++){const p=M.pose(c.id,d,i/8,'run');frames.push(JSON.stringify(p.limbs));for(const n of ['L','R'])for(const limb of ['arm','leg']){const points=p.limbs[n][limb];for(const q of Object.values(points))assert(Number.isFinite(q.x)&&Number.isFinite(q.y));const mesh=M.limbMesh(points,50);assert(mesh.vertices.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));assert(mesh.triangles.length>4);}}assert.equal(new Set(frames).size,8,c.id+' '+d);}}
 assert.equal(new Set(signatures).size,10);
});

test('front idle legs are straight and planted while running alternates real feet and opposing arms',()=>{
 const idle=M.pose('doctor','down');for(const side of ['L','R']){const leg=idle.limbs[side].leg;assert.equal(leg.root.x,leg.joint.x);assert.equal(leg.joint.x,leg.tip.x);}
 // Reviewed gait change: phase .125 is support and .625 is opposite support.
 // A recovering ankle can be ahead while its knee is already coming back; arm
 // opposition must follow the thighs, not the old projected ankle-X heuristic.
 const first=M.pose('doctor','right',.125,'run'),second=M.pose('doctor','right',.625,'run');
 assert(first.limbs.L.contact);assert(!first.limbs.R.contact);assert(!second.limbs.L.contact);assert(second.limbs.R.contact);
 for(const p of [first,second]){const a=p.limbs.L.anatomical,b=p.limbs.R.anatomical;assert((a.thighDegrees-b.thighDegrees)*(a.upperArmDegrees-b.upperArmDegrees)<0,'arms oppose the contralateral thigh swing');assert.notEqual(p.limbs.L.leg.tip.x,p.limbs.R.leg.tip.x);assert.notEqual(p.limbs.L.arm.tip.x,p.limbs.R.arm.tip.x);}
 assert.notDeepEqual(first.limbs,second.limbs);
});

test('professor reference fit keeps an adult bust-to-waist contour across four views and run poses',()=>{
 const art=require('../game/raster-art.js'),s=state('professor',{});
 for(const d of M.DIRECTIONS){
  const parts=M.plan(s,d,art,env).parts;
  for(const [phase,action] of [[0,'idle'],[.125,'run'],[.625,'run']]){
   const p=M.pose('professor',d,phase,action);p.headPart=parts.head;
   const mesh=M.partMesh('body.torso',parts['body.torso'],p),row=i=>mesh.vertices.slice(i*mesh.columns,(i+1)*mesh.columns);
   assert.equal(mesh.columns,7);assert(mesh.vertices.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
   const bust=row(4),waist=row(7),bustWidth=bust.at(-1).x-bust[0].x,waistWidth=waist.at(-1).x-waist[0].x;
   assert(bustWidth>waistWidth*1.3,d+' fuller bust and defined waist');
   if(d==='right')assert(bust.at(-1).x-row(6).at(-1).x>15,'right anterior bust projects beyond abdomen');
   if(d==='left')assert(row(6)[0].x-bust[0].x>15,'left anterior bust projects beyond abdomen');
  }
 }
});

test('all ten actors keep their own heads and finite four-view shell surfaces through RUN8',()=>{
 const art=require('../game/raster-art.js'),signatures=new Set();
 for(const actor of A.CHARACTERS){
  const s=state(actor.id,{});
  for(const d of M.DIRECTIONS){
   const parts=M.plan(s,d,art,env).parts;
   assert.deepEqual(parts.head.rect,art.heads[actor.id][d].rect,actor.id+' owns its source head');
   for(const phase of [0,.125,.375,.625,.875]){
    const p=M.pose(actor.id,d,phase,phase?'run':'idle');p.headPart=parts.head;
    for(const key of ['body.torso','body.armL','body.armR','body.legL','body.legR','body.footL','body.footR']){
     const mesh=M.partMesh(key,parts[key],p);
     assert.equal(mesh.columns,7,actor.id+' '+d+' '+key);
     assert(mesh.vertices.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)),actor.id+' '+d+' finite '+key);
    }
   }
   if(d==='down'){
    const p=M.pose(actor.id,d);p.headPart=parts.head;
    const mesh=M.partMesh('body.torso',parts['body.torso'],p),row=i=>mesh.vertices.slice(i*7,(i+1)*7);
    signatures.add([actor.id,...[4,7,9].map(i=>(row(i).at(-1).x-row(i)[0].x).toFixed(2))].join(':'));
   }
  }
 }
 assert.equal(signatures.size,10);
 const opt={bodyProfile:'graduate-reference-v1',direction:'down'},p=M.pose('graduate','down',0,'idle',opt);
 assert(p.bodyProfile,'graduate opt-in reference remains available');
});

test('mesh corrects angled source limb centerlines continuously through knees and elbows',()=>{
 const limb={root:{x:0,y:0},joint:{x:0,y:50},tip:{x:0,y:100}},mesh=M.limbMesh(limb,40,{root:[.2,0],joint:[.5,.5],tip:[.8,1]});
 const middle=mesh.vertices.find(v=>v.u===.5&&v.v===.5);assert.equal(middle.x,0);assert.equal(middle.y,50);const top=mesh.vertices.find(v=>v.u===.5&&v.v===0),bottom=mesh.vertices.find(v=>v.u===.5&&v.v===1);assert(top.x>0);assert(bottom.x<0);
 for(const tri of mesh.triangles)for(const i of tri)assert(i>=0&&i<mesh.vertices.length);
});

test('true directional parts keep the book on the same anatomical hand with depth-order changes',()=>{
 const m=manifest(),down=M.plan(state(),'down',m,env),left=M.plan(state(),'left',m,env),right=M.plan(state(),'right',m,env);assert.notDeepEqual(left.parts['jacket.torso'].rect,right.parts['jacket.torso'].rect);
 const l=M.layers(M.pose('doctor','left'),left.parts),r=M.layers(M.pose('doctor','right'),right.parts);assert(l.indexOf('handheld')>l.indexOf('jacket.torso'));assert(r.indexOf('handheld')<r.indexOf('jacket.torso'));assert.equal(down.parts.handheld.item,'style-bach-handheld');
});

test('single-item preview and mixed fullwear plan use identical measured raster parts without changing state',()=>{
 const m=manifest(),s=state('herbal-mentor',{...state().rpg.loadout,hat:'style-haydn-hat'}),before=JSON.stringify(s),full=M.plan(s,'down',m,env);
 for(const slot of M.SLOTS){const id=s.rpg.loadout[slot],single=M.plan(state(s.appearance.character,{[slot]:id}),'down',m,env,slot);for(const key of M.PARTS[slot])assert.deepEqual(single.parts[key],full.parts[key]);}
 for(const item of E.ITEMS){const p=M.plan(state('doctor',{handheld:item.id}),'down',m,env,'handheld');assert.equal(p.parts.handheld.item,item.id);}
 assert.equal(JSON.stringify(s),before);
});

test('missing art and invalid atlas crops fail explicitly instead of substituting flat artwork',()=>{
 const m=manifest();delete m.kits.bach.views.left;assert.throws(()=>M.plan(state(),'left',m,env),/缺少/);assert.throws(()=>M.checkedPart({atlas:'cloth',rect:[500,0,30,30]},m),/裁切/);assert.throws(()=>M.plan(state('doctor',{jacket:'fruit-citrus-jacket'}),'down',m,env),/缺少/);
 const key=M.plan({...state(),profile:{name:'PRIVATE'},account:{uid:'SECRET'}},'down',manifest(),env).key;assert(!key.includes('PRIVATE'));assert(!key.includes('SECRET'));
});

test('byte-bounded atlas cache never revokes in-use images and shares concurrent appearances',async()=>{
 const closed=[],cache=M.createCache(20,v=>closed.push(v.id));let renders=0;const make=id=>async()=>{renders++;return {id};};
 const [a,b]=await Promise.all([cache.acquire('look',10,make('look')),cache.acquire('look',10,make('look'))]);assert.equal(renders,1);assert.equal(a.value,b.value);const c=await cache.acquire('other',10,make('other'));assert.equal(cache.stats().bytes,20);await assert.rejects(cache.acquire('third',10,make('third')),/忙碌/);assert.deepEqual(closed,[]);
 a.release();assert.equal(cache.stats().pinned,2);b.release();const d=await cache.acquire('third',10,make('third'));assert.deepEqual(closed,['look']);assert.equal(cache.stats().bytes,20);c.release();d.release();cache.clear();assert.equal(cache.stats().bytes,0);assert.equal(closed.length,3);d.release();assert.equal(closed.length,3);
});

test('sixty current 24-pose atlases and eight retiring views fit within the declared scene byte budget',()=>{
 const cost=M.FRAME.width*M.FRAME.height*M.FRAME.count*4;assert.equal(cost,829440);assert(68*cost<M.SCENE_BYTES);assert.equal(M.SCENE_BYTES,64*1024*1024);
});

function runtimeFixture(options={}){
 // A full figure now pins its own-hand atlas as the third texture; the
 // zero-pin disposal assertions remain unchanged.
 const m=options.manifest||manifest(),events=[],frames=new Map();let clock=0,serial=0,workTime=0,bakes=0;const yields=[];
 const context=()=>({save(){},restore(){},clearRect(){},scale(){},translate(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},quadraticCurveTo(){},fill(){},fillRect(){},createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},closePath(){},transform(...args){assert(args.every(Number.isFinite));},drawImage(image){events.push(image.src);workTime+=options.drawCost||0;}});
 const createCanvas=(width,height)=>({width,height,dataset:{},attrs:{},isConnected:false,setAttribute(k,v){this.attrs[k]=v;},getContext:()=>context()});
 const runtime=M.createRuntime({...env,manifest:()=>m,createCanvas,loadImage:async src=>({src}),canvasURL:async()=>{bakes++;return {url:'blob:fixture-'+(++serial),objectURL:true};},URL:{revokeObjectURL:url=>events.push('release:'+url)},requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),document:{hidden:false},now:()=>workTime,yieldTask:async()=>{yields.push({workTime,draws:events.length});await options.onYield?.();},matchMedia:()=>({matches:false})});
 return {runtime,events,frames,yields,bakes:()=>bakes,tick(){clock+=40;const list=[...frames.values()];frames.clear();for(const fn of list)fn(clock);}};
}

test('canvas preview contract releases static texture pins and stops animated previews after DOM removal',async()=>{
 const f=runtimeFixture(),c=f.runtime.preview(state());await f.runtime.ready(c);assert.equal(c.dataset.renderStatus,'ready');assert(f.events.includes('cloth.png'));assert.equal(f.runtime.stats().sources.pinned,0);assert.equal(f.frames.size,0);
 c.isConnected=true;await f.runtime.setPose(c,{direction:'right',animate:true});assert.equal(f.runtime.stats().sources.pinned,3);assert.equal(f.frames.size,1);f.tick();const first=f.events.length;f.tick();assert(f.events.length>first);c.isConnected=false;f.tick();assert.equal(f.frames.size,0);assert.equal(f.runtime.stats().sources.pinned,0);f.runtime.dispose(c);
});


test('base clothes are rendering defaults only and optional cargo panels do not become required on other kits',()=>{
 const m=manifest(),s=state('doctor',{}),before=JSON.stringify(s);for(const d of M.DIRECTIONS){delete m.kits.bach.views[d].parts['pants.pocketL'];delete m.kits.bach.views[d].parts['pants.pocketR'];const p=M.plan(s,d,m,env);assert(p.parts['shirt.torso']);assert(p.parts['pants.legL']);assert(p.parts['shoes.L']);assert(p.parts.head);assert(!p.parts['jacket.torso']);assert(!p.parts.hat);assert(Object.values(p.items).every(v=>v===null));}assert.equal(JSON.stringify(s),before);
});

test('authored ankle and sole anchors stay grounded across body fits, views, and strides',()=>{
 for(const c of A.CHARACTERS)for(const d of M.DIRECTIONS)for(const phase of [0,.125,.375,.625,.875]){
  const p=M.pose(c.id,d,phase,phase?'run':'idle'),before=JSON.stringify(p),parts=Object.fromEntries(['L','R'].map(side=>['shoes.'+side,{atlas:'fixture',rect:[0,0,80,d==='down'?120:78],anchor:[.46,.72]}])),fitted=M.fitFeet(p,parts);
  for(const side of ['L','R']){const mesh=M.partMesh('shoes.'+side,parts['shoes.'+side],fitted),soleY=(mesh.vertices[2].y+mesh.vertices[3].y)/2;
   if(!p.athleteRun8)assert(Math.abs(soleY-(p.limbs[side].leg.tip.y+20))<1e-8,c.id+' '+d+' unchanged idle fit');
   else {const leg=fitted.limbs[side].leg,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));assert(Math.abs(dist(leg.root,leg.joint)-p.runLengths.legUpper)<1e-8);assert(Math.abs(dist(leg.joint,leg.tip)-p.runLengths.legLower)<1e-8);
    // During flight the fixed-length IK may clamp an unreachable synthetic boot
    // target. Never stretch the bones to satisfy its arbitrary crop padding.
    if(p.limbs[side].contact)assert(Math.abs(soleY-M.SPACE.foot)<1e-8,c.id+' '+d+' support sole stays on ground');
    else assert(Number.isFinite(soleY)&&soleY<M.SPACE.foot,c.id+' '+d+' flight sole remains above ground');
   }
  }
  assert.equal(JSON.stringify(p),before,'fit does not mutate the motion skeleton');
 }
});

test('hem fitting preserves upper cloth features and full coats reach the intended lower-leg height',()=>{
 const p=M.pose('doctor'),normal=M.clothMesh(p,120,180,130,'jacket'),long=M.clothMesh(p,120,180,130,'jacket',{lengthScale:1.5,hemStart:.65});for(let i=0;i<normal.vertices.length;i++)if(normal.vertices[i].v<=.65)assert.deepEqual(long.vertices[i],normal.vertices[i]);assert.equal(long.vertices.at(-1).y-normal.vertices.at(-1).y,90);
 const part={atlas:'fixture',rect:[0,0,150,180],garmentLength:'full'},mesh=M.partMesh('jacket.torso',part,p);assert.equal(Math.max(...mesh.vertices.map(v=>v.y)),M.SPACE.foot-15);
});

test('neck skin layers behind collars while the remaining head and long hair stay in front',()=>{
 const m=manifest(),neck=[[[.4,.7],[.6,.7],[.6,1],[.4,1]]];m.heads.doctor.down.neckMask=neck;const p=M.plan(state(),'down',m,env),order=M.layers(M.pose('doctor'),p.parts);assert(p.parts['head.neck'].mask.flat().every(([,v])=>v<=.835+1e-9));assert(p.parts['head.neck'].mask.flat().some(([,v])=>Math.abs(v-.835)<1e-9));assert.equal(p.parts.head.cutouts,neck);assert(order.indexOf('head.neck')<order.indexOf('jacket.torso'));assert(order.indexOf('head')>order.indexOf('jacket.torso'));
});

test('one canceled cache subscriber does not discard an appearance still used by another actor',async()=>{
 const cache=M.createCache(20),first=new AbortController(),second=new AbortController();let finish,alive;
 const produce=check=>{alive=check;return new Promise(resolve=>{finish=resolve;});},a=cache.acquire('shared',10,produce,{signal:first.signal}),b=cache.acquire('shared',10,produce,{signal:second.signal});await Promise.resolve();first.abort();await assert.rejects(a,{name:'AbortError'});assert.equal(cache.stats().pinned,1);assert(alive());finish({id:'shared'});const handle=await b;assert.equal(handle.value.id,'shared');handle.release();cache.clear();assert.equal(cache.stats().bytes,0);
});

test('scene baking yields after a 5ms cooperative slice and reuses the completed atlas',async()=>{
 const f=runtimeFixture({drawCost:1}),a=await f.runtime.acquire(state(),'down');assert(f.yields.length>10);let previous=0;for(const at of f.yields){assert(at.workTime-previous<=5,'no next triangle after the slice budget expires');previous=at.workTime;}assert.equal(f.bakes(),1);const b=await f.runtime.acquire(state(),'down');assert.equal(a.value,b.value);assert.equal(f.bakes(),1);a.release();b.release();assert.equal(f.runtime.stats().sources.pinned,0);
});

test('canceling the last actor aborts unfinished baking and releases every acquired texture',async()=>{
 const cancel=new AbortController(),f=runtimeFixture({drawCost:1,onYield:()=>cancel.abort()}),promise=f.runtime.acquire(state(),'down',{signal:cancel.signal});await assert.rejects(promise,{name:'AbortError'});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.bakes(),0);assert.equal(f.runtime.stats().sources.pinned,0);assert.equal(f.runtime.stats().frames.bytes,0);
});

test('switching run preview back to idle and never mounting a preview both release source pins',async()=>{
 const f=runtimeFixture(),c=f.runtime.preview(state(),{animate:true});c.isConnected=true;await f.runtime.ready(c);assert.equal(f.runtime.stats().sources.pinned,3);await f.runtime.setPose(c,{animate:false});assert.equal(f.frames.size,0);assert.equal(f.runtime.stats().sources.pinned,0);
 const unused=f.runtime.preview(state(),{animate:true});await f.runtime.ready(unused);for(let i=0;i<5;i++)f.tick();assert.equal(f.frames.size,0);assert.equal(f.runtime.stats().sources.pinned,0);
});

test('retired pending directions free reservations immediately and cannot overwrite a replacement cache entry',async()=>{
 const disposed=[],cache=M.createCache(10,value=>disposed.push(value.id)),controller=new AbortController();let finish;
 const stale=cache.acquire('turn',10,()=>new Promise(resolve=>{finish=resolve;}),{signal:controller.signal});await Promise.resolve();controller.abort();await assert.rejects(stale,{name:'AbortError'});assert.equal(cache.stats().bytes,0);
 const replacement=await cache.acquire('turn',10,async()=>({id:'current'}));finish({id:'stale'});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(disposed,['stale']);assert.equal(cache.stats().bytes,10);assert.equal(replacement.value.id,'current');replacement.release();cache.clear();assert.deepEqual(disposed,['stale','current']);
});

test('closing a fitting dialog disposes animation even when its canvas remains connected',async()=>{
 const f=runtimeFixture(),listeners=new Map(),dialog={open:true,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}},c=f.runtime.preview(state(),{animate:true});c.isConnected=true;c.closest=()=>dialog;await f.runtime.ready(c);f.tick();assert.equal(f.runtime.stats().sources.pinned,3);assert.equal(listeners.size,1);
 dialog.open=false;listeners.get('close')();assert.equal(c.isConnected,true);assert.equal(f.runtime.stats().sources.pinned,0);assert.equal(f.frames.size,0);assert.equal(listeners.size,0);
 const direct=f.runtime.preview(state(),{animate:true});direct.isConnected=true;direct.closest=()=>({open:false});await f.runtime.ready(direct);f.tick();assert.equal(f.runtime.stats().sources.pinned,0);assert.equal(f.frames.size,0);
});


test('measured source regions keep full preview detail while excluding unused atlas rows and columns',async()=>{
 const f=runtimeFixture(),prepared=await f.runtime.prepare(state(),'left','preview');try{const source=prepared.sources.cloth;assert(source.x>0);assert.equal(source.scaleX,1);assert.equal(source.scaleY,1);assert(f.runtime.stats().sources.bytes<512*256*4+400*100*4);for(const part of Object.values(prepared.plan.parts)){const atlas=manifest().atlases[part.atlas]||(part.atlas==='own-native-front-hand-fragments-v1'?M.OWN_HAND_ATLAS:null),region=M.sourceRegion([part],atlas);assert(region.x<=part.rect[0]);assert(region.y<=part.rect[1]);assert(region.x+region.width>=part.rect[0]+part.rect[2]);assert(region.y+region.height>=part.rect[1]+part.rect[3]);}}finally{prepared.release();}
});

test('eight distinct equipped styles can retain two full-detail preview directions while a scene atlas bakes',async()=>{
 const art=require('../game/raster-art.js'),sets=[...R.STYLE_SETS,...R.FRUIT_SETS].slice(1,9),wear=Object.fromEntries(M.SLOTS.map((slot,i)=>[slot,R.setIds(sets[i]).find(id=>R.gear(id).slot===slot)])),s=state('doctor',wear),f=runtimeFixture({manifest:art});
 const front=await f.runtime.prepare(s,'down','preview'),left=await f.runtime.prepare(s,'left','preview');try{const scene=await f.runtime.acquire(s,'right');scene.release();assert(f.runtime.stats().sources.bytes<32*1024*1024,'measured source regions leave room for concurrent animation');assert(f.runtime.stats().sources.pinned>=16);}finally{front.release();left.release();}assert.equal(f.runtime.stats().sources.pinned,0);
});
