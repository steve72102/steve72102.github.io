(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.MindEngine,typeof module==='object'&&module.exports?require('./combat.js'):root.MindCombat,typeof module==='object'&&module.exports?require('./academy.js'):root.MindAcademy);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MindDuel=api;
})(typeof window==='object'?window:globalThis,function(E,C,A){
  'use strict';
  const VERSION='mq-duel-2', BANK='notes-3221-r5';
  function profile(raw) {
    if(!raw||typeof raw!=='object'||typeof raw.name!=='string'||!Number.isInteger(raw.level)||raw.level<1||raw.level>1000001)throw Error('角色資料不正確');
    const name=raw.name.trim();
    if(!/^[\p{L}\p{N} _-]{1,16}$/u.test(name))throw Error('暱稱請使用 1–16 個文字、數字、空格或底線');
    if(raw.gearId!==null&&!E.ITEMS.some(i=>i.id===raw.gearId))throw Error('裝備資料不正確');
    return {name,level:raw.level,gearId:raw.gearId,appearance:A.restore(raw.appearance)};
  }
  function match(raw,questions,subject) {
    if(!raw||raw.version!==VERSION||raw.bank!==BANK||!E.SUBJECTS[raw.subject]||(subject&&subject!==raw.subject)||!Array.isArray(raw.ids)||raw.ids.length!==6||new Set(raw.ids).size!==6)throw Error('對戰版本或題目不一致，請雙方更新網頁');
    const byId=new Map(questions.map(q=>[q.id,q]));
    if(!raw.ids.every(id=>typeof id==='string'&&byId.get(id)?.subject===raw.subject&&!byId.get(id).needsReview))throw Error('對戰題目不正確或待複核，請雙方更新網頁');
    return {version:VERSION,bank:BANK,subject:raw.subject,ids:raw.ids.slice(),opponent:profile(raw.profile)};
  }
  function create(subject,questions,random) {
    if(!E.SUBJECTS[subject])throw Error('科目不正確');
    const ids=E.shuffle(questions.filter(q=>!q.needsReview&&q.subject===subject),random).slice(0,6).map(q=>q.id);
    if(ids.length!==6)throw Error('題目不足');
    return {version:VERSION,bank:BANK,subject,ids};
  }
  function fresh(config,mine,other) {
    return {subject:config.subject,ids:config.ids.slice(),players:[profile(mine),profile(other)],round:0,index:0,phase:'prep',ready:[false,false],commits:[null,null],reveals:[null,null],next:[false,false],answers:[[],[]],rounds:[[],[]],prepared:[false,false]};
  }
  function ready(s,side) {
    if(s.phase!=='prep'||s.ready[side])return false;
    s.ready[side]=true;
    if(s.ready.every(Boolean))s.phase='question';
    return true;
  }
  function commit(s,side,hash,index) {
    if(s.phase!=='question'||index!==s.index||s.commits[side]!==null||!/^([a-f0-9]{64})$/.test(hash))return false;
    s.commits[side]=hash;return true;
  }
  function reveal(s,side,choice,index) {
    // The transport verifies the SHA-256 commitment before calling this reducer.
    if(s.phase!=='question'||index!==s.index||!s.commits.every(Boolean)||s.reveals[side]!==null||!Number.isInteger(choice)||choice<0||choice>3)return false;
    s.reveals[side]=choice;return true;
  }
  function settleQuestion(s,q) {
    if(s.phase!=='question'||s.ids[s.index]!==q.id||s.reveals.some(x=>x===null))return false;
    for(let side=0;side<2;side++)s.answers[side].push({choice:s.reveals[side],correct:s.reveals[side]===q.answer});
    if(s.index%3===2)for(let side=0;side<2;side++){
      const count=s.answers[side].slice(s.round*3,s.round*3+3).filter(a=>a.correct).length;
      const p=s.players[side],hero=C.heroStats(p.level,p.gearId,s.subject);
      s.rounds[side].push(C.calculateRound(hero,{attack:0},count,s.round?s.rounds[side][0].correct:0));
    }
    s.phase='feedback';return true;
  }
  function next(s,side) {
    if(s.phase!=='feedback'||s.next[side])return false;
    s.next[side]=true;
    if(!s.next.every(Boolean))return true;
    if(s.index===5){s.phase='done';return true;}
    s.index++;s.commits=[null,null];s.reveals=[null,null];s.next=[false,false];
    if(s.index===3){s.round=1;s.ready=[false,false];s.phase='prep';}else s.phase='question';
    return true;
  }
  function totals(s){return s.rounds.map(rs=>rs.reduce((v,r)=>v+r.damage,0));}
  function winner(s){if(s.phase!=='done')return null;const [a,b]=totals(s);return a===b?'draw':a>b?0:1;}
  function packet(text) {
    if(typeof text!=='string'||text.length>4096)throw Error('連線資料過大或格式錯誤');
    const p=JSON.parse(text,(k,v)=>{if(['__proto__','prototype','constructor'].includes(k))throw Error('連線資料不合法');return v;});
    if(!p||Array.isArray(p)||typeof p!=='object'||p.v!==VERSION||!['hello','match','ack','ready','commit','reveal','next','ping','leave','busy'].includes(p.type))throw Error('連線協定不一致');
    return p;
  }
  function commitmentText(index,choice,nonce) {
    if(!Number.isInteger(index)||index<0||index>5||!Number.isInteger(choice)||choice<0||choice>3||typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce))throw Error('答案格式不正確');
    return VERSION+':'+index+':'+choice+':'+nonce;
  }
  return {VERSION,BANK,profile,match,create,fresh,ready,commit,reveal,settleQuestion,next,totals,winner,packet,commitmentText};
});
