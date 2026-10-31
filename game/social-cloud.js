window.MindEconomyCloud=function(ctx){
  'use strict';
  const P=window.MindEconomy,account=ctx.account;
  let uid=null,key='',wallet=null,stop=null,starting=false,working=false,draining=false,lastError='',generation=0,retryAt=0,retryTimer=null;
  const doc=(sdk,collection,id)=>sdk.db.doc(sdk.d,collection,String(id));
  const snapshot=()=>({key,wallet:wallet&&P.copy(wallet),ready:!!key&&!!wallet,working,starting,message:lastError});
  const changed=()=>ctx.changed?.(snapshot());
  function data(s){return s.exists()?s.data():null;}
  function pendingKey(id){return 'mind-quest-social-operation:'+id;}
  function pending(id){try{const x=JSON.parse(localStorage.getItem(pendingKey(id))||'null');if(x&&(!/^[a-f0-9]{32}$/.test(x.id)||typeof x.kind!=='string'||!x.args))throw Error();return x;}catch(_){throw Error('待確認的券使用紀錄損壞，請保留瀏覽器資料。');}}
  function fields(current,save,revision,economy,sdk){return {schema:1,revision,payload:JSON.stringify(save),coins:save.arena.coins,modifiedAt:Date.now(),updatedAt:sdk.db.serverTimestamp(),...(current.fountain?{fountain:current.fountain}:{}),economy};}
  function writeWallet(tx,sdk,k,w,op){const next={...w,revision:w.revision+1,operationId:op,updatedAt:sdk.db.serverTimestamp()};tx.set(doc(sdk,'money',k),next);return next;}
  function watchBlocked(w,k,watch){return Object.values(w.rooms).some(room=>watch?.active?.[room]?.members?.includes(k));}
  async function readWallet(tx,sdk,current){
    const k=current?.economy?.key;if(!k)return null;
    const raw=data(await tx.get(doc(sdk,'money',k)));if(!raw)throw Error('找不到金幣帳本，請重新同步。');
    const w=P.validate(raw),watch=data(await tx.get(doc(sdk,'bombWatch',w.day)));
    if(watchBlocked(w,k,watch)){const e=Error('班級正在結算金幣，請稍候再試。');e.code='economy-frozen';throw e;}
    return {key:k,wallet:w,watch,rolled:P.roll(w)};
  }
  async function prepareSave(tx,{sdk,uid:owner,current,save,operationId}){
    const context=await readWallet(tx,sdk,current);if(!context)return {save};
    const {key:k,wallet:before,rolled}=context,result=P.replay(rolled,save.arena.economy?.pending||[]);
    result.wallet.name=save.profile.name;
    const changedWallet=JSON.stringify(result.wallet)!==JSON.stringify(before),w=changedWallet?{...result.wallet,revision:before.revision+1,operationId}:before;
    const next=P.project(save,k,w,[]);
    return {save:next,economy:{key:k,revision:w.revision},wallet:w,commit(){if(!changedWallet)return;tx.set(doc(sdk,'money',k),{...w,updatedAt:sdk.db.serverTimestamp()});tx.set(doc(sdk,'economyOps',operationId),{schema:1,kind:'income',actor:k,day:w.day,amount:result.amount,debit:0,devices:Object.keys(w.cursors).filter(k=>w.cursors[k]!==before.cursors[k]),sequence:w.revision,createdAt:sdk.db.serverTimestamp()});}};
  }
  async function readWish(tx,args){return readWallet(tx,args.sdk,args.current);}
  function writeWish(tx,{sdk,current,save,operationId,context}){
    if(!context)return {save};const before=context.wallet,w={...context.rolled,coins:save.arena.coins};
    // Fountain payouts are transfers, not knowledge income; debt and daily earned
    // totals are intentionally unchanged here.
    const next=writeWallet(tx,sdk,context.key,w,operationId);
    return {save:P.project(save,context.key,next,[]),economy:{key:context.key,revision:next.revision}};
  }
  async function register(){
    return account().transact(async({sdk,uid:owner,ref,unpack})=>sdk.db.runTransaction(sdk.d,async tx=>{
      const [ps,as]=await Promise.all([tx.get(ref),tx.get(doc(sdk,'economyAccounts',owner))]),current=unpack(ps),binding=data(as);
      if(!current)throw Error('請先保存遊戲進度。');
      if(binding){const w=data(await tx.get(doc(sdk,'money',binding.key)));if(!w)throw Error('金幣帳本尚未完成。');return {save:P.project(current.save,binding.key,P.validate(w),current.save.arena.economy?.pending||[]),revision:current.revision,modifiedAt:current.modifiedAt};}
      let k=current.save.rpg.socialId;if(!P.validKey(k))k=P.id();
      if((await tx.get(doc(sdk,'money',k))).exists()){k=P.id();if((await tx.get(doc(sdk,'money',k))).exists())throw Error('角色識別碼衝突，請重新同步。');}
      const w=P.freshWallet(current.save.arena.coins,current.save.profile.name);w.revision=1;
      const next=P.project(current.save,k,w,[]),revision=current.revision+1,record=fields(current,next,revision,{key:k,revision:1},sdk);
      tx.set(doc(sdk,'economyAccounts',owner),{schema:1,key:k});tx.set(doc(sdk,'economyKeys',k),{uid:owner});tx.set(doc(sdk,'money',k),{...w,updatedAt:sdk.db.serverTimestamp()});tx.set(ref,record);
      return {save:next,revision,modifiedAt:record.modifiedAt};
    }));
  }
  async function observe(){
    const a=account()?.snapshot();if(!a)return;
    if(uid!==a.uid){generation++;clearTimeout(retryTimer);stop?.();stop=null;uid=a.uid;key='';wallet=null;starting=false;lastError='';retryAt=0;}
    if(!uid||a.locked||a.wishing||a.syncing)return;
    if(key&&wallet){account().rebaseEconomy?.(key,wallet);return;}
    if(starting||Date.now()<retryAt||!['synced','pending'].includes(a.phase))return;
    starting=true;const token=generation;changed();
    try{
      await recover();const r=await register();if(token!==generation)return;
      key=r.save.arena.economy.key;wallet=r.save.arena.economy.wallet;
      const sdk=await account().services();stop=sdk.db.onSnapshot(doc(sdk,'money',key),s=>{
        if(token!==generation||!s.exists())return;try{wallet=P.validate(s.data());lastError='';account().rebaseEconomy?.(key,wallet);changed();}catch(e){lastError=e.message;changed();}
      },e=>{lastError='多人金幣帳本暫時無法同步。';changed();});
    }catch(e){lastError=e.message;retryAt=Date.now()+15000;clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(token===generation)observe();},15050);}finally{if(token===generation){starting=false;changed();}}
  }
  async function recover(){
    if(draining||!account()?.snapshot().uid)return;draining=true;
    try{
      const sdk=await account().services(),owner=account().snapshot().uid,binding=data(await sdk.db.getDocFromServer(doc(sdk,'economyAccounts',owner)));if(!binding)return;
      const w=data(await sdk.db.getDocFromServer(doc(sdk,'money',binding.key)));if(!w)return;
      const watch=data(await sdk.db.getDocFromServer(doc(sdk,'bombWatch',w.day)));
      for(const room of Object.values(w.rooms)){const active=watch?.active?.[room];if(active?.members?.includes(binding.key))await settle(active.operationId,binding.key,sdk);}
    }finally{draining=false;}
  }
  async function perform(kind,args={}){
    if(working)throw Error('上一個操作仍在處理中。');working=true;lastError='';changed();let intent,owner;
    try{
      await recover();
      const result=await account().transact(async({sdk,uid:who,ref,unpack})=>{
        owner=who;intent=pending(owner)||{id:P.id(),kind,args};localStorage.setItem(pendingKey(owner),JSON.stringify(intent));
        return sdk.db.runTransaction(sdk.d,async tx=>{
          const [ps,rs]=await Promise.all([tx.get(ref),tx.get(doc(sdk,'economyOps',intent.id))]),current=unpack(ps);
          if(!current?.economy)throw Error('多人帳本正在準備，請稍後再試。');
          const c=await readWallet(tx,sdk,current),k=c.key;
          if(rs.exists())return {save:P.project(current.save,k,c.wallet,[]),revision:current.revision,modifiedAt:current.modifiedAt,receipt:rs.data(),recovered:true};
          let w=c.rolled,save=P.project(current.save,k,w,[]),extra={},writes=[];
          try{
            if(intent.kind==='buy'){w=P.purchase(w,intent.args.kind);extra.item=intent.args.kind;}
            else if(intent.kind==='counter'){w=P.counter(w);}
            else if(intent.kind==='honor'){w=P.useHonor(w,intent.args.region);extra.region=intent.args.region;}
            else if(intent.kind==='crown'){
              const R=window.MindRankings,season=intent.args.week,region=intent.args.region;
              if(!R?.validWeek(season)||season+7>P.day()||!P.REGIONS[region])throw Error('冠軍獎勵期間不正確。');
              const claimId=season+'_'+k;
              const [fs,cs]=await Promise.all([tx.get(doc(sdk,'rankFinals',season)),tx.get(doc(sdk,'rankClaims',claimId))]);
              if(cs.exists())throw Error('這一週的冠軍獎勵已領取。');
              const final=data(fs),tier=final?.finished?Object.keys(R.TIERS).find(t=>final.leaders[t]?.key===k):null;
              if(!tier)throw Error('全服週榜尚未結算完成，或你不是該週的組別冠軍。');
              w=P.crown(w,{region,tier,week:season});extra={week:season,region,tier};
              writes.push(()=>tx.set(doc(sdk,'rankClaims',claimId),{schema:1,week:season,key:k,tier,region,day:w.day,operationId:intent.id,createdAt:sdk.db.serverTimestamp()}));
            }
            else if(intent.kind==='bully'){
              const target=intent.args.target;if(!P.validKey(target)||target===k)throw Error('請選擇其他玩家。');
              const pairId=w.day+'_'+k+'_'+target;
              const [ts,pairSnap]=await Promise.all([tx.get(doc(sdk,'money',target)),tx.get(doc(sdk,'bullyPairs',pairId))]);
              if(!ts.exists())throw Error('對方尚未完成 Google 帳號同步。');
              const raw=P.validate(ts.data()),tw=data(await tx.get(doc(sdk,'bombWatch',raw.day)));
              if(watchBlocked(raw,target,tw))throw Error('對方的班級正在結算，請稍後再試。');
              const planned=P.bully(w,P.roll(raw),{actorKey:k,targetKey:target,used:data(pairSnap)?.used||0});
              w=planned.actor;extra={target,step:planned.step,pair:pairId};
              writes.push(()=>writeWallet(tx,sdk,target,planned.target,intent.id),()=>tx.set(doc(sdk,'bullyPairs',pairId),{day:w.day,actor:k,target,used:planned.used,operationId:intent.id}));
            }else if(intent.kind==='enroll'){
              const building=intent.args.building;if(!P.BUILDINGS[building])throw Error('這棟樓沒有分班。');
              const group=w.day+'_'+building,memberId=group+'_'+k;
              const [gs,ms]=await Promise.all([tx.get(doc(sdk,'classDays',group)),tx.get(doc(sdk,'classMembers',memberId))]);
              const member=data(ms),groupData=data(gs)||{day:w.day,building,count:0};
              const number=member?.number||P.enrollment(groupData.count).number,roomId=group+'_'+number;
              const roomSnap=await tx.get(doc(sdk,'classRooms',roomId)),room=data(roomSnap)||{day:w.day,building,number,members:[],activeBomb:null};
              w.rooms[building]=roomId;extra={building,group,room:roomId,member:memberId,number,newMember:!member};
              if(!member){if(room.members.length>=50)throw Error('班級剛額滿，請重試。');writes.push(()=>tx.set(doc(sdk,'classDays',group),{...groupData,count:groupData.count+1,operationId:intent.id}),()=>tx.set(doc(sdk,'classRooms',roomId),{...room,members:[...room.members,k],operationId:intent.id}),()=>tx.set(doc(sdk,'classMembers',memberId),{day:w.day,building,number,key:k,room:roomId,operationId:intent.id}));}
            }else if(intent.kind==='bomb'){
              const roomId=intent.args.room;if(typeof roomId!=='string'||!/^[0-9]+_(pharmaceutics|pharmacology|herbal|battle)_[0-9]+$/.test(roomId))throw Error('班級不正確。');
              const [roomSnap,watchSnap]=await Promise.all([tx.get(doc(sdk,'classRooms',roomId)),tx.get(doc(sdk,'bombWatch',w.day))]);
              const room=data(roomSnap),watch=data(watchSnap)||{day:w.day,active:{}};
              if(!room||room.day!==w.day||!w.rooms[room.building])throw Error('請先進入該棟樓的今日班級。');
              if(room.activeBomb||watch.active[roomId])throw Error('這個班級正在結算上一張炸彈券。');
              w=P.activateBomb(w);extra={room:roomId,building:room.building,members:room.members};
              writes.push(()=>tx.set(doc(sdk,'classRooms',roomId),{...room,activeBomb:intent.id,operationId:intent.id}),()=>tx.set(doc(sdk,'bombWatch',w.day),{...watch,active:{...watch.active,[roomId]:{operationId:intent.id,members:room.members}},operationId:intent.id}),()=>tx.set(doc(sdk,'bombs',intent.id),{schema:1,day:w.day,actor:k,room:roomId,members:room.members,settled:0,total:0,done:false,operationId:intent.id,createdAt:sdk.db.serverTimestamp()}));
            }else if(intent.kind==='game'){
              const R=window.MindAdventure,C=window.MindCombat,action=intent.args.action,param=intent.args.param;
              const operations={'gear-buy':()=>R.buy(save,param),'gear-sell':()=>R.sell(save,param),'bag-expand':()=>R.expand(save),'supplies':()=>C.buy(save,param),'quest':()=>R.claimQuest(save)};
              if(!operations[action]||!operations[action]())throw Error('目前無法完成，請確認金幣、背包空間或任務條件。');
              const income=P.replay(w,save.arena.economy.pending),debit=w.coins+income.cash-save.arena.coins;
              if(!P.integer(debit)||income.wallet.coins<debit)throw Error('金幣餘額已更新，請重新選擇。');
              w=income.wallet;w.coins-=debit;extra={amount:income.amount,debit,action,param:param??null,devices:Object.keys(w.cursors).filter(device=>w.cursors[device]!==c.wallet.cursors[device])};
            }else throw Error('不支援這個操作。');
          }catch(e){if(!e.code)e.code='game-rule';throw e;}
          const next=writeWallet(tx,sdk,k,w,intent.id),revision=current.revision+1;save=P.project(save,k,next,[]);
          const receipt={schema:1,kind:intent.kind,actor:k,day:w.day,sequence:next.revision,...extra,createdAt:sdk.db.serverTimestamp()},record=fields(current,save,revision,{key:k,revision:next.revision},sdk);
          writes.forEach(write=>write());tx.set(doc(sdk,'economyOps',intent.id),receipt);tx.set(ref,record);
          return {save,revision,modifiedAt:record.modifiedAt,receipt,recovered:false};
        });
      });
      localStorage.removeItem(pendingKey(owner));wallet=result.save.arena.economy.wallet;key=result.save.arena.economy.key;
      if(result.receipt.kind==='bomb')resumeBomb(intent.id).catch(e=>{lastError=e.message;changed();});
      return {...result,previous:intent.kind!==kind||JSON.stringify(intent.args)!==JSON.stringify(args)};
    }catch(e){if(owner&&['game-rule','permission-denied'].includes(e.code))localStorage.removeItem(pendingKey(owner));lastError=e.message;throw e;}
    finally{working=false;changed();}
  }
  async function settle(bombId,target,sdk){
    if(!/^[a-f0-9]{32}$/.test(bombId)||!P.validKey(target))throw Error('結算識別碼不正確。');
    const operationId='b'+bombId+'_'+target;
    return sdk.db.runTransaction(sdk.d,async tx=>{
      const [bs,rs]=await Promise.all([tx.get(doc(sdk,'bombs',bombId)),tx.get(doc(sdk,'economyOps',operationId))]);
      if(rs.exists())return rs.data();const bomb=data(bs);if(!bomb||!bomb.members.includes(target))throw Error('玩家不在這次結算名單。');
      const [as,ts,ws,cs]=await Promise.all([tx.get(doc(sdk,'money',bomb.actor)),tx.get(doc(sdk,'money',target)),tx.get(doc(sdk,'bombWatch',bomb.day)),tx.get(doc(sdk,'classRooms',bomb.room))]);
      const actor=P.validate(data(as)),victim=P.validate(data(ts)),watch=data(ws),room=data(cs);
      if(victim.day!==bomb.day||!watch?.active?.[bomb.room]?.members.includes(target)||room?.activeBomb!==bombId)throw Error('班級結算狀態不一致，請稍後重新同步。');
      const planned=P.settleBomb(actor,victim,bomb.actor===target),remaining=watch.active[bomb.room].members.filter(k=>k!==target),active={...watch.active};
      if(remaining.length)active[bomb.room]={operationId:bombId,members:remaining};else delete active[bomb.room];
      const receipt={schema:1,kind:'settle',actor:bomb.actor,target,bomb:bombId,room:bomb.room,day:bomb.day,amount:planned.amount,cash:planned.cash,debt:planned.debt,createdAt:sdk.db.serverTimestamp()};
      if(target!==bomb.actor){writeWallet(tx,sdk,target,planned.target,operationId);writeWallet(tx,sdk,bomb.actor,planned.actor,operationId);}
      tx.set(doc(sdk,'economyOps',operationId),receipt);tx.set(doc(sdk,'bombWatch',bomb.day),{...watch,active,operationId});
      tx.set(doc(sdk,'bombs',bombId),{...bomb,settled:bomb.settled+1,total:bomb.total+planned.amount,done:remaining.length===0,operationId});
      if(!remaining.length)tx.set(doc(sdk,'classRooms',bomb.room),{...room,activeBomb:null,operationId});
      return receipt;
    });
  }
  async function resumeBomb(bombId){const sdk=await account().services(),bomb=data(await sdk.db.getDocFromServer(doc(sdk,'bombs',bombId)));if(!bomb||bomb.done)return bomb;for(const target of bomb.members){await settle(bombId,target,sdk);ctx.progress?.();}return data(await sdk.db.getDocFromServer(doc(sdk,'bombs',bombId)));}
  async function classes(building){if(!P.BUILDINGS[building])return [];const sdk=await account().services(),group=P.day()+'_'+building,g=data(await sdk.db.getDocFromServer(doc(sdk,'classDays',group)));if(!g)return [];const rows=[];for(let n=1;n<=Math.ceil(g.count/50);n++){const roomId=group+'_'+n,r=data(await sdk.db.getDocFromServer(doc(sdk,'classRooms',roomId)));if(r)rows.push({...r,id:roomId});}return rows;}
  async function player(k){if(!P.validKey(k))return null;const sdk=await account().services(),s=await sdk.db.getDocFromServer(doc(sdk,'money',k));return s.exists()?P.validate(s.data()):null;}
  return {snapshot,observe,recover,prepareSave,readWish,writeWish,perform,classes,player,resumeBomb,settle,
    buy:kind=>perform('buy',{kind}),honor:region=>perform('honor',{region}),crown:(week,region)=>perform('crown',{week,region}),counter:()=>perform('counter'),bully:target=>perform('bully',{target}),bomb:room=>perform('bomb',{room}),mutate:(action,param)=>perform('game',{action,param:param??null}),
    enter:building=>!P.BUILDINGS[building]||!key||wallet?.day===P.day()&&wallet.rooms[building]?Promise.resolve():perform('enroll',{building})};
};
