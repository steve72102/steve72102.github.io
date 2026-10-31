(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindEconomy=api;})(typeof window==='object'?window:this,function(){
  'use strict';
  const VERSION=1,MAX_COINS=100000000,MAX_DEBT=1000000000000,MAX_PENDING=2000;
  const REGIONS=Object.freeze(Object.assign(Object.create(null),{north:'北部',central:'中部',south:'南部',east:'東部'}));
  const CROWN_BONUS=Object.freeze(Object.assign(Object.create(null),{diamond:35,gold:30,silver:25,bronze:20}));
  const PRICES=Object.freeze(Object.assign(Object.create(null),{bully:180,counter:60,bomb:600,north:1000,central:1000,south:1000,east:1000}));
  const BUILDINGS=Object.freeze({pharmaceutics:'藥劑樓',pharmacology:'藥理樓',herbal:'生藥樓',battle:'對戰樓'});
  const copy=x=>JSON.parse(JSON.stringify(x));
  const day=(at=Date.now())=>Math.floor((at+28800000)/86400000);
  const validKey=x=>typeof x==='string'&&/^[a-f0-9]{20,64}$/.test(x);
  const integer=(x,max=MAX_COINS)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
  function id(){const b=new Uint8Array(16);if(typeof crypto==='undefined'||!crypto.getRandomValues)throw Error('瀏覽器不支援安全識別碼。');crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
  function freshWallet(coins=0,name='',today=day()){return {schema:1,revision:0,day:today,coins,debt:0,earned:0,carry:0,bonus:0,penalty:0,stock:{bully:0,counter:0,bomb:0},usedCounters:0,lastTarget:'',streak:0,bubbleAt:0,rooms:{},cursors:{},name,operationId:null};}
  function validate(w){
    if(!w||w.schema!==1||!integer(w.revision,Number.MAX_SAFE_INTEGER)||!integer(w.day,100000)||!integer(w.coins)||!integer(w.debt,MAX_DEBT)||!integer(w.earned)||!integer(w.carry,99)||!integer(w.bonus,10000)||!integer(w.penalty,10105)||!integer(w.usedCounters,10000)||!integer(w.streak,3)||!integer(w.bubbleAt,Number.MAX_SAFE_INTEGER)||typeof w.name!=='string'||w.name.length>32||!w.stock||!['bully','counter','bomb'].every(k=>integer(w.stock[k],9999))||!Object.keys(REGIONS).every(k=>integer(w.stock[k]??0,9999))||Object.keys(w.stock).some(k=>!PRICES[k])||!w.rooms||Object.keys(w.rooms).some(k=>!BUILDINGS[k]||typeof w.rooms[k]!=='string')||!w.cursors||Object.keys(w.cursors).length>64||Object.entries(w.cursors).some(([k,v])=>!/^[a-f0-9]{32}$/.test(k)||!integer(v,Number.MAX_SAFE_INTEGER))||(w.lastTarget!==''&&!validKey(w.lastTarget)))throw Error('金幣帳本格式不正確。');
    for(const [key,duration] of [['honor',14],['crown',21]]){const h=w[key];if(h!=null&&(!REGIONS[h.region]||!integer(h.start,100000)||h.until!==h.start+duration||key==='crown'&&(!CROWN_BONUS[h.tier]||!integer(h.week,100000))))throw Error('稱號紀錄不正確。');}
    return copy(w);
  }
  function roll(w,today=day()){w=validate(w);if(w.day>today)throw Error('帳本日期晚於目前日期，請檢查裝置時間。');if(w.day!==today)Object.assign(w,{day:today,earned:0,carry:0,bonus:0,penalty:0,usedCounters:0,lastTarget:'',streak:0,bubbleAt:0,rooms:{}});return w;}
  function activeHonor(w,today=w?.day??day()){
    const active=h=>h&&today>=h.start&&today<h.until;
    if(active(w?.crown))return {...w.crown,bonus:CROWN_BONUS[w.crown.tier],title:REGIONS[w.crown.region]+'最聰明',kind:'crown'};
    if(active(w?.honor))return {...w.honor,bonus:15,title:'自以為'+REGIONS[w.honor.region]+'最強',kind:'honor'};
    return null;
  }
  const honorBonus=(w,today=w.day)=>activeHonor(w,today)?.bonus||0;
  const factor=w=>Math.max(30,100+w.bonus+honorBonus(w)-w.penalty);
  function useHonor(w,region,today=day()){
    if(!REGIONS[region]||!(w.stock[region]>0))throw Error('你沒有這張地區券。');
    if(activeHonor(w,today)?.kind==='crown')throw Error('冠軍稱號仍在生效，地區券先保留，避免浪費。');
    w=copy(w);w.stock[region]--;w.honor={region,start:today,until:today+14};return w;
  }
  function crown(w,{region,tier,week},today=day()){
    if(!REGIONS[region]||!CROWN_BONUS[tier]||!integer(week,100000)||week+7>today)throw Error('冠軍獎勵資料不正確。');
    if(honorBonus(w,today)>CROWN_BONUS[tier])throw Error('較高加成的冠軍稱號仍在生效；這份獎勵可保留，稍後再領。');
    w=copy(w);w.crown={region,tier,week,start:today,until:today+21};return w;
  }
  function earn(w,base){
    if(!integer(base))throw Error('收入金額不正確。');w=copy(w);
    const units=base*factor(w)+w.carry,gross=Math.floor(units/100),paid=Math.min(w.debt,gross),cash=gross-paid;
    if(w.coins+cash>MAX_COINS||w.earned+gross>MAX_COINS)throw Error('今日金幣已達上限。');
    Object.assign(w,{coins:w.coins+cash,debt:w.debt-paid,earned:w.earned+gross,carry:units%100});return {wallet:w,gross,paid,cash};
  }
  function purchase(w,kind){const price=PRICES[kind];if(!price)throw Error('找不到這張券。');if(w.coins<price)throw Error('金幣不足。');if(w.stock[kind]>=9999)throw Error('這種券已達持有上限。');w=copy(w);w.coins-=price;w.stock[kind]=(w.stock[kind]||0)+1;return w;}
  function bully(actor,target,{actorKey,targetKey,used=0}={}){
    if(!validKey(actorKey)||!validKey(targetKey)||actorKey===targetKey)throw Error('請選擇其他玩家。');
    if(actor.stock.bully<1)throw Error('你沒有霸凌券。');if(!integer(used,3)||used>=3)throw Error('今天對這位玩家已使用三次。');
    if(factor(target)<=30)throw Error('對方已達減益上限，這張券不會消耗。');
    actor=copy(actor);target=copy(target);const step=actor.lastTarget===targetKey?Math.min(3,actor.streak+1):1;
    if(actor.bonus+step+1>10000)throw Error('今日加成已達上限。');
    actor.stock.bully--;actor.lastTarget=targetKey;actor.streak=step;actor.bonus+=step+1;target.penalty=Math.min(target.bonus+honorBonus(target)+70,target.penalty+step);
    return {actor,target,used:used+1,step};
  }
  function counter(w,at=Date.now()){if(w.stock.counter<1)throw Error('你沒有反霸凌券。');if(w.usedCounters>=10000)throw Error('今日使用次數已達上限。');w=copy(w);w.stock.counter--;w.penalty=0;w.usedCounters++;w.bubbleAt=at;return w;}
  function eligible(w){return w.usedCounters>=6&&factor(w)<70;}
  function activateBomb(w){if(w.stock.bomb<1)throw Error('你沒有炸彈券。');if(!eligible(w))throw Error('須當天已使用至少六張反霸凌券，且目前收益倍率低於 70%。');w=copy(w);w.stock.bomb--;return w;}
  function settleBomb(actor,target,samePerson=false){
    actor=copy(actor);target=copy(target);const amount=samePerson?0:Math.floor(target.earned/5),cash=Math.min(target.coins,amount),debt=amount-cash;
    if(actor.coins+amount>MAX_COINS||target.debt+debt>MAX_DEBT)throw Error('金幣帳本已達上限，結算暫停。');
    actor.coins+=amount;target.coins-=cash;target.debt+=debt;return {actor,target,amount,cash,debt};
  }
  function enrollment(count){if(!integer(count,500000))throw Error('班級人數不正確。');return {number:Math.floor(count/50)+1,seat:count%50+1};}
  function localFresh(){return {version:VERSION,key:'',wallet:null,pending:[]};}
  function localRestore(raw){
    if(raw===undefined)return localFresh();if(!raw||raw.version!==VERSION||(raw.key!==''&&!validKey(raw.key))||!Array.isArray(raw.pending)||raw.pending.length>MAX_PENDING)throw Error('多人金幣紀錄不正確。');
    const pending=raw.pending.map(e=>{if(!e||!/^[a-f0-9]{32}$/.test(e.device)||!integer(e.sequence,Number.MAX_SAFE_INTEGER)||e.sequence<1||!integer(e.amount)||e.amount<1)throw Error('待入帳收入不正確。');return {device:e.device,sequence:e.sequence,amount:e.amount};});
    return {version:VERSION,key:raw.key,wallet:raw.wallet?validate(raw.wallet):null,pending};
  }
  function append(a,amount){
    const e=a.economy;if(!e?.key||!amount)return;if(e.pending.length>=MAX_PENDING)throw Error('離線收入已滿，請連線同步後繼續領取。');
    const storageKey='mind-quest-income-source:'+e.key;let source;
    try{source=JSON.parse(localStorage.getItem(storageKey)||'null');}catch(_){source=null;}
    if(!source||!/^[a-f0-9]{32}$/.test(source.device)||!integer(source.sequence,Number.MAX_SAFE_INTEGER))source={device:id(),sequence:0};
    source.sequence++;localStorage.setItem(storageKey,JSON.stringify(source));e.pending.push({...source,amount});
  }
  // These are knowledge/gameplay earnings. Transfers and fountain prizes do not
  // count as daily earnings and do not recursively trigger income bonuses.
  function award(a,base,today=day()){
    if(!a.economy?.key){const cash=Math.min(base,MAX_COINS-a.coins);a.coins+=cash;return {gross:cash,paid:0,cash};}
    const current=roll(a.economy.wallet,today);current.coins=a.coins;const result=earn(current,base);append(a,base);a.economy.wallet=result.wallet;a.coins=result.wallet.coins;return {gross:result.gross,paid:result.paid,cash:result.cash};
  }
  function replay(w,events){w=copy(w);let amount=0;const cursors={...w.cursors};for(const e of events){if(e.sequence<=(cursors[e.device]||0))continue;amount+=e.amount;cursors[e.device]=e.sequence;}if(Object.keys(cursors).length>64)throw Error('登入裝置紀錄已滿，請聯絡維護者。');const result=earn(w,amount);result.wallet.cursors=cursors;return {...result,amount};}
  function project(save,key,w,pending=[]){const next=copy(save),result=replay(w,pending);next.arena.coins=result.wallet.coins;next.arena.economy={version:VERSION,key,wallet:result.wallet,pending:copy(pending)};next.rpg.socialId=key;return next;}
  return Object.freeze({VERSION,MAX_COINS,MAX_DEBT,MAX_PENDING,PRICES,REGIONS,CROWN_BONUS,BUILDINGS,copy,day,id,validKey,integer,freshWallet,validate,roll,activeHonor,honorBonus,useHonor,crown,factor,earn,purchase,bully,counter,eligible,activateBomb,settleBomb,enrollment,localFresh,localRestore,award,replay,project});
});
