// Local emulator only. No production authentication or player data is used.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),P=require('../game/social-economy.js');
const base='http://127.0.0.1:8085',project='demo-mind-quest-rules',root=`projects/${project}/databases/(default)/documents`,url=base+'/v1/'+root;
const A='a'.repeat(32),B='b'.repeat(32),C='c'.repeat(32);let serial=100;
const op=()=> (++serial).toString(16).padStart(32,'0');
function token(uid){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return enc({alg:'none',type:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,user_id:uid,iat:0,exp:3600,auth_time:0,firebase:{sign_in_provider:'custom',identities:{}}})+'.';}
const enc=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:typeof v==='boolean'?{booleanValue:v}:v.timestampValue?{timestampValue:v.timestampValue}:{mapValue:{fields:fields(v)}};
const fields=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,enc(v)]));
const dec=v=>v.mapValue?unfields(v.mapValue.fields):v.arrayValue?(v.arrayValue.values||[]).map(dec):v.integerValue!==undefined?Number(v.integerValue):v.stringValue!==undefined?v.stringValue:v.timestampValue?{timestampValue:v.timestampValue}:v.booleanValue!==undefined?v.booleanValue:null;
const unfields=f=>Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,dec(v)]));
async function req(path,{uid,method='GET',body,admin=false}={}){const res=await fetch(path,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer owner'}:uid?{Authorization:'Bearer '+token(uid)}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};}
const write=(path,data,transforms=[])=>({update:{name:root+'/'+path,fields:fields(Object.fromEntries(Object.entries(data).filter(([k])=>!transforms.includes(k))))},...(transforms.length?{updateTransforms:transforms.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}:{})});
const commit=(writes,uid='alice',admin=false)=>req(url+':commit',{uid,admin,method:'POST',body:{writes}});
async function get(path,uid='alice'){const r=await req(url+'/'+path,{uid});return r.status===404?null:(assert.equal(r.status,200,JSON.stringify(r.body)),unfields(r.body.fields));}
async function reset(){assert.equal((await req(base+`/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'})).status,200);}
async function good(writes,uid='alice'){const r=await commit(writes,uid);assert.equal(r.status,200,JSON.stringify(r.body));return r;}
const cloneWrites=writes=>structuredClone(writes);
const writeAt=(writes,path)=>{const found=writes.find(w=>w.update?.name===root+'/'+path);assert.ok(found,'Missing test write: '+path);return found;};
function changeWrite(writes,path,change){const w=writeAt(writes,path),data=unfields(w.update.fields);change(data);w.update.fields=fields(data);return writes;}
function hitReceipt(writes){const w=writes.find(w=>w.update?.name.startsWith(root+'/economyOps/'));assert.ok(w);return {id:w.update.name.slice(w.update.name.lastIndexOf('/')+1),...unfields(w.update.fields)};}
async function denied(writes,uid='alice'){const r=await commit(writes,uid);assert.equal(r.status,403,JSON.stringify(r.body));}
function stamped(k,w,id){const next={...w,revision:w.revision+1,operationId:id};return {next,write:write('money/'+k,next,['updatedAt'])};}
const receipt=(id,r)=>write('economyOps/'+id,{schema:1,day:P.day(),...r},['createdAt']);
async function seed(uid,k,overrides={}){const w={...P.freshWallet(5000,uid),revision:1,...overrides};const player={schema:1,revision:1,payload:'{}',coins:w.coins,modifiedAt:Date.now(),economy:{key:k,revision:1}};assert.equal((await commit([write('players/'+uid,player,['updatedAt']),write('economyAccounts/'+uid,{schema:1,key:k}),write('economyKeys/'+k,{uid}),write('money/'+k,w,['updatedAt'])],null,true)).status,200);return w;}
async function purchase(k,kind,uid='alice'){const id=op(),b=await get('money/'+k),n=stamped(k,P.purchase(b,kind),id);await good([n.write,receipt(id,{kind:'buy',actor:k,item:kind,sequence:n.next.revision})],uid);return n.next;}
async function incomeWrites(k,amount,{id=op(),debit=0}={}){const b=await get('money/'+k),n=P.earn(P.roll(b),amount).wallet;n.cursors={...n.cursors,[C]:(n.cursors[C]||0)+1};n.coins-=debit;const x=stamped(k,n,id);return [x.write,receipt(id,{kind:'income',actor:k,amount,debit,devices:[C],sequence:x.next.revision})];}
async function hitWrites(actor,target){
  const id=op(),today=P.day(),pair=today+'_'+actor+'_'+target,crowd=today+'_'+target,crowdMember=crowd+'_'+actor;
  const [a,b,previous,group,member]=await Promise.all([get('money/'+actor),get('money/'+target),get('bullyPairs/'+pair),get('bullyCrowds/'+crowd),get('bullyCrowdMembers/'+crowdMember)]);
  const plan=P.crowdPlan(group,member,{day:today,actorKey:actor,targetKey:target});
  const p=P.bully(P.roll(a),P.roll(b),{actorKey:actor,targetKey:target,used:previous?.used||0,crowdCount:plan.crowdCount}),x=stamped(actor,p.actor,id),y=stamped(target,p.target,id);
  const writes=[x.write,y.write,write('bullyPairs/'+pair,{day:today,actor,target,used:p.used,operationId:id}),write('bullyCrowds/'+crowd,{schema:1,day:today,target,count:plan.crowdCount,operationId:id}),receipt(id,{kind:'bully',actor,target,pair,step:p.step,...plan,sequence:x.next.revision})];
  if(plan.crowdNew)writes.push(write('bullyCrowdMembers/'+crowdMember,{schema:1,day:today,target,actor,operationId:id}));
  return writes;
}
async function hit(actor,target,uid='alice'){
  const writes=await hitWrites(actor,target);await good(writes,uid);return writes;
}
async function enroll(k,building='herbal',uid='alice'){
  const b=await get('money/'+k),id=op(),group=P.day()+'_'+building,member=group+'_'+k,g=await get('classDays/'+group)||{day:P.day(),building,count:0},m=await get('classMembers/'+member),number=m?.number||P.enrollment(g.count).number,roomId=group+'_'+number;
  const room=await get('classRooms/'+roomId)||{day:P.day(),building,number,members:[],activeBomb:null},w=P.roll(b);w.rooms[building]=roomId;const x=stamped(k,w,id),writes=[x.write,receipt(id,{kind:'enroll',actor:k,building,group,member,room:roomId,number,newMember:!m,sequence:x.next.revision})];
  if(!m)writes.push(write('classDays/'+group,{...g,count:g.count+1,operationId:id}),write('classRooms/'+roomId,{...room,members:[...room.members,k],operationId:id}),write('classMembers/'+member,{day:P.day(),building,number,key:k,room:roomId,operationId:id}));
  await good(writes,uid);return roomId;
}
async function bomb(k,roomId,uid='alice',only=false){
  const id=op(),b=await get('money/'+k),room=await get('classRooms/'+roomId),watch=await get('bombWatch/'+P.day())||{day:P.day(),active:{}},x=stamped(k,{...P.roll(b),stock:{...b.stock,bomb:b.stock.bomb-1}},id);
  const r={kind:'bomb',actor:k,building:room.building,room:roomId,members:room.members,sequence:x.next.revision};
  const writes=[x.write,receipt(id,r),write('classRooms/'+roomId,{...room,activeBomb:id,operationId:id}),write('bombWatch/'+P.day(),{...watch,active:{...watch.active,[roomId]:{operationId:id,members:room.members}},operationId:id}),write('bombs/'+id,{schema:1,day:P.day(),actor:k,room:roomId,members:room.members,settled:0,total:0,done:false,operationId:id},['createdAt'])];
  if(only)return writes;await good(writes,uid);return id;
}
async function settleWrites(id,target){
  const b=await get('bombs/'+id),actor=await get('money/'+b.actor),victim=await get('money/'+target),watch=await get('bombWatch/'+b.day),room=await get('classRooms/'+b.room),operation='b'+id+'_'+target,p=P.settleBomb(actor,victim,target===b.actor),remaining=watch.active[b.room].members.filter(x=>x!==target),active={...watch.active};
  if(remaining.length)active[b.room]={operationId:id,members:remaining};else delete active[b.room];
  const writes=[receipt(operation,{kind:'settle',actor:b.actor,target,bomb:id,room:b.room,day:b.day,amount:p.amount,cash:p.cash,debt:p.debt}),write('bombWatch/'+b.day,{...watch,active,operationId:operation}),write('bombs/'+id,{...b,settled:b.settled+1,total:b.total+p.amount,done:remaining.length===0,operationId:operation})];
  if(target!==b.actor)writes.push(stamped(b.actor,p.actor,operation).write,stamped(target,p.target,operation).write);
  if(!remaining.length)writes.push(write('classRooms/'+b.room,{...room,activeBomb:null,operationId:operation}));
  return writes;
}
test('正式規則可在本機模擬器編譯',async()=>{const r=await req(base+`/emulator/v1/projects/${project}:securityRules`,{method:'PUT',body:{rules:{files:[{name:'firestore.rules',content:fs.readFileSync('game/firestore.rules','utf8')}]}}});assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(!r.body.issues?.some(x=>x.severity==='ERROR'),JSON.stringify(r.body));});
test('新版存檔格式一旦寫入，舊分頁不能降版或省略格式欄位',async()=>{
 await reset();const player={schema:1,saveFormat:2,revision:1,payload:'{}',coins:0,modifiedAt:Date.now()};
 await good([write('players/alice',player,['updatedAt'])]);
 const next={...player,revision:2};delete next.saveFormat;
 assert.equal((await commit([write('players/alice',next,['updatedAt'])])).status,403);
 assert.equal((await commit([write('players/alice',{...next,saveFormat:1},['updatedAt'])])).status,403);
 assert.equal((await commit([write('players/alice',{...next,saveFormat:3},['updatedAt'])])).status,403);
 await good([write('players/alice',{...next,saveFormat:2},['updatedAt'])]);
 assert.equal((await get('players/alice')).revision,2);
});
test('一般玩家無法讀寫擁有者管理測試收據',async()=>{
 await reset();const target='adminFixtures/owner-lv90-wallet10000-v1';
 assert.equal((await req(url+'/'+target,{uid:'alice'})).status,403);
 assert.equal((await commit([write(target,{uid:'alice',coins:10000})])).status,403);
});
test('初次綁定只匯入該玩家餘額，Google UID 與存檔不會公開',async()=>{
  await reset();await commit([write('players/alice',{schema:1,revision:1,payload:'{}',coins:1000,modifiedAt:Date.now()},['updatedAt'])],null,true);
  const w={...P.freshWallet(1000,'Alice'),revision:1};
  await good([write('economyAccounts/alice',{schema:1,key:A}),write('economyKeys/'+A,{uid:'alice'}),write('money/'+A,w,['updatedAt']),write('players/alice',{schema:1,revision:2,payload:'{}',coins:1000,modifiedAt:Date.now(),economy:{key:A,revision:1}},['updatedAt'])]);
  assert.equal((await req(url+'/money/'+A,{uid:'bob'})).status,200);assert.equal((await req(url+'/economyKeys/'+A,{uid:'bob'})).status,403);assert.equal((await req(url+'/players/alice',{uid:'bob'})).status,403);
  assert.equal((await commit([write('money/'+A,{...w,coins:9000,revision:2},['updatedAt'])])).status,403);
});
test('三種券售價與庫存由規則檢查，炸彈券 600 金幣',async()=>{await reset();await seed('alice',A);await purchase(A,'bully');await purchase(A,'counter');await purchase(A,'bomb');const a=await get('money/'+A);assert.equal(a.coins,4160);assert.deepEqual(a.stock,{bully:1,counter:1,bomb:1});const id=op(),x=stamped(A,{...a,coins:a.coins-500,stock:{...a.stock,bomb:2}},id);assert.equal((await commit([x.write,receipt(id,{kind:'buy',actor:A,item:'bomb',sequence:x.next.revision})])).status,403);});
test('連用 −6/+9、每日三張配額，不能偽造第四張或單獨扣別人的錢',async()=>{await reset();await seed('alice',A,{stock:{bully:4,counter:0,bomb:0}});await seed('bob',B);await hit(A,B);await hit(A,B);const third=await hit(A,B);assert.equal((await get('money/'+A)).bonus,9);assert.equal((await get('money/'+B)).penalty,6);assert.equal((await commit(third)).status,403);const b=await get('money/'+B);assert.equal((await commit([stamped(B,{...b,coins:0},op()).write])).status,403);});
test('清除減益不會清除攻擊者對目標的次數，反霸凌後仍可受影響',async()=>{await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B,{stock:{bully:0,counter:1,bomb:0}});await hit(A,B);let b=await get('money/'+B),id=op(),n=stamped(B,P.counter(b),id);await good([n.write,receipt(id,{kind:'counter',actor:B,sequence:n.next.revision})],'bob');await hit(A,B);b=await get('money/'+B);assert.equal(b.penalty,2);assert.equal(b.usedCounters,1);});
test('第 51 位自動第二班，重返原樓不重複占位，不同棟樓各自分班',async()=>{await reset();const keys=Array.from({length:51},(_,i)=>(i+200).toString(16).padStart(32,'0'));for(let i=0;i<keys.length;i++){await seed('user'+i,keys[i]);await enroll(keys[i],'herbal','user'+i);}const group=P.day()+'_herbal';assert.equal((await get('classDays/'+group)).count,51);assert.equal((await get('classRooms/'+group+'_1')).members.length,50);assert.equal((await get('classRooms/'+group+'_2')).members.length,1);await enroll(keys[0],'herbal','user0');assert.equal((await get('classDays/'+group)).count,51);await enroll(keys[0],'pharmacology','user0');assert.equal((await get('classDays/'+P.day()+'_pharmacology')).count,1);});
test('炸彈先固定班級收入；逐人結算含欠款且不會重複發放',async()=>{
  await reset();await seed('alice',A,{usedCounters:6,penalty:31,stock:{bully:0,counter:0,bomb:1}});await seed('bob',B,{coins:3,earned:110});
  const room=await enroll(A);await enroll(B,'herbal','bob');const id=await bomb(A,room);
  assert.equal((await commit(await incomeWrites(B,100),'bob')).status,403);
  const writes=await settleWrites(id,B);await good(writes,'bob');assert.equal((await commit(writes,'bob')).status,403);
  const b=await get('money/'+B);assert.deepEqual([b.coins,b.debt],[0,19]);assert.equal((await get('money/'+A)).coins,5022);
  await good(await settleWrites(id,A),'bob');assert.equal((await get('bombs/'+id)).done,true);assert.equal((await get('classRooms/'+room)).activeBomb,null);
  await good(await incomeWrites(B,10),'bob');const repaid=await get('money/'+B);assert.equal(repaid.debt,9);assert.equal(repaid.coins,0);
});
test('入場後的新成員不受舊炸彈影響',async()=>{
  await reset();await seed('alice',A,{usedCounters:6,penalty:31,stock:{bully:0,counter:0,bomb:1}});await seed('bob',B,{earned:100});await seed('cara',C,{earned:200});const room=await enroll(A);await enroll(B,'herbal','bob');const id=await bomb(A,room);await enroll(C,'herbal','cara');assert.ok(!(await get('bombs/'+id)).members.includes(C));await good(await incomeWrites(C,10),'cara');
  const b=await get('money/'+A),forged=stamped(A,{...b,usedCounters:0},op());assert.equal((await commit([forged.write])).status,403);
});
test('收入紀錄不能倒退、債務不能自行刪除，已綁定帳號不能退回舊版覆寫錢包',async()=>{
  await reset();await seed('alice',A,{debt:20});await good(await incomeWrites(A,10));const a=await get('money/'+A);assert.equal(a.debt,10);
  let writes=await incomeWrites(A,10);writes[0].update.fields.cursors=enc({[C]:0});assert.equal((await commit(writes)).status,403);
  const p=await get('players/alice');delete p.economy;p.revision++;assert.equal((await commit([write('players/alice',p,['updatedAt'])])).status,403);
});

test('伺服器拒絕反霸凌不足六次與收益正好 70% 的炸彈請求',async()=>{await reset();await seed('alice',A,{usedCounters:5,penalty:31,stock:{bully:0,counter:0,bomb:1}});const room=await enroll(A);assert.equal((await commit(await bomb(A,room,'alice',true))).status,403);const a=await get('money/'+A);await commit([write('money/'+A,{...a,usedCounters:6,penalty:30},['updatedAt'])],null,true);assert.equal((await commit(await bomb(A,room,'alice',true))).status,403);assert.equal((await get('money/'+A)).stock.bomb,1);});
test('最多 64 台裝置的紀錄仍可結算；錯誤名稱與超額裝置被拒絕',async()=>{await reset();const cursors=Object.fromEntries(Array.from({length:63},(_,i)=>[(i+1000).toString(16).padStart(32,'0'),1]));cursors[C]=1;await seed('alice',A,{cursors});await good(await incomeWrites(A,10));let writes=await incomeWrites(A,10);writes[0].update.fields.name=enc('x'.repeat(33));assert.equal((await commit(writes)).status,403);writes=await incomeWrites(A,10);writes[0].update.fields.cursors.mapValue.fields[A]=enc(1);assert.equal((await commit(writes)).status,403);});
test('滿班 50 人逐一結算，全部完成才解除暫停，跨日保留欠款',async()=>{await reset();const keys=Array.from({length:50},(_,i)=>(i+800).toString(16).padStart(32,'0')),room=P.day()+'_battle_1';for(let i=0;i<50;i++)await seed('u'+i,keys[i],{coins:10,earned:100,rooms:{battle:room}});await seed('alice',A,{usedCounters:6,penalty:31,stock:{bully:0,counter:0,bomb:1},rooms:{battle:P.day()+'_battle_2'}});await commit([write('classRooms/'+room,{day:P.day(),building:'battle',number:1,members:keys,activeBomb:null,operationId:op()})],null,true);const id=await bomb(A,room);for(const k of keys)await good(await settleWrites(id,k));const b=await get('bombs/'+id);assert.equal(b.total,1000);assert.equal(b.settled,50);assert.equal(b.done,true);assert.equal((await get('money/'+A)).coins,6000);const victim=await get('money/'+keys[0]);assert.equal(victim.debt,10);await commit([write('money/'+keys[0],{...victim,day:P.day()-1},['updatedAt'])],null,true);await good(await incomeWrites(keys[0],6),'u0');assert.equal((await get('money/'+keys[0])).debt,4);});


test('同一收入游標不可換新操作ID重播；正收入必須推進至少一個來源序號',async()=>{
 await reset();await seed('alice',A);let before=await get('money/'+A),id=op();
 const empty=stamped(A,P.earn(P.roll(before),10).wallet,id);
 assert.equal((await commit([empty.write,receipt(id,{kind:'income',actor:A,amount:10,debit:0,devices:[],sequence:empty.next.revision})])).status,403);
 await good(await incomeWrites(A,10));before=await get('money/'+A);assert.equal(before.cursors[C],1);
 id=op();const same=stamped(A,P.earn(P.roll(before),10).wallet,id);
 assert.equal((await commit([same.write,receipt(id,{kind:'income',actor:A,amount:10,debit:0,devices:[C],sequence:same.next.revision})])).status,403);
 // A metadata-only synchronization has no new income or cursor and remains valid.
 id=op();const name=stamped(A,{...before,name:'Renamed'},id);
 await good([name.write,receipt(id,{kind:'income',actor:A,amount:0,debit:0,devices:[],sequence:name.next.revision})]);
 assert.equal((await get('money/'+A)).coins,5010);
});

test('多人加成在 N=3、6、9 增加；N=1、2、5 不提早進位且不回補舊券',async()=>{
  await reset();await seed('bob',B);
  const keys=Array.from({length:9},(_,i)=>(4000+i).toString(16).padStart(32,'0'));
  let penalty=0;
  for(let i=0;i<keys.length;i++){
    const count=i+1,bonus=Math.floor(count/3);
    await seed('crowd'+i,keys[i],{stock:{bully:3,counter:0,bomb:0}});
    const r=hitReceipt(await hit(keys[i],B,'crowd'+i));penalty+=1+bonus;
    assert.deepEqual([r.step,r.crowdCount,r.crowdBonus,r.crowdNew],[1,count,bonus,true]);
    assert.equal((await get('bullyCrowds/'+r.crowd)).count,count);
    assert.equal((await get('money/'+B)).penalty,penalty);
    for(let j=0;j<=i;j++)assert.equal((await get('money/'+keys[j])).bonus,2+Math.floor((j+1)/3));
  }
  assert.equal(penalty,21);
});

test('同一人只算一次，連用級數獨立；反霸凌不清當日人數或首次紀錄',async()=>{
  await reset();const D='d'.repeat(32);
  for(const [uid,key] of [['alice',A],['cara',C],['dan',D]])await seed(uid,key,{stock:{bully:3,counter:0,bomb:0}});
  await seed('bob',B,{stock:{bully:0,counter:1,bomb:0}});
  const first=hitReceipt(await hit(A,B));await hit(C,B,'cara');await hit(D,B,'dan');
  const second=hitReceipt(await hit(A,B));
  assert.deepEqual([second.step,second.crowdCount,second.crowdBonus,second.crowdNew],[2,3,1,false]);
  assert.equal((await get('money/'+A)).bonus,6);
  const b=await get('money/'+B),id=op(),n=stamped(B,P.counter(b),id);
  await good([n.write,receipt(id,{kind:'counter',actor:B,sequence:n.next.revision})],'bob');
  assert.equal((await get('bullyCrowds/'+first.crowd)).count,3);
  assert.equal((await get('bullyCrowdMembers/'+first.crowdMember)).operationId,first.id);
  const third=hitReceipt(await hit(A,B));
  assert.deepEqual([third.step,third.crowdCount,third.crowdBonus,third.crowdNew],[3,3,1,false]);
  assert.equal((await get('money/'+A)).bonus,11);
  assert.equal((await get('money/'+B)).penalty,4);
  assert.equal((await get('bullyPairs/'+third.pair)).used,3);
});

test('臺灣跨日與不同目標各自建立新計數，保留舊日紀錄且不承接舊連用級數',async()=>{
  await reset();const yesterday=P.day()-1,id=op(),crowd=yesterday+'_'+B,member=crowd+'_'+A,pair=yesterday+'_'+A+'_'+B;
  await seed('alice',A,{day:yesterday,bonus:20,lastTarget:B,streak:3,stock:{bully:3,counter:0,bomb:0}});
  await seed('bob',B,{day:yesterday,penalty:30});await seed('cara',C);
  const old={schema:1,day:yesterday,target:B,count:9,operationId:id};
  // Administrative seeding is only a local-emulator fixture, never a player request.
  assert.equal((await commit([write('bullyCrowds/'+crowd,old),write('bullyCrowdMembers/'+member,{schema:1,day:yesterday,target:B,actor:A,operationId:id}),write('bullyPairs/'+pair,{day:yesterday,actor:A,target:B,used:3,operationId:id})],null,true)).status,200);
  const now=hitReceipt(await hit(A,B));
  assert.deepEqual([now.crowdCount,now.crowdBonus,now.crowdNew,now.step],[1,0,true,1]);
  assert.equal((await get('money/'+A)).bonus,2);assert.equal((await get('money/'+B)).penalty,1);
  assert.deepEqual(await get('bullyCrowds/'+crowd),old);
  const other=hitReceipt(await hit(A,C));assert.equal(other.crowdCount,1);assert.equal(other.step,1);
  assert.notEqual(other.crowd,now.crowd);assert.equal((await get('bullyCrowds/'+now.crowd)).count,1);
});

test('即使同步偽造兩個錢包，也不能跳增人數或改寫 floor(N/3) 的加成',async()=>{
  await reset();const D='d'.repeat(32);await seed('bob',B);
  for(const [uid,key] of [['alice',A],['cara',C],['dan',D]])await seed(uid,key,{stock:{bully:3,counter:0,bomb:0}});
  await hit(A,B);await hit(C,B,'cara');const valid=await hitWrites(D,B),r=hitReceipt(valid);
  assert.deepEqual([r.crowdCount,r.crowdBonus],[3,1]);
  for(const count of [3,6]){
    const forged=cloneWrites(valid);
    changeWrite(forged,'bullyCrowds/'+r.crowd,d=>{d.count=count;});
    changeWrite(forged,'economyOps/'+r.id,d=>{d.crowdCount=count;d.crowdBonus=2;});
    changeWrite(forged,'money/'+D,d=>{d.bonus++;});changeWrite(forged,'money/'+B,d=>{d.penalty++;});
    await denied(forged,'dan');
  }
  assert.equal((await get('bullyCrowds/'+r.crowd)).count,2);
  assert.equal((await get('money/'+D)).stock.bully,3);assert.equal((await get('money/'+B)).penalty,2);
  await good(valid,'dan');
});

test('首次與重複施放由既有會員文件決定，不能自行宣告為新人或略過新人建檔',async()=>{
  await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B);await seed('cara',C,{stock:{bully:3,counter:0,bomb:0}});
  await hit(A,B);const repeat=await hitWrites(A,B),r=hitReceipt(repeat);
  changeWrite(repeat,'economyOps/'+r.id,d=>{d.crowdNew=true;d.crowdCount=2;});
  changeWrite(repeat,'bullyCrowds/'+r.crowd,d=>{d.count=2;});await denied(repeat);
  repeat.push(write('bullyCrowdMembers/'+r.crowdMember,{schema:1,day:P.day(),target:B,actor:A,operationId:r.id}));await denied(repeat);
  let fresh=await hitWrites(C,B);const f=hitReceipt(fresh);
  changeWrite(fresh,'economyOps/'+f.id,d=>{d.crowdNew=false;d.crowdCount=1;});
  changeWrite(fresh,'bullyCrowds/'+f.crowd,d=>{d.count=1;});
  fresh=fresh.filter(w=>w.update.name!==root+'/bullyCrowdMembers/'+f.crowdMember);await denied(fresh,'cara');
  assert.equal((await get('bullyCrowds/'+r.crowd)).count,1);
  assert.equal(await get('bullyCrowdMembers/'+f.crowdMember),null);
});

test('首次交易缺群組、會員、配額、任一錢包或收據均整筆拒絕，既有群組也不能漏新會員',async()=>{
  await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B);
  const beforeA=await get('money/'+A),beforeB=await get('money/'+B),valid=await hitWrites(A,B),r=hitReceipt(valid);
  assert.equal(valid.length,6);
  for(let i=0;i<valid.length;i++){
    await denied(valid.filter((_,j)=>j!==i));
    assert.deepEqual(await get('money/'+A),beforeA);assert.deepEqual(await get('money/'+B),beforeB);
    for(const path of ['bullyCrowds/'+r.crowd,'bullyCrowdMembers/'+r.crowdMember,'bullyPairs/'+r.pair,'economyOps/'+r.id])assert.equal(await get(path),null);
  }
  await good(valid);await seed('cara',C,{stock:{bully:3,counter:0,bomb:0}});
  const next=await hitWrites(C,B),n=hitReceipt(next);
  await denied(next.filter(w=>w.update.name!==root+'/bullyCrowdMembers/'+n.crowdMember),'cara');
  assert.equal((await get('bullyCrowds/'+r.crowd)).count,1);
});

test('每個文件綁定同一次操作，拒絕舊群組搭新收據與完整交易重播',async()=>{
  await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B);
  const valid=await hitWrites(A,B),r=hitReceipt(valid);
  for(const path of ['money/'+A,'money/'+B,'bullyPairs/'+r.pair,'bullyCrowds/'+r.crowd,'bullyCrowdMembers/'+r.crowdMember]){
    const forged=cloneWrites(valid);changeWrite(forged,path,d=>{d.operationId=op();});await denied(forged);
  }
  const renamed=cloneWrites(valid);writeAt(renamed,'economyOps/'+r.id).update.name=root+'/economyOps/'+op();await denied(renamed);
  await good(valid);const group=await get('bullyCrowds/'+r.crowd),member=await get('bullyCrowdMembers/'+r.crowdMember);
  await denied(valid);
  const next=await hitWrites(A,B);await denied(next.filter(w=>w.update.name!==root+'/bullyCrowds/'+r.crowd));
  assert.deepEqual(await get('bullyCrowds/'+r.crowd),group);assert.deepEqual(await get('bullyCrowdMembers/'+r.crowdMember),member);
});

test('不能替他人植入會員、改寫會員或塞入 Google UID 等額外欄位',async()=>{
  await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B);
  const valid=await hitWrites(A,B),r=hitReceipt(valid),path='bullyCrowdMembers/'+r.crowdMember;
  for(const change of [d=>{d.actor=C;},d=>{d.target=C;},d=>{d.day--;},d=>{d.schema=2;},d=>{d.uid='alice';},d=>{d.email='private@example.invalid';}]){
    const forged=cloneWrites(valid);changeWrite(forged,path,change);await denied(forged);
  }
  const moved=cloneWrites(valid);writeAt(moved,path).update.name=root+'/bullyCrowdMembers/'+r.crowd+'_'+C;await denied(moved);
  const extra=cloneWrites(valid);extra.push(write('bullyCrowdMembers/'+r.crowd+'_'+C,{schema:1,day:P.day(),target:B,actor:C,operationId:r.id}));await denied(extra);
  const leak=cloneWrites(valid);changeWrite(leak,'bullyCrowds/'+r.crowd,d=>{d.uid='alice';});await denied(leak);
  await denied(valid,'bob');await good(valid);
  const member=await get(path);await denied([write(path,{...member,operationId:op()})]);
  assert.deepEqual(await get(path),member);
});

test('參與紀錄僅提供已知匿名鍵查詢，禁止匿名讀取、清單與刪除，私人 UID 綁定仍不可讀',async()=>{
  await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B);
  const r=hitReceipt(await hit(A,B));
  const records=[['bullyCrowds',r.crowd,['count','day','operationId','schema','target']],['bullyCrowdMembers',r.crowdMember,['actor','day','operationId','schema','target']]];
  for(const [collection,key,keys] of records){
    const path=collection+'/'+key,data=await get(path,'bob');assert.deepEqual(Object.keys(data).sort(),keys);
    assert.equal((await req(url+'/'+path)).status,403);assert.equal((await req(url+'/'+collection,{uid:'bob'})).status,403);
    await denied([{delete:root+'/'+path}]);assert.deepEqual(await get(path),data);
  }
  for(const path of ['players/alice','economyAccounts/alice','economyKeys/'+A])assert.equal((await req(url+'/'+path,{uid:'bob'})).status,403);
});

test('反霸凌交易不能夾帶人數歸零、刪除群組或刪除首次參與紀錄',async()=>{
  await reset();await seed('alice',A,{stock:{bully:3,counter:0,bomb:0}});await seed('bob',B,{stock:{bully:0,counter:1,bomb:0}});
  const first=hitReceipt(await hit(A,B)),b=await get('money/'+B),id=op(),n=stamped(B,P.counter(b),id);
  const counter=[n.write,receipt(id,{kind:'counter',actor:B,sequence:n.next.revision})],group=await get('bullyCrowds/'+first.crowd);
  for(const illegal of [write('bullyCrowds/'+first.crowd,{...group,count:0,operationId:id}),{delete:root+'/bullyCrowds/'+first.crowd},{delete:root+'/bullyCrowdMembers/'+first.crowdMember}])await denied([...counter,illegal],'bob');
  assert.equal((await get('money/'+B)).penalty,1);await good(counter,'bob');
  assert.equal((await get('money/'+B)).penalty,0);assert.deepEqual(await get('bullyCrowds/'+first.crowd),group);
  assert.equal((await get('bullyCrowdMembers/'+first.crowdMember)).operationId,first.id);
});

test('多人加成保留 bonus 10000、penalty 10105 上限與最低 30% 收益',async()=>{
  for(const strong of [false,true]){
    await reset();const today=P.day(),D='d'.repeat(32),group=today+'_'+B,prior=op();
    await seed('alice',A,{bonus:9997,stock:{bully:3,counter:0,bomb:0}});
    await seed('bob',B,strong?{bonus:10000,penalty:10104,crown:{region:'north',tier:'diamond',week:today-7,start:today,until:today+21}}:{penalty:69});
    assert.equal((await commit([write('bullyCrowds/'+group,{schema:1,day:today,target:B,count:2,operationId:prior}),... [C,D].map(actor=>write('bullyCrowdMembers/'+group+'_'+actor,{schema:1,day:today,target:B,actor,operationId:prior}))],null,true)).status,200);
    const valid=await hitWrites(A,B),r=hitReceipt(valid),limit=strong?10105:70;
    const tooLow=cloneWrites(valid);changeWrite(tooLow,'money/'+B,d=>{d.penalty=limit+1;});await denied(tooLow);
    await seed('alice',A,{bonus:9998,stock:{bully:3,counter:0,bomb:0}});
    const tooHigh=cloneWrites(valid);changeWrite(tooHigh,'money/'+A,d=>{d.bonus=10001;});await denied(tooHigh);
    await seed('alice',A,{bonus:9997,stock:{bully:3,counter:0,bomb:0}});await good(valid);
    assert.equal((await get('money/'+A)).bonus,10000);assert.equal((await get('money/'+B)).penalty,limit);assert.equal(P.factor(await get('money/'+B)),30);
    // An existing participant's complete forged request cannot consume a coupon at the floor.
    await seed('cara',C,{stock:{bully:3,counter:0,bomb:0}});
    const a=await get('money/'+C),b=await get('money/'+B),id=op(),x=stamped(C,{...a,bonus:3,lastTarget:B,streak:1,stock:{...a.stock,bully:2}},id),y=stamped(B,b,id),pair=today+'_'+C+'_'+B;
    await denied([x.write,y.write,write('bullyPairs/'+pair,{day:today,actor:C,target:B,used:1,operationId:id}),write('bullyCrowds/'+group,{schema:1,day:today,target:B,count:3,operationId:id}),receipt(id,{kind:'bully',actor:C,target:B,pair,step:1,crowd:group,crowdMember:group+'_'+C,crowdCount:3,crowdBonus:1,crowdNew:false,sequence:x.next.revision})],'cara');
    assert.equal((await get('money/'+C)).stock.bully,3);assert.equal((await get('bullyCrowds/'+r.crowd)).count,3);
  }
});

test('含私有存檔投影及兩位已入班玩家的首次與重複交易均在規則存取預算內',async()=>{
  await reset();const room=P.day()+'_herbal_1';
  await seed('alice',A,{rooms:{herbal:room},stock:{bully:3,counter:0,bomb:0}});await seed('bob',B,{rooms:{herbal:room}});
  assert.equal((await commit([write('bombWatch/'+P.day(),{day:P.day(),active:{},operationId:op()})],null,true)).status,200);
  for(let i=0;i<2;i++){
    const writes=await hitWrites(A,B),r=hitReceipt(writes),player=await get('players/alice'),wallet=unfields(writeAt(writes,'money/'+A).update.fields);
    writes.push(write('players/alice',{...player,saveFormat:2,revision:player.revision+1,modifiedAt:Date.now(),coins:wallet.coins,economy:{key:A,revision:wallet.revision}},['updatedAt']));
    await good(writes);
    assert.equal((await get('players/alice')).economy.revision,wallet.revision);assert.equal(r.crowdNew,i===0);
  }
});
