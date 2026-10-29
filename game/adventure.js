(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.MindEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindAdventure=api;})(typeof window==='object'?window:globalThis,function(E){
  'use strict';
  const MAX=100000000,SLOTS={coat:'披風',boots:'靴子',badge:'徽章'};
  const GEAR=[
    {id:'coat-dawn',name:'晨光短披風',slot:'coat',tier:0,price:80,attack:2,hp:8,guard:1,color:'mint',text:'輕裝出發，把未知留給今天。'},
    {id:'coat-herb',name:'藥圃旅行披風',slot:'coat',tier:1,price:240,attack:4,hp:18,guard:2,color:'leaf',text:'葉紋記下每一段觀察與驗證。'},
    {id:'coat-star',name:'星紋長披風',slot:'coat',tier:2,price:600,attack:7,hp:30,guard:3,color:'violet',text:'把零散的知識，織成一片星空。'},
    {id:'boots-dawn',name:'晨露輕靴',slot:'boots',tier:0,price:60,attack:1,hp:4,guard:0,color:'mint',text:'從第一步，到第一個懂了。'},
    {id:'boots-path',name:'尋跡旅行靴',slot:'boots',tier:1,price:180,attack:3,hp:8,guard:1,color:'leaf',text:'耐心循著證據，找到下一個線索。'},
    {id:'boots-star',name:'星路遠征靴',slot:'boots',tier:2,price:480,attack:6,hp:14,guard:2,color:'violet',text:'跨過迷霧，也記得回頭驗算。'},
    {id:'badge-seed',name:'萌芽研究章',slot:'badge',tier:0,price:100,attack:2,hp:5,guard:0,color:'mint',text:'每個好問題，都是一顆種子。'},
    {id:'badge-prism',name:'稜光分析章',slot:'badge',tier:1,price:260,attack:5,hp:10,guard:1,color:'leaf',text:'從不同角度，檢查同一份證據。'},
    {id:'badge-sage',name:'賢者知識章',slot:'badge',tier:3,price:900,attack:9,hp:20,guard:3,color:'gold',text:'真正的力量，是願意一直學習。'}
  ];
  const QUESTS=[
    {id:'arrival',chapter:'序章',name:'把學院走成自己的地圖',guide:'苔光教授',story:'新同學，先不用急著比誰答得快。沿著步道，看看三座學科樓各自在研究什麼。',goal:'走進藥劑樓、藥理樓與生藥樓',coins:50,item:'coat-dawn',route:'home'},
    {id:'first-light',chapter:'第一章',name:'讓第一盞知識燈亮起',guide:'星序博士',story:'一個答案不只是一個字母。讀完每日知識卡，再用自己的理解答對五道不同的題目。',goal:'領取每日補給，並累積答對 5 道不同題目',coins:80,item:'boots-dawn',route:'practice'},
    {id:'paper-guard',chapter:'第二章',name:'紙頁間的守門人',guide:'璃砂研究員',story:'散落的筆記捲成了紙頁小怪。穿上裝備，透過兩回合答題，把混亂的概念重新理順。',goal:'擊敗紙頁小怪 1 次',coins:100,item:'badge-seed',route:'arena'},
    {id:'prepared',chapter:'第三章',name:'為下一次遠行整裝',guide:'砥石技師',story:'好的裝備是幫手，理解才是方向。去整理背包，選兩件適合今天的衣著，再繼續出發。',goal:'同時穿戴 2 種衣著裝備',coins:100,item:'coat-herb',route:'bag'},
    {id:'runes',chapter:'第四章',name:'讀懂符文留下的理由',guide:'沐衡分析師',story:'長得相似的選項，往往只差一個條件。累積二十道理解，再向符文守衛說明你的答案。',goal:'累積答對 20 道不同題目，並擊敗符文守衛',coins:180,item:'boots-path',route:'arena'},
    {id:'clear-sky',chapter:'第五章',name:'把迷霧讀成晴天',guide:'杉庭院士',story:'不要把熟悉當成理解。帶著四十道不同題目的經驗，再去面對迷霧術士，完成第一段學院主線。',goal:'累積答對 40 道不同題目，並擊敗迷霧術士',coins:300,item:'coat-star',route:'arena'}
  ];
  const places=['pharmaceutics','pharmacology','herbal','battle','life'],enemies=['bronze','silver','gold','diamond'];
  const gear=id=>GEAR.find(g=>g.id===id)||null;
  function fresh(){return {version:1,capacity:50,items:{},pending:{},loadout:{coat:null,boots:null,badge:null},quest:0,visited:[],defeated:[],lootDays:{},socialId:null,friends:[]};}
  function loadout(raw){const out={coat:null,boots:null,badge:null};if(raw===undefined)return out;if(!raw||Array.isArray(raw)||typeof raw!=='object')throw Error('衣著資料不正確');for(const k of Object.keys(out)){const id=raw[k];if(id!==null&&(!gear(id)||gear(id).slot!==k))throw Error('衣著欄位不正確');out[k]=id;}return out;}
  function bonus(raw){return Object.values(loadout(raw)).map(gear).filter(Boolean).reduce((s,g)=>({attack:s.attack+g.attack,hp:s.hp+g.hp,guard:s.guard+g.guard}),{attack:0,hp:0,guard:0});}
  function count(s){return Object.values(s.inventory).reduce((n,v)=>n+v,0)+Object.values(s.rpg?.items||{}).reduce((n,v)=>n+v,0);}
  function room(s,n=1){return count(s)+n<=(s.rpg?.capacity||50);}
  function grant(s,id){if(!gear(id)||!room(s))return false;s.rpg.items[id]=(s.rpg.items[id]||0)+1;return true;}
  function buy(s,id){const g=gear(id);if(!g||s.arena.coins<g.price||!room(s))return false;grant(s,id);s.arena.coins-=g.price;return true;}
  function equip(s,id){const g=gear(id);if(!g||!s.rpg.items[id])return false;s.rpg.loadout[g.slot]=id;return true;}
  function unequip(s,slot){if(!Object.hasOwn(SLOTS,slot))return false;s.rpg.loadout[slot]=null;return true;}
  function sell(s,id){const g=gear(id)||E.ITEMS.find(i=>i.id===id),items=gear(id)?s.rpg.items:s.inventory;if(!g||!items[id])return false;if(items[id]===1&&(s.equipped===id||Object.values(s.rpg.loadout).includes(id)))return false;items[id]--;if(!items[id])delete items[id];s.arena.coins=Math.min(MAX,s.arena.coins+Math.max(5,Math.floor((g.price||[40,80,160,320][g.tier])/4)));return true;}
  function expandPrice(s){return 300+(s.rpg.capacity-50)*20;}
  function expand(s){const price=expandPrice(s);if(s.rpg.capacity>=100||s.arena.coins<price)return false;s.arena.coins-=price;s.rpg.capacity+=10;return true;}
  function visit(s,id){if(!places.includes(id)||s.rpg.visited.includes(id))return false;s.rpg.visited.push(id);return true;}
  function progress(s){const r=s.rpg,q=QUESTS[r.quest];if(!q)return {done:true,current:1,total:1};const data=[
    [r.visited.filter(x=>places.slice(0,3).includes(x)).length,3],
    [Math.min(5,s.mastered.length)+(s.claimed?1:0),6],
    [Number(r.defeated.includes('bronze')),1],
    [Math.min(2,Object.values(r.loadout).filter(Boolean).length),2],
    [Math.min(20,s.mastered.length)+Number(r.defeated.includes('silver')),21],
    [Math.min(40,s.mastered.length)+Number(r.defeated.includes('gold')),41]
  ][r.quest];return {current:data[0],total:data[1],done:data[0]>=data[1]};}
  function claimQuest(s){const q=QUESTS[s.rpg.quest];if(!q||!progress(s).done||!room(s))return null;grant(s,q.item);s.arena.coins=Math.min(MAX,s.arena.coins+q.coins);s.rpg.quest++;return q;}
  function recordBattle(s){const b=s.arena.battle,r=s.rpg;if(!r||!b||b.phase!=='done'||!b.result?.win)return null;let changed=false;if(!r.defeated.includes(b.enemyId)){r.defeated.push(b.enemyId);changed=true;}if(!b.result.eligible||b.day<=(r.lootDays[b.enemyId]||''))return changed?{recorded:true}:null;
    const pools={bronze:['coat-dawn','boots-dawn','badge-seed'],silver:['coat-herb','boots-path','badge-prism'],gold:['coat-star','boots-star','badge-prism'],diamond:['badge-sage','coat-star','boots-star']};
    const seed=Array.from(b.day+b.enemyId+b.subject).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7),pool=pools[b.enemyId],id=pool[seed%pool.length];r.lootDays[b.enemyId]=b.day;r.pending[id]=Math.min(MAX,(r.pending[id]||0)+1);return {id,recorded:true};
  }
  function collect(s,id){if(!s.rpg.pending[id]||!grant(s,id))return false;s.rpg.pending[id]--;if(!s.rpg.pending[id])delete s.rpg.pending[id];return true;}
  function restore(raw){if(raw===undefined)return fresh();const bad=()=>{throw Error('主線或背包存檔不正確');};if(!raw||raw.version!==1||!Number.isInteger(raw.capacity)||raw.capacity<50||raw.capacity>100||raw.capacity%10||!Number.isInteger(raw.quest)||raw.quest<0||raw.quest>QUESTS.length)bad();const r=fresh();r.capacity=raw.capacity;r.quest=raw.quest;r.loadout=loadout(raw.loadout);
    for(const key of ['items','pending']){const obj=raw[key];if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length>GEAR.length)bad();for(const [id,n] of Object.entries(obj)){if(!gear(id)||!Number.isInteger(n)||n<1||n>(key==='items'?100:MAX))bad();r[key][id]=n;}}
    if(Object.values(r.items).reduce((n,v)=>n+v,0)>100)bad();for(const id of Object.values(r.loadout))if(id&&!r.items[id])bad();
    for(const [key,allowed] of [['visited',places],['defeated',enemies]]){const a=raw[key];if(!Array.isArray(a)||a.length>allowed.length||new Set(a).size!==a.length||a.some(x=>!allowed.includes(x)))bad();r[key]=a.slice();}
    if(!raw.lootDays||typeof raw.lootDays!=='object'||Array.isArray(raw.lootDays)||Object.keys(raw.lootDays).length>4)bad();for(const [id,day] of Object.entries(raw.lootDays)){if(!enemies.includes(id)||typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)bad();r.lootDays[id]=day;}
    if(raw.socialId!==undefined&&raw.socialId!==null&&!/^[a-f0-9]{32}$/.test(raw.socialId))bad();r.socialId=raw.socialId||null;if(raw.friends!==undefined){if(!Array.isArray(raw.friends)||raw.friends.length>100)bad();for(const f of raw.friends){if(!f||!/^[a-f0-9]{32}$/.test(f.id)||typeof f.name!=='string'||!/^[\p{L}\p{N} _-]{1,16}$/u.test(f.name)||r.friends.some(x=>x.id===f.id))bad();r.friends.push({id:f.id,name:f.name});}}return r;
  }
  return {GEAR,SLOTS,QUESTS,fresh,gear,loadout,bonus,count,room,grant,buy,equip,unequip,sell,expand,expandPrice,visit,progress,claimQuest,recordBattle,collect,restore};
});
