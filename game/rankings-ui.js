window.MindRankingsUI=function(ctx){
  'use strict';
  const {node,btn,note,title,go,getState,network,economy,account,openModal,closeModal,toast}=ctx;
  const R=window.MindRankings,P=window.MindEconomy;
  const names={diamond:'鑽石',gold:'金',silver:'銀',bronze:'銅'},marks={diamond:'◇',gold:'♜',silver:'✧',bronze:'♧'};
  const fmt=n=>Number(n||0).toLocaleString('zh-TW');
  let chosen=R.week();
  function open(){chosen=R.week();go('rankings');network().load(chosen);}
  function select(week){if(network().snapshot().loading)return;chosen=week;network().load(week);}
  function claim(week,tier){
    const w=getState().arena.economy?.wallet,rate=P.CROWN_BONUS[tier],active=P.activeHonor(w,P.day());
    openModal(node('p',{class:'eyebrow'},'WEEKLY CHAMPION'),node('h2',{},names[tier]+'組週冠軍 · 選擇你的地區'),
      note('領取後顯示「某地區最聰明」，遊戲收入加成 '+rate+'%，從今天起算 21 天，至 '+R.date(P.day()+20)+' 23:59（臺灣時間）。'),
      note('四個地區只有稱號不同。與商城地區券不疊加；同級再次領獎會重新起算 21 天。'),
      active?.bonus>rate?note('你正在享有更高的冠軍加成；這份獎勵會保留，可等目前稱號到期後再領。'):null,
      node('div',{class:'region-choices'},Object.entries(P.REGIONS).map(([region,label])=>btn(label+'最聰明',async()=>{
        try{const result=await economy().crown(week,region);closeModal();toast(result?.previous?'已先完成上次待確認的操作，請再領取這份獎勵。':'已領取'+label+'最聰明，享有 '+rate+'% 加成。');await network().load(week);}
        catch(e){toast(e.message||'領取未完成，請稍後再試。');}
      },'secondary',account().snapshot().wishing||active?.bonus>rate))));
  }
  function page(){
    const s=network().snapshot(),uid=account().snapshot().uid,key=getState().arena.economy?.key,closed=chosen<R.week(),busy=s.loading;
    const picker=node('input',{type:'date',value:R.date(chosen),max:R.date(R.week()+6),disabled:busy,'aria-label':'選擇週榜日期',onChange:event=>{
      const day=Math.floor(Date.parse(event.target.value+'T00:00:00Z')/86400000);
      if(Number.isFinite(day)&&day<=R.week()+6)select(R.week(day));
    }});
    const active=P.activeHonor(getState().arena.economy?.wallet,P.day());
    return [title('全服週榜','同一週，四個段位，各有一位冠軍。'),
      node('section',{class:'rank-hero'},node('div',{},node('p',{class:'eyebrow'},'ACADEMY WEEKLY LEAGUE'),node('h2',{},closed?'讓努力，留下名字。':'這一週，你想走多遠？'),
        note('週一 00:00 至週日 23:59 · 臺灣時間'),
        node('div',{class:'rank-period'},node('strong',{},R.date(chosen)+' — '+R.date(chosen+6)),node('span',{class:'pill'},closed?'已結束的賽季':'本週進行中'))),
        node('div',{class:'rank-hero-stat'},node('strong',{},s.loaded?fmt(s.count):'—'),node('span',{},'位已登錄參賽者'))),
      node('div',{class:'rank-toolbar'},btn('本週',()=>select(R.week()),'secondary',busy),btn('上週',()=>select(R.week()-7),'secondary',busy),node('label',{},'選擇一週 ',picker),btn(busy?'讀取中…':'重新整理',()=>network().load(chosen),'secondary',busy||!uid)),
      active?node('div',{class:'honor-status '+active.kind},node('strong',{},active.title),node('span',{},'收入 +'+active.bonus+'% · 至 '+R.date(active.until-1)+' 23:59')):null,
      !uid?node('section',{class:'panel'},node('h3',{},'登入，讓你的努力上榜'),note('使用 Google 帳號同步本週積分後，自動加入全服週榜。'),btn('前往登入',()=>go('account'))):null,
      s.message?node('p',{class:'notice',role:'status'},s.message):null,
      busy?node('p',{class:'note',role:'status','aria-live':'polite'},closed?'正在完整核對參賽名單：'+fmt(s.progress)+' / '+fmt(s.count)+'。可稍後重開接續結算。':'正在讀取本週成績：'+fmt(s.progress)+' / '+fmt(s.count)):null,
      node('div',{class:'rank-crowns'},Object.keys(names).map(tier=>{
        const leader=s.leaders[tier],mine=leader?.key===key;
        return node('article',{class:'rank-crown '+tier},node('span',{class:'rank-insignia','aria-hidden':'true'},marks[tier]),node('small',{},names[tier]+'組 · '+({diamond:'3,600 分以上',gold:'1,800–3,599 分',silver:'600–1,799 分',bronze:'1–599 分'})[tier]),
          node('h3',{},leader?leader.name+(mine?' · 你':''):busy?'正在核對…':!uid?'登入後查看':s.loaded?'尚無參賽者':'等待讀取'),
          node('p',{class:'rank-points'},leader?fmt(leader.points)+' 分':'—'),
          node('p',{},'冠軍收入 +'+P.CROWN_BONUS[tier]+'%'),note('自選地區稱號 · 21 天'),
          closed&&s.finished&&mine?(s.claim?node('span',{class:'pill'},'✓ 已領取稱號'):btn('領取冠軍稱號',()=>claim(chosen,tier),'gold full',busy||!uid)):
          node('small',{},closed?(s.finished?(leader?'本週結算結果':'本組未產生冠軍'):'等待完整結算'):(leader?'目前領先 · 週末才能確定冠軍':'等待挑戰者')));
      })),
      !closed&&s.rows.length?node('section',{class:'panel rank-table-panel'},node('h3',{},'本週參賽名單'),node('div',{class:'rank-table-wrap'},node('table',{class:'rank-table'},node('thead',{},node('tr',{},['名次','玩家','段位','本週積分'].map(t=>node('th',{scope:'col'},t)))),node('tbody',{},s.rows.map((r,i)=>node('tr',{class:r.key===key?'rank-self':''},node('td',{},i+1),node('td',{},r.name+(r.key===key?' · 你':'')),node('td',{},names[R.tier(r.points)]),node('td',{},fmt(r.points)))))))):null,
      node('section',{class:'panel rank-rules'},node('h3',{},'冠軍怎麼決定？'),node('ol',{class:'rules'},
        node('li',{},'依週末最後積分分成鑽石、金、銀、銅四組，每組一位冠軍；沒有玩家的組別不發獎。'),
        node('li',{},'同分時，先同步到該積分的人優先；時間仍相同則依本週登錄順序。請在週日結束前連線同步，離線未上傳的積分不列入當週。'),
        node('li',{},'週末結束後，開啟該週榜單會接續核對完整名單。全部完成後，冠軍才可領取一次三週稱號。'),
        node('li',{},'商城地區券 +15% 與冠軍加成只取最高一種，不會累加；倍率只適用遊戲收入，不含許願獎金或玩家間轉移。')),
        note('目前為友善週賽：成績來自登入帳號的遊戲存檔，尚非由伺服器全程驗證答題的防作弊賽事。')),
      btn('前往積分試煉 →',()=>go('arena'),'secondary')];
  }
  return {page,open};
};
