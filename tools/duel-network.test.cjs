const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{webcrypto}=require('node:crypto'),D=require('../game/duel.js'),E=require('../game/engine.js');
const questions=Array.from({length:6},(_,i)=>({id:'q'+i,subject:'pharmaceutics',answer:i%4}));
const pause=()=>new Promise(resolve=>setTimeout(resolve,4));
async function until(fn){for(let i=0;i<500;i++){if(fn())return;await pause();}throw Error('Timed out waiting for peers');}
function fixture({duplicateDecisions=false}={}){
  const registry=new Map(),nets=[],peers=[],packets=[];
  class Conn extends EventEmitter{
    constructor(opts){super();Object.assign(this,opts);this.open=false;}
    send(text){packets.push(JSON.parse(text));const deliver=()=>{if(this.other.open)this.other.emit('data',text);};setTimeout(deliver,1);if(duplicateDecisions&&JSON.parse(text).type==='pass_decision')setTimeout(deliver,2);}
    close(){if(!this.open)return;this.open=false;this.emit('close');this.other.close();}
  }
  class Peer extends EventEmitter{
    constructor(id){super();this.id=id;this.links=[];peers.push(this);registry.set(id,this);setTimeout(()=>this.emit('open',id),1);}
    connect(id,opts){const c=new Conn(opts),r=new Conn(opts);c.other=r;r.other=c;const host=registry.get(id);this.links.push(c);host.links.push(r);setTimeout(()=>{host.emit('connection',r);c.open=r.open=true;c.emit('open');r.emit('open');},1);return c;}
    disconnect(){if(registry.get(this.id)===this)registry.delete(this.id);}
    destroy(){this.disconnect();this.links.forEach(c=>c.close());}
  }
  function player(name){
    const win=new EventTarget();Object.assign(win,{MindDuel:D,MindEngine:E,Peer,RTCPeerConnection:function(){}});
    vm.runInNewContext(fs.readFileSync(require.resolve('../game/duel-network.js'),'utf8'),{window:win,crypto:webcrypto,Uint8Array,TextEncoder,navigator:{onLine:true},location:{protocol:'https:'},document:{getElementById:()=>null},setTimeout,clearTimeout,setInterval,clearInterval});
    const stock={shirkTickets:6,diligenceTickets:1},earned=[],messages=[];
    const net=win.MindDuelNetwork({questions,random:()=>.3,onChange:()=>{},onAnswer:(q,correct)=>earned.push({id:q.id,correct}),onNotice:m=>messages.push(m),useTicket:key=>stock[key]>0?(stock[key]--,true):false});
    nets.push(net);return {net,stock,earned,messages,profile:{name,level:1,gearId:null,...stock}};
  }
  async function pair(){const a=player('測試一'),b=player('測試二');a.net.start({mode:'host',subject:'pharmaceutics',profile:a.profile});await until(()=>a.net.snapshot().status==='waiting');b.net.start({mode:'join',subject:'pharmaceutics',profile:b.profile,code:a.net.snapshot().code});await until(()=>[a,b].every(p=>p.net.snapshot().status==='connected'));return [a,b];}
  return {pair,packets,stop:()=>nets.forEach(n=>n.leave())};
}
async function ready(pair){pair.forEach(p=>p.net.ready());await until(()=>pair.every(p=>p.net.snapshot().game.phase==='question'));}
async function next(pair){const index=pair[0].net.snapshot().game.index;pair.forEach(p=>p.net.next());await until(()=>pair.every(p=>p.net.snapshot().game.index!==index||p.net.snapshot().game.phase==='done'));if(index===2)await ready(pair);}
async function feedback(pair){await until(()=>pair.every(p=>p.net.snapshot().game.phase==='feedback'||p.net.snapshot().status==='error'));for(const p of pair)assert.equal(p.net.snapshot().status,'connected',p.net.snapshot().message);}
test('two peers complete six delegated copies, charge once, award only actual study and synchronize final bonus',async t=>{
  const f=fixture({duplicateDecisions:true});t.after(f.stop);const pair=await f.pair(),[a,b]=pair;await ready(pair);
  for(let i=0;i<6;i++){
    assert(a.net.requestPass());await until(()=>b.net.snapshot().game.passBy===1);assert.equal(a.stock.shirkTickets,5-i);assert.equal(b.stock.shirkTickets,6);
    const correct=questions.find(q=>q.id===b.net.snapshot().game.ids[i]).answer;await b.net.answer([correct,i===1||i===4?(correct+1)%4:correct]);await feedback(pair);
    if(i<5)await next(pair);
  }
  assert.equal(a.earned.length,0);assert.equal(b.earned.length,6);assert(b.earned.every(x=>x.correct));
  const before=D.totals(a.net.snapshot().game);assert.equal(D.diligenceBonus(b.net.snapshot().game,0).correct,4);
  assert(b.net.diligence());assert.equal(b.net.diligence(),false);await until(()=>a.net.snapshot().game.diligence[1]);assert.equal(b.stock.diligenceTickets,0);
  assert.equal(D.totals(a.net.snapshot().game)[0],before[0]);assert.equal(D.totals(a.net.snapshot().game)[1],before[1]+512);
  await next(pair);assert.deepEqual(D.totals(a.net.snapshot().game),D.totals(b.net.snapshot().game).slice().reverse());
});
test('simultaneous pass requests accept only one and do not charge the rejected player',async t=>{
  const f=fixture();t.after(f.stop);const pair=await f.pair(),[a,b]=pair;await ready(pair);
  b.net.requestPass();a.net.requestPass();await until(()=>b.net.snapshot().game.passBy!==null);assert.equal(a.stock.shirkTickets+b.stock.shirkTickets,11);
  const receiver=pair.find(p=>p.net.snapshot().game.passBy===1),correct=questions.find(q=>q.id===receiver.net.snapshot().game.ids[0]).answer;
  await receiver.net.answer([correct,correct]);await feedback(pair);assert.equal(a.stock.shirkTickets+b.stock.shirkTickets,11);
});
test('host-accepted pass replaces an in-flight guest submission without a stale commitment error',async t=>{
  const f=fixture();t.after(f.stop);const pair=await f.pair(),[a,b]=pair;await ready(pair);
  const correct=questions.find(q=>q.id===a.net.snapshot().game.ids[0]).answer;
  const pending=b.net.answer(correct);assert(a.net.requestPass());await pending;await until(()=>b.net.snapshot().game.passBy===1);
  await b.net.answer([correct,(correct+1)%4]);await feedback(pair);
  assert.equal(a.net.snapshot().game.answers[0][0].correct,false);assert.equal(b.net.snapshot().game.answers[0][0].correct,true);
});
test('guest can pass, committed questions reject passes without charge, and wrong extras cannot consume diligence',async t=>{
  const f=fixture();t.after(f.stop);const pair=await f.pair(),[a,b]=pair;await ready(pair);
  for(let i=0;i<6;i++){
    const correct=questions.find(q=>q.id===a.net.snapshot().game.ids[i]).answer,wrong=(correct+1)%4;
    if(i===0){await a.net.answer(correct);await until(()=>b.net.snapshot().game.commits[1]);assert.equal(b.net.requestPass(),false);await b.net.answer(correct);}
    else{assert(b.net.requestPass());await until(()=>a.net.snapshot().game.passBy===1);await a.net.answer([correct,wrong]);}
    await feedback(pair);if(i<5)await next(pair);
  }
  assert.equal(D.diligenceBonus(a.net.snapshot().game,0).correct,0);assert.equal(a.net.diligence(),false);assert.equal(a.stock.diligenceTickets,1);assert.equal(b.stock.shirkTickets,1);
});
