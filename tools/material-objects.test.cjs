const test=require('node:test'),assert=require('node:assert/strict'),P=require('../game/scene-play.js'),F=require('../game/furniture.js'),W=require('../game/campus-walk.js'),L=require('../game/lobby.js'),R=require('../game/adventure.js'),A=require('../game/academy.js'),E=require('../game/engine.js'),S=require('../game/social-economy.js');
const id='a'.repeat(32);
function pushObject(state,scene,object,direction='right',now=1000){const c=P.cup(state,scene,object,now);return P.push(state,{id,scene,x:c.x,y:c.y,z:c.z},{type:'push',scene,direction},now);}
function drop(state,scene,object){for(let i=0;i<100;i++){const now=1000+i*10,c=P.cup(state,scene,object,now);if(c.fallUntil>now){P.step(state,[],c.fallUntil);return {c:P.cup(state,scene,object),time:c.fallUntil};}assert(pushObject(state,scene,object,'right',now),'the actual tabletop object can move toward its edge');}throw Error('object did not fall');}

test('actual glass and heavy stone objects respond to their different mass and friction',()=>{
  const state=P.fresh(),scene='hall:herbal:practice',stone='herbal-front-mortar',glass='herbal-front-flask',a=P.cup(state,scene,stone),b=P.cup(state,scene,glass);assert(pushObject(state,scene,stone));assert(pushObject(state,scene,glass));const heavy=P.cup(state,scene,stone).x-a.x,light=P.cup(state,scene,glass).x-b.x;assert(heavy>0);assert(light>heavy);assert.equal(P.cup(state,scene,stone).brokenUntil,0);assert.equal(P.cup(state,scene,glass).brokenUntil,0);
});

test('paper, wood, metal and stone fall intact, stay on the floor and never create glass injuries',()=>{
  for(const [scene,object] of [['hall:pharmaceutics:practice','ntu-desk-books'],['hall:herbal:practice','herbal-mid-tray'],['classroom:pharmaceutics','prep-left-instrument'],['hall:herbal:practice','herbal-front-mortar']]){
    const state=P.fresh(),{c,time}=drop(state,scene,object);assert.equal(c.z,0,object);assert.equal(c.support,null);assert.equal(c.fallUntil,0);assert.equal(c.brokenUntil,0);assert(!c.removed);const player={id,scene,x:c.x,y:c.y,z:0,moving:false};P.step(state,[player],time+61000);assert(!state.injuries[id]);assert(!P.cup(state,scene,object).removed);assert.equal(P.cup(state,scene,object).brokenUntil,0);assert.doesNotThrow(()=>P.restore(P.pack(P.snapshot(state,time+61000)),time+61000));
    const before={...P.cup(state,scene,object)};const moved=['left','down','right','up'].some(direction=>pushObject(state,scene,object,direction,time+62000));assert(moved,'fallen object remains movable on the actual floor');assert(W.distance(before,P.cup(state,scene,object))>0);
  }
});

test('a photographed ceramic pot falls and breaks, while stepping on a paper notebook does not shatter it',()=>{
  const state=P.fresh(),scene='classroom:pharmacology',object='seminar-plant-0',{c,time}=drop(state,scene,object);assert.equal(c.brokenUntil,time+P.GLASS_MS);assert.equal(P.definitions(scene).find(d=>d.id===object).material,'ceramic');
  const paper='seminar-books-0',book=P.cup(state,scene,paper),person={id,scene,x:book.x,y:book.y,z:book.z+20,moving:false};P.step(state,[person],time+100);person.z=book.z;P.step(state,[person],time+200);assert.equal(P.cup(state,scene,paper).brokenUntil,0);assert(!P.cup(state,scene,paper).removed);
});

test('material and support validation rejects forged paper shards, hidden books and impossible falling states',()=>{
  const state=P.fresh(),scene='hall:pharmaceutics:practice',object='ntu-desk-books';assert(pushObject(state,scene,object));const raw=P.snapshot(state,1000),row=raw.cups[0];
  for(const patch of [{remaining:1000,material:'glass'},{removed:true},{support:'ntu-window-desk'},{fallRemaining:400,fromZ:105},{support:null,z:0,fallRemaining:1400,fromZ:10},{fromZ:1},{remaining:-1}])assert.throws(()=>P.restore({...raw,cups:[{...row,...patch}]},1000));
  assert.throws(()=>P.restore({cups:[],furniture:[],injuries:Array.from({length:61},(_,i)=>({id:i.toString(16).padStart(32,'0'),remaining:8000}))},0));
});

test('compact world packets reject malformed tuple lengths, numeric types, object indices and duplicate rows',()=>{
  const state=P.fresh();assert(pushObject(state,'hall:pharmaceutics:practice','ntu-desk-books'));const packed=P.pack(P.snapshot(state,1000));assert.deepEqual(P.unpack(packed),P.snapshot(state,1000));assert.deepEqual(P.snapshot(P.restore(packed,1000),1000),P.snapshot(state,1000));
  const bad=modify=>{const raw=JSON.parse(JSON.stringify(packed));modify(raw);assert.throws(()=>P.restore(raw,1000));};
  bad(raw=>raw.v=3);bad(raw=>raw.o[0].push(0));bad(raw=>raw.o[0][0]=P.scenes.length);bad(raw=>raw.o[0][1]=9999);bad(raw=>raw.o[0][0]='0');bad(raw=>raw.o[0][2]=Infinity);bad(raw=>raw.o[0][5]=9999);bad(raw=>raw.o[0][6]=2);bad(raw=>raw.o.push([...raw.o[0]]));bad(raw=>raw.f=[[0,0,NaN,0]]);bad(raw=>raw.i=[['a'.repeat(32),8001]]);bad(raw=>raw.i=Array.from({length:61},(_,i)=>[i.toString(16).padStart(32,'0'),1]));
});

test('all real room objects plus sixty fully equipped players and injuries fit below 64 KiB without relaxing validation',()=>{
  const now=1000,state=P.fresh(),shift={dx:.123456789123456,dy:.234567891234567};
  for(const scene of P.scenes){
    for(const surface of P.scene(scene,state).surfaces.filter(s=>s.movable)){
      const key=scene+'#'+surface.id;state.furniture[key]={...shift};if(!F.valid(state,scene,surface.id)){state.furniture[key]={dx:-shift.dx,dy:-shift.dy};if(!F.valid(state,scene,surface.id))state.furniture[key]={dx:0,dy:0};}
    }
    for(const [i,d] of P.definitions(scene).entries()){
      let c={...P.cup(state,scene,d.id)};const support=P.scene(scene,state).surfaces.find(s=>s.id===d.surface),offset={...c,x:c.x+.123456789123456,y:c.y+.234567891234567};if(support?W.inside(offset,support.polygon):W.ground(P.scene(scene,state),offset))c=offset;
      if(i%5===0&&c.z>0){const ground=W.nearest(P.scene(scene,state),c),height=c.z;c={...c,...ground,z:0,support:null,fallUntil:now+P.fallDuration(height)-.123456789123456,fromZ:height};}
      else if(d.breakable&&i%3===0)c.brokenUntil=now+P.GLASS_MS-.123456789123456;
      else if(d.breakable&&i%3===1)c.removed=true;
      state.cups[scene+'#'+d.id]=c;
    }
  }
  const loadout=Object.fromEntries(Object.keys(R.SLOTS).map(slot=>[slot,R.GEAR.filter(g=>g.slot===slot).sort((a,b)=>b.id.length-a.id.length)[0].id]));
  const knowledge=[...E.ITEMS].sort((a,b)=>b.id.length-a.id.length)[0].id,day=S.day();
  const players=Array.from({length:60},(_,i)=>{const playerId=i.toString(16).padStart(32,'0');state.injuries[playerId]=now+P.BLEED_MS-.123456789123456;return L.player({id:playerId,socialId:playerId,name:'𠮷'.repeat(16),appearance:{...A.fresh(),character:'balance-analyst',pet:'cylinder'},loadout,knowledge,counterAt:Date.now(),honor:{region:'central',kind:'crown',start:day,until:day+21,tier:'diamond'},scene:'campus',...W.campus.spawn,z:0,direction:'down',moving:false});});
  const raw=P.snapshot(state,now),environment=P.pack(raw),restored=P.restore(environment,now);assert.deepEqual(P.snapshot(restored,now),raw);assert.equal(raw.cups.length,P.MAX_PROPS);assert.equal(raw.furniture.length,P.MAX_FURNITURE);assert.equal(raw.injuries.length,60);
  const wire=JSON.stringify({v:L.VERSION,type:'world',players,environment,session:'f'.repeat(32),seq:Number.MAX_SAFE_INTEGER}),bytes=Buffer.byteLength(wire,'utf8');assert(wire.length<65536,'character length '+wire.length);assert(bytes<65536,'UTF-8 bytes '+bytes);assert.doesNotThrow(()=>L.packet(wire));
  console.log('Photo scene full-load packet: '+wire.length+' characters / '+bytes+' UTF-8 bytes; '+raw.furniture.length+' furniture, '+raw.cups.length+' objects, 60 players and injuries.');
});

test('a portable object cannot claim a different real support even with valid coordinates on that support',()=>{
  const state=P.fresh(),scene='hall:pharmaceutics:practice',object='ntu-desk-books';assert(pushObject(state,scene,object));const raw=P.snapshot(state,1000),foreign=P.scene(scene,state).surfaces.find(s=>s.id==='ntu-window-desk');
  const forged={...raw.cups[0],x:foreign.x,y:foreign.y,z:foreign.height,support:foreign.id};assert(W.inside(forged,foreign.polygon));assert.throws(()=>P.restore({...raw,cups:[forged]},1000));
});

test('geometry caches are private to one restore and revalidate support positions in every later snapshot',()=>{
  const scene='classroom:pharmacology',object='seminar-books-0',state=P.fresh();state.furniture[scene+'#seminar-table-0']={dx:0,dy:-5};const c=P.cup(state,scene,object);state.cups[scene+'#'+object]={...c,x:215,y:208};
  const earlier=P.snapshot(state,0);assert.doesNotThrow(()=>P.restore(earlier,0));
  const later=JSON.parse(JSON.stringify(earlier));later.furniture[0].dy=5;assert.throws(()=>P.restore(later,0),'old coordinates are now outside the moved table');later.cups[0].y=218;assert.doesNotThrow(()=>P.restore(later,0));assert.doesNotThrow(()=>P.restore(earlier,0),'another request cannot reuse the newer table geometry');
});
