(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindJourney=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const STAGES=[{name:'初芽夥伴',at:0,mark:'✧'},{name:'研修精靈',at:20,mark:'◇'},{name:'星耀賢者',at:60,mark:'✦'}];
  function nickname(value){
    if(typeof value!=='string')throw Error('請輸入暱稱。');
    const name=value.normalize('NFC').trim().replace(/\s+/g,' ');
    if(!/^[\p{L}\p{N} _-]{1,16}$/u.test(name))throw Error('暱稱請用 1–16 字的文字、數字、空格、底線或連字號。');
    return name;
  }
  function profile(raw){
    if(raw===undefined)return {version:1,name:'',enrolled:false};
    if(!raw||raw.version!==1||typeof raw.enrolled!=='boolean')throw Error('玩家資料格式不正確。');
    return {version:1,name:raw.enrolled?nickname(raw.name):'',enrolled:raw.enrolled};
  }
  function companion(raw,s){
    if(raw===undefined){
      const legacy=!!s.appearance.pet&&(s.totalCorrect>0||!!s.claimed||s.xp>0);
      if(!legacy)s.appearance.pet=null;
      return {version:1,unlocked:legacy,base:s.totalCorrect};
    }
    if(!raw||raw.version!==1||typeof raw.unlocked!=='boolean'||!Number.isSafeInteger(raw.base)||raw.base<0||raw.base>s.totalCorrect)throw Error('夥伴成長資料不正確。');
    if(!raw.unlocked)s.appearance.pet=null;
    return {version:1,unlocked:raw.unlocked,base:raw.base};
  }
  function ready(s){return s.mastered.length>=5&&!!s.claimed;}
  function unlock(s,id,ids){
    if(s.companion.unlocked||!ready(s)||!ids.includes(id))return false;
    s.companion={version:1,unlocked:true,base:s.totalCorrect};s.appearance.pet=id;return true;
  }
  function growth(s){
    const xp=s.companion?.unlocked?Math.max(0,s.totalCorrect-s.companion.base):0;
    const stage=xp>=60?2:xp>=20?1:0;
    return {xp,level:Math.floor(xp/10)+1,stage,...STAGES[stage],next:STAGES[stage+1]||null};
  }
  function hasProgress(s){return !!(s.profile?.enrolled||s.xp||s.claimed||s.totalCorrect||s.arena?.coins||s.session);}
  return {STAGES,nickname,profile,companion,ready,unlock,growth,hasProgress};
});
