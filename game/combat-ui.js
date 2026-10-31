window.MindBattleUI = function(ctx) {
  'use strict';
  const {E,C,node,btn,note,go,title,save,render,toast,openModal,closeModal,questions,getState,random,appearance}=ctx;
  const byId=new Map(questions.map(q=>[q.id,q]));
  let selectedSubject='pharmaceutics',choice=null;
  const state=()=>getState(), arenaState=()=>state().arena;
  const monster=(enemy,small=false)=>node('div',{class:'monster-art '+enemy.id+(small?' small':''),'aria-hidden':'true'},node('div',{class:'monster-aura'}),node('div',{class:'monster-wing left'}),node('div',{class:'monster-wing right'}),node('div',{class:'monster-body'},node('span',{class:'monster-crown'},enemy.icon),node('div',{class:'monster-eyes'},node('i'),node('i')),node('span',{class:'monster-rune'},'◇')),node('div',{class:'monster-shadow'}));
  const badge=r=>node('div',{class:'rank-medal '+r.id,'aria-hidden':'true'},node('span',{},r.id==='diamond'?'✦':'◈'));
  function commit() {save();render();}
  function scrollTop(){document.getElementById('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function battleStart(enemyId) {
    const existing=arenaState().battle;
    const launch=()=>{if(C.begin(state(),enemyId,selectedSubject,questions,random)){choice=null;save();closeModal();go('battle');}};
    if(existing&&existing.phase!=='done') {
      openModal(node('h2',{},'尚有一場雙回合對戰'),note('繼續既有對戰可保留回合進度。放棄後本場不結算積分或金幣，已使用的補給券不退回；答題經驗仍保留。'),node('div',{class:'modal-actions'},btn('繼續對戰',()=>{closeModal();go('battle');}),btn('放棄並開始新對戰',()=>{arenaState().battle=null;launch();},'secondary')));return;
    }
    launch();
  }
  function arena() {
    title('讓知識，成為你的力量。','THE WEEKLY KNOWLEDGE ARENA');
    const a=arenaState(),points=C.score(a),r=C.rank(points),next=C.RANKS.find(x=>x.min>points),stats=C.stats(state(),selectedSubject),equipped=E.ITEMS.find(x=>x.id===state().equipped);
    const hero=node('section',{class:'season-hero '+r.id},node('div',{},node('span',{class:'pill'},'個人週賽 · 每週一 00:00 換季'),node('h2',{},'這一週，挑戰更遠一點。'),node('p',{},`${a.week.id} — ${C.addDays(a.week.id,6)} · 台北時間`),node('div',{class:'season-score'},node('strong',{},points.toLocaleString()),node('span',{},'本週積分')),node('p',{class:'note'},next?`再累積 ${next.min-points} 分，晉升${next.name}階。`:'已抵達鑽石階，繼續刷新你的最佳紀錄。'),node('progress',{max:next?next.min-r.min:1,value:next?points-r.min:1,'aria-label':'本週段位進度'})),node('div',{class:'season-emblem'},badge(r),node('strong',{},r.name+'階旅人'),node('small',{},'WEEKLY LEAGUE')));
    const ladder=node('div',{class:'rank-ladder'},C.RANKS.map(x=>node('div',{class:'rank-step '+x.id+(x.id===r.id?' current':'')},node('span',{},x.id==='diamond'?'✦':'◇'),node('strong',{},x.name+'階'),node('small',{},x.min.toLocaleString()+' 分'))));
    const subject=node('select',{id:'arena-subject',onChange:e=>{selectedSubject=e.target.value;render();}},Object.entries(E.SUBJECTS).map(([id,s])=>node('option',{value:id},s.name)));subject.value=selectedSubject;
    const loadout=node('section',{class:'panel loadout'},node('div',{},node('p',{class:'eyebrow'},'YOUR LOADOUT'),node('h3',{},`Lv. ${stats.level} · ${equipped?.name||'知識旅人，輕裝出發'}`),note(`攻擊 ${stats.attack} · 生命 ${stats.hp} · 裝備減傷 ${stats.guard}`)),node('div',{class:'filters'},node('label',{for:'arena-subject'},'試煉學科'),subject,btn('調整裝備',()=>go('inventory'),'small secondary')));
    const enemies=node('div',{class:'enemy-grid'},C.ENEMIES.map(enemy=>{
      const record=a.week.records[E.today()+':'+enemy.id];
      return node('article',{class:'enemy-card '+enemy.id},node('div',{class:'enemy-title'},node('span',{class:'eyebrow'},enemy.title),node('span',{class:'level-tag'},'Lv. '+enemy.level)),monster(enemy,true),node('h3',{},enemy.name),node('p',{class:'enemy-flavor'},enemy.flavor),node('div',{class:'enemy-stats'},node('span',{},'耐久 '+enemy.hp),node('span',{},'反擊 '+enemy.attack)),node('p',{class:'note'},record?`今日最佳 ${record.points} 分 · ${record.correct}/6 題答對`:'今日尚未留下戰績'),btn('挑戰 · 兩回合 →',()=>battleStart(enemy.id),'full '+(enemy.id==='diamond'?'gold':'secondary')));
    }));
    return [hero,ladder,a.battle&&a.battle.phase!=='done'?node('div',{class:'resume-bar'},node('span',{},`未完成：${C.ENEMIES.find(e=>e.id===a.battle.enemyId).name} · 第 ${a.battle.round+1} 回合`),btn('繼續對戰 →',()=>go('battle'),'small')):null,loadout,node('div',{class:'section-title'},node('h2',{},'選擇你的對手'),node('p',{},'所有試煉都可直接挑戰')),enemies,node('div',{class:'two-col'},node('section',{class:'panel'},node('h3',{},'弱裝備，也有逆轉的力量'),note('每場固定 2 回合，每回合答 3 題。單回合傷害＝基礎攻擊 × 答對數＋22 × 答對數²；全對再加 30，第二回合還有接續加成。答對也能減少敵方反擊。'),note('即使 Lv. 1、沒有裝備，六題全對也能擊敗鑽晶巨龍。裝備越稀有、等級越高，越能容許答題失誤；全部答錯則無法造成傷害。')),node('section',{class:'panel'},node('h3',{},'本週計分與結算'),note('這是本機個人打怪積分賽。每隻怪每天只計最佳成績，重打超越紀錄時補發積分與金幣差額；沒有虛構的真人對手或全球排名。'),note('答對每題 20 分；勝利加 80／150／220／300 分；六題全對勝利再加 80 分。週一重置後，有參賽的上一週可領銅 60／銀 120／金 240／鑽石 400 金幣，首次開啟時自動結算。'))),a.history.length?node('section',{class:'panel season-history'},node('h3',{},'走過的賽季'),a.history.map(h=>node('div',{class:'history-row'},node('span',{},h.week+' 週'),node('strong',{},C.rank(h.points).name+'階 · '+h.points+' 分'),node('span',{},'已領 '+h.bonus+' 金幣')))):null];
  }
  function battlefield(b) {
    const enemy=C.ENEMIES.find(e=>e.id===b.enemyId),t=C.totals(b),gear=E.ITEMS.find(i=>i.id===b.hero.gearId);
    return node('section',{class:'battlefield '+enemy.id},node('div',{class:'fighter player'},node('span',{class:'eyebrow'},'KNOWLEDGE TRAVELER'),appearance(),node('h3',{},state().profile?.name||window.MindAcademy.character(state().appearance.character).name),node('p',{},'Lv. '+b.hero.level+' · '+(gear?.name||'輕裝出發')),node('div',{class:'health-label'},node('span',{},'生命'),node('strong',{},`${t.hp} / ${b.hero.hp}`)),node('progress',{value:t.hp,max:b.hero.hp,'aria-label':'角色生命'})),node('div',{class:'battle-versus'},node('strong',{},'VS'),node('span',{},'ROUND '+(b.round+1)+' / 2')),node('div',{class:'fighter enemy'},node('span',{class:'eyebrow'},enemy.title),monster(enemy,true),node('h3',{},enemy.name),node('p',{},'Lv. '+enemy.level+' · 反擊 '+enemy.attack),node('div',{class:'health-label'},node('span',{},'累積傷害 / 擊破目標'),node('strong',{},`${t.damage} / ${enemy.hp}`)),node('progress',{value:Math.min(t.damage,enemy.hp),max:enemy.hp,'aria-label':'擊破進度'})));
  }
  function preview(b) {
    const set=b.ids.slice(b.round*3,b.round*3+3).map(id=>byId.get(id));
    openModal(node('p',{class:'eyebrow'},'UNDERSTAND BEFORE YOU FIGHT'),node('h2',{},`第 ${b.round+1} 回合 · 知識預習`),note('這三張知識卡對應本回合的三道題。先理解概念、判斷理由與記憶重點，再進場作答；回合開始前可以免費重看。'),...set.map((q,i)=>{
      const card=C.studyCard(q);
      return node('section',{class:'supply-card'},node('p',{class:'eyebrow'},`知識 ${i+1} / 3`),node('h3',{},card.title),window.MindLesson.render(q,node,{question:true}),node('details',{class:'supply-options'},node('summary',{},'對照這題的全部選項'),node('ol',{},card.options.map((text,index)=>node('li',{},node('span',{class:'option-reference'},String.fromCharCode(65+index)+'．'),text,index===q.answer?'（本題答案）':'')))),node('small',{class:'muted'},q.source+' · 第 '+q.number+' 題'));
    }));
    const dialog=document.getElementById('modal'),heading=dialog.querySelector('h2');
    heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});dialog.scrollTop=0;
  }
  function battle() {
    const b=arenaState().battle;
    if(!b)return arena();
    title(b.phase==='done'?'每一份理解，都有力量。':`第 ${b.round+1} 回合 · 知識交鋒`,'TWO ROUNDS. SIX CHANCES.');
    const enemy=C.ENEMIES.find(e=>e.id===b.enemyId),stage=battlefield(b),a=arenaState();
    if(b.phase==='prep') return [stage,node('section',{class:'panel round-prep'},node('p',{class:'eyebrow'},`ROUND 0${b.round+1} / PREPARATION`),node('h2',{},b.round?'第二回合，蓄力再出發。':'先準備，再迎戰。'),note(`${E.SUBJECTS[b.subject].name} · 本回合 3 題，回答後累積攻擊力。等級與裝備已在開戰時鎖定。`),node('div',{class:'supply-callout'},node('span',{class:'supply-symbol','aria-hidden':'true'},'▱'),node('div',{},node('h3',{},'臨時補給券'),note(`持有 ${a.supplies} 張 · 1 張可預習本回合 3 題的概念、完整答案與解析`)),btn(b.prepared[b.round]?'再次查看本回合補給':'使用 1 張，預讀知識',()=>{if(C.useSupply(a)){save();render();preview(b);}else toast('補給券不足，可以前往商城購買。');},'secondary',!b.prepared[b.round]&&a.supplies<1)),node('div',{class:'question-actions'},btn('前往補給商城',()=>go('shop'),'secondary'),btn(`開始第 ${b.round+1} 回合 →`,()=>{C.startRound(a);choice=null;commit();scrollTop();})),note('補給只可在本回合開始前使用。使用後離開或重新整理，仍會保留已解鎖的預讀內容。'))];
    if(b.phase==='recap') {
      const r=b.rounds[0],t=C.totals(b);
      return [stage,node('section',{class:'panel round-recap'},node('p',{class:'eyebrow'},'FIRST STRIKE'),node('h2',{},r.correct===3?'三題全對，知識爆擊！':'第一回合，力量已累積。'),damageDetail(r),note(`已造成 ${t.damage} 傷害；敵方反擊 ${r.retaliation}，剩餘生命 ${t.hp}。${t.damage>=enemy.hp?'已達擊破目標，完成第二回合後結算勝負。':'下一回合仍可透過答題追加傷害。'}`),btn('進入第二回合準備 →',()=>{C.advance(a);choice=null;commit();scrollTop();}))];
    }
    if(b.phase==='done') {
      const r=b.result;
      return [stage,node('section',{class:'panel battle-result'},node('p',{class:'eyebrow'},r.win?'VICTORY · KNOWLEDGE WINS':'A LESSON WORTH KEEPING'),node('h2',{},r.win?'擊破成功，這是理解的力量。':r.hp===0?'生命耗盡，帶著理解再挑戰。':'還差一點，讀懂錯題再回來。'),node('div',{class:'summary-stats'},[['答對',r.correct+'/6'],['新增積分','+'+r.earnedPoints],['基礎金幣','+'+r.earnedCoins]].map(([k,v])=>node('div',{},node('strong',{},v),node('small',{},k)))),node('div',{class:'round-totals'},b.rounds.map((round,i)=>node('div',{class:'panel'},node('h3',{},`第 ${i+1} 回合 · ${round.correct}/3 題`),damageDetail(round)))),note(r.eligible?`本場成績 ${r.points} 分、金幣基準 ${r.coins}。同一天、同一隻怪只計最佳紀錄，這次只補發超越原紀錄的差額；金幣依今日倍率結算，並先償還欠款。`:'本場於上一週開始，不計入新一週積分與金幣；答題經驗與錯題紀錄已保留。'),node('div',{class:'modal-actions'},btn('回到每週積分賽',()=>go('arena')),btn('複習錯題',()=>go('review'),'secondary'),btn('補充行囊',()=>go('shop'),'gold')))];
    }
    const index=b.round*3+b.cursor,q=byId.get(b.ids[index]),answered=b.answers[index];
    const panel=node('section',{class:'panel question-panel combat-question'},node('div',{class:'question-top'},node('span',{},E.SUBJECTS[q.subject].name+' · '+q.exam+' · 第 '+q.number+' 題'),node('strong',{},`本回合 ${b.cursor+1} / 3`)),node('h2',{class:'question-text'},q.question));
    panel.append(node('div',{class:'answers',role:'group','aria-label':'戰鬥作答選項'},q.options.map((option,i)=>node('button',{class:'answer'+(!answered&&choice===i?' selected':'')+(answered&&i===q.answer?' correct':'')+(answered&&i===answered.choice&&!answered.correct?' incorrect':''),disabled:!!answered,'aria-pressed':String((answered?answered.choice:choice)===i),onClick:()=>{choice=i;render();document.querySelectorAll('.combat-question .answer')[i].focus({preventScroll:true});}},node('span',{class:'answer-letter'},String.fromCharCode(65+i)),node('span',{},option,answered&&i===q.answer?' ✓ 正確答案':answered&&i===answered.choice?' ✕ 你的選擇':'')))));
    if(answered)panel.append(node('section',{class:'feedback'+(answered.correct?'':' wrong'),'aria-live':'polite'},node('h3',{},answered.correct?'✦ 知識命中！攻擊正在蓄力。':'這一擊沒有命中，先讀懂原因。'),note(answered.correct?(answered.repeated?'此題今日已領經驗，仍計入本場攻擊力。':`+${answered.xp} XP`+(answered.ticket?' · 獲得 1 張星願券！':'')):'已加入錯題修練。'),node('h3',{},q.title),window.MindLesson.render(q,node),node('small',{},q.source+' · 第 '+q.number+' 題')));
    panel.append(node('div',{class:'question-actions'},btn('暫回積分賽',()=>go('arena'),'secondary'),answered?btn(b.cursor===2?b.round===0?'結算第一回合 →':'完成對戰 →':'下一題 →',()=>{C.next(state());choice=null;commit();scrollTop();}):btn('確認答案，累積攻擊',()=>{if(choice===null)return;const result=C.answer(state(),q,choice);if(result)window.MindAdventure.earnNote(state(),q.id,result.correct);commit();document.querySelector('.combat-question .feedback')?.scrollIntoView({block:'nearest',behavior:'instant'});},'',choice===null)),note('本場裝備已鎖定；補給預讀限回合開始前使用。答題會同時累積日常經驗、星願進度及錯題紀錄。'));
    return [stage,panel];
  }
  function damageDetail(r) {
    return node('div',{class:'damage-breakdown'},node('div',{},node('span',{},'裝備與基礎'),node('strong',{},r.basic)),node('div',{},node('span',{},'知識加成'),node('strong',{},r.knowledge)),node('div',{},node('span',{},'全對＋接續'),node('strong',{},r.perfect+r.chain)),node('div',{class:'damage-total'},node('span',{},'傷害'),node('strong',{},r.damage)));
  }
  function shop() {
    title('為下一場冒險，備好行囊。','THE TRAVELER’S SUPPLY SHOP');
    const a=arenaState();
    return [node('section',{class:'shop-hero'},node('div',{},node('p',{class:'eyebrow'},'LEARN. EARN. PREPARE.'),node('h2',{},'讀懂一點，就多一分勝算。'),note('每日補給提供基礎 80 金幣，打怪刷新當日最佳紀錄也能獲得金幣。')),node('div',{class:'shop-purse'},node('span',{},'◉'),node('strong',{},a.coins.toLocaleString()),node('small',{},'金幣'))),node('div',{class:'shop-inventory'},node('span',{},'▱ 補給券 '+a.supplies+' 張'),node('span',{},'▤ 星願券 '+state().tickets+' 張'),node('span',{},'↪ 甩鍋券 '+a.shirkTickets+' 張'),node('span',{},'✦ 能者多勞券 '+a.diligenceTickets+' 張'),a.login!==E.today()?btn('領取今日補給 · 基礎 80',()=>{const n=C.claimCoins(a);commit();toast(n?'今日補給已結算，會依倍率入帳並先償還欠款。':'今天已領取。');},'small gold'):node('span',{class:'muted'},'✓ 今日金幣已領取')),node('div',{class:'shop-grid'},C.GOODS.map(item=>node('article',{class:'shop-card'},node('p',{class:'eyebrow'},item.tag),node('div',{class:'product-art','aria-hidden':'true'},item.kind==='supplies'?'▱':item.kind==='shirkTickets'?'↪':item.kind==='diligenceTickets'?'✦':'▤',node('span',{},'×'+item.count)),node('h3',{},item.name),note(item.description||(item.kind==='supplies'?`含 ${item.count} 張補給券。每張可在回合開始前預習該回合 3 題的完整題意、知識與判斷方法。`:'含 1 張星願券，可在星願寶箱抽取一件裝備。')),node('div',{class:'product-price'},node('strong',{},item.price),node('span',{},'金幣')),btn(a.coins<item.price?'金幣不足':'購買 '+item.name,()=>openModal(node('h2',{},'把補給放進行囊？'),note(`${item.name} ×1，花費 ${item.price} 金幣。購買後剩餘 ${a.coins-item.price} 金幣。`),btn('確認購買',()=>{if(ctx.money){ctx.money('supplies',item.id,()=>C.buy(state(),item.id),'已購入 '+item.name+'，行囊已更新。');return;}const success=C.buy(state(),item.id);closeModal();commit();toast(success?'已購入 '+item.name+'，行囊已更新。':'金幣不足或數量已達上限。');})),item.kind==='supplies'?'full':'full secondary',a.coins<item.price)))),node('section',{class:'panel shop-guide'},node('h3',{},'怎麼使用臨時補給券？'),node('ol',{class:'rules'},node('li',{},'在每週積分賽選擇怪物，或在雙人對戰完成配對，進入回合準備。'),node('li',{},'點「使用 1 張，預讀知識」，閱讀本回合的概念、完整題意、答案內容與記憶重點。'),node('li',{},'理解後再開始回合。第二回合如需預讀，另外使用一張。')),note('已使用的券不退回；同一回合開始前可再次查看，不會重複扣券。補給券不會隨週賽重置而消失。')),node('div',{class:'notice payment-status'},node('strong',{},'刷卡購買尚未開放'),node('p',{},'目前只接受遊戲內賺取的金幣。待商家收款帳號與售價確認後再開放刷卡；此頁不會要求或保存信用卡資料。'))];
  }
  function banner() {
    const a=arenaState(),r=C.rank(C.score(a));
    return node('section',{class:'arena-banner'},node('div',{},node('p',{class:'eyebrow'},'NEW · WEEKLY KNOWLEDGE ARENA'),node('h3',{},'知識打怪，每週向上挑戰。'),note(`本週${r.name}階 · ${C.score(a)} 分 · 兩回合決勝，六題創造逆轉。`)),btn('進入每週積分賽 →',()=>go('arena'),'gold'));
  }
  return {arena,battle,shop,banner};
};
