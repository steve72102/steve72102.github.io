'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Native=require('../game/native-avatar.js'),Motion=require('../game/character-motion.js');
const A=require('../game/academy.js'),R=require('../game/adventure.js'),E=require('../game/engine.js'),L=require('../game/lobby.js');
const full=()=>({appearance:{version:1,character:'doctor',pet:null},rpg:{loadout:Object.fromEntries(Native.SLOTS.map(slot=>[slot,'fruit-pineapple-'+slot]))}});
const visual=values=>({action:'idle',moving:false,turning:false,phase:0,reducedMotion:false,...values});
const sample=values=>({x:100,y:100,z:0,time:0,frameMs:0,groundZ:0,scene:'hall:pharmaceutics:foundation',scale:1,direction:'down',intent:false,...values});

test('native artwork requires the exact scholar and all eight actually equipped pieces',()=>{
  const state=full(),before=JSON.stringify(state);assert(Native.matches(state));
  for(const slot of Native.SLOTS){
    const missing=full();delete missing.rpg.loadout[slot];assert(!Native.matches(missing),slot);
    const mixed=full();mixed.rpg.loadout[slot]='fruit-berry-'+slot;assert(!Native.matches(mixed),slot);
    const empty=full();empty.rpg.loadout[slot]=null;assert(!Native.matches(empty),slot);
  }
  for(const character of A.CHARACTERS.filter(c=>c.id!=='doctor'))assert(!Native.matches({...state,appearance:{character:character.id}}));
  assert(!Native.matches({rpg:state.rpg}));assert(!Native.matches(null));assert.equal(JSON.stringify(state),before);
});

test('four directions point to independent atlases and all eight frame rectangles stay within bounds',()=>{
  assert.equal(new Set(Native.DIRECTIONS.map(d=>Native.asset(d,'run'))).size,4);
  assert.match(Native.asset('left','run'),/left-run\.webp$/);assert.match(Native.asset('right','run'),/right-run\.webp$/);
  assert.match(Native.asset('https://untrusted.test/x','bad'),/down-actions\.webp$/);
  const rectangles=Array.from({length:8},(_,i)=>Native.frameRect(i));assert.equal(new Set(rectangles.map(r=>r.x+','+r.y)).size,8);
  for(const r of rectangles){assert(r.x>=0&&r.y>=0);assert(r.x+r.width<=1024&&r.y+r.height<=768);}
  assert.deepEqual(Native.ATLAS,{columns:4,rows:2,frameWidth:256,frameHeight:384,width:1024,height:768,anchorX:128,anchorY:372});
});

test('distance phase selects all eight alternating run drawings without generating extra gait from time',()=>{
  let state=Native.selectFrame(null,visual(),sample());
  state=Native.selectFrame(state,visual({action:'run',moving:true,phase:.125}),sample({time:16,frameMs:16}));assert.equal(state.pose,'start');
  state=Native.selectFrame(state,visual({action:'run',moving:true,phase:0}),sample({time:116,frameMs:100}));assert.equal(state.sheet,'run');
  const frames=[];
  for(let i=0;i<8;i++){state=Native.selectFrame(state,visual({action:'run',moving:true,phase:i/8}),sample({time:132+i*16,frameMs:16}));frames.push(state.frame);}
  assert.deepEqual(frames,[0,1,2,3,4,5,6,7]);
  state=Native.selectFrame(state,visual({action:'push'}),sample({time:260,frameMs:16,intent:true}));assert.equal(state.pose,'stop');
  state=Native.selectFrame(state,visual({action:'push'}),sample({time:380,frameMs:120,intent:true}));assert.equal(state.pose,'idle');assert(!state.needsFrame);
});

test('start, stop and turn use discrete painted poses, settle with frameMs, and never advance on an event-only sample',()=>{
  let state=Native.selectFrame(null,visual(),sample());
  state=Native.selectFrame(state,visual({action:'run',moving:true}),sample({time:16,frameMs:16}));assert.equal(state.frame,1);
  state=Native.selectFrame(state,visual({action:'run',moving:true}),sample({time:1000,frameMs:0}));assert.equal(state.remaining,90);
  state=Native.selectFrame(state,visual({action:'run',moving:true}),sample({time:1100,frameMs:100}));assert.equal(state.pose,'run');
  state=Native.selectFrame(state,visual({action:'run',moving:true,turning:true}),sample({time:1116,frameMs:16,direction:'left'}));assert.equal(state.frame,3);assert.equal(state.direction,'left');
  state=Native.selectFrame(state,visual({action:'run',moving:true}),sample({time:1206,frameMs:90,direction:'left'}));assert.equal(state.pose,'run');
  state=Native.selectFrame(state,visual(),sample({time:1222,frameMs:16,direction:'left'}));assert.equal(state.frame,2);assert(state.needsFrame);
  state=Native.selectFrame(state,visual(),sample({time:1332,frameMs:110,direction:'left'}));assert.equal(state.frame,0);assert(!state.needsFrame);
});

test('ascent, apex, descent and landing come from physical motion while reduced motion keeps the same real outfit and view',()=>{
  let state=Native.selectFrame(null,visual(),sample());
  state=Native.selectFrame(state,visual({action:'rise'}),sample({time:16,frameMs:16,z:10,verticalVelocity:240}));assert.equal(state.frame,4);
  state=Native.selectFrame(state,visual({action:'rise'}),sample({time:96,frameMs:80,z:30,verticalVelocity:20}));assert.equal(state.frame,5);
  state=Native.selectFrame(state,visual({action:'fall'}),sample({time:112,frameMs:16,z:29,verticalVelocity:-40}));assert.equal(state.frame,5);
  state=Native.selectFrame(state,visual({action:'fall'}),sample({time:192,frameMs:80,z:15,verticalVelocity:-200}));assert.equal(state.frame,6);
  state=Native.selectFrame(state,visual({action:'land'}),sample({time:240,frameMs:48,z:0,verticalVelocity:0}));assert.equal(state.frame,7);
  state=Native.selectFrame(state,visual({action:'run',moving:true,reducedMotion:true}),sample({time:256,frameMs:16,direction:'up'}));
  assert.equal(state.frame,0);assert.equal(state.direction,'up');assert.equal(state.sheet,'actions');assert(!state.needsFrame);
});

function domFixture({images=true,missing=null}={}){
  let writes=0,serialized=0;const requests=[];
  class Element{
    constructor(tag,attrs={},children=[]){
      this.tag=tag;this.attrs={};this.dataset={};this.children=[];this.styleValues=new Map();this.isConnected=true;this.listeners={};
      this.style={left:'25%',top:'60%',transform:'world-position',setProperty:(key,value)=>{writes++;this.styleValues.set(key,value);},removeProperty:key=>this.styleValues.delete(key)};
      this.classList={contains:name=>(this.attrs.class||'').split(' ').includes(name),add:name=>{if(!this.classList.contains(name))this.attrs.class=((this.attrs.class||'')+' '+name).trim();},remove:name=>{this.attrs.class=(this.attrs.class||'').split(' ').filter(c=>c!==name).join(' ');},toggle:(name,on)=>on?this.classList.add(name):this.classList.remove(name)};
      for(const [key,value] of Object.entries(attrs))this.setAttribute(key,value);this.append(...children);
    }
    setAttribute(key,value){this.attrs[key]=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
    getAttribute(key){return this.attrs[key]??null;}
    removeAttribute(key){delete this.attrs[key];}
    append(...children){this.children.push(...children.flat(Infinity).filter(v=>v!==null&&v!==undefined&&v!==false));}
    appendChild(child){this.append(child);return child;}
    replaceChild(child,old){this.children.splice(this.children.indexOf(old),1,child);return old;}
    querySelector(selector){return this.children.find(child=>child instanceof Element&&(selector.startsWith('.')?child.classList.contains(selector.slice(1)):child.tag===selector))||this.children.flatMap(child=>child instanceof Element?[child.querySelector(selector)]:[]).find(Boolean)||null;}
    querySelectorAll(){return [];}
    addEventListener(type,listener){this.listeners[type]=listener;}
  }
  const node=(tag,attrs={},...children)=>new Element(tag,attrs,children),document={createElementNS:(_,tag)=>node(tag)};
  const window={document,MindAcademy:A,MindAdventure:R,MindEngine:E,MindLobby:L,MindCharacterMotion:Motion,matchMedia:()=>({matches:false})};
  if(images)window.Image=class{constructor(){this.naturalWidth=1024;this.naturalHeight=768;}set src(value){requests.push(value);if(missing?.test(value))this.onerror();else this.onload();}};
  const context=vm.createContext({window,document,Date,XMLSerializer:class{serializeToString(el){serialized++;return JSON.stringify(el.attrs);}}});
  for(const name of ['native-avatar','cast-outfit','avatar-motion','lobby-ui'])vm.runInContext(fs.readFileSync(require.resolve('../game/'+name+'.js'),'utf8'),context);
  const actor=(state=full(),remote=false)=>window.MindAvatar({node,appearance:state.appearance,loadout:state.rpg.loadout,name:remote?'同學乙':'同學甲',remote});
  return {window,node,actor,requests,writes:()=>writes,serialized:()=>serialized};
}

test('shop and wardrobe SVG previews, local actor and remote actor choose the same exact artwork without changing the save',()=>{
  const f=domFixture(),state=full(),before=JSON.stringify(state),svg=f.window.MindCastOutfit.preview(state),local=f.actor(state),remote=f.actor(state,true);
  assert.equal(svg.tag,'svg');assert.equal(svg.attrs['data-native-avatar'],Native.ID);
  assert.equal(svg.attrs.viewBox,Native.PREVIEW_BOX.join(' '));
  assert.equal(svg.querySelector('image').attrs.href,Native.asset('down','actions'));
  assert.equal(svg.querySelector('clipPath').attrs.clipPathUnits,'userSpaceOnUse');assert.equal(svg.querySelector('rect').attrs.height,'384');
  for(const actor of [local,remote]){assert(actor.classList.contains('native-actor'));assert(actor.querySelector('.native-avatar-sprite'));assert(!actor.querySelector('.equipped-sprite'));}
  assert.equal(f.serialized(),0,'native actors must not serialize nested external images into a broken data URI');
  assert.equal(JSON.stringify(state),before);assert.equal(f.requests.length,0,'merely constructing an avatar must not preload eight atlases');
  for(const view of Native.DIRECTIONS){const viewSVG=f.window.MindCastOutfit.preview(state,{direction:view});assert.equal(viewSVG.querySelector('image').attrs.href,Native.asset(view,'actions'));}
  const portrait=f.window.MindNativeAvatar.portrait(state);assert.equal(portrait.attrs.viewBox,Native.PORTRAIT_BOX.join(' '));assert.equal(portrait.querySelector('image').attrs.href,Native.asset('down','actions'));
});

test('removing even one hat, accessory or handheld restores the existing truthful SVG for self, remote and wardrobe',()=>{
  const f=domFixture();
  for(const slot of Native.SLOTS){
    const state=full();state.rpg.loadout[slot]=null;
    const preview=f.window.MindCastOutfit.preview(state);assert.equal(preview.attrs['data-native-avatar'],undefined,slot);
    for(const remote of [false,true]){const actor=f.actor(state,remote);assert(actor.querySelector('.equipped-sprite'),slot);assert(!actor.querySelector('.native-avatar-sprite'),slot);}
  }
  assert.equal(f.requests.length,0,'fallback outfits must not load painted atlases');
});

test('all eight native catalog cards crop the approved independent garment while single-piece try-on remains truthful',()=>{
  const f=domFixture(),state=full(),before=JSON.stringify(state);
  for(const slot of Native.SLOTS){
    const item=R.gear('fruit-pineapple-'+slot),svg=f.window.MindCastOutfit.itemPreview(state,item),box=Native.CATALOG.crops[slot];
    assert.equal(svg.attrs['data-gear-id'],item.id);assert.equal(svg.attrs.viewBox,box.join(' '));
    assert.equal(svg.querySelector('image').attrs.href,Native.CATALOG.url);assert.equal(svg.querySelector('rect').attrs.width,String(box[2]));
    const single=full();single.rpg.loadout={[slot]:item.id};assert.equal(f.window.MindCastOutfit.preview(single).attrs['data-native-avatar'],undefined);
  }
  assert.equal(JSON.stringify(state),before);
});

test('60 native actors share lazy image resources, settle without repeated style writes and dispose cleanly',()=>{
  const f=domFixture(),actors=Array.from({length:60},()=>f.actor()),adapter=f.window.MindAvatarMotion;
  for(const actor of actors)adapter.update(actor,Object.freeze(sample()));
  assert.deepEqual(f.requests,[Native.asset('down','actions')]);const writes=f.writes();
  for(const actor of actors){assert(!adapter.needsFrame(actor));adapter.update(actor,sample({time:40,frameMs:40}));assert.equal(actor.style.transform,'world-position');}
  assert.equal(f.writes(),writes);
  const actor=actors[0];adapter.update(actor,sample({x:104,time:56,frameMs:16,direction:'right',intent:true}));
  assert.equal(actor.dataset.nativePose,'start');assert(f.requests.length<=3);
  assert.equal(actor.styleValues.has('--motion-mirror'),false);assert.equal(actor.styleValues.has('--motion-scale-x'),false);
  for(const a of actors){adapter.dispose(a);adapter.dispose(a);assert(!adapter.needsFrame(a));assert.equal(a.querySelector('.native-avatar-sprite').styleValues.size,0);}
});

test('the adapter plays a physical jump sequence without touching position, intent or outer transforms',()=>{
  const f=domFixture(),a=f.actor(),adapter=f.window.MindAvatarMotion;
  const update=changes=>{const input=Object.freeze(sample(changes));adapter.update(a,input);assert.equal(a.style.left,'25%');assert.equal(a.style.top,'60%');assert.equal(a.style.transform,'world-position');return a.dataset.nativePose;};
  update({});assert.equal(update({time:16,frameMs:16,z:10,airborne:true,verticalVelocity:240}),'rise');
  assert.equal(update({time:96,frameMs:80,z:30,airborne:true,verticalVelocity:20}),'apex');
  update({time:112,frameMs:16,z:29,airborne:true,verticalVelocity:-50});
  assert.equal(update({time:192,frameMs:80,z:15,airborne:true,verticalVelocity:-200}),'fall');
  assert.equal(update({time:240,frameMs:48,z:0,airborne:false,verticalVelocity:0}),'land');
  assert.equal(update({time:400,frameMs:160,z:0,airborne:false,verticalVelocity:0}),'idle');
  assert(!adapter.needsFrame(a));
});

test('missing native atlases restore the exact existing equipment SVG instead of leaving an invisible actor',()=>{
  const f=domFixture({missing:/down-actions/}),state=full(),before=JSON.stringify(state),actor=f.actor(state);
  f.window.MindAvatarMotion.update(actor,sample());
  assert(!actor.classList.contains('native-actor'));assert(!actor.querySelector('.native-avatar-sprite'));
  assert(actor.querySelector('.equipped-sprite'));assert.equal(actor.dataset.nativeAssetStatus,'fallback');assert.equal(f.serialized(),3);
  assert.equal(JSON.stringify(state),before);assert.equal(actor.style.transform,'world-position');
  for(const img of actor.querySelector('.equipped-sprite').children)assert.match(img.attrs.src,/^data:image\/svg\+xml/);
  assert(!f.window.MindAvatarMotion.needsFrame(actor));
});

test('native CSS crops cells uniformly and explicitly disables the legacy whole-body transforms',()=>{
  const css=fs.readFileSync(require.resolve('../game/native-avatar.css'),'utf8');
  assert.match(css,/background-size:400% 200%/);assert.match(css,/transform:none!important/);assert.doesNotMatch(css,/scaleX\(-1\)|@keyframes/);
  assert.match(css,/overflow:hidden/);
});

test('service worker installs the illustrated room but caches native atlases only when actually requested',async()=>{
  const listeners={},cached=new Map(),fetches=[];
  const scope='https://example.test/game/',self={registration:{scope},addEventListener:(name,handler)=>listeners[name]=handler};
  const cache={match:async req=>cached.get(typeof req==='string'?req:req.url),put:async(req,res)=>cached.set(req.url,res)};
  const context=vm.createContext({self,URL,Request,caches:{open:async()=>cache},fetch:async req=>{fetches.push(req.url);return {ok:true,clone(){return this;}};}});
  vm.runInContext(fs.readFileSync(require.resolve('../game/sw.js'),'utf8'),context);
  const assets=vm.runInContext('ASSETS',context);assert(assets.includes('./native-avatar.js'));assert(assets.includes('./assets/illustrated-scenes/classroom-pharmaceutics.webp'));assert(!assets.some(path=>path.includes('native-avatar/pineapple-doctor/')));
  const request=new Request(new URL(Native.asset('up','run'),scope));let response;
  listeners.fetch({request,respondWith:value=>{response=value;}});await response;
  assert.deepEqual(fetches,[request.url]);assert(cached.has(request.url));
  listeners.fetch({request,respondWith:value=>{response=value;}});await response;assert.equal(fetches.length,1);
});
