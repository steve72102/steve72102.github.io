(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindWish=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const COST=1000,TICKETS=100000,MAX_COINS=100000000,MAX_POOL=1000000000000;
  const designs=[
    ['mint-coat','薄荷晨讀外套','coat',20,'mint','先列已知條件與單位，再選用公式。'],
    ['cedar-coat','杉影觀察長衫','coat',20,'leaf','把觀察到的事實與自己的推測分開記錄。'],
    ['sakura-coat','櫻光筆記披肩','coat',20,'rose','看到否定問句，先圈出「不是」或「錯誤」。'],
    ['river-coat','溪藍研習衣','coat',20,'sky','比較兩個數值前，先確認單位與測量條件相同。'],
    ['mint-hat','薄荷採集帽','hat',20,'mint','把陌生詞寫成一句能用自己的話解釋的意思。'],
    ['cedar-hat','杉芽翻頁帽','hat',20,'leaf','遇到連題，先補齊前一題的共同條件。'],
    ['sakura-hat','櫻瓣觀星帽','hat',20,'rose','答案選項與正確知識不同；否定題尤其要分清楚。'],
    ['river-hat','溪光實驗帽','hat',20,'sky','計算後用單位檢查結果，看看是否符合題目所問。'],
    ['prism-coat','稜光循證禮衣','coat',40,'violet','資料彼此矛盾時，先比較版本、族群與實驗條件。'],
    ['bloom-coat','木棉研究披風','coat',40,'rose','把易混淆概念做成對照表，每欄只比較一個條件。'],
    ['prism-hat','稜鏡推理冠','hat',40,'violet','把推導拆成小步驟；每一步都問自己為什麼。'],
    ['bloom-hat','木棉學者帽','hat',40,'rose','重讀後先闔上筆記回想，找出真正還不熟的部分。'],
    ['aurora-coat','極光求知長袍','coat',60,'sky','能說明其他選項為什麼不合題意，才算完成比較。'],
    ['aurora-hat','晨星探索冠','hat',60,'violet','記憶口訣是提示；定義、條件與例外仍要理解。'],
    ['zenith-coat','天穹循證禮袍','coat',80,'gold','保留疑問、回到證據，比勉強背下不確定的結論更有價值。']
  ];
  const GEAR=designs.map(([id,name,slot,level,color,text],i)=>({id:'wish-'+id,name,slot,level,color,text,source:'fountain',tier:level===20?1:level===40?2:3,price:null,sellValue:level===20?100:level===40?200:level===60?350:800,attack:(slot==='coat'?{20:5,40:10,60:16,80:24}:{20:3,40:6,60:10})[level],hp:(slot==='coat'?{20:20,40:36,60:54,80:80}:{20:10,40:18,60:28})[level],guard:level===80?7:Math.floor(level/20),weight:i<8?10000:i<12?4500:i<14?945:10,pattern:i%4}));
  const PRIZES=[...GEAR.map(g=>({id:g.id,name:g.name,weight:g.weight,gear:g})),{id:'coins',name:'金球回饋金幣',weight:100}];
  const operationId=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
  const integer=(n,max=MAX_POOL)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
  function pool(raw){if(raw===undefined||raw===null)return {schema:1,balance:0,seeded:0,contributed:0,paidOut:0,draws:0,lastOperation:null};if(raw.schema!==1||!['balance','contributed','paidOut','draws'].every(k=>integer(raw[k]))||!integer(raw.seeded??0)||raw.balance+raw.paidOut!==raw.contributed+(raw.seeded??0)||raw.draws*COST!==raw.contributed||raw.lastOperation!==null&&!operationId(raw.lastOperation))throw Error('許願池資料不正確，請稍後重新連線。');return {schema:1,balance:raw.balance,seeded:raw.seeded??0,contributed:raw.contributed,paidOut:raw.paidOut,draws:raw.draws,lastOperation:raw.lastOperation};}
  function fresh(){return {version:1,draws:0,spent:0,last:null};}
  function restore(raw){if(raw===undefined)return fresh();if(!raw||raw.version!==1||!integer(raw.draws)||!integer(raw.spent)||raw.spent!==raw.draws*COST)throw Error('許願紀錄不正確。');let last=null;if(raw.last!==null){const r=raw.last;if(!r||!operationId(r.operationId)||!PRIZES.some(p=>p.id===r.prizeId)||!integer(r.coins,MAX_COINS)||!integer(r.poolAfter)||!integer(r.at,Number.MAX_SAFE_INTEGER)||r.prizeId!=='coins'&&r.coins!==0)throw Error('許願獎勵紀錄不正確。');last={operationId:r.operationId,prizeId:r.prizeId,coins:r.coins,poolAfter:r.poolAfter,at:r.at};}return {version:1,draws:raw.draws,spent:raw.spent,last};}
  function prize(ticket){if(!Number.isInteger(ticket)||ticket<0||ticket>=TICKETS)throw Error('抽獎數值不正確。');let edge=0;return PRIZES.find(p=>ticket<(edge+=p.weight));}
  function randomTicket(crypto){if(!crypto?.getRandomValues)throw Error('此瀏覽器無法進行安全抽獎，請更新瀏覽器。');const limit=Math.floor(4294967296/TICKETS)*TICKETS,value=new Uint32Array(1);do{crypto.getRandomValues(value);}while(value[0]>=limit);return value[0]%TICKETS;}
  function newOperation(crypto){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');}
  function space(s){return Object.values(s.inventory||{}).reduce((a,b)=>a+b,0)+Object.values(s.rpg.items).reduce((a,b)=>a+b,0)<s.rpg.capacity;}
  function payout(balance){if(!integer(balance)||balance<COST)throw Error('獎池金額不正確。');return Math.max(COST,Math.floor(balance/100));}
  // Pure transaction planner. No live state is mutated before the cloud commit succeeds.
  function plan(save,rawPool,ticket,id,now=Date.now()){
    if(!operationId(id)||!integer(now,Number.MAX_SAFE_INTEGER))throw Error('許願編號不正確。');
    const p=pool(rawPool),s=JSON.parse(JSON.stringify(save)),w=restore(s.wishes),result=prize(ticket);
    if(!integer(s.arena?.coins,MAX_COINS)||s.arena.coins<COST)throw Error('金幣不足，許願需要 1,000 金幣。');
    if(!s.rpg||!space(s))throw Error('背包已滿，請先整理 1 格；金幣尚未扣除。');
    if(p.balance>MAX_POOL-COST||p.contributed>MAX_POOL-COST||w.spent>MAX_POOL-COST)throw Error('許願池已達目前上限，請聯絡維護者。');
    const afterDeposit=p.balance+COST,coins=result.id==='coins'?payout(afterDeposit):0,before=s.arena.coins;
    if(before-COST+coins>MAX_COINS)throw Error('錢袋無法容納這次獎金，請先使用部分金幣後再重試。');
    s.arena.coins=before-COST+coins;
    if(result.gear)s.rpg.items[result.id]=(s.rpg.items[result.id]||0)+1;
    p.balance=afterDeposit-coins;p.contributed+=COST;p.paidOut+=coins;p.draws++;p.lastOperation=id;
    const last={operationId:id,prizeId:result.id,coins,poolAfter:p.balance,at:now};
    s.wishes={version:1,draws:w.draws+1,spent:w.spent+COST,last};
    return {save:s,pool:p,receipt:{schema:1,...last,ticket,walletBefore:before,walletAfter:s.arena.coins,poolBefore:afterDeposit-COST,contributed:p.contributed,paidOut:p.paidOut,draws:p.draws}};
  }
  return {COST,TICKETS,MAX_COINS,MAX_POOL,GEAR,PRIZES,operationId,pool,fresh,restore,prize,randomTicket,newOperation,space,payout,plan};
});
