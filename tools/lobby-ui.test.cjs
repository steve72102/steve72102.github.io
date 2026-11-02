const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function fixture({motion=false}={}){
  let now=0,frameId=0,heightReads=0,styleWrites=0,snapshotReads=0,onChange;
  const frames=new Map(),actors=[];
  class Element {
    constructor(){this.isConnected=true;this.dataset={};this.children=[];const classes=new Set();this.classList={toggle(name,on){if(on)classes.add(name);else classes.delete(name);},add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)};this.style=new Proxy({setProperty(){styleWrites++;},removeProperty(){styleWrites++;}},{set(target,key,value){styleWrites++;target[key]=value;return true;}});}
    append(child){this.children.push(child);}
    remove(){this.isConnected=false;}
    addEventListener(){}
    setAttribute(){}
    querySelector(){return null;}
    querySelectorAll(){return [];}
  }
  const world=new Element(),root=new Element(),label=new Element(),button=new Element();
  Object.defineProperty(world,'offsetHeight',{get(){heightReads++;return 667;}});
  root.querySelector=s=>({'.walk-world':world,'.world-online-status':label,'.world-online':button})[s]||null;
  const players=Array.from({length:60},(_,i)=>({id:String(i),name:'同學'+i,scene:'campus',x:450+i,y:550,z:0,direction:'down',moving:false,appearance:{},loadout:{}}));
  const data={status:'connected',message:'',channel:1,players,selfId:'0',environment:{},messages:[],requests:[]};
  const state={rpg:{socialId:'a'.repeat(32),loadout:{},friends:[]},arena:{},profile:{name:'同學0'},appearance:{}};
  const window={MindSceneUI:()=>({render(){}}),MindScenePlay:{fresh:()=>({}),restore:v=>v,scenes:[],step(){}},MindWalk:{WIDTH:1000,HEIGHT:667,campus:{spawn:{x:450,y:550}}},MindEconomy:{day:()=>1,activeHonor:()=>null},MindClassrooms:{channelName:()=> '第 1 大廳'},MindLobby:{},MindLobbyNetwork:options=>{onChange=options.onChange;return {snapshot(){snapshotReads++;return data;},takeFriends:()=>[],refresh(){},move(){},leave(){}};}};
  if(motion){window.MindCharacterMotion=require('../game/character-motion.js');vm.runInNewContext(fs.readFileSync(require.resolve('../game/avatar-motion.js'),'utf8'),{window});}
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/lobby-ui.js'),'utf8'),{window,Date,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)});
  window.MindAvatar=()=>{const el=new Element();actors.push(el);if(motion)window.MindAvatarMotion.register(el);return el;};
  const ui=window.MindLobbyUI({node:()=>new Element(),getState:()=>state,save(){}});
  ui.bind(root,'campus',{x:450,y:550});
  return {ui,actors,data,notify:()=>onChange(data),counts:()=>({heightReads,styleWrites,snapshotReads}),tick(){now+=40;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}};
}

test('60-player scene reuses avatars, reads height once per frame, and skips stationary style writes',()=>{
  const f=fixture();assert.equal(f.actors.length,59);
  const first=f.counts();assert.equal(first.heightReads,1);
  for(let i=0;i<10;i++)f.tick();
  const later=f.counts();assert.equal(later.heightReads-first.heightReads,10);
  assert.equal(later.styleWrites,first.styleWrites);
  const before=f.counts().snapshotReads;f.notify();
  assert.equal(f.counts().snapshotReads,before,'a network-supplied snapshot should not be rebuilt');
  assert.equal(f.actors.length,59);assert.equal(f.counts().styleWrites,first.styleWrites);f.ui.hide();
});

test('motion updates interpolate to the target then stop writing unchanged styles',()=>{
  const f=fixture(),first=f.counts().styleWrites;f.data.players[1].x+=20;f.notify();
  for(let i=0;i<40;i++)f.tick();
  assert(f.counts().styleWrites>first);
  const settled=f.counts().styleWrites;for(let i=0;i<10;i++)f.tick();
  assert.equal(f.counts().styleWrites,settled);f.ui.hide();
});

test('remote stopped packets keep feet moving while interpolating, then cease all style writes',()=>{
  const f=fixture({motion:true}),actor=f.actors[0];f.data.players[1].x+=20;f.data.players[1].direction='right';f.data.players[1].moving=false;f.notify();
  f.tick();assert.equal(actor.dataset.motionAction,'run');assert(actor.classList.contains('walking'));
  for(let i=0;i<40;i++)f.tick();assert.equal(actor.dataset.motionAction,'idle');assert(!actor.classList.contains('walking'));
  const settled=f.counts().styleWrites;for(let i=0;i<10;i++)f.tick();assert.equal(f.counts().styleWrites,settled);assert.equal(f.actors.length,59);
  f.ui.hide();assert(!actor.classList.contains('motion-managed'));
});

test('remote movement intent with no displacement cannot keep running, and remains unchanged on the wire',()=>{
  const f=fixture({motion:true}),actor=f.actors[0];f.data.players[1].moving=true;f.notify();
  for(let i=0;i<5;i++)f.tick();assert(!actor.classList.contains('walking'));assert.equal(f.data.players[1].moving,true);
  const old=actor;f.data.players[1].name='改名同學';f.notify();assert.equal(f.actors.length,60);assert(!old.classList.contains('motion-managed'));assert.equal(old.isConnected,false);
  f.ui.hide();
});
