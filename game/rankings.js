(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./social-economy.js'):root.MindEconomy);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindRankings=api;})(typeof window==='object'?window:this,function(P){
  'use strict';
  const TIERS=Object.freeze({diamond:'鑽石',gold:'金',silver:'銀',bronze:'銅'}),BATCH=4;
  const week=(today=P.day())=>today-(today+3)%7;
  const validWeek=n=>P.integer(n,100000)&&(n+3)%7===0;
  const date=n=>new Date(n*86400000).toISOString().slice(0,10);
  const tier=n=>n>=3600?'diamond':n>=1800?'gold':n>=600?'silver':'bronze';
  function time(t){const n=typeof t==='number'?t:typeof t?.toMillis==='function'?t.toMillis():t?.seconds*1000+(t?.nanoseconds||0)/1000000;if(!Number.isFinite(n)||n<0)throw Error('週榜時間不正確。');return Math.floor(n);}
  function candidate(e){
    if(!e||!P.validKey(e.key)||!P.integer(e.slot,1000000)||e.slot<1||typeof e.name!=='string'||e.name.length>32||!P.integer(e.points,10850)||e.points<1)throw Error('週榜成績不正確。');
    return {key:e.key,name:e.name,slot:e.slot,points:e.points,achievedAt:time(e.achievedAt)};
  }
  function better(a,b){return !b||a.points>b.points||a.points===b.points&&(a.achievedAt<b.achievedAt||a.achievedAt===b.achievedAt&&a.slot<b.slot);}
  function leaders(entries,previous={diamond:null,gold:null,silver:null,bronze:null}){const result={...previous};for(const raw of entries){const e=candidate(raw),group=tier(e.points);if(better(e,result[group]))result[group]=e;}return result;}
  function finalize(previous,entries,count,season){
    if(!validWeek(season)||!P.integer(count,1000000))throw Error('週榜期間不正確。');
    const prior=previous||{schema:1,week:season,cursor:0,leaders:leaders([]),finished:false};
    if(prior.week!==season||prior.finished||!P.integer(prior.cursor,count)||entries.length!==Math.min(BATCH,count-prior.cursor)||entries.some((e,i)=>e.week!==season||e.slot!==prior.cursor+i+1))throw Error('週榜結算順序不正確。');
    const cursor=prior.cursor+entries.length;
    return {schema:1,week:season,cursor,leaders:leaders(entries,prior.leaders),finished:cursor===count};
  }
  return Object.freeze({TIERS,BATCH,week,validWeek,date,tier,time,candidate,better,leaders,finalize});
});
