window.MindRankingsCloud=function(ctx){
  'use strict';
  const R=window.MindRankings,P=window.MindEconomy,C=window.MindCombat;
  let owner=null,published='',submitting=false,loading=false,retryAt=0,generation=0;
  let state={week:R.week(),rows:[],leaders:R.leaders([]),count:0,progress:0,finished:false,loaded:false,message:'',claim:null};
  const doc=(sdk,collection,id)=>sdk.db.doc(sdk.d,collection,String(id)),data=s=>s.exists()?s.data():null;
  const snapshot=()=>({...state,loading,submitting,ready:!!ctx.account()?.snapshot().uid});
  const changed=()=>ctx.changed?.();
  function fingerprint(save,uid){return [uid,save.arena.week.id,C.score(save.arena),save.profile.name].join('|');}
  async function submit(){
    const a=ctx.account().snapshot(),local=ctx.getState(),uid=a.uid;
    if(!uid||a.locked||a.wishing||a.syncing||a.phase!=='synced'||!navigator.onLine||submitting||!local.arena.economy?.key)return;
    const mark=fingerprint(local,uid);if(mark===published||C.score(local.arena)<1)return;
    submitting=true;const token=generation;
    try{
      const sdk=await ctx.account().services();
      const result=await sdk.db.runTransaction(sdk.d,async tx=>{
        const player=data(await tx.get(doc(sdk,'players',uid)));if(!player?.economy?.key)return null;
        const save=JSON.parse(player.payload),season=R.week(),key=player.economy.key,points=C.score(save.arena);
        if(save.arena.week.id!==R.date(season)||!P.integer(points,1550*(P.day()-season+1))||points<1)return null;
        const [metaSnap,mapSnap]=await Promise.all([tx.get(doc(sdk,'rankWeeks',season)),tx.get(doc(sdk,'rankEntries',season+'_'+key))]);
        const meta=data(metaSnap),mapping=data(mapSnap),slot=mapping?.slot||(meta?.count||0)+1;
        const ref=doc(sdk,'rankSlots',season+'_'+slot),before=mapping?data(await tx.get(ref)):null;
        if(mapping&&!before)throw Error('週榜名單尚未完成，請重新讀取。');
        if(!mapping&&slot>1000000)throw Error('本週名單已達容量上限。');
        const next={schema:1,week:season,slot,key,name:save.profile.name,points:Math.max(points,before?.points||0),achievedAt:before&&points<=before.points?before.achievedAt:sdk.db.serverTimestamp(),updatedAt:sdk.db.serverTimestamp()};
        if(!mapping){tx.set(doc(sdk,'rankWeeks',season),{schema:1,week:season,count:slot,updatedAt:sdk.db.serverTimestamp()});tx.set(doc(sdk,'rankEntries',season+'_'+key),{week:season,key,slot});}
        if(!before||next.points!==before.points||next.name!==before.name)tx.set(ref,next);
        return {mark:fingerprint(save,uid)};
      });
      if(token===generation&&result)published=result.mark;
    }catch(e){if(token===generation){retryAt=Date.now()+15000;state.message='週榜成績尚未同步：'+e.message;}}
    finally{if(token===generation){submitting=false;changed();}}
  }
  function observe(){
    const a=ctx.account()?.snapshot();if(!a)return;
    if(owner!==a.uid){generation++;owner=a.uid;published='';submitting=false;loading=false;retryAt=0;state={week:R.week(),rows:[],leaders:R.leaders([]),count:0,progress:0,finished:false,loaded:false,message:'',claim:null};}
    if(Date.now()>=retryAt)submit();
  }
  async function finish(sdk,season,token){
    for(;;){
      if(token!==generation)throw Error('帳號已切換，請重新讀取。');
      const final=await sdk.db.runTransaction(sdk.d,async tx=>{
        const [ms,fs]=await Promise.all([tx.get(doc(sdk,'rankWeeks',season)),tx.get(doc(sdk,'rankFinals',season))]);
        const meta=data(ms),before=data(fs);if(!meta)return null;if(before?.finished)return before;
        const cursor=before?.cursor||0,length=Math.min(R.BATCH,meta.count-cursor);
        const snaps=await Promise.all(Array.from({length},(_,i)=>tx.get(doc(sdk,'rankSlots',season+'_'+(cursor+i+1)))));
        const rows=snaps.map(data);if(rows.some(r=>!r))throw Error('週榜名單不完整，無法略過任何玩家。');
        const next=R.finalize(before,rows,meta.count,season);tx.set(doc(sdk,'rankFinals',season),{...next,updatedAt:sdk.db.serverTimestamp()});return {...next,count:meta.count};
      });
      if(!final||final.finished)return final;
      state.progress=final.cursor;state.count=final.count;changed();
    }
  }
  async function load(season=R.week()){
    if(loading)return;if(!R.validWeek(season)||season>R.week())throw Error('週榜期間不正確。');
    const a=ctx.account().snapshot();if(!a.uid||!navigator.onLine){state.message='Google 登入並連線後可查看全服週榜。';changed();return;}
    loading=true;const token=generation;state={week:season,rows:[],leaders:R.leaders([]),count:0,progress:0,finished:false,loaded:false,message:'',claim:null};changed();
    try{
      await submit();const sdk=await ctx.account().services(),meta=data(await sdk.db.getDocFromServer(doc(sdk,'rankWeeks',season)));
      if(token!==generation)return;if(!meta){state.finished=season<R.week();state.loaded=true;return;}
      state.count=meta.count;
      if(season<R.week()){
        const final=await finish(sdk,season,token);if(token!==generation)return;
        state.leaders=final?.leaders||R.leaders([]);state.finished=!!final?.finished;state.progress=meta.count;
        const key=ctx.getState().arena.economy?.key;if(key)state.claim=data(await sdk.db.getDocFromServer(doc(sdk,'rankClaims',season+'_'+key)));
      }else{
        const rows=[];
        for(let start=1;start<=meta.count;start+=20){
          const snaps=await Promise.all(Array.from({length:Math.min(20,meta.count-start+1)},(_,i)=>sdk.db.getDocFromServer(doc(sdk,'rankSlots',season+'_'+(start+i)))));
          if(token!==generation)return;
          rows.push(...snaps.map(data).filter(Boolean).map(R.candidate));state.progress=rows.length;changed();
        }
        state.rows=rows.sort((a,b)=>R.better(a,b)?-1:R.better(b,a)?1:0);state.leaders=R.leaders(rows);
      }
      state.loaded=true;
    }catch(e){if(token===generation)state.message='週榜暫時無法完成：'+e.message;}
    finally{if(token===generation){loading=false;changed();}}
  }
  return {snapshot,observe,submit,load};
};
