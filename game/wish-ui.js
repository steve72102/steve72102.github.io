window.MindWishUI=function(ctx){
  'use strict';
  const {node,btn,note,openModal,closeModal,getState,account,network,adventure,go,render}=ctx,W=window.MindWish;
  const fmt=n=>n.toLocaleString('zh-TW');let busy=false,cooldown=0;
  function amount(){const snap=network().snapshot();return snap.phase==='ready'?fmt(snap.pool.balance):'—';}
  function badge(){return node('button',{type:'button',class:'wish-pool-badge','data-walk-portal':'wish','aria-label':'走向中央許願池'},node('small',{},'全體玩家 · 共同許願池'),node('strong',{},'◉ ',node('span',{'data-wish-pool':''},amount())),node('span',{},'投幣許願 ↗'));}
  function update(){document.querySelectorAll('[data-wish-pool]').forEach(el=>el.textContent=amount());const status=document.querySelector('[data-wish-status]');if(status)status.textContent=network().snapshot().message;refreshButton();}
  function refreshButton(){const button=document.querySelector('[data-wish-draw]');if(!button)return;const s=getState(),a=account().snapshot(),ready=network().snapshot().phase==='ready';button.disabled=busy||a.wishing||a.locked||!a.uid||!navigator.onLine||!ready||!W.space(s)||s.arena.coins<W.COST||Date.now()<cooldown;button.textContent=busy?'金幣正落入水面…':!a.uid?'Google 登入後許願':!ready?'等待共同獎池連線':!W.space(s)?'服飾收藏數量已達上限':s.arena.coins<W.COST?'需要 1,000 金幣':Date.now()<cooldown?'水波稍歇，請稍候':'投入 1,000 金幣 · 許願一次';}
  function prizeCard(p){const g=p.gear;return node('article',{class:'wish-prize '+(g?'wish-level-'+g.level:'wish-coins')},g?adventure().icon(g):node('span',{class:'wish-coin-mark','aria-hidden':'true'},'◉'),node('div',{},node('small',{},g?'Lv. '+g.level+' · '+(g.slot==='hat'?'帽子':'服裝'):'共同獎池回饋'),node('h4',{},p.name),node('strong',{},(p.weight/1000)+'%'),g?note('攻擊 +'+g.attack+' · 生命 +'+g.hp+' · 減傷 +'+g.guard):note('投入後獎池的 1%，無條件捨去小數；最少 1,000 金幣。')));}
  function open(){
    if(busy)return;network().watch();const s=getState(),a=account().snapshot(),last=s.wishes.last;
    openModal(node('section',{class:'wish-dialog'},node('div',{class:'wish-heading'},node('p',{class:'eyebrow'},'THE SHARED WISHING FOUNTAIN'),node('h2',{},'把願望，交給一圈水波。'),node('p',{},'知識累積成旅程，金幣匯聚成大家的願望。')),
      node('div',{class:'wish-hero'},node('div',{class:'wish-emblem','aria-hidden':'true'},node('i'),node('b',{},'✦')),node('small',{},'金球上方 · 全體玩家共用獎池'),node('strong',{},'◉ ',node('span',{'data-wish-pool':''},amount())),node('p',{'data-wish-status':'',class:'note'},network().snapshot().message)),
      a.locked?note(a.message):null,node('div',{class:'wish-wallet'},node('span',{},'你的金幣 ',node('strong',{},fmt(s.arena.coins))),node('span',{},'服飾收藏 ',node('strong',{},window.MindAdventure.wardrobeCount(s)+' 件 · 不佔一般背包'))),
      node('button',{type:'button',class:'button gold full wish-draw','data-wish-draw':'',onClick:draw},'投入 1,000 金幣 · 許願一次'),
      node('p',{class:'wish-feedback',role:'status','aria-live':'polite'}),
      !a.uid?btn('前往 Google 登入',()=>{closeModal();go('account');},'secondary full'):null,
      node('div',{class:'wish-odds-strip'},node('span',{},'20 級 · 8 款 · 80%'),node('span',{},'40 級 · 4 款 · 18%'),node('span',{},'60 級 · 2 款 · 1.89%'),node('span',{},'頂裝 · 1 款 · 0.01%'),node('span',{},'金幣 · 0.1%')),
      note('每次只抽 1 獎，各次獨立、沒有保底。所有投入都進共同獎池；抽中金幣後扣除該次獎金。低等級可先收藏裝備，達到標示等級後穿戴。'),
      node('details',{class:'wish-prize-list'},node('summary',{},'查看全部 16 個獎項與機率'),node('div',{class:'wish-prizes'},W.PRIZES.map(prizeCard))),
      last?node('div',{class:'wish-last'},node('small',{},'上次許願'),node('strong',{},last.prizeId==='coins'?fmt(last.coins)+' 金幣':W.PRIZES.find(p=>p.id===last.prizeId).name),note('累計許願 '+s.wishes.draws+' 次 · 已投入 '+fmt(s.wishes.spent)+' 金幣')):null,
      node('div',{class:'modal-actions'},btn('查看服飾背包',()=>{closeModal();go('bag');},'secondary small'),btn('重新連接獎池',async()=>{await account().sync();await network().retry();},'secondary small')),
      note('使用遊戲內金幣；不提供現金、刷卡購買或兌現。共同獎池需 Google 登入與連網，其他單人玩法仍可離線遊玩。')));
    refreshButton();
  }
  async function draw(){
    if(busy||Date.now()<cooldown)return;busy=true;refreshButton();document.querySelector('.wish-hero')?.classList.add('casting');
    const modal=document.getElementById('modal');modal?.classList.add('wish-pending');
    try{const result=await network().draw(),r=result.receipt,p=W.PRIZES.find(p=>p.id===r.prizeId);cooldown=Date.now()+2100;
      busy=false;modal?.classList.remove('wish-pending');render();
      openModal(node('section',{class:'wish-result'},node('p',{class:'eyebrow'},result.recovered?'YOUR WISH, SAFELY RECOVERED':'A RIPPLE RETURNS YOUR WISH'),node('h2',{},result.recovered?'已確認上次的許願結果':'水波捎來了回禮'),p.gear?adventure().icon(p.gear):node('span',{class:'wish-coin-mark'},'◉'),node('h3',{},p.gear?p.name:fmt(r.coins)+' 金幣'),p.gear?note('Lv. '+p.gear.level+' · 已收入服裝配件背包'+(Math.floor(getState().xp/100)+1<p.gear.level?'，達到等級即可穿戴。':'，可以到服飾背包穿戴。')):note('計算基準：('+fmt(r.poolBefore)+' + 1,000) × 1%，取整數且至少 1,000。'),p.gear?node('blockquote',{class:'wish-study-tip'},p.gear.text):note('金幣也能換補給券，先讀懂關卡，再開始挑戰。'),note(result.recovered?'這是上次已完成的許願，沒有再次扣款；獎品已保存至雲端。':'本次扣除 1,000 金幣 · 獎品已保存至雲端。'),node('div',{class:'modal-actions'},btn('回到許願池',open,'gold'),btn('打開服飾背包',()=>{closeModal();go('bag');},'secondary'))));
    }catch(error){busy=false;modal?.classList.remove('wish-pending');const feedback=document.querySelector('.wish-feedback');if(feedback)feedback.textContent=error.code==='permission-denied'?'本次交易未完成。可能操作太快或服務正在更新，請稍後再試；重試會先核對上次結果。':error.message||'連線暫時中斷，重試會先核對上次結果。';document.querySelector('.wish-hero')?.classList.remove('casting');refreshButton();}
    finally{busy=false;modal?.classList.remove('wish-pending');setTimeout(refreshButton,2200);}
  }
  return {open,badge,update,busy:()=>busy};
};
