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
async function good(writes,uid='alice',admin=false){const r=await commit(writes,uid,admin);assert.equal(r.status,200,JSON.stringify(r.body));return r;}
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

const R=require('../game/rankings.js');
test('地區週榜規則可編譯',async()=>{const r=await req(base+'/emulator/v1/projects/'+project+':securityRules',{method:'PUT',body:{rules:{files:[{name:'firestore.rules',content:fs.readFileSync('game/firestore.rules','utf8')}]}}});assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(!r.body.issues?.some(x=>x.severity==='ERROR'),JSON.stringify(r.body));});
test('四區售價固定 1000；稱號只能扣券啟用 14 天，收入依 115% 計算',async()=>{
 await reset();await seed('alice',A);
 for(const region of Object.keys(P.REGIONS))await purchase(A,region);
 let w=await get('money/'+A);assert.equal(w.coins,1000);assert.equal(w.stock.north,1);
 let id=op(),n=stamped(A,{...w,coins:100,stock:{...w.stock,north:2}},id);
 assert.equal((await commit([n.write,receipt(id,{kind:'buy',actor:A,item:'north',sequence:n.next.revision})])).status,403);
 id=op();n=stamped(A,P.useHonor(w,'north'),id);
 const bad=clone(n.next);bad.honor.until++;
 assert.equal((await commit([write('money/'+A,bad,['updatedAt']),receipt(id,{kind:'honor',actor:A,region:'north',sequence:n.next.revision})])).status,403);
 await good([n.write,receipt(id,{kind:'honor',actor:A,region:'north',sequence:n.next.revision})]);await good(await incomeWrites(A,100));w=await get('money/'+A);
 assert.equal(w.coins,1115);assert.equal(w.stock.north,0);
 id=op();n=stamped(A,{...w,honor:{...w.honor,until:w.honor.until+20}},id);
 assert.equal((await commit([n.write,receipt(id,{kind:'income',actor:A,amount:0,debit:0,devices:[],sequence:n.next.revision})])).status,403);
});
const clone=x=>JSON.parse(JSON.stringify(x));
async function enrollRank(key,points,uid='alice'){
 const season=R.week(),meta=await get('rankWeeks/'+season),slot=(meta?.count||0)+1,entry={schema:1,week:season,slot,key,name:uid,points};
 const writes=[write('rankWeeks/'+season,{schema:1,week:season,count:slot},['updatedAt']),write('rankEntries/'+season+'_'+key,{week:season,key,slot}),write('rankSlots/'+season+'_'+slot,entry,['achievedAt','updatedAt'])];return {writes,slot,season};
}
test('參賽按序編號，同帳號不能重複登記、改別人的分數或超過每日可得分數',async()=>{
 await reset();await seed('alice',A);await seed('bob',B);
 let r=await enrollRank(A,100);await good(r.writes);r=await enrollRank(B,200,'bob');await good(r.writes,'bob');
 assert.equal((await get('rankWeeks/'+r.season)).count,2);assert.equal((await get('rankEntries/'+r.season+'_'+A)).slot,1);
 r=await enrollRank(A,300);assert.equal((await commit(r.writes)).status,403);
 let e=await get('rankSlots/'+r.season+'_1');
 assert.equal((await commit([write('rankSlots/'+r.season+'_1',{...e,points:400},['achievedAt','updatedAt'])],'bob')).status,403);
 assert.equal((await commit([write('rankSlots/'+r.season+'_1',{...e,points:1550*(P.day()-r.season+1)+1},['achievedAt','updatedAt'])])).status,403);
 await good([write('rankSlots/'+r.season+'_1',{...e,points:450},['achievedAt','updatedAt'])]);
 e=await get('rankSlots/'+r.season+'_1');assert.equal((await commit([write('rankSlots/'+r.season+'_1',{...e,points:451,achievedAt:{timestampValue:'2000-01-01T00:00:00Z'}},['updatedAt'])])).status,403);
 assert.equal((await commit([write('rankSlots/'+r.season+'_1',{...e,points:400},['achievedAt','updatedAt'])])).status,403);
});
async function finalStep(season){
 const meta=await get('rankWeeks/'+season),before=await get('rankFinals/'+season),cursor=before?.cursor||0,rows=[];
 for(let i=cursor+1;i<=Math.min(cursor+4,meta.count);i++){const e=await get('rankSlots/'+season+'_'+i);rows.push({...e,achievedAt:Date.parse(e.achievedAt.timestampValue)});}
 const next=R.finalize(before,rows,meta.count,season);return {next,write:write('rankFinals/'+season,next,['updatedAt'])};
}
async function crownWrites(key,season,tier,region='north'){
 const w=await get('money/'+key),id=op(),n=stamped(key,P.crown(w,{week:season,tier,region}),id);
 return [n.write,receipt(id,{kind:'crown',actor:key,week:season,tier,region,sequence:n.next.revision}),write('rankClaims/'+season+'_'+key,{schema:1,week:season,key,tier,region,day:P.day(),operationId:id},['createdAt'])];
}
test('週末結算不可跳過任何人或提前領獎；四組冠軍正確且不能重複領取',async()=>{
 await reset();const season=R.week()-7,points=[500,800,2100,4000,4500,4500],keys=[];
 for(let i=0;i<6;i++){const key=(i+20).toString(16).padStart(32,'0');keys.push(key);await seed('player'+i,key);
  await good([write('rankSlots/'+season+'_'+(i+1),{schema:1,week:season,slot:i+1,key,name:'player'+i,points:points[i],achievedAt:{timestampValue:i===5?'2026-01-01T00:00:00Z':'2026-01-02T00:00:00Z'}},['updatedAt'])],null,true);
 }
 await good([write('rankWeeks/'+season,{schema:1,week:season,count:6},['updatedAt'])],null,true);
 let step=await finalStep(season),forged={...step.next,cursor:6,finished:true};
 assert.equal((await commit([write('rankFinals/'+season,forged,['updatedAt'])])).status,403);
 await good([step.write]);assert.equal((await commit(await crownWrites(keys[0],season,'bronze'),'player0')).status,403);
 step=await finalStep(season);await good([step.write]);const final=await get('rankFinals/'+season);
 assert.equal(final.finished,true);assert.equal(final.leaders.diamond.key,keys[5]);assert.equal(final.leaders.gold.key,keys[2]);assert.equal(final.leaders.silver.key,keys[1]);assert.equal(final.leaders.bronze.key,keys[0]);
 assert.equal((await commit(await crownWrites(keys[3],season,'diamond'),'player3')).status,403);
 for(const [i,tier]of [[0,'bronze'],[1,'silver'],[2,'gold'],[5,'diamond']]){
  await good(await crownWrites(keys[i],season,tier,'east'),'player'+i);
  assert.equal(P.factor(await get('money/'+keys[i])),100+P.CROWN_BONUS[tier]);
  assert.equal((await commit(await crownWrites(keys[i],season,tier,'north'),'player'+i)).status,403);
 }
 const old=await get('rankSlots/'+season+'_1');assert.equal((await commit([write('rankSlots/'+season+'_1',{...old,points:1000},['achievedAt','updatedAt'])],'player0')).status,403);
 assert.equal((await commit([step.write])).status,403);
});
test('冠軍與商城券不疊加，屆滿自動停止加成，不能用普通收入交易偽造稱號',async()=>{
 await reset();const day=P.day();let w=await seed('alice',A,{honor:{region:'north',start:day-1,until:day+13},crown:{region:'south',tier:'diamond',week:R.week()-7,start:day-1,until:day+20}});
 await good(await incomeWrites(A,100));assert.equal((await get('money/'+A)).coins,5135);
 w=await get('money/'+A);const id=op(),n=stamped(A,{...w,crown:{...w.crown,until:w.crown.until+100}},id);
 assert.equal((await commit([n.write,receipt(id,{kind:'income',actor:A,amount:0,debit:0,devices:[],sequence:n.next.revision})])).status,403);
 w.crown={...w.crown,start:day-21,until:day};w.honor={...w.honor,start:day-14,until:day};await good([write('money/'+A,w,['updatedAt'])],null,true);
 await good(await incomeWrites(A,100));assert.equal((await get('money/'+A)).coins,5235);
});
test('64 台裝置與跨日結算仍可套用冠軍加成並償還欠款',async()=>{
 await reset();const day=P.day(),cursors=Object.fromEntries(Array.from({length:63},(_,i)=>[(i+1).toString(16).padStart(32,'0'),1]));cursors[C]=1;
 await seed('alice',A,{day:day-1,debt:50,cursors,bonus:9,penalty:6,crown:{region:'east',tier:'diamond',week:R.week()-7,start:day-1,until:day+20}});
 await good(await incomeWrites(A,100));const w=await get('money/'+A);assert.equal(w.coins,5085);assert.equal(w.debt,0);assert.equal(w.bonus,0);assert.equal(w.penalty,0);
});
