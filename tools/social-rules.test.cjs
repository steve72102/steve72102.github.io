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
function stamped(k,w,id){const next={...w,revision:w.revision+1,operationId:id};return {next,write:write('money/'+k,next,['updatedAt'])};}
const receipt=(id,r)=>write('economyOps/'+id,{schema:1,day:P.day(),...r},['createdAt']);
async function seed(uid,k,overrides={}){const w={...P.freshWallet(5000,uid),revision:1,...overrides};const player={schema:1,revision:1,payload:'{}',coins:w.coins,modifiedAt:Date.now(),economy:{key:k,revision:1}};assert.equal((await commit([write('players/'+uid,player,['updatedAt']),write('economyAccounts/'+uid,{schema:1,key:k}),write('economyKeys/'+k,{uid}),write('money/'+k,w,['updatedAt'])],null,true)).status,200);return w;}
async function purchase(k,kind,uid='alice'){const id=op(),b=await get('money/'+k),n=stamped(k,P.purchase(b,kind),id);await good([n.write,receipt(id,{kind:'buy',actor:k,item:kind,sequence:n.next.revision})],uid);return n.next;}
async function incomeWrites(k,amount,{id=op(),debit=0}={}){const b=await get('money/'+k),n=P.earn(P.roll(b),amount).wallet;n.cursors={...n.cursors,[C]:(n.cursors[C]||0)+1};n.coins-=debit;const x=stamped(k,n,id);return [x.write,receipt(id,{kind:'income',actor:k,amount,debit,devices:[C],sequence:x.next.revision})];}
async function hit(actor,target,uid='alice'){
  const id=op(),a=await get('money/'+actor),b=await get('money/'+target),pair=P.day()+'_'+actor+'_'+target,previous=await get('bullyPairs/'+pair);
  const p=P.bully(P.roll(a),P.roll(b),{actorKey:actor,targetKey:target,used:previous?.used||0}),x=stamped(actor,p.actor,id),y=stamped(target,p.target,id);
  const writes=[x.write,y.write,write('bullyPairs/'+pair,{day:P.day(),actor,target,used:p.used,operationId:id}),receipt(id,{kind:'bully',actor,target,pair,step:p.step,sequence:x.next.revision})];await good(writes,uid);return writes;
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
