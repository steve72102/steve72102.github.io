const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../game/cloud.js'),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x)),fresh=()=>({xp:0,mastered:[],profile:{enrolled:false},arena:{coins:0}});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({guest=fresh(),cache=null,remote=null,offline=false,locks=undefined}={}){
 const storage=new Map([['mind-quest-save-v4',JSON.stringify(guest)]]),events={},documentEvents={},a={currentUser:null};let state=clone(guest),listener,dbValue=remote,transactions=0,forceRace=false,readFailure=false,playing=false,nextRead=null;
 if(cache){storage.set('mind-quest-account-v4','alice');storage.set('mind-quest-player-v4:alice',JSON.stringify(cache));}
 const snap=()=>({exists:()=>!!dbValue,data:()=>clone(dbValue)});
 const services={a,d:{},auth:{GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:(_,fn)=>{listener=fn;},signInWithPopup:async()=>{a.currentUser={uid:'alice',email:'player@example.test'};listener(a.currentUser);},signOut:async()=>{a.currentUser=null;listener(null);}},db:{doc:(_,collection,id)=>({collection,id}),getDocFromServer:async ref=>{assert.equal(ref.collection,'players');if(readFailure)throw Error('network unavailable');const value=clone(dbValue),gate=nextRead;nextRead=null;if(gate){gate.started();await gate.wait;}return {exists:()=>!!value,data:()=>clone(value)};},serverTimestamp:()=>123,runTransaction:async(_,fn)=>{transactions++;return fn({get:async()=>{if(forceRace){dbValue={schema:1,revision:(dbValue?.revision||0)+1,modifiedAt:Date.now()+1000,payload:JSON.stringify({...fresh(),xp:900})};forceRace=false;}return snap();},set:(_,value)=>{dbValue=clone(value);}});}}};
 const context={window:{MIND_FIREBASE_CONFIG:{projectId:'test'},MindJourney:{hasProgress:s=>!!s.xp},addEventListener:(n,f)=>events[n]=f},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{hidden:false,addEventListener:(n,f)=>documentEvents[n]=f},navigator:{onLine:!offline,locks},location:{protocol:'https:'},setTimeout:()=>0,clearTimeout(){},Date};
 vm.runInNewContext(source,context);
 const cloud=context.window.MindCloud({getState:()=>state,setState:s=>{state=s;},fresh,restore:clone,changed(){},busy:()=>playing,warning(){},services});
 return {cloud,storage,getState:()=>state,setState:s=>state=clone(s),getRemote:()=>dbValue,setRemote:v=>dbValue=v,setRace:()=>forceRace=true,transactions:()=>transactions,events,online:v=>context.navigator.onLine=v,readFails:v=>readFailure=v,busy:v=>playing=v,delayRead:()=>{let release,started;const wait=new Promise(r=>release=r),began=new Promise(r=>started=r);nextRead={wait,started};return {release,started:began};},switchAccount:async id=>{a.currentUser={uid:id,email:id+'@example.test'};listener(a.currentUser);await tick();await tick();},login:async()=>{await cloud.login();await tick();await tick();}};
}
test('login loads cloud without replacing the guest backup; logout returns to guest',async()=>{const guest={...fresh(),xp:40},save={...fresh(),xp:100};const f=fixture({guest,remote:{schema:1,revision:3,payload:JSON.stringify(save)}});await f.cloud.init();await f.login();assert.equal(f.getState().xp,100);assert.equal(JSON.parse(f.storage.get('mind-quest-save-v4')).xp,40);await f.cloud.logout();assert.equal(f.getState().xp,40);});
test('first login automatically imports the latest guest journey into an empty account',async()=>{const f=fixture({guest:{...fresh(),xp:40}});await f.login();assert.equal(f.cloud.snapshot().phase,'synced');assert.equal(JSON.parse(f.getRemote().payload).xp,40);assert.equal(f.getRemote().revision,1);});
test('offline changes stay local; reconnect uses expected revision and saves once',async()=>{const f=fixture({cache:{version:1,base:2,dirty:false,save:fresh()},remote:{schema:1,revision:2,payload:JSON.stringify(fresh())},offline:true});await f.cloud.init();await f.login();f.setState({...fresh(),xp:20});f.cloud.localSave();await f.cloud.sync();assert.equal(f.transactions(),0);f.online(true);await f.cloud.sync();assert.equal(f.getRemote().revision,3);assert.equal(JSON.parse(f.getRemote().payload).xp,20);await f.cloud.sync();assert.equal(f.transactions(),1);});
test('a clock-ahead stale device cannot replace a newer server revision; its journey remains recoverable',async()=>{const f=fixture({cache:{version:1,base:2,dirty:true,modifiedAt:Date.now()+86400000,save:{...fresh(),xp:50}},remote:{schema:1,revision:3,modifiedAt:Date.now(),payload:JSON.stringify({...fresh(),xp:100})}});await f.cloud.init();await f.login();assert.equal(f.cloud.snapshot().phase,'synced');assert.equal(JSON.parse(f.getRemote().payload).xp,100);assert.equal(f.getRemote().revision,3);assert.equal(f.getState().xp,100);assert.equal(JSON.parse(f.cloud.recovery()).xp,50);assert.equal(f.transactions(),0);});
test('revision race automatically resumes newer server save and preserves old local backup',async()=>{const f=fixture({cache:{version:1,base:2,dirty:false,save:fresh()},remote:{schema:1,revision:2,payload:JSON.stringify(fresh())}});await f.cloud.init();await f.login();f.setState({...fresh(),xp:30});f.cloud.localSave();f.setRace();await f.cloud.sync();assert.equal(f.cloud.snapshot().phase,'synced');assert.equal(JSON.parse(f.getRemote().payload).xp,900);assert.equal(f.getState().xp,900);});
test('account change in another tab locks writing until reload',async()=>{const f=fixture({cache:{version:1,base:1,dirty:false,save:fresh()},remote:{schema:1,revision:1,payload:JSON.stringify(fresh())}});await f.cloud.init();await f.login();f.events.storage({key:'mind-quest-account-v4',newValue:'bob'});f.setState({...fresh(),xp:900});f.cloud.localSave();await f.cloud.sync();assert.equal(f.cloud.snapshot().locked,true);assert.equal(f.transactions(),0);assert.equal(JSON.parse(f.storage.get('mind-quest-player-v4:alice')).save.xp,0);});

test('mutating the active game state still marks the independent account cache dirty',async()=>{const f=fixture({cache:{version:1,base:1,dirty:false,save:fresh()},remote:{schema:1,revision:1,payload:JSON.stringify(fresh())}});await f.cloud.init();await f.login();f.getState().xp=77;f.cloud.localSave();await f.cloud.sync();assert.equal(JSON.parse(f.getRemote().payload).xp,77);assert.equal(f.getRemote().revision,2);});

test('failed first cloud read preserves guest progress and blocks overwrites until retry succeeds',async()=>{const f=fixture({guest:{...fresh(),xp:40},remote:{schema:1,revision:7,modifiedAt:100,payload:JSON.stringify({...fresh(),xp:700})}});f.readFails(true);await f.login();assert.equal(f.cloud.snapshot().locked,true);assert.equal(f.getState().xp,40);f.cloud.localSave();assert.equal(f.storage.has('mind-quest-player-v4:alice'),false);assert.equal(f.transactions(),0);f.readFails(false);await f.cloud.sync();assert.equal(f.getState().xp,700);assert.equal(f.cloud.snapshot().locked,false);assert.equal(JSON.parse(f.storage.get('mind-quest-save-v4')).xp,40);assert.equal(f.getRemote().revision,7);});

test('newer cloud progress waits for a live duel to end before replacing local state',async()=>{const f=fixture({cache:{version:1,base:1,dirty:false,save:{...fresh(),xp:40}},remote:{schema:1,revision:1,payload:JSON.stringify({...fresh(),xp:40})}});await f.cloud.init();await f.login();f.busy(true);f.setRemote({schema:1,revision:2,modifiedAt:Date.now(),payload:JSON.stringify({...fresh(),xp:90})});await f.cloud.sync();assert.equal(f.cloud.snapshot().phase,'deferred');assert.equal(f.getState().xp,40);f.busy(false);await f.cloud.sync();assert.equal(f.getState().xp,90);assert.equal(JSON.parse(f.cloud.recovery()).xp,40);});


test('a delayed account read cannot replace guest state after logout',async()=>{
 const f=fixture({guest:{...fresh(),xp:40},remote:{schema:1,revision:1,payload:JSON.stringify({...fresh(),xp:70})}});
 await f.login();f.setRemote({schema:1,revision:2,payload:JSON.stringify({...fresh(),xp:90})});
 const gate=f.delayRead(),running=f.cloud.sync();await gate.started;await f.cloud.logout();gate.release();await running;
 assert.equal(f.cloud.snapshot().uid,null);assert.equal(f.cloud.snapshot().phase,'guest');assert.equal(f.getState().xp,40);assert.equal(JSON.parse(f.storage.get('mind-quest-save-v4')).xp,40);
});
test('a delayed old-account response never enters a newly selected account or its cache',async()=>{
 const f=fixture({remote:{schema:1,revision:1,payload:JSON.stringify({...fresh(),xp:70})}});await f.login();
 f.setRemote({schema:1,revision:2,payload:JSON.stringify({...fresh(),xp:90})});const gate=f.delayRead(),running=f.cloud.sync();await gate.started;
 f.setRemote({schema:1,revision:5,payload:JSON.stringify({...fresh(),xp:200})});await f.switchAccount('bob');
 gate.release();await running;assert.equal(f.cloud.snapshot().uid,'bob');assert.equal(f.getState().xp,200);assert.equal(JSON.parse(f.storage.get('mind-quest-player-v4:bob')).save.xp,200);
});
test('another tab changing accounts invalidates an already pending read',async()=>{
 const f=fixture({remote:{schema:1,revision:1,payload:JSON.stringify({...fresh(),xp:70})}});await f.login();
 f.setRemote({schema:1,revision:2,payload:JSON.stringify({...fresh(),xp:90})});const gate=f.delayRead(),running=f.cloud.sync();await gate.started;
 f.storage.set('mind-quest-account-v4','bob');f.events.storage({key:'mind-quest-account-v4',newValue:'bob'});gate.release();await running;
 assert.equal(f.cloud.snapshot().locked,true);assert.equal(f.getState().xp,70);assert.equal(JSON.parse(f.storage.get('mind-quest-player-v4:alice')).save.xp,70);
});


test('Web Locks keep a second same-account tab read-only until the writer releases its lease',async()=>{
 const held=new Set(),locks={request:async(name,options,callback)=>{assert.equal(options.ifAvailable,true);if(held.has(name))return callback(null);held.add(name);try{return await callback({name});}finally{held.delete(name);}}};
 const initial={version:1,base:2,dirty:false,save:fresh()},remote={schema:1,revision:2,payload:JSON.stringify(fresh())};
 const first=fixture({cache:clone(initial),remote:clone(remote),locks}),second=fixture({cache:clone(initial),remote:clone(remote),locks});
 await first.cloud.init();await first.login();await second.cloud.init();await second.login();
 assert.equal(first.cloud.snapshot().writer,'held');assert.equal(second.cloud.snapshot().writer,'blocked');assert.equal(second.cloud.snapshot().locked,true);
 second.setState({...fresh(),xp:50});second.cloud.localSave();await second.cloud.sync();
 assert.equal(second.transactions(),0);assert.equal(JSON.parse(second.storage.get('mind-quest-player-v4:alice')).save.xp,0);
 await assert.rejects(second.cloud.transact(async()=>{}),/同步/);
 await first.cloud.logout();await second.cloud.sync();assert.equal(second.cloud.snapshot().writer,'held');assert.equal(second.cloud.snapshot().locked,false);
 second.setState({...fresh(),xp:25});second.cloud.localSave();await second.cloud.sync();assert.equal(JSON.parse(second.getRemote().payload).xp,25);
 await second.cloud.logout();assert.equal(held.size,0);
});
test('browsers without Web Locks keep revision-checked synchronization available',async()=>{
 const f=fixture({remote:{schema:1,revision:1,payload:JSON.stringify(fresh())}});await f.login();
 assert.equal(f.cloud.snapshot().writer,'unsupported');assert.equal(f.cloud.snapshot().locked,false);f.setState({...fresh(),xp:20});f.cloud.localSave();await f.cloud.sync();assert.equal(f.getRemote().revision,2);
});
test('legacy caches migrate once, retain recovery markers, and old tabs cannot overwrite the new namespace',async()=>{
 const f=fixture({offline:true});f.storage.delete('mind-quest-save-v4');
 const guest={...fresh(),xp:40},legacy={version:1,base:3,dirty:true,save:{...fresh(),xp:70}};
 f.storage.set('mind-quest-save-v3',JSON.stringify(guest));f.storage.set('mind-quest-account','alice');
 f.storage.set('mind-quest-player:alice',JSON.stringify(legacy));
 f.storage.set('mind-quest-player:alice:recovery',JSON.stringify({...fresh(),xp:20}));
 await f.cloud.init();assert.equal(f.getState().xp,70);
 assert.equal(JSON.parse(f.storage.get('mind-quest-save-v4')).xp,40);
 assert.equal(f.storage.get('mind-quest-player:alice'),JSON.stringify(legacy));
 assert.equal(JSON.parse(f.cloud.recovery()).xp,20);
 f.storage.set('mind-quest-player:alice',JSON.stringify({...legacy,save:{...fresh(),xp:999}}));
 f.events.storage({key:'mind-quest-player:alice',newValue:f.storage.get('mind-quest-player:alice')});
 assert.equal(f.getState().xp,70);assert.equal(JSON.parse(f.storage.get('mind-quest-player-v4:alice')).save.xp,70);
 await f.cloud.logout();await f.cloud.init();assert.equal(f.cloud.snapshot().uid,null);assert.equal(f.getState().xp,40);
});
test('new writes declare saveFormat 2 and future cloud formats fail closed',async()=>{
 const f=fixture();await f.login();assert.equal(f.getRemote().saveFormat,2);
 f.setRemote({schema:1,saveFormat:3,revision:9,payload:JSON.stringify({...fresh(),xp:999})});
 const before=f.transactions();await f.cloud.sync();assert.equal(f.cloud.snapshot().phase,'error');assert.equal(f.transactions(),before);assert.notEqual(f.getState().xp,999);
});
test('a previously logged-out legacy account imports unsynced progress on verified login',async()=>{
 const f=fixture({remote:{schema:1,revision:3,payload:JSON.stringify({...fresh(),xp:50})}});
 const legacy={version:1,base:3,dirty:true,save:{...fresh(),xp:70}};
 f.storage.set('mind-quest-player:alice',JSON.stringify(legacy));f.storage.set('mind-quest-player:alice:recovery',JSON.stringify({...fresh(),xp:20}));
 await f.cloud.init();assert.equal(f.cloud.snapshot().uid,null);await f.login();
 assert.equal(f.getState().xp,70);assert.equal(JSON.parse(f.getRemote().payload).xp,70);
 assert.equal(f.getRemote().revision,4);assert.equal(JSON.parse(f.cloud.recovery()).xp,20);
 assert.equal(f.storage.get('mind-quest-player:alice'),JSON.stringify(legacy));
});
test('migration of one account never suppresses a later second-account cache migration',async()=>{
 const f=fixture({remote:{schema:1,revision:1,payload:JSON.stringify(fresh())}});await f.cloud.init();await f.login();
 const legacy={version:1,base:7,dirty:true,save:{...fresh(),xp:120}};f.storage.set('mind-quest-player:bob',JSON.stringify(legacy));
 f.setRemote({schema:1,revision:7,payload:JSON.stringify({...fresh(),xp:90})});await f.switchAccount('bob');
 assert.equal(f.cloud.snapshot().uid,'bob');assert.equal(f.getState().xp,120);assert.equal(f.getRemote().revision,8);
 assert.equal(JSON.parse(f.storage.get('mind-quest-player-v4:bob')).save.xp,120);
 assert.equal(f.storage.get('mind-quest-player:bob'),JSON.stringify(legacy));
});

test('a corrupt second-account cache cannot inherit or overwrite the previous account and can recover safely',async()=>{
 for(const corruptKey of ['mind-quest-player:bob','mind-quest-player-v4:bob']){
  const f=fixture({remote:{schema:1,revision:1,payload:JSON.stringify({...fresh(),xp:70})}});await f.login();
  const alice=f.storage.get('mind-quest-player-v4:alice'),broken='{broken';f.storage.set(corruptKey,broken);
  f.setRemote({schema:1,revision:7,payload:JSON.stringify({...fresh(),xp:90})});await f.switchAccount('bob');
  assert.equal(f.cloud.snapshot().uid,'bob');assert.equal(f.cloud.snapshot().locked,true);assert.equal(f.cloud.snapshot().phase,'error');
  const count=f.transactions();f.setState({...fresh(),xp:999});f.cloud.localSave();await f.cloud.sync();
  assert.equal(f.transactions(),count);assert.equal(f.storage.get(corruptKey),broken);assert.equal(f.storage.get('mind-quest-player-v4:alice'),alice);
  assert.equal(f.storage.get('mind-quest-player-v4:bob'),corruptKey.endsWith('-v4:bob')?broken:undefined);
  await assert.rejects(f.cloud.transact(async()=>{throw Error('must not run');}),/同步/);
  f.storage.set(corruptKey,JSON.stringify({version:1,base:7,dirty:true,save:{...fresh(),xp:120}}));
  await f.cloud.sync();assert.equal(f.cloud.snapshot().locked,false);assert.equal(f.getState().xp,120);
  assert.equal(JSON.parse(f.getRemote().payload).xp,120);assert.equal(f.getRemote().revision,8);
 }
});
test('switching to an empty Google account never imports the previous account journey',async()=>{
 const f=fixture({guest:{...fresh(),xp:40},remote:{schema:1,revision:1,payload:JSON.stringify({...fresh(),xp:70})}});await f.login();
 const alice=f.storage.get('mind-quest-player-v4:alice');f.setRemote(null);await f.switchAccount('bob');
 assert.equal(f.cloud.snapshot().uid,'bob');assert.equal(f.getState().xp,0);assert.equal(JSON.parse(f.getRemote().payload).xp,0);
 assert.equal(f.storage.get('mind-quest-player-v4:alice'),alice);assert.equal(JSON.parse(f.storage.get('mind-quest-save-v4')).xp,40);
});

test('an obsolete initial-login response with an invalid format cannot turn a later logout into an error',async()=>{
 const f=fixture({guest:{...fresh(),xp:40},remote:{schema:1,saveFormat:3,revision:1,payload:JSON.stringify({...fresh(),xp:700})}});
 const gate=f.delayRead();await f.login();await gate.started;await f.cloud.logout();gate.release();await tick();await tick();
 assert.equal(f.cloud.snapshot().uid,null);assert.equal(f.cloud.snapshot().phase,'guest');assert.equal(f.cloud.snapshot().locked,false);
 assert.equal(f.getState().xp,40);assert.equal(f.storage.has('mind-quest-player-v4:alice'),false);
});
