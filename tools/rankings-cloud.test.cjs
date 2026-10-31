const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
function database(){const rows=new Map(),watchers=[];let failRead=false,loseReply=false,retries=0;
 const snap=p=>({exists:()=>rows.has(p),data:()=>clone(rows.get(p))});
 const sdk={doc:(_, ...p)=>p.join('/'),serverTimestamp:()=>Date.now(),getDocFromServer:async p=>{if(failRead)throw Error('offline');return snap(p);},onSnapshot:(p,next)=>{const w={p,next,active:true};watchers.push(w);next(snap(p));return ()=>w.active=false;},runTransaction:async(_,fn)=>{for(let i=0;i<30;i++){const reads=new Map(),writes=new Map();const r=await fn({get:async p=>{reads.set(p,JSON.stringify(rows.get(p)));return snap(p);},set:(p,v)=>writes.set(p,clone(v))});await tick();if([...reads].some(([p,v])=>JSON.stringify(rows.get(p))!==v)){retries++;continue;}for(const [p,v]of writes)rows.set(p,v);watchers.filter(w=>w.active).forEach(w=>w.next(snap(w.p)));if(loseReply&&writes.size){loseReply=false;failRead=true;throw Error('reply lost after commit');}return r;}throw Error('contention');}};
 return {rows,sdk,lose:()=>loseReply=true,reconnect:()=>failRead=false,retries:()=>retries};
}
async function player(db,uid,storage=new Map()){
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},a={currentUser:null};let listener;
 const services={a,d:{},db:db.sdk,auth:{GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:(_,fn)=>listener=fn,signInWithPopup:async()=>{a.currentUser={uid,email:uid+'@example.test'};listener(a.currentUser);},signOut:async()=>{a.currentUser=null;listener(null);}}};
 const window={MIND_FIREBASE_CONFIG:{projectId:'demo'},MindJourney:{hasProgress:()=>true},crypto:webcrypto,addEventListener(){}};
 const context=vm.createContext({window,crypto:webcrypto,localStorage,navigator:{onLine:true},location:{protocol:'http:'},document:{hidden:false,addEventListener(){}},Date,setTimeout:()=>0,clearTimeout(){}});
 for(const file of ['engine','social-economy','wish','adventure','combat','cloud','wish-cloud','social-cloud','rankings','rankings-cloud'])vm.runInContext(fs.readFileSync(require.resolve('../game/'+file+'.js'),'utf8'),context);
 const P=window.MindEconomy,fresh=()=>({...window.MindEngine.fresh(),arena:{...window.MindCombat.fresh(),coins:10000},rpg:window.MindAdventure.fresh(),wishes:window.MindWish.fresh(),profile:{enrolled:true,name:uid}});let state=fresh(),net;
 if(!db.rows.has('players/'+uid))db.rows.set('players/'+uid,{schema:1,revision:1,payload:JSON.stringify(state),coins:10000,modifiedAt:1});
 const cloud=window.MindCloud({getState:()=>state,setState:s=>state=s,restore:clone,fresh,changed(){},busy:()=>false,warning(){},services,economy:()=>net});
 net=window.MindEconomyCloud({account:()=>cloud,changed(){}});
 const wish=window.MindWishCloud({account:()=>cloud,economy:()=>net,changed(){}});
 await cloud.init();await cloud.login();await tick();await tick();await net.observe();
 const ranking=window.MindRankingsCloud({account:()=>cloud,getState:()=>state,changed(){}});ranking.observe();return {cloud,net,wish,P,ranking,storage,state:()=>state,key:()=>state.arena.economy.key};
}

const R=require('../game/rankings.js');
test('地區券購買、使用與 15% 收益會跨裝置保存',async()=>{
 const db=database(),a=await player(db,'alice');await a.net.buy('north');assert.equal(a.state().arena.coins,9000);await a.net.honor('north');
 assert.equal(a.P.activeHonor(a.state().arena.economy.wallet).title,'自以為北部最聰明');assert.equal(a.state().arena.economy.wallet.stock.north,0);
 a.P.award(a.state().arena,100);a.cloud.localSave();await a.cloud.sync();assert.equal(a.state().arena.coins,9115);
 const b=await player(db,'alice');assert.equal(b.state().arena.coins,9115);assert.equal(b.P.factor(b.state().arena.economy.wallet),115);
});
test('同時上傳成績仍依序且一人一筆，更新不會重複登記',async()=>{
 const db=database(),a=await player(db,'alice'),b=await player(db,'bob'),season=R.week();
 for(const [p,points]of [[a,100],[b,800]]){p.state().arena.week.records.test={points};p.cloud.localSave();await p.cloud.sync();}
 await Promise.all([a.ranking.submit(),b.ranking.submit()]);
 assert.equal(db.rows.get('rankWeeks/'+season).count,2);assert.ok(db.retries()>0);
 const slot=db.rows.get('rankEntries/'+season+'_'+a.key()).slot;
 a.state().arena.week.records.test.points=1500;a.cloud.localSave();await a.cloud.sync();await a.ranking.submit();await a.ranking.submit();
 assert.equal(db.rows.get('rankWeeks/'+season).count,2);assert.equal(db.rows.get('rankSlots/'+season+'_'+slot).points,1500);
 await a.ranking.load();const result=a.ranking.snapshot();assert.equal(result.rows.length,2);assert.equal(result.leaders.silver.key,a.key());assert.equal(result.leaders.bronze,null);
});
test('完整結算可接續，冠軍自選地區並且只能領一次',async()=>{
 const db=database(),a=await player(db,'alice'),season=R.week()-7;
 const rows=Array.from({length:6},(_,i)=>({schema:1,week:season,slot:i+1,key:i===5?a.key():(i+200).toString(16).padStart(32,'0'),name:'旅人'+i,points:[100,800,1800,3600,4000,4500][i],achievedAt:1000+i,updatedAt:1000+i}));
 db.rows.set('rankWeeks/'+season,{schema:1,week:season,count:6});rows.forEach(r=>db.rows.set('rankSlots/'+season+'_'+r.slot,r));
 db.rows.set('rankFinals/'+season,R.finalize(null,rows.slice(0,4),6,season));
 await a.ranking.load(season);const final=a.ranking.snapshot();assert.equal(final.finished,true);assert.equal(final.leaders.diamond.key,a.key());assert.equal(final.progress,6);
 await a.net.crown(season,'south');assert.equal(a.P.factor(a.state().arena.economy.wallet),135);assert.equal(a.P.activeHonor(a.state().arena.economy.wallet).title,'南部最聰明');
 await assert.rejects(a.net.crown(season,'east'),/已領取/);
 const other=await player(db,'alice');assert.equal(other.P.factor(other.state().arena.economy.wallet),135);
});
test('不是冠軍或尚未結算不能領獎；交易回覆遺失不會重複延長稱號',async()=>{
 const db=database(),a=await player(db,'alice'),season=R.week()-7;
 await assert.rejects(a.net.crown(season,'north'),/尚未結算/);
 db.rows.set('rankFinals/'+season,{schema:1,week:season,cursor:1,finished:true,leaders:{...R.leaders([]),gold:{key:a.key(),name:'alice',points:2000,slot:1,achievedAt:1000}}});
 db.lose();await assert.rejects(a.net.crown(season,'east'),/reply lost/);db.reconnect();await a.cloud.sync();const before=db.rows.get('money/'+a.key()).crown;
 const replay=await a.net.crown(season,'east');assert.equal(replay.recovered,true);assert.deepEqual(db.rows.get('money/'+a.key()).crown,before);
 assert.equal([...db.rows.keys()].filter(k=>k.startsWith('rankClaims/')).length,1);
});
