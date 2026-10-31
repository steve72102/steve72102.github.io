window.MindEconomyUI=function(ctx){
  'use strict';
  const {node,btn,note,openModal,closeModal,getState,toast,render,network,account}=ctx,P=window.MindEconomy;
  const names={bully:'霸凌券',counter:'反霸凌券',bomb:'炸彈券'},marks={bully:'↘',counter:'◇',bomb:'✹'};
  const couponName=kind=>names[kind]||'自以為'+P.REGIONS[kind]+'最聰明券';
  const fmt=n=>Number(n||0).toLocaleString('zh-TW');
  function current(){const w=getState().arena.economy?.wallet;return w?P.roll(w):null;}
  function locked(){const a=account().snapshot(),n=network().snapshot();return !a.uid||a.locked||a.wishing||!n.ready||n.working||!navigator.onLine;}
  async function run(action,message,after){
    try{const result=await action();closeModal();render();toast(result?.previous?'已先完成上次待確認的操作；本次選擇尚未執行。':message);if(after)after(result);return result;}
    catch(e){toast(e.message||'目前無法完成，請稍後重試。');return null;}
  }
  function summary(){const w=current();return node('div',{class:'economy-summary'},w?[
    node('div',{},node('small',{},'今日收益倍率'),node('strong',{},P.factor(w)+'%')),
    node('div',{},node('small',{},'今日已入帳收入'),node('strong',{},fmt(w.earned))),
    node('div',{class:w.debt?'has-debt':''},node('small',{},'尚待償還'),node('strong',{},fmt(w.debt))),
    node('div',{},node('small',{},'今日反霸凌使用'),node('strong',{},w.usedCounters+' 次'))
  ]:[note(account().snapshot().uid?'帳號已登入，正在準備金幣與班級資料…':'Google 登入後可使用多人券、加入今日班級並同步金幣。')]);}
  function shop(){const w=current(),s=network().snapshot();return node('section',{class:'panel coupon-shop'},node('p',{class:'eyebrow'},'ACADEMY EXCHANGE'),node('h2',{},'學院互動券'),summary(),s.message?note(s.message):null,
    node('div',{class:'coupon-grid'},Object.keys(names).map(kind=>node('article',{class:'coupon-card coupon-'+kind},node('span',{class:'coupon-mark','aria-hidden':'true'},marks[kind]),node('small',{},kind==='bully'?'PLAYER EFFECT':kind==='counter'?'CLEAR EFFECTS':'CLASS TRANSFER'),node('h3',{},names[kind]),note(kind==='bully'?'對同一人每天最多三張。連用三張累計對方 −6%、自己 +9%；實際收益最低 30%。':kind==='counter'?'清除目前所有收益減益，保留自己的加成。頭頂短暫顯示「可悲阿~」，當天仍可能再次受到影響。':'當天已用反霸凌券至少六次，且收益倍率低於 70% 時，才能對一個班級使用。'),node('p',{class:'coupon-price'},fmt(P.PRICES[kind])+' 金幣'),note('持有 '+(w?.stock[kind]||0)+' 張'),btn('購買 1 張',()=>purchase(kind),'full',locked()||getState().arena.coins<P.PRICES[kind]),kind==='counter'?btn('使用 1 張',counter,'secondary full',locked()||!w?.stock.counter):kind==='bomb'?btn('查看今日班級',()=>classes(),'secondary full',!account().snapshot().uid):null))),
    regionShop(),
    note('倍率適用於每日補給、打怪、週賽獎勵、主線與裝備回收。許願獎金和玩家間轉移不再套用倍率，也不重複算成當日收入。小數會累積，不會因分次領取而少拿。'),
    note('每日效果與分班依臺灣時間午夜重置。欠款持續保留，之後的遊戲收入先還款；離線收入以重新連線時有效的倍率結算。券不占背包格數。'));
  }
  function regionShop(){
    const w=current(),active=P.activeHonor(w,P.day()),R=window.MindRankings;
    return node('section',{class:'region-shop'},node('div',{class:'region-shop-heading'},node('div',{},node('p',{class:'eyebrow'},'A LITTLE CONFIDENCE'),node('h2',{},'把你的地區，戴在頭上。')),btn('查看全服週榜 ↗',()=>ctx.rankings().open(),'secondary')),
      note('四種地區券，每張 1,000 金幣。使用後的新遊戲收入 +15%，頭頂顯示你的專屬稱號，從使用當天起算 14 天。'),
      active?node('div',{class:'honor-status '+active.kind},node('strong',{},active.title),node('span',{},'收入 +'+active.bonus+'% · 至 '+R.date(active.until-1)+' 23:59')):null,
      node('div',{class:'region-grid'},Object.entries(P.REGIONS).map(([kind,label],i)=>node('article',{class:'region-card region-'+kind},
        node('div',{class:'region-art','aria-hidden':'true'},node('span',{},['北','中','南','東'][i]),node('i',{}),node('b',{},'✦')),
        node('p',{class:'eyebrow'},['NORTH','CENTRAL','SOUTH','EAST'][i]+' · 14 DAYS'),
        node('h3',{},'自以為'+label+'最聰明券'),node('div',{class:'region-benefit'},node('strong',{},'+15%'),node('span',{},'遊戲金幣收入')),
        note('頭頂稱號：自以為'+label+'最聰明'),node('p',{class:'coupon-price'},'1,000 金幣'),note('持有 '+(w?.stock[kind]||0)+' 張'),
        btn('購買'+label+'券',()=>purchase(kind),'full',locked()||getState().arena.coins<1000),
        btn('使用'+label+'券',()=>useRegion(kind),'secondary full',locked()||!w?.stock[kind]||active?.kind==='crown')))),
      note('四個地區效果相同，只取一種加成。重複使用或切換地區會重新起算 14 天，不會延長剩餘天數；冠軍稱號生效時先保留地區券。以臺灣日期計算，使用當天為第 1 天。'));
  }
  function useRegion(region){
    const R=window.MindRankings,active=P.activeHonor(current(),P.day());
    openModal(node('p',{class:'eyebrow'},'REGIONAL TITLE'),node('h2',{},'自以為'+P.REGIONS[region]+'最聰明'),
      note('消耗 1 張券。從今天起，遊戲金幣收入 +15%，至 '+R.date(P.day()+13)+' 23:59（臺灣時間）。頭頂會持續顯示此稱號。'),
      active?note('目前稱號會被替換，剩餘天數不會累加。'):null,
      btn('確認使用 1 張',()=>run(()=>network().honor(region),'地區稱號已啟用，遊戲收入 +15%。'),'gold',locked()||!current()?.stock[region]||active?.kind==='crown'));
  }
  function purchase(kind){openModal(node('div',{class:'coupon-mark'},marks[kind]||'✦'),node('h2',{},'購買'+couponName(kind)),note('花費 '+P.PRICES[kind]+' 金幣，獲得 1 張。'),btn('確認購買 · '+P.PRICES[kind]+' 金幣',()=>run(()=>network().buy(kind),'已購入 1 張'+couponName(kind)+'。'),'gold',locked()));}
  function counter(){const w=current();openModal(node('h2',{},'使用反霸凌券'),note('清除目前減益，收益倍率回到 '+(100+(w?.bonus||0)+(w?P.honorBonus(w):0))+'%。這張券不提供當天免疫，也不消除欠款。'),btn('使用 1 張反霸凌券',()=>run(()=>network().counter(),'已清除收益減益。'),'gold',locked()||!w?.stock.counter));}
  async function target(k,label){
    if(locked()){toast('請先完成 Google 帳號與金幣同步。');return;}
    openModal(node('h2',{},'讀取玩家資料…'));
    try{const w=await network().player(k);if(!w){openModal(node('h2',{},label||'玩家'),note('這位玩家尚未完成多人金幣帳本設定。'));return;}
      const mine=current(),t=P.roll(w);
      openModal(node('p',{class:'eyebrow'},'PLAYER EFFECT · '+k.slice(-6)),node('h2',{},w.name),note('目前收益倍率 '+P.factor(t)+'%。使用後只影響當天的新收入，不會追回過去已賺的金幣。'),note('同一人每天最多三張；連續對同一人使用的單張減益為 1%、2%、3%，自己的單張加成為 2%、3%、4%。'),btn('對此玩家使用 1 張霸凌券',()=>run(()=>network().bully(k),'霸凌券已使用，雙方今日倍率已更新。'),'gold',locked()||!mine?.stock.bully||P.factor(t)<=30),note('你目前持有 '+(mine?.stock.bully||0)+' 張；對方已達 30% 下限時不消耗券。'));
    }catch(e){openModal(node('h2',{},'暫時無法讀取'),note(e.message));}
  }
  function targetButton(player){return btn('使用互動券',()=>target(player.socialId,player.name),'secondary',locked()||player.socialId===getState().rpg.socialId);}
  async function classes(building=ctx.building?.()){
    if(!account().snapshot().uid){openModal(node('h2',{},'今日班級'),note('請先使用 Google 登入，再走進任一學科樓或對戰樓。每棟樓依當天不同玩家的到達順序，每 50 人一班。'));return;}
    if(!network().snapshot().ready){openModal(node('h2',{},'正在同步班級資料'),note(network().snapshot().message||'帳號已登入，正在載入金幣與班級資料。'),btn('重新讀取',()=>classes(building),'secondary'));network().observe();return;}
    if(!P.BUILDINGS[building]){openModal(node('h2',{},'四棟樓的今日班級'),note('各棟樓獨立分班，同一天重返不重複占位。走進樓內後，會加入當天班級。'),node('div',{class:'class-building-picker'},Object.entries(P.BUILDINGS).map(([id,name])=>btn(name,()=>classes(id),'secondary'))));return;}
    openModal(node('p',{class:'eyebrow'},'TODAY’S CLASSROOMS'),node('h2',{},P.BUILDINGS[building]),note('正在讀取今天的班級…'));
    try{
      if(ctx.building?.()===building&&network().snapshot().ready&&!current()?.rooms[building])await network().enter(building);
      const rows=await network().classes(building),w=current(),own=w?.rooms[building];
      openModal(node('p',{class:'eyebrow'},'TODAY’S CLASSROOMS'),node('h2',{},P.BUILDINGS[building]+' · 今日班級'),summary(),note('今日班級固定：同科目當天離開再回來、重新登入或換裝置，都會回到原班，不會重新分班。每班最多 50 人，不同棟樓各自計算。'),
        node('div',{class:'class-list'},rows.length?rows.map(room=>node('article',{class:'class-card'+(room.id===own?' my-class':'')},node('div',{},node('h3',{},'第 '+room.number+' 班'+(room.id===own?' · 你的班級':'')),note(room.members.length+' / 50 人'+(room.activeBomb?' · 金幣結算中':''))),node('div',{class:'class-actions'},btn('查看同學',()=>roster(room),'secondary small'),room.id===own?btn('進入教室',()=>{if(ctx.building?.()!==building){toast('請先走進'+P.BUILDINGS[building]+'，再進入教室。');return;}closeModal();ctx.openClass?.(building,room);},'small gold'):null,room.activeBomb?btn('繼續結算',()=>run(()=>network().resumeBomb(room.activeBomb),'班級結算已完成。',()=>classes(building)),'small secondary'):btn('使用炸彈券',()=>bomb(room),'small secondary',locked()||!w?.stock.bomb||!P.eligible(w)||!own)))):note('今天還沒有人進入這棟樓。')),
        btn('選擇其他樓',()=>classes(null),'secondary small'),note('炸彈券只結算啟用當下的名單。每位其他同學當日已入帳收入的 20%（整數無條件捨去）轉給使用者；餘額不足記為欠款。自己在名單內不會額外產生金幣。'));
    }catch(e){openModal(node('h2',{},'班級暫時無法讀取'),note(e.message),btn('重新整理',()=>classes(building),'secondary'));}
  }
  async function roster(room){openModal(node('h2',{},'第 '+room.number+' 班 · 同學名單'),note('正在讀取…'));try{const students=await Promise.all(room.members.map(async key=>({key,w:await network().player(key)})));openModal(node('h2',{},P.BUILDINGS[room.building]+' · 第 '+room.number+' 班'),node('div',{class:'class-roster'},students.map(({key,w})=>node('div',{class:'classmate'},node('strong',{},w?.name||'學院同學'),key===getState().rpg.socialId?node('small',{},'你'):btn('互動券',()=>target(key,w?.name),'small secondary',locked())))),btn('返回班級列表',()=>classes(room.building),'secondary'));}catch(e){toast(e.message);}}
  function bomb(room){openModal(node('div',{class:'coupon-mark coupon-bomb'},'✹'),node('h2',{},'對第 '+room.number+' 班使用炸彈券'),note(P.BUILDINGS[room.building]+' · 目前 '+room.members.length+' 位當日成員。系統會以啟用瞬間的名單與已入帳收入結算，每人 20% 歸你。'),note('不足的餘額會成為對方欠款，由之後的遊戲收入償還。這次消耗 1 張炸彈券；使用時再次檢查六次反霸凌券與低於 70% 的條件。'),btn('確認使用 1 張炸彈券',()=>run(()=>network().bomb(room.id),'炸彈券已啟用，正在逐人結算。',()=>classes(room.building)),'gold',locked()));}
  function brief(building){const w=current();return w?.rooms[building]?'第 '+w.rooms[building].split('_').pop()+' 班':'';}
  return {shop,summary,targetButton,target,classes,counter,brief,run};
};
