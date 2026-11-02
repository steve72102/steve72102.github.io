'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../game/raster-outfit.js'),art=require('../game/raster-art.js'),N=require('../game/native-avatar.js'),A=require('../game/academy.js'),G=require('../game/adventure.js'),E=require('../game/engine.js');
const env={MindAcademy:A,MindAdventure:G,MindEngine:E};
const full=(character='herbal-mentor')=>({appearance:{character},rpg:{loadout:Object.fromEntries(G.setIds('berry').map(id=>[G.gear(id).slot,id]))}});
test('all 140 original wearable entries are complete in four independent views and single-item plans match fullwear',()=>{
  const all=[...G.GEAR,...E.ITEMS.map(i=>({...i,slot:'handheld'}))];assert.equal(all.length,140);
  assert.deepEqual(Object.keys(art.catalog).sort(),all.map(i=>i.id).sort());
  for(const item of all)for(const view of R.DIRECTIONS){const s={appearance:{character:'herbal-mentor'},rpg:{loadout:{[item.slot]:item.id}}},full=R.plan(s,view,art,env),one=R.plan(s,view,art,env,item.slot);for(const key of R.PARTS[item.slot])assert.deepEqual(full.parts[key],one.parts[key],item.id+' '+view+' '+key);}
});
test('empty equipment never grants or paints a hat, cape, jacket, brooch or notebook',()=>{
  assert.deepEqual(Object.keys(art.defaults).sort(),['pants','shirt','shoes']);
  const state={appearance:{character:'graduate'},rpg:{loadout:{}}},before=JSON.stringify(state);
  for(const d of R.DIRECTIONS){const p=R.plan(state,d,art,env);assert(!p.parts.hat&&!p.parts['cape.front']&&!p.parts['jacket.torso']&&!p.parts.accessory&&!p.parts.handheld);assert(Object.values(p.items).every(i=>i===null));}
  assert.equal(JSON.stringify(state),before);
});
test('four head images and measured regions preserve all ten identities independently',()=>{
  assert.equal(Object.keys(art.heads).length,10);
  for(const c of A.CHARACTERS){const sources=R.DIRECTIONS.map(d=>{const h=R.checkedPart(art.heads[c.id][d],art);return h.atlas+JSON.stringify(h.rect);});assert.equal(new Set(sources).size,4,c.id);}
  for(const atlas of Object.values(art.atlases))assert.match(atlas.src,/^\.\/assets\/avatar-raster\/[a-z0-9-]+\.webp$/);
});
test('all 24 skeletal pose definitions are finite across ten body fits and four views',()=>{
  assert.equal(R.POSES.length,24);assert.equal(R.POSES.filter(([action])=>action==='run').length,8);
  for(const c of A.CHARACTERS)for(const d of R.DIRECTIONS)for(const [action,phase] of R.POSES){const p=R.pose(c.id,d,phase,action);for(const n of ['L','R'])for(const kind of ['arm','leg'])for(const point of Object.values(p.limbs[n][kind]))assert(Number.isFinite(point.x)&&Number.isFinite(point.y));}
  const start=R.pose('doctor','right',0,'start'),idle=R.pose('doctor','right',0,'idle'),rise=R.pose('doctor','right',1,'rise'),land=R.pose('doctor','right',0,'land');
  assert.notDeepEqual(start.limbs,idle.limbs);assert.notDeepEqual(rise.limbs,idle.limbs);assert.notDeepEqual(land.limbs,idle.limbs);
});
function fixture(){
  const pending=[],paints=[];let released=0;
  class Element{
    constructor(tag,attrs={}){this.tag=tag;this.dataset={};this.children=[];this.attrs=attrs;this.width=attrs.width||72;this.height=attrs.height||120;this.style={left:'world-x',top:'world-y',transform:'world-transform'};for(const [k,v] of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.classList={remove:()=>{},add:()=>{}};}
    append(...children){this.children.push(...children);}querySelector(){return this.children.find(c=>c.attrs.class==='layered-avatar-canvas')||null;}replaceChild(n,o){this.children[this.children.indexOf(o)]=n;}
    getContext(){return {clearRect(){},drawImage(...args){paints.push(args);}};}
  }
  const window={document:{},AbortController,MindNativeAvatar:N,MindRasterOutfit:{describe:s=>R.plan(s,'down',art,env),acquire(state,direction,options){return new Promise((resolve,reject)=>pending.push({state,direction,options,resolve:()=>resolve({value:{canvas:{direction},width:72,height:120,columns:4,key:direction,direction},release(){released++;}}),reject}));}}};
  const context=vm.createContext({window,console});vm.runInContext(fs.readFileSync(require.resolve('../game/layered-avatar.js'),'utf8'),context);
  const api=window.MindLayeredAvatar,node=(tag,attrs)=>new Element(tag,attrs),actor=node('div'),body=api.createBody(node,full());actor.append(body);api.register(actor,()=>node('svg',{class:'accurate-fallback'}));
  return {api,actor,body,pending,paints,released:()=>released};
}
const visual={action:'idle',moving:false,turning:false,phase:0,reducedMotion:false};
test('stale direction completion cannot overwrite a newer appearance and releases its cache handle',async()=>{
  const f=fixture();f.api.update(f.actor,visual,{time:0,direction:'down'});f.api.update(f.actor,visual,{time:16,frameMs:16,direction:'left'});
  f.pending[1].resolve();await Promise.resolve();assert.equal(f.actor.dataset.layeredDirection,'left');const paints=f.paints.length;
  f.pending[0].resolve();await Promise.resolve();assert.equal(f.paints.length,paints);assert.equal(f.released(),1);assert.equal(f.actor.style.transform,'world-transform');
  f.api.dispose(f.actor);assert.equal(f.released(),2);assert(!f.api.needsFrame(f.actor));
});
test('disposing during a bake cannot paint a retired actor or leak the returned atlas',async()=>{
  const f=fixture();f.api.update(f.actor,visual,{time:0,direction:'down'});f.api.dispose(f.actor);f.pending[0].resolve();await Promise.resolve();assert.equal(f.paints.length,0);assert.equal(f.released(),1);
});
test('a failed direction restores exact-loadout fallback and stops waiting',async()=>{
  const f=fixture();f.api.update(f.actor,visual,{time:0,direction:'down'});f.pending[0].reject(Error('intentional missing atlas'));await Promise.resolve();await Promise.resolve();assert.equal(f.actor.dataset.layeredAssetStatus,'fallback');assert.equal(f.actor.children[0].tag,'svg');assert(!f.api.needsFrame(f.actor));
});
test('idle updates do not repaint or schedule a separate animation clock',async()=>{
  const f=fixture();f.api.update(f.actor,visual,{time:0,direction:'down'});f.pending[0].resolve();await Promise.resolve();const n=f.paints.length;for(let i=1;i<=20;i++)f.api.update(f.actor,visual,{time:i*16,frameMs:16,direction:'down'});assert.equal(f.paints.length,n);assert.equal(f.pending.length,1);assert(!f.api.needsFrame(f.actor));f.api.dispose(f.actor);
});
test('only the local wearer prepares three unseen views, releases completed handles and cancels queued preparation on disposal',async()=>{
  const f=fixture();f.actor.classList.contains=name=>name==='local-actor';f.api.update(f.actor,visual,{time:0,direction:'down'});f.pending[0].resolve();await Promise.resolve();
  assert.deepEqual(f.pending.slice(1).map(r=>r.direction),['right','left','up']);assert.equal(f.pending.length,4);
  f.pending[1].resolve();await Promise.resolve();assert.equal(f.released(),1);f.api.dispose(f.actor);assert(f.pending[2].options.signal.aborted);assert(f.pending[3].options.signal.aborted);assert.equal(f.released(),2);
  f.pending[2].resolve();f.pending[3].resolve();await Promise.resolve();assert.equal(f.released(),4);
});
test('only public appearance and eight IDs enter shared cache identity',()=>{
  const f=fixture(),s={...full(),profile:{name:'PRIVATE'},account:{uid:'SECRET'},wishes:{wallet:9000}};
  const clean=f.api.publicState(s);assert.deepEqual(Object.keys(clean).sort(),['appearance','rpg']);assert(!JSON.stringify(clean).includes('PRIVATE'));assert(!JSON.stringify(clean).includes('SECRET'));assert.deepEqual(Object.keys(clean.rpg.loadout),R.SLOTS);
});
