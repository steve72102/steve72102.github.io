const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
function database(now=Date.now()){const rows=new Map(),watchers=[],commits=[];let failRead=false,loseReply=false,retries=0;
 const Clock=class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 const snap=p=>({exists:()=>rows.has(p),data:()=>clone(rows.get(p))});
 const sdk={doc:(_, ...p)=>p.join('/'),serverTimestamp:()=>Clock.now(),getDocFromServer:async p=>{if(failRead)throw Error('offline');return snap(p);},onSnapshot:(p,next)=>{const w={p,next,active:true};watchers.push(w);next(snap(p));return ()=>w.active=false;},runTransaction:async(_,fn)=>{for(let i=0;i<30;i++){const reads=new Map(),writes=new Map();const r=await fn({get:async p=>{assert.equal(writes.size,0,'transaction reads must precede every write');reads.set(p,JSON.stringify(rows.get(p)));return snap(p);},set:(p,v)=>writes.set(p,clone(v))});await tick();if([...reads].some(([p,v])=>JSON.stringify(rows.get(p))!==v)){retries++;continue;}for(const [p,v]of writes)rows.set(p,v);if(writes.size)commits.push([...writes.keys()]);watchers.filter(w=>w.active).forEach(w=>w.next(snap(w.p)));if(loseReply&&writes.size){loseReply=false;failRead=true;throw Error('reply lost after commit');}return r;}throw Error('contention');}};
 return {rows,sdk,Clock,advance:ms=>now+=ms,lose:()=>loseReply=true,reconnect:()=>failRead=false,retries:()=>retries,commits:()=>commits.map(paths=>[...paths])};
}
async function player(db,uid,storage=new Map()){
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},a={currentUser:null};let listener;
 const services={a,d:{},db:db.sdk,auth:{GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:(_,fn)=>listener=fn,signInWithPopup:async()=>{a.currentUser={uid,email:uid+'@example.test'};listener(a.currentUser);},signOut:async()=>{a.currentUser=null;listener(null);}}};
 const window={MIND_FIREBASE_CONFIG:{projectId:'demo'},MindJourney:{hasProgress:()=>true},crypto:webcrypto,addEventListener(){}};
 const context=vm.createContext({window,crypto:webcrypto,localStorage,navigator:{onLine:true},location:{protocol:'http:'},document:{hidden:false,addEventListener(){}},Date:db.Clock,setTimeout:()=>0,clearTimeout(){}});
 for(const file of ['engine','social-economy','wish','adventure','combat','cloud','wish-cloud','social-cloud'])vm.runInContext(fs.readFileSync(require.resolve('../game/'+file+'.js'),'utf8'),context);
 const P=window.MindEconomy,fresh=()=>({...window.MindEngine.fresh(),arena:{...window.MindCombat.fresh(),coins:10000},rpg:window.MindAdventure.fresh(),wishes:window.MindWish.fresh(),profile:{enrolled:true,name:uid}});let state=fresh(),net;
 if(!db.rows.has('players/'+uid))db.rows.set('players/'+uid,{schema:1,revision:1,payload:JSON.stringify(state),coins:10000,modifiedAt:1});
 const cloud=window.MindCloud({getState:()=>state,setState:s=>state=s,restore:clone,fresh,changed(){},busy:()=>false,warning(){},services,economy:()=>net});
 net=window.MindEconomyCloud({account:()=>cloud,changed(){}});
 const wish=window.MindWishCloud({account:()=>cloud,economy:()=>net,changed(){}});
 await cloud.init();await cloud.login();await tick();await tick();await net.observe();
 return {cloud,net,wish,P,storage,state:()=>state,key:()=>state.arena.economy.key};
}
test('帳號註冊保留原有金幣；三種券跨裝置保存並以固定價格扣款',async()=>{const db=database(),a=await player(db,'alice');assert.equal(a.state().arena.coins,10000);await a.net.buy('bully');await a.net.buy('counter');await a.net.buy('bomb');assert.equal(a.state().arena.coins,9160);const second=await player(db,'alice');assert.deepEqual(second.state().arena.economy.wallet.stock,{bully:1,counter:1,bomb:1});assert.equal(second.state().arena.coins,9160);});
test('交易回覆遺失後重試同一張券不會再扣款，刷新也能恢復',async()=>{const db=database(),a=await player(db,'alice');db.lose();await assert.rejects(a.net.buy('bully'),/reply lost/);await tick();assert.equal(a.cloud.snapshot().locked,true);db.reconnect();await a.cloud.sync();const again=await a.net.buy('bully');assert.equal(again.recovered,true);assert.equal(a.state().arena.coins,9820);assert.equal(a.state().arena.economy.wallet.stock.bully,1);});
test('兩位玩家同時進樓不重複占位；重返同樓維持原班級',async()=>{const db=database(),a=await player(db,'alice'),b=await player(db,'bob');await Promise.all([a.net.enter('herbal'),b.net.enter('herbal')]);await a.net.enter('herbal');const classes=await a.net.classes('herbal');assert.equal(classes[0].members.length,2);assert.equal(db.rows.get('classDays/'+a.P.day()+'_herbal').count,2);assert.ok(db.retries()>0);});
test('收益加成和反霸凌由同一筆交易更新兩方，券與配額不會重播',async()=>{const db=database(),a=await player(db,'alice'),b=await player(db,'bob');for(let i=0;i<3;i++)await a.net.buy('bully');await b.net.buy('counter');for(let i=0;i<3;i++)await a.net.bully(b.key());assert.equal(db.rows.get('money/'+a.key()).bonus,9);assert.equal(db.rows.get('money/'+b.key()).penalty,6);await b.net.counter();assert.equal(db.rows.get('money/'+b.key()).penalty,0);assert.equal(db.rows.get('money/'+b.key()).usedCounters,1);await a.net.buy('bully');await assert.rejects(a.net.bully(b.key()),/三次/);});
test('待入帳收入只結算一次，先償還欠款；舊裝置不能覆寫外來扣款',async()=>{const db=database(),a=await player(db,'alice'),second=await player(db,'alice'),key=a.key();let w=db.rows.get('money/'+key);db.rows.set('money/'+key,{...w,coins:0,debt:19,revision:w.revision+1});a.P.award(a.state().arena,10);a.cloud.localSave();await a.cloud.sync();assert.equal(db.rows.get('money/'+key).debt,9);assert.equal(a.state().arena.coins,0);second.state().xp=20;second.cloud.localSave();await second.cloud.sync();assert.equal(second.state().arena.coins,0);assert.equal(second.state().arena.economy.wallet.debt,9);await second.cloud.sync();assert.equal(db.rows.get('money/'+key).debt,9);});
test('另一台裝置稍晚的舊存檔不能抹掉已購衣服',async()=>{const db=database(),a=await player(db,'alice'),second=await player(db,'alice');await a.net.mutate('gear-buy','coat-dawn');second.state().xp=10;second.cloud.localSave();await second.cloud.sync();assert.equal(second.state().rpg.items['coat-dawn'],1);assert.equal(second.state().arena.coins,a.state().arena.coins);});
test('水果服飾購買回覆遺失後先恢復原收據，不會重複扣款或偷偷購入別件',async()=>{
 const db=database(Date.parse('2026-11-01T12:00:00Z')),a=await player(db,'fruit-buyer');
 db.lose();await assert.rejects(a.net.mutate('gear-buy','fruit-citrus-jacket'),/reply lost/);await tick();db.reconnect();await a.cloud.sync();
 const recovered=await a.net.mutate('gear-buy','fruit-berry-jacket');assert.equal(recovered.recovered,true);assert.equal(recovered.previous,true);assert.equal(a.state().arena.coins,9760);assert.equal(a.state().rpg.items['fruit-citrus-jacket'],1);assert.equal(a.state().rpg.items['fruit-berry-jacket'],undefined);
 const receipt=[...db.rows].find(([path,row])=>path.startsWith('economyOps/')&&row.kind==='game'&&row.param==='fruit-citrus-jacket');assert(receipt);assert.equal(receipt[1].debit,240);const writes=db.commits().find(paths=>paths.includes(receipt[0]));for(const path of ['money/'+a.key(),'players/fruit-buyer',receipt[0]])assert(writes.includes(path));
 const second=await player(db,'fruit-buyer');assert.equal(second.state().rpg.items['fruit-citrus-jacket'],1);assert.equal(second.state().arena.coins,9760);await a.net.mutate('gear-buy','fruit-berry-jacket');assert.equal(a.state().rpg.items['fruit-berry-jacket'],1);assert.equal(a.state().arena.coins,9520);
});
test('同帳號雙裝置同時購買不同水果配件，餘額和兩件收藏一起保留',async()=>{
 const db=database(Date.parse('2026-11-01T12:00:00Z')),a=await player(db,'fruit-concurrent'),b=await player(db,'fruit-concurrent');
 await Promise.all([a.net.mutate('gear-buy','fruit-pomelo-hat'),b.net.mutate('gear-buy','fruit-grape-handheld')]);await a.cloud.sync();await b.cloud.sync();
 const saved=JSON.parse(db.rows.get('players/fruit-concurrent').payload),wallet=db.rows.get('money/'+a.key());assert.equal(wallet.coins,9680);for(const state of [a.state(),b.state(),saved]){assert.equal(state.arena.coins,9680);assert.equal(state.rpg.items['fruit-pomelo-hat'],1);assert.equal(state.rpg.items['fruit-grape-handheld'],1);}assert(db.retries()>0);
 const receipts=[...db.rows].filter(([path,row])=>path.startsWith('economyOps/')&&row.kind==='game'&&row.action==='gear-buy');assert.equal(receipts.length,2);assert.deepEqual(receipts.map(([,row])=>row.debit).sort((a,b)=>a-b),[140,180]);
});
test('另一台裝置保留已買已穿的水果衣服，跨端舊存檔不會覆蓋新收藏',async()=>{
 const db=database(Date.parse('2026-11-01T12:00:00Z')),a=await player(db,'fruit-wearer'),b=await player(db,'fruit-wearer');await a.net.mutate('gear-buy','fruit-cherry-jacket');a.state().rpg.loadout.jacket='fruit-cherry-jacket';a.cloud.localSave();await a.cloud.sync();b.state().xp=10;b.cloud.localSave();await b.cloud.sync();
 assert.equal(b.state().rpg.loadout.jacket,'fruit-cherry-jacket');assert.equal(b.state().rpg.items['fruit-cherry-jacket'],1);assert.equal(b.state().arena.coins,9760);const freshDevice=await player(db,'fruit-wearer');assert.equal(freshDevice.state().rpg.loadout.jacket,'fruit-cherry-jacket');assert.equal(freshDevice.state().rpg.items['fruit-cherry-jacket'],1);
});
test('許願使用即時共用帳本餘額，抽到的物品與金幣同步保存',async()=>{const db=database(),a=await player(db,'alice');await a.net.buy('bomb');const before=db.rows.get('money/'+a.key()).coins;await a.wish.draw();assert.equal(db.rows.get('money/'+a.key()).coins,before-1000);assert.equal(a.state().arena.coins,before-1000);assert.equal(db.rows.get('fountains/central').balance,1000);assert.equal(a.state().wishes.draws,1);assert.equal(a.state().arena.economy.wallet.stock.bomb,1);});
test('整班結算可重試，餘額不足留下欠款，使用者收到全額',async()=>{
 const db=database(),a=await player(db,'alice'),b=await player(db,'bob');await a.net.enter('herbal');await b.net.enter('herbal');
 let w=db.rows.get('money/'+a.key());db.rows.set('money/'+a.key(),{...w,usedCounters:6,penalty:31,stock:{...w.stock,bomb:1},revision:w.revision+1});
 w=db.rows.get('money/'+b.key());db.rows.set('money/'+b.key(),{...w,coins:3,earned:110,revision:w.revision+1});
 const room=a.state().arena.economy.wallet.rooms.herbal;await a.net.bomb(room);for(let i=0;i<20;i++)await tick();const job=[...db.rows].find(([path])=>path.startsWith('bombs/'));assert.ok(job);await a.net.resumeBomb(job[0].slice(6));assert.equal(db.rows.get('money/'+b.key()).debt,19);assert.equal(db.rows.get('money/'+a.key()).coins,10022);assert.equal(db.rows.get(job[0]).total,22);await a.net.resumeBomb(job[0].slice(6));assert.equal(db.rows.get('money/'+a.key()).coins,10022);
});

test('原班滿 50 人且已開第二班後，跨裝置重新登入仍保留當天同科原班',async()=>{
 const db=database(),first=await player(db,'returning-student');
 await first.net.enter('herbal');await first.net.enter('pharmaceutics');
 const firstRooms=clone(first.state().arena.economy.wallet.rooms),day=first.P.day();
 for(let i=0;i<50;i++){const newcomer=await player(db,'newcomer-'+i);await newcomer.net.enter('herbal');}
 assert.equal(db.rows.get('classDays/'+day+'_herbal').count,51);
 assert.equal(db.rows.get('classRooms/'+day+'_herbal_2').members.length,1);
 const secondDevice=await player(db,'returning-student');
 for(let i=0;i<3;i++){await secondDevice.net.enter('herbal');await secondDevice.net.enter('pharmaceutics');}
 assert.deepEqual(secondDevice.state().arena.economy.wallet.rooms,firstRooms);
 assert.equal(db.rows.get('classDays/'+day+'_herbal').count,51);
 assert.equal(db.rows.get('classDays/'+day+'_pharmaceutics').count,1);
 assert.equal(db.rows.get('classRooms/'+firstRooms.herbal).members.length,50);
 assert.equal(db.rows.get('classRooms/'+firstRooms.herbal).members.filter(k=>k===first.key()).length,1);
});


test('同帳號兩裝置同時購買不同券，各自只扣一次且以最新帳本為準',async()=>{
 const db=database(),a=await player(db,'alice'),b=await player(db,'alice');
 await Promise.all([a.net.buy('bully'),b.net.buy('bomb')]);await a.cloud.sync();await b.cloud.sync();
 const wallet=db.rows.get('money/'+a.key());assert.equal(wallet.coins,9220);assert.equal(wallet.stock.bully,1);assert.equal(wallet.stock.bomb,1);
 assert.equal(a.state().arena.coins,9220);assert.equal(b.state().arena.coins,9220);
 assert.equal([...db.rows].filter(([path,row])=>path.startsWith('economyOps/')&&row.kind==='buy').length,2);
});
test('同帳號跨端許願與購券競爭，池款、餘額及券不可部分提交',async()=>{
 const db=database(),a=await player(db,'alice'),b=await player(db,'alice');
 await Promise.all([a.wish.draw(),b.net.buy('counter')]);await a.cloud.sync();await b.cloud.sync();
 const pool=db.rows.get('fountains/central'),wallet=db.rows.get('money/'+a.key()),playerSave=JSON.parse(db.rows.get('players/alice').payload);
 assert.equal(pool.draws,1);assert.equal(pool.contributed,1000);assert.equal(pool.balance+pool.paidOut,1000);
 assert.equal(wallet.coins,10000-1000-60+pool.paidOut);assert.equal(wallet.stock.counter,1);assert.equal(playerSave.wishes.draws,1);
 assert.equal(a.state().arena.coins,wallet.coins);assert.equal(b.state().arena.coins,wallet.coins);
});
test('未知成功結果改點別種券時，先回復舊收據，不偷偷執行新購買',async()=>{
 const db=database(),a=await player(db,'alice');db.lose();await assert.rejects(a.net.buy('bully'),/reply lost/);await tick();db.reconnect();await a.cloud.sync();
 const result=await a.net.buy('bomb');assert.equal(result.recovered,true);assert.equal(result.previous,true);
 const wallet=db.rows.get('money/'+a.key());assert.equal(wallet.coins,9820);assert.equal(wallet.stock.bully,1);assert.equal(wallet.stock.bomb,0);
});


test('已完成券操作只能清除自己的intent，不能抹掉另一分頁新操作的重試紀錄',async()=>{
 const db=database(),a=await player(db,'alice'),run=db.sdk.runTransaction,next={id:'f'.repeat(32),kind:'buy',args:{kind:'bomb'}};
 db.sdk.runTransaction=async(...args)=>{const result=await run(...args);if(result.receipt?.kind==='buy'&&!result.recovered)a.storage.set('mind-quest-social-operation:alice',JSON.stringify(next));return result;};
 await a.net.buy('bully');assert.deepEqual(JSON.parse(a.storage.get('mind-quest-social-operation:alice')),next);
 assert.equal(db.rows.get('money/'+a.key()).coins,9820);
});

test('不同新帳號同時攻擊讓人數原子地由 2 經 3 到 4，較早操作不追溯加成',async()=>{
 const db=database(),target=await player(db,'target'),actors=[];
 for(const name of ['first','second','third','fourth']){const a=await player(db,name);await a.net.buy('bully');actors.push(a);}
 const early=[];for(const a of actors.slice(0,2))early.push(await a.net.bully(target.key()));
 const crowd=target.P.day()+'_'+target.key(),retries=db.retries();
 assert.equal(db.rows.get('bullyCrowds/'+crowd).count,2);
 const late=await Promise.all(actors.slice(2).map(a=>a.net.bully(target.key())));
 assert.ok(db.retries()>retries);assert.deepEqual(late.map(r=>r.receipt.crowdCount).sort(),[3,4]);
 assert.deepEqual(early.map(r=>r.receipt.crowdBonus),[0,0]);assert.deepEqual(late.map(r=>r.receipt.crowdBonus),[1,1]);
 assert.equal(db.rows.get('bullyCrowds/'+crowd).count,4);
 assert.equal([...db.rows.keys()].filter(path=>path.startsWith('bullyCrowdMembers/'+crowd+'_')).length,4);
 assert.equal(db.rows.get('money/'+target.key()).penalty,6);
 for(let i=0;i<actors.length;i++){
  const a=actors[i],w=db.rows.get('money/'+a.key()),member=db.rows.get('bullyCrowdMembers/'+crowd+'_'+a.key());
  assert.equal(w.bonus,i<2?2:3);assert.equal(w.stock.bully,0);assert.equal(w.coins,9820);
  const receipt=db.rows.get('economyOps/'+member.operationId),paths=db.commits().find(paths=>paths.includes('economyOps/'+member.operationId));
  assert.equal(receipt.crowd,crowd);assert.equal(receipt.crowdMember,crowd+'_'+a.key());assert.equal(receipt.crowdNew,true);
  for(const path of ['money/'+a.key(),'money/'+target.key(),'bullyPairs/'+receipt.pair,'bullyCrowds/'+crowd,'bullyCrowdMembers/'+receipt.crowdMember,'players/'+['first','second','third','fourth'][i]])assert.ok(paths.includes(path),path+' must commit with its receipt');
  assert.equal(JSON.parse(db.rows.get('players/'+['first','second','third','fourth'][i]).payload).arena.economy.wallet.bonus,w.bonus);
 }
});
test('同帳號兩裝置並發使用只新增一個成員，重用該日人數與同目標配額',async()=>{
 const db=database(),target=await player(db,'target');
 for(const name of ['first','second']){const p=await player(db,name);await p.net.buy('bully');await p.net.bully(target.key());}
 const a=await player(db,'alice');await a.net.buy('bully');await a.net.buy('bully');const second=await player(db,'alice');
 const results=await Promise.all([a.net.bully(target.key()),second.net.bully(target.key())]),crowd=a.P.day()+'_'+target.key();
 assert.deepEqual(results.map(r=>r.receipt.crowdNew).sort(),[false,true]);
 for(const result of results){assert.equal(result.receipt.crowdCount,3);assert.equal(result.receipt.crowdBonus,1);}
 const group=db.rows.get('bullyCrowds/'+crowd),member=db.rows.get('bullyCrowdMembers/'+crowd+'_'+a.key());
 assert.equal(group.count,3);assert.notEqual(group.operationId,member.operationId);
 assert.equal(db.rows.get('economyOps/'+member.operationId).crowdNew,true);
 assert.equal(db.rows.get('economyOps/'+group.operationId).crowdNew,false);
 assert.equal(db.commits().find(paths=>paths.includes('economyOps/'+group.operationId)).includes('bullyCrowdMembers/'+crowd+'_'+a.key()),false);
 assert.equal([...db.rows.keys()].filter(path=>path.startsWith('bullyCrowdMembers/'+crowd+'_')).length,3);
 assert.equal(db.rows.get('bullyPairs/'+a.P.day()+'_'+a.key()+'_'+target.key()).used,2);
 assert.equal(db.rows.get('money/'+a.key()).bonus,7);assert.equal(db.rows.get('money/'+a.key()).stock.bully,0);
 assert.equal(db.rows.get('money/'+target.key()).penalty,7);
});
test('霸凌成功回覆遺失後使用原收據恢復，人數與券不重算且不受後續人數影響',async()=>{
 const db=database(),a=await player(db,'alice'),b=await player(db,'bob'),target=await player(db,'target');
 await a.net.buy('bully');await b.net.buy('bully');db.lose();
 await assert.rejects(a.net.bully(target.key()),/reply lost/);await tick();
 const intent=JSON.parse(a.storage.get('mind-quest-social-operation:alice')),original=clone(db.rows.get('economyOps/'+intent.id));
 assert.equal(original.crowdCount,1);assert.equal(a.cloud.snapshot().locked,true);
 db.reconnect();await b.net.bully(target.key());await a.cloud.sync();
 const before=clone(db.rows.get('bullyCrowds/'+original.crowd)),again=await a.net.bully(target.key());
 assert.equal(again.recovered,true);assert.deepEqual(again.receipt,original);
 assert.deepEqual(db.rows.get('bullyCrowds/'+original.crowd),before);assert.equal(before.count,2);
 assert.equal(db.rows.get('money/'+a.key()).stock.bully,0);assert.equal(db.rows.get('money/'+a.key()).bonus,2);
 assert.equal(db.rows.get('money/'+target.key()).penalty,2);assert.equal(db.rows.get('bullyPairs/'+original.pair).used,1);
 assert.equal(a.storage.has('mind-quest-social-operation:alice'),false);
});
test('反霸凌只清除減益，當日不同攻擊者與後續當次群體加成仍保留',async()=>{
 const db=database(),target=await player(db,'target'),actors=[];await target.net.buy('counter');
 for(const name of ['first','second','third']){const a=await player(db,name);await a.net.buy('bully');actors.push(a);await a.net.bully(target.key());}
 const crowd=target.P.day()+'_'+target.key(),before=clone(db.rows.get('bullyCrowds/'+crowd));
 assert.equal(db.rows.get('money/'+target.key()).penalty,4);await target.net.counter();
 assert.equal(db.rows.get('money/'+target.key()).penalty,0);assert.deepEqual(db.rows.get('bullyCrowds/'+crowd),before);
 await actors[0].net.buy('bully');const again=await actors[0].net.bully(target.key());
 assert.equal(again.receipt.crowdNew,false);assert.equal(again.receipt.crowdCount,3);assert.equal(again.receipt.crowdBonus,1);
 assert.equal(db.rows.get('money/'+target.key()).penalty,3);assert.equal(db.rows.get('money/'+actors[0].key()).bonus,6);
 assert.equal(db.rows.get('bullyCrowds/'+crowd).count,3);assert.equal(db.rows.get('money/'+target.key()).usedCounters,1);
});
test('沒有券或目標已達 30% 地板的失敗操作不建立成員、不增加人數、不扣券',async()=>{
 for(const floor of [false,true]){
  const db=database(),a=await player(db,'alice'),target=await player(db,'target'),crowd=a.P.day()+'_'+target.key();
  if(floor){
   for(const name of ['first','second']){const p=await player(db,name);await p.net.buy('bully');await p.net.bully(target.key());}
   await a.net.buy('bully');const w=db.rows.get('money/'+target.key());db.rows.set('money/'+target.key(),{...w,penalty:70,revision:w.revision+1});
  }
  const group=db.rows.get('bullyCrowds/'+crowd),actor=clone(db.rows.get('money/'+a.key())),victim=clone(db.rows.get('money/'+target.key()));
  await assert.rejects(a.net.bully(target.key()),floor?/減益上限/:/沒有霸凌券/);await tick();
  assert.deepEqual(db.rows.get('bullyCrowds/'+crowd),group);
  assert.equal(db.rows.has('bullyCrowdMembers/'+crowd+'_'+a.key()),false);
  assert.equal(db.rows.has('bullyPairs/'+a.P.day()+'_'+a.key()+'_'+target.key()),false);
  assert.deepEqual(db.rows.get('money/'+a.key()),actor);assert.deepEqual(db.rows.get('money/'+target.key()),victim);
  assert.equal([...db.rows.values()].filter(row=>row.kind==='bully'&&row.actor===a.key()).length,0);
 }
});
test('臺灣午夜後另建當日人數與成員，舊日歷史保留且加成和目標配額重置',async()=>{
 const db=database(Date.parse('2026-03-01T15:59:00Z')),target=await player(db,'target'),actors=[];
 for(const name of ['first','second','third']){const a=await player(db,name);await a.net.buy('bully');if(name==='first')await a.net.buy('bully');actors.push(a);await a.net.bully(target.key());}
 const a=actors[0],oldDay=a.P.day(),oldCrowd=oldDay+'_'+target.key(),oldGroup=clone(db.rows.get('bullyCrowds/'+oldCrowd)),oldMember=clone(db.rows.get('bullyCrowdMembers/'+oldCrowd+'_'+a.key()));
 assert.equal(oldGroup.count,3);db.advance(120000);assert.equal(a.P.day(),oldDay+1);
 const next=await a.net.bully(target.key()),crowd=a.P.day()+'_'+target.key();
 assert.equal(next.receipt.crowd,crowd);assert.equal(next.receipt.crowdCount,1);assert.equal(next.receipt.crowdBonus,0);assert.equal(next.receipt.crowdNew,true);assert.equal(next.receipt.step,1);
 assert.equal(db.rows.get('bullyCrowds/'+crowd).count,1);assert.equal(db.rows.get('bullyPairs/'+next.receipt.pair).used,1);
 assert.deepEqual(db.rows.get('bullyCrowds/'+oldCrowd),oldGroup);assert.deepEqual(db.rows.get('bullyCrowdMembers/'+oldCrowd+'_'+a.key()),oldMember);
 assert.equal(db.rows.get('money/'+a.key()).bonus,2);assert.equal(db.rows.get('money/'+target.key()).penalty,1);
});
test('升級前的同目標使用配額仍有效，舊紀錄不推算今日不同攻擊者',async()=>{
 const db=database(),a=await player(db,'alice'),target=await player(db,'target');await a.net.buy('bully');await a.net.buy('bully');
 const pair=a.P.day()+'_'+a.key()+'_'+target.key(),crowd=a.P.day()+'_'+target.key(),w=db.rows.get('money/'+a.key());
 db.rows.set('bullyPairs/'+pair,{day:a.P.day(),actor:a.key(),target:target.key(),used:2,operationId:'a'.repeat(32)});
 db.rows.set('money/'+a.key(),{...w,lastTarget:target.key(),streak:2,bonus:5,revision:w.revision+1});
 const result=await a.net.bully(target.key());assert.equal(result.receipt.step,3);assert.equal(result.receipt.crowdCount,1);assert.equal(result.receipt.crowdBonus,0);
 assert.equal(db.rows.get('bullyPairs/'+pair).used,3);assert.equal(db.rows.get('bullyCrowds/'+crowd).count,1);
 const group=clone(db.rows.get('bullyCrowds/'+crowd)),stock=db.rows.get('money/'+a.key()).stock.bully;
 await assert.rejects(a.net.bully(target.key()),/三次/);assert.deepEqual(db.rows.get('bullyCrowds/'+crowd),group);assert.equal(db.rows.get('money/'+a.key()).stock.bully,stock);
});
