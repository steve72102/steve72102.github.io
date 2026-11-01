'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../game/academy.js'),R=require('../game/adventure.js'),E=require('../game/engine.js'),L=require('../game/lobby.js'),D=require('../game/duel.js');

function fixture(){
  const renders=[],frames=new Map();let now=0,frameId=0,onChange;
  class Element{
    constructor(tag,attrs={},children=[]){this.tag=tag;this.attrs={...attrs};this.children=children.filter(v=>v!=null);this.dataset={};this.isConnected=true;this.style={setProperty(){}};this.listeners={};this.classList={add:c=>this.attrs.class=((this.attrs.class||'')+' '+c).trim(),toggle(){},remove(){}};}
    setAttribute(k,v){this.attrs[k]=String(v);}
    removeAttribute(k){delete this.attrs[k];}
    append(...children){this.children.push(...children.filter(v=>v!=null));}
    remove(){this.isConnected=false;}
    addEventListener(type,listener){this.listeners[type]=listener;}
    querySelector(){return null;}
    querySelectorAll(){return [];}
  }
  const node=(tag,attrs={},...children)=>new Element(tag,attrs,children.flat());
  const world=node('div'),section=node('section'),label=node('small'),online=node('button');
  world.offsetHeight=667;section.querySelector=s=>({'.walk-world':world,'.world-online-status':label,'.world-online':online})[s]||null;
  const data={status:'connected',message:'',channel:1,players:[],selfId:'self',environment:{},messages:[],requests:[]};
  const state={rpg:{socialId:'a'.repeat(32),loadout:{},friends:[]},arena:{},profile:{name:'Local'},appearance:{version:1,pet:null,character:'doctor'}};
  const window={MindAcademy:A,MindAdventure:R,MindEngine:E,MindLobby:L,MindCastOutfit:{preview(s,options={}){renders.push({character:s.appearance.character,loadout:{...s.rpg.loadout},direction:options.direction||'down'});return node('svg',{'data-character':s.appearance.character,'data-direction':options.direction||'down','data-loadout':JSON.stringify(s.rpg.loadout)});}},MindSceneUI:()=>({render(){}}),MindScenePlay:{fresh:()=>({}),restore:v=>v,scenes:[],step(){}},MindWalk:{WIDTH:1000,HEIGHT:667,campus:{spawn:{x:450,y:550}}},MindEconomy:{day:()=>1,activeHonor:()=>null},MindClassrooms:{channelName:()=> '第 1 大廳'},MindLobbyNetwork:options=>{onChange=options.onChange;return {snapshot:()=>data,takeFriends:()=>[],refresh(){},move(){},leave(){}};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/lobby-ui.js'),'utf8'),{window,Date,XMLSerializer:class{serializeToString(el){return JSON.stringify(el.attrs);}},performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)});
  const avatar=options=>window.MindAvatar({node,name:'Local',appearance:{version:1,pet:null,character:'doctor'},loadout:{},...options});
  const ui=window.MindLobbyUI({node,getState:()=>state,save(){}});
  return {window,node,avatar,renders,ui,world,section,data,notify:()=>onChange(data),tick(){now+=40;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}};
}
const childrenOf=(node,cls)=>node.children.filter(c=>c?.attrs?.class?.split(' ').includes(cls));
const bodyOf=actor=>childrenOf(actor,'equipped-sprite')[0];
const loadoutFor=key=>Object.fromEntries(Object.keys(R.SLOTS).map(slot=>[slot,'style-'+key+'-'+slot]));

test('unequipped scholars keep original sprite artwork and do not generate outfit images',()=>{
  const f=fixture();for(const character of A.CHARACTERS){const actor=f.avatar({appearance:{version:1,pet:null,character:character.id}});assert.equal(childrenOf(actor,'run-sprite').length,1);assert.equal(bodyOf(actor),undefined);}
  assert.equal(f.renders.length,0);
});

test('every equipped slot is passed to the actual wardrobe renderer in three directions',()=>{
  const f=fixture();
  for(const slot of Object.keys(R.SLOTS)){
    const id='style-bach-'+slot,actor=f.avatar({loadout:{[slot]:id}}),body=bodyOf(actor);
    assert(body,slot);assert.equal(body.children.length,3);assert.equal(childrenOf(actor,'run-sprite').length,0);
    const latest=f.renders.slice(-3);assert.deepEqual(latest.map(r=>r.direction),['down','up','right']);assert(latest.every(r=>r.loadout[slot]===id));
    for(const image of body.children){assert(image.attrs.src.startsWith('data:image/svg+xml;charset=utf-8,'));assert(decodeURIComponent(image.attrs.src).includes(id));}
    assert(!actor.children.some(c=>/outfit-aura|worn-hat|worn-badge|worn-book/.test(c?.attrs?.class||'')),'do not overlay a generic substitute');
  }
});

test('all ten body identities and knowledge handhelds reach the shared renderer',()=>{
  const f=fixture(),id=E.ITEMS[0].id;
  for(const character of A.CHARACTERS)f.avatar({appearance:{version:1,pet:null,character:character.id},loadout:{handheld:id}});
  assert.equal(f.renders.length,30);assert.equal(new Set(f.renders.map(r=>r.character)).size,10);assert(f.renders.every(r=>r.loadout.handheld===id));
});

test('local and remote avatars share exact clothing images without caching names or accounts',()=>{
  const f=fixture(),loadout=loadoutFor('bach'),local=f.avatar({name:'私人名字甲',loadout}),remote=f.avatar({name:'私人名字乙',loadout,remote:true});
  assert.equal(f.renders.length,3);assert.deepEqual(bodyOf(local).children.map(i=>i.attrs.src),bodyOf(remote).children.map(i=>i.attrs.src));
  assert.match(remote.attrs.class,/remote-actor/);assert.equal(childrenOf(remote,'player-name')[0].children[0],'私人名字乙');
  for(const img of bodyOf(remote).children)assert(!decodeURIComponent(img.attrs.src).includes('私人名字'));
});

test('one garment change refreshes all views while canonical slot order reuses the cache',()=>{
  const f=fixture(),loadout=loadoutFor('bach');f.avatar({loadout});
  f.avatar({loadout:Object.fromEntries(Object.entries(loadout).reverse())});assert.equal(f.renders.length,3);
  const changed=f.avatar({loadout:{...loadout,hat:'style-haydn-hat'}});assert.equal(f.renders.length,6);assert(bodyOf(changed).children.every(i=>decodeURIComponent(i.attrs.src).includes('style-haydn-hat')));
});

test('outfit cache is bounded to 96 appearances and evicts the least recently used one',()=>{
  const f=fixture(),all=[];
  for(let i=0;i<100;i++)all.push({appearance:{version:1,pet:null,character:A.CHARACTERS[i%10].id},loadout:{jacket:'style-'+R.STYLE_SETS[Math.floor(i/10)%7].key+'-jacket',hat:'style-'+R.STYLE_SETS[Math.floor(i/70)].key+'-hat'}});
  for(const options of all)f.avatar(options);assert.equal(f.renders.length,300);
  f.avatar(all[99]);assert.equal(f.renders.length,300,'recent look should be reused');
  f.avatar(all[0]);assert.equal(f.renders.length,303,'evicted oldest look should be rendered again');
});

test('59 remote equipped avatars render once then reuse images across motion frames and notifications',()=>{
  const f=fixture();f.data.players=Array.from({length:60},(_,i)=>({id:i?'p'+i:'self',name:'同學'+i,scene:'campus',x:450+i,y:550,z:0,direction:'down',moving:false,appearance:{version:1,pet:null,character:A.CHARACTERS[i%10].id},loadout:loadoutFor(R.STYLE_SETS[Math.floor(i/10)].key)}));
  f.ui.bind(f.section,'campus',{x:450,y:550});assert.equal(f.renders.length,59*3);
  for(let i=0;i<20;i++)f.tick();f.notify();assert.equal(f.renders.length,59*3);
  f.data.players[1].direction='left';f.data.players[1].moving=true;f.data.players[1].x+=40;f.notify();for(let i=0;i<20;i++)f.tick();assert.equal(f.renders.length,59*3,'animation must not reserialize outfit SVGs');
  f.data.players[1].loadout={...f.data.players[1].loadout,hat:'style-tide-hat'};f.notify();assert.equal(f.renders.length,60*3);f.ui.hide();
});

test('new catalog uses explicit multiplayer versions so old peers cannot silently omit new clothes',()=>{
  assert.equal(L.VERSION,'mq-lobby-13');assert.equal(D.VERSION,'mq-duel-8');assert.throws(()=>L.packet(JSON.stringify({v:'mq-lobby-11',type:'ping'})),/更新|連線|協定/);assert.throws(()=>D.packet(JSON.stringify({v:'mq-duel-7',type:'ping'})),/協定/);
});
