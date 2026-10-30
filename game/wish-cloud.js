window.MindWishCloud=function(ctx){
  'use strict';
  const W=window.MindWish,account=ctx.account;let status={phase:'loading',pool:null,message:'正在連接共同獎池…'},stop=null,starting=false;
  const snapshot=()=>({...status});
  function update(next){status=next;ctx.changed?.(snapshot());}
  async function watch(){
    if(stop||starting)return;starting=true;
    if(location.protocol==='file:'||!navigator.onLine){starting=false;update({phase:'offline',pool:null,message:'共同獎池需要網站版與網路連線'});return;}
    try{const sdk=await account().services();stop=sdk.db.onSnapshot(sdk.db.doc(sdk.d,'fountains','central'),snap=>{try{update({phase:'ready',pool:W.pool(snap.exists()?snap.data():null),message:'全體玩家共用 · 即時更新'});}catch(e){update({phase:'error',pool:null,message:e.message});}},()=>update({phase:'error',pool:null,message:'共同獎池暫時無法連線，稍後可重試。'}));}catch(_){update({phase:'error',pool:null,message:'共同獎池暫時無法連線，稍後可重試。'});}finally{starting=false;}
  }
  async function retry(){stop?.();stop=null;await watch();}
  async function draw(){
    const result=await account().transact(async({sdk,uid,ref,unpack})=>{
      const key='mind-quest-wish-operation:'+uid;let intent;
      try{intent=JSON.parse(localStorage.getItem(key)||'null');}catch(_){throw Error('待確認的許願紀錄損壞，請保留瀏覽器資料並聯絡維護者。');}
      if(!intent){intent={id:W.newOperation(window.crypto),ticket:W.randomTicket(window.crypto)};localStorage.setItem(key,JSON.stringify(intent));}
      if(!W.operationId(intent.id)||!Number.isInteger(intent.ticket)||intent.ticket<0||intent.ticket>=W.TICKETS)throw Error('待確認的許願紀錄不正確。');
      const poolRef=sdk.db.doc(sdk.d,'fountains','central'),receiptRef=sdk.db.doc(sdk.d,'players',uid,'wishes',intent.id);
      const settled=await sdk.db.runTransaction(sdk.d,async tx=>{
        // Read every document before writing; callback retries keep the same operation and ticket.
        const [playerSnap,poolSnap,receiptSnap]=await Promise.all([tx.get(ref),tx.get(poolRef),tx.get(receiptRef)]),current=unpack(playerSnap);
        if(!current)throw Error('請先同步遊戲進度，再來許願。');
        const economyContext=ctx.economy?await ctx.economy().readWish(tx,{sdk,current}):null;
        const baseSave=economyContext?window.MindEconomy.project(current.save,economyContext.key,economyContext.rolled,[]):current.save;
        if(receiptSnap.exists())return {save:baseSave,revision:current.revision,modifiedAt:current.modifiedAt,receipt:receiptSnap.data(),recovered:true};
        const planned=W.plan(baseSave,poolSnap.exists()?poolSnap.data():null,intent.ticket,intent.id),now=Date.now(),revision=current.revision+1,sequence=(current.fountain?.sequence||0)+1;
        const receipt={...planned.receipt,sequence,playerRevision:revision,updatedAt:sdk.db.serverTimestamp()};
        const integrated=ctx.economy?ctx.economy().writeWish(tx,{sdk,current,save:planned.save,operationId:intent.id,context:economyContext}):{save:planned.save};
        planned.save=integrated.save;
        tx.set(ref,{schema:1,revision,...(integrated.economy?{economy:integrated.economy}:{}),payload:JSON.stringify(planned.save),coins:planned.save.arena.coins,modifiedAt:now,updatedAt:sdk.db.serverTimestamp(),fountain:{sequence,operationId:intent.id,at:sdk.db.serverTimestamp()}});
        tx.set(poolRef,{...planned.pool,updatedAt:sdk.db.serverTimestamp()});
        tx.set(receiptRef,receipt);
        return {save:planned.save,revision,modifiedAt:now,receipt,recovered:false};
      });
      return {...settled,intentKey:key};
    });
    // Clear only after both the server transaction and local account cache have succeeded.
    localStorage.removeItem(result.intentKey);return result;
  }
  window.addEventListener('online',retry);
  return {snapshot,watch,retry,draw};
};
