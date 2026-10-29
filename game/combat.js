(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.MindEngine,typeof module === 'object' && module.exports ? require('./adventure.js') : root.MindAdventure);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MindCombat = api;
})(typeof window === 'object' ? window : globalThis, function(E,R) {
  'use strict';
  const MAX = 100000000;
  const ENEMIES = [
    { id:'bronze', name:'紙頁小怪', title:'銅之試煉', level:3, hp:160, attack:18, points:80, coins:15, icon:'◒', flavor:'散落的筆記，聚成了第一位守門人。' },
    { id:'silver', name:'符文守衛', title:'銀之試煉', level:10, hp:280, attack:30, points:150, coins:25, icon:'◈', flavor:'只有讀懂符文，才能穿過這道防線。' },
    { id:'gold', name:'迷霧術士', title:'金之試煉', level:20, hp:420, attack:46, points:220, coins:40, icon:'✧', flavor:'把似是而非的答案，化成看得清的光。' },
    { id:'diamond', name:'鑽晶巨龍', title:'鑽石試煉', level:35, hp:520, attack:64, points:300, coins:60, icon:'✦', flavor:'六道知識之光，也能擊碎巨龍的鱗甲。' }
  ];
  const RANKS = [
    {id:'bronze',name:'銅',min:0,bonus:60}, {id:'silver',name:'銀',min:600,bonus:120},
    {id:'gold',name:'金',min:1800,bonus:240}, {id:'diamond',name:'鑽石',min:3600,bonus:400}
  ];
  const GOODS = [
    {id:'supply-1',name:'臨時補給券',count:1,price:40,kind:'supplies',tag:'一回合的準備'},
    {id:'supply-3',name:'補給小行囊',count:3,price:100,kind:'supplies',tag:'三次預讀機會'},
    {id:'supply-10',name:'遠征補給箱',count:10,price:300,kind:'supplies',tag:'為一週的冒險準備'},
    {id:'wish-1',name:'星願券',count:1,price:120,kind:'tickets',tag:'用學習所得，換一份驚喜'}
  ];
  const GEAR_ATTACK = [0,8,18,32], GEAR_HP = [0,10,25,45], GEAR_GUARD = [0,2,4,7];
  function weekId(day = E.today()) {
    const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0,10);
  }
  function addDays(day, count) { const d = new Date(day+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+count); return d.toISOString().slice(0,10); }
  function fresh(day = E.today()) { return {version:1,coins:0,supplies:0,login:'',week:{id:weekId(day),records:{}},history:[],battle:null}; }
  function score(a) { return Object.values(a.week.records).reduce((n,r)=>n+r.points,0); }
  function rank(points) { return RANKS.slice().reverse().find(r=>points>=r.min) || RANKS[0]; }
  function rollWeek(a, day = E.today()) {
    const current = weekId(day);
    if (a.week.id === current) return false;
    // Moving the device clock backwards must not award a season twice.
    if (current < a.week.id) return false;
    const points = score(a), r = rank(points), bonus = points ? r.bonus : 0;
    if (points) a.history = [{week:a.week.id,points,rank:r.id,bonus},...a.history].slice(0,8);
    a.coins = Math.min(MAX,a.coins+bonus); a.week = {id:current,records:{}};
    return true;
  }
  function claimCoins(a, day = E.today()) { rollWeek(a,day); if(a.login===day) return 0; a.login=day; a.coins=Math.min(MAX,a.coins+80); return 80; }
  function buy(s, id) {
    const item=GOODS.find(i=>i.id===id), a=s.arena;
    if(!item || !a || a.coins<item.price) return false;
    const target=item.kind==='tickets'?s:a;
    if(target[item.kind]+item.count>MAX) return false;
    a.coins-=item.price; target[item.kind]+=item.count; return true;
  }
  function heroStats(level, gearId, subject, outfit) {
    const gear=E.ITEMS.find(i=>i.id===gearId), tier=gear?.tier ?? 0, capped=Math.min(20,level);
    const loadout=R.loadout(outfit),extra=R.bonus(loadout);
    return {level,gearId:gear?.id || null,tier,loadout,hp:90+capped*5+(gear?GEAR_HP[tier]:0)+extra.hp,attack:18+capped*2+(gear?GEAR_ATTACK[tier]:0)+(gear&&gear.subject===subject?6:0)+extra.attack,guard:(gear?GEAR_GUARD[tier]:0)+extra.guard};
  }
  function stats(s, subject) { return heroStats(Math.floor(s.xp/100)+1,s.equipped,subject,s.rpg?.loadout); }
  function begin(s, enemyId, subject, questions, random = Math.random, day = E.today()) {
    const a=s.arena, enemy=ENEMIES.find(e=>e.id===enemyId), pool=questions.filter(q=>!q.needsReview&&q.subject===subject);
    if(!enemy || !E.SUBJECTS[subject] || pool.length<6 || a.battle&&a.battle.phase!=='done') return false;
    rollWeek(a,day);
    a.battle={enemyId,subject,day,week:weekId(day),ids:E.shuffle(pool,random).slice(0,6).map(q=>q.id),hero:stats(s,subject),round:0,cursor:0,phase:'prep',prepared:[false,false],answers:[],rounds:[],result:null};
    return true;
  }
  function useSupply(a) {
    const b=a.battle;
    if(!b || b.phase!=='prep') return false;
    if(b.prepared[b.round]) return true;
    if(a.supplies<1) return false;
    a.supplies--; b.prepared[b.round]=true; return true;
  }
  function startRound(a) { if(!a.battle || a.battle.phase!=='prep')return false; a.battle.phase='question';return true; }
  function answer(s,q,choice,day=E.today()) {
    const b=s.arena.battle, offset=b?b.round*3+b.cursor:-1;
    if(!b || b.phase!=='question' || b.ids[offset]!==q.id || b.answers.length!==offset || !Number.isInteger(choice) || choice<0 || choice>3)return null;
    const correct=choice===q.answer, reward=E.reward(s,q,correct,day);
    const result={choice,correct,...reward};b.answers.push(result);return result;
  }
  function calculateRound(hero, enemy, correct, previousCorrect = 0) {
    const basic=hero.attack*correct, knowledge=22*correct*correct, perfect=correct===3?30:0, chain=correct>0?previousCorrect*6:0;
    return {correct,basic,knowledge,perfect,chain,damage:basic+knowledge+perfect+chain,retaliation:Math.max(0,enemy.attack-correct*12-hero.guard)};
  }
  function totals(b) {
    const enemy=ENEMIES.find(e=>e.id===b.enemyId);
    const damage=b.rounds.reduce((n,r)=>n+r.damage,0), hp=Math.max(0,b.hero.hp-b.rounds.reduce((n,r)=>n+r.retaliation,0));
    return {damage,hp,win:damage>=enemy.hp&&hp>0,correct:b.answers.filter(a=>a.correct).length};
  }
  function performance(enemy,correct,win) { return {points:correct*20+(win?enemy.points:0)+(win&&correct===6?80:0),coins:correct*3+(win?enemy.coins:0)}; }
  function settle(s,day) {
    const a=s.arena,b=a.battle,enemy=ENEMIES.find(e=>e.id===b.enemyId),total=totals(b);
    rollWeek(a,day);
    const value=performance(enemy,total.correct,total.win),eligible=b.week===a.week.id;
    const key=b.day+':'+b.enemyId,prev=a.week.records[key]||{points:0,coins:0};
    const earnedPoints=eligible?Math.max(0,value.points-prev.points):0, earnedCoins=eligible?Math.max(0,value.coins-prev.coins):0;
    if(eligible && value.points>prev.points) a.week.records[key]={...value,correct:total.correct,win:total.win};
    a.coins=Math.min(MAX,a.coins+earnedCoins);
    b.result={...total,...value,earnedPoints,earnedCoins,eligible};
  }
  function next(s,day=E.today()) {
    const a=s.arena,b=a.battle;
    if(!b || b.phase!=='question' || b.answers.length!==b.round*3+b.cursor+1)return false;
    if(b.cursor<2) {b.cursor++;return true;}
    const enemy=ENEMIES.find(e=>e.id===b.enemyId),correct=b.answers.slice(b.round*3,b.round*3+3).filter(x=>x.correct).length;
    b.rounds.push(calculateRound(b.hero,enemy,correct,b.round?b.rounds[0].correct:0));
    if(b.round===0)b.phase='recap';else {b.phase='done';settle(s,day);}
    return true;
  }
  function advance(a) {const b=a.battle;if(!b||b.phase!=='recap'||b.round!==0)return false;b.round=1;b.cursor=0;b.phase='prep';return true;}
  function studyCard(q) {
    const option = letter => '「' + q.options[letter.charCodeAt(0)-65] + '」';
    // Expand explicit answer references only. AUC, BCS, vitamin D, D2 and
    // concentration symbols are subject knowledge, not option labels.
    function explain(text) {
      return String(text || '')
        .replace(/(答案(?:是|為)?|正解(?:是|為)?|(?:本題)?(?:應選|選擇|選)|本題|因此|所以|故)\s*[（(]?([ABCD])[）)]?(?![A-Za-z0-9])/g, (_,prefix,letter) => prefix + option(letter))
        .replace(/選項\s*[（(]?([ABCD])[）)]?(?![A-Za-z0-9])/g, (_,letter) => '選項' + option(letter))
        .replace(/(^|[，。；;：:\n])\s*([ABCD])(?=(?:為|是)(?:正確|錯誤|答案|主要理由|關鍵|本題)|正確|錯誤|錯|對|把|將|寫|敘述)/g, (_,prefix,letter) => prefix + option(letter))
        .replace(/→\s*([ABCD])(?=\s*(?:[，。；;、）)]|$|錯|對))/g, (_,letter) => '→' + option(letter));
    }
    const letter=String.fromCharCode(65+q.answer),answer=q.options[q.answer];
    let memory=String(q.memory || '');
    if(answer.length>1 && memory.startsWith(letter+answer)) memory=memory.slice(1);
    else if(!/^[ABCD](?:型|類|群|細胞|受體|蛋白|鏈|端|肽|環|位|核|肝炎)/.test(memory)) memory=memory.replace(new RegExp('^'+letter+'(?:\\s+|(?=[\\u4e00-\\u9fff]))'),'');
    return {title:q.title,question:q.question,answer,explanation:explain(q.explanation),memory:explain(memory),options:q.options.slice()};
  }
  function restore(raw,questions) {
    if(raw===undefined)return fresh();
    const invalid=()=>{throw new Error('戰鬥或商城存檔不正確。');};
    const num=(v,max=MAX)=>{if(!Number.isInteger(v)||v<0||v>max)invalid();return v;};
    const bool=v=>{if(typeof v!=='boolean')invalid();return v;};
    const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)invalid();return v;};
    if(!raw||typeof raw!=='object'||raw.version!==1||!raw.week||!raw.week.records||Array.isArray(raw.week.records)||typeof raw.week.records!=='object')invalid();
    const week=date(raw.week.id);if(weekId(week)!==week)invalid();
    const a={version:1,coins:num(raw.coins),supplies:num(raw.supplies),login:raw.login===''?'':date(raw.login),week:{id:week,records:{}},history:[],battle:null};
    if(Object.keys(raw.week.records).length>28)invalid();
    for(const [key,r] of Object.entries(raw.week.records)) {
      const [day,id]=key.split(':'),enemy=ENEMIES.find(e=>e.id===id);
      if(!enemy||weekId(date(day))!==week||key!==day+':'+id||!r)invalid();
      const correct=num(r.correct,6),win=bool(r.win),value=performance(enemy,correct,win);
      if(r.points!==value.points||r.coins!==value.coins)invalid();
      a.week.records[key]={...value,correct,win};
    }
    if(!Array.isArray(raw.history)||raw.history.length>8)invalid();
    const seen=new Set();
    a.history=raw.history.map(h=>{if(!h)invalid();const w=date(h.week),points=num(h.points,15000),r=rank(points);if(weekId(w)!==w||w>=week||seen.has(w)||h.rank!==r.id||h.bonus!==r.bonus||!points)invalid();seen.add(w);return {week:w,points,rank:r.id,bonus:r.bonus};});
    if(raw.battle!==null) {
      const b=raw.battle,byId=new Map(questions.map(q=>[q.id,q]));
      if(!b||!ENEMIES.some(e=>e.id===b.enemyId)||!E.SUBJECTS[b.subject]||!Array.isArray(b.ids)||b.ids.length!==6||new Set(b.ids).size!==6||b.ids.some(id=>!byId.has(id)||byId.get(id).subject!==b.subject))invalid();
      const day=date(b.day);if(b.week!==weekId(day))invalid();
      if(!b.hero||num(b.hero.level,1000001)<1||b.hero.gearId!==null&&!E.ITEMS.some(i=>i.id===b.hero.gearId))invalid();
      const hero=heroStats(b.hero.level,b.hero.gearId,b.subject,b.hero.loadout),round=num(b.round,1),cursor=num(b.cursor,2);
      if(!['prep','question','recap','done'].includes(b.phase)||!Array.isArray(b.answers)||b.answers.length>6||!Array.isArray(b.prepared)||b.prepared.length!==2)invalid();
      const prepared=b.prepared.map(bool),offset=round*3+cursor;
      if(b.phase==='prep'&&(cursor!==0||b.answers.length!==round*3)||b.phase==='question'&&(b.answers.length<offset||b.answers.length>offset+1)||b.phase==='recap'&&(round!==0||cursor!==2||b.answers.length!==3)||b.phase==='done'&&(round!==1||cursor!==2||b.answers.length!==6)||round===0&&prepared[1])invalid();
      const answers=b.answers.map((v,i)=>{if(!v)invalid();const choice=num(v.choice,3),correct=choice===byId.get(b.ids[i]).answer;if(v.correct!==correct)invalid();return {choice,correct,xp:num(v.xp,16),ticket:num(v.ticket,1),repeated:bool(v.repeated)};});
      const rounds=[],finishedRounds=b.phase==='done'?2:b.phase==='recap'||round===1?1:0,enemy=ENEMIES.find(e=>e.id===b.enemyId);
      for(let i=0;i<finishedRounds;i++)rounds.push(calculateRound(hero,enemy,answers.slice(i*3,i*3+3).filter(v=>v.correct).length,i?rounds[0].correct:0));
      const battle={enemyId:b.enemyId,subject:b.subject,day,week:b.week,ids:b.ids.slice(),hero,round,cursor,phase:b.phase,prepared,answers,rounds,result:null};
      if(b.phase==='done') {
        if(!b.result)invalid();const t=totals(battle),p=performance(enemy,t.correct,t.win),r=b.result;
        if(r.win!==t.win||r.correct!==t.correct||r.damage!==t.damage||r.hp!==t.hp||r.points!==p.points||r.coins!==p.coins)invalid();
        battle.result={...t,...p,earnedPoints:num(r.earnedPoints,p.points),earnedCoins:num(r.earnedCoins,p.coins),eligible:bool(r.eligible)};
        if(!battle.result.eligible&&(r.earnedPoints||r.earnedCoins))invalid();
      } else if(b.result!==null)invalid();
      a.battle=battle;
    }
    return a;
  }
  return {ENEMIES,RANKS,GOODS,GEAR_ATTACK,GEAR_HP,GEAR_GUARD,weekId,addDays,fresh,score,rank,rollWeek,claimCoins,buy,stats,heroStats,begin,useSupply,startRound,answer,calculateRound,totals,next,advance,studyCard,restore};
});
