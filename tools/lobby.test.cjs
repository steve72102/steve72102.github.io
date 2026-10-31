const test=require('node:test'),assert=require('node:assert/strict'),L=require('../game/lobby.js'),W=require('../game/campus-walk.js');
const p={id:'a'.repeat(32),name:'學院旅人',scene:'campus',...W.campus.spawn,direction:'down',moving:false};
test('regional and champion titles are bounded, expire, and never trust free-form remote text',()=>{
 const day=require('../game/social-economy.js').day(),h={kind:'honor',region:'north',start:day,until:day+14,title:'<script>'};
 assert.equal(L.honorTitle(h),'自以為北部最聰明');assert.equal(L.player({...p,honor:h}).honor.title,undefined);
 assert.equal(L.honor(h,day+14),null);assert.equal(L.honorTitle({...h,kind:'crown',tier:'diamond',until:day+21}),'北部最聰明');
 for(const change of [{region:'constructor'},{kind:'fake'},{until:day+90},{start:day+1}])assert.throws(()=>L.honor({...h,...change}));
});
test('lobby accepts all real walking scenes, known appearances and bounded positions only',()=>{assert.equal(L.player(p).name,p.name);for(const change of [{x:Infinity},{x:-1},{scene:'secret'},{direction:'diagonal'},{moving:'yes'},{name:'<script>'},{appearance:{version:1,character:'../x',pet:null}},{x:520,y:389}])assert.throws(()=>L.player({...p,...change}));for(const scene of L.scenes.filter(s=>s.startsWith('hall:')))assert.equal(L.pose({...p,...W.hall('').spawn,scene}).scene,scene);});
test('lobby packets are bounded, unique, prototype safe and exclude private account/save fields',()=>{const wrap=x=>JSON.stringify({v:L.VERSION,...x});for(const raw of ['x'.repeat(65537),'null','[]','{"v":"mq-lobby-1","type":"ping","__proto__":{}}',wrap({type:'giveCoins'}),wrap({type:'world',players:[p,p]}),wrap({type:'world',players:Array(61).fill(p)})])assert.throws(()=>L.packet(raw));const result=L.packet(wrap({type:'join',player:{...p,email:'secret',payload:'private',xp:1000}}));assert(!('email' in result.player));assert(!('payload' in result.player));assert(!('xp' in result.player));assert.equal(L.packet(wrap({type:'world',players:[p]})).players.length,1);});
