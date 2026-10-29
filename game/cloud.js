window.MindCloud=function(ctx){
  'use strict';
  const {getState,setState,restore,fresh,changed,busy,warning}=ctx;
  const GUEST='mind-quest-save-v3',ACTIVE='mind-quest-account',PREFIX='mind-quest-player:',GUEST_TIME='mind-quest-guest-updated';
  let sdk=null,uid=null,label='',record=null,phase='guest',message='訪客 · 進度保存在此瀏覽器',timer=null,inflight=false,generation=0,candidate=null,booting=false,needsRead=false,lastSync='',candidateTime=0;
  const snapshot=()=>({uid,label,phase,message,lastSync,locked:booting||needsRead,ready:!!window.MIND_FIREBASE_CONFIG?.projectId});
  function status(p,m){phase=p;message=m;changed();}
  function parse(raw){const x=JSON.parse(raw);if(!x||x.version!==1||(x.base!==null&&(!Number.isSafeInteger(x.base)||x.base<0))||typeof x.dirty!=='boolean')throw Error('帳號快取格式不正確');return {...x,save:restore(x.save)};}
  function cache(){try{localStorage.setItem(PREFIX+uid,JSON.stringify(record));}catch(_){warning('此裝置無法保存帳號進度，請匯出備份。');}}
  function localSave(){
    if(booting||needsRead)return;
    if(!uid){const payload=JSON.stringify(getState());if(localStorage.getItem(GUEST)!==payload){localStorage.setItem(GUEST,payload);localStorage.setItem(GUEST_TIME,String(Date.now()));}return;}
    const copy=JSON.parse(JSON.stringify(getState()));
    if(record&&JSON.stringify(record.save)===JSON.stringify(copy))return;
    record={version:1,base:record?.base??null,dirty:true,modifiedAt:Date.now(),save:copy};cache();
    if(phase!=='connecting')status('pending',navigator.onLine?'本機已保存 · 等待雲端同步':'離線已保存 · 連線後同步');
    clearTimeout(timer);timer=setTimeout(sync,1500);
  }
  async function load(){
    if(sdk)return sdk;
    if(ctx.services){sdk=ctx.services;sdk.auth.onAuthStateChanged(sdk.a,user=>{attach(user).catch(fail);});return sdk;}
    if(!window.MIND_FIREBASE_CONFIG?.projectId)throw Error('Google 雲端服務尚未完成設定，目前可使用訪客與匯出備份。');
    if(location.protocol==='file:')throw Error('請在網站版使用 Google 登入；離線檔案可用訪客模式。');
    const [app,auth,db]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')]);
    const a=app.initializeApp(window.MIND_FIREBASE_CONFIG);sdk={auth,db,a:auth.getAuth(a),d:db.getFirestore(a)};
    sdk.auth.onAuthStateChanged(sdk.a,user=>{attach(user).catch(fail);});return sdk;
  }
  function fail(error){
    const map={'auth/popup-closed-by-user':'登入視窗已關閉。若沒有看到視窗，請用 Chrome、Edge 或 Safari 開啟遊戲再登入。','auth/popup-blocked':'瀏覽器擋住登入視窗，請允許本站彈出式視窗後重試。','auth/unauthorized-domain':'此網址尚未獲准 Google 登入，請使用正式遊戲網址。','auth/network-request-failed':'網路暫時無法連線；本機進度仍保留。','permission-denied':'雲端拒絕存取；本機進度仍保留，請稍後再試。'};
    status('error',map[error.code]||error.message||'雲端暫時無法連線；請保留本機備份。');
  }
  function docRef(){return sdk.db.doc(sdk.d,'players',uid);}
  function unpack(snap){
    if(!snap.exists())return null;
    const d=snap.data();if(d.schema!==1||!Number.isSafeInteger(d.revision)||d.revision<1||typeof d.payload!=='string'||d.payload.length>750000)throw Error('雲端存檔格式不相容，已保留本機進度。');
    return {revision:d.revision,modifiedAt:Number.isSafeInteger(d.modifiedAt)?d.modifiedAt:0,save:restore(JSON.parse(d.payload))};
  }
  function apply(save,revision,dirty=false,modifiedAt=0){record={version:1,base:revision,dirty,modifiedAt,save:restore(save)};needsRead=false;setState(restore(record.save));cache();}
  function backup(value){try{localStorage.setItem(PREFIX+uid+':recovery',JSON.stringify(value));}catch(_){warning('救援備份無法保存，請手動匯出目前存檔。');}}
  async function latest(snap){
    if(busy()){status('deferred','已保留最新存檔 · 對戰結束後接續');clearTimeout(timer);timer=setTimeout(sync,5000);return;}
    if(record.dirty&&(record.modifiedAt||0)>(snap?.modifiedAt||0)){
      if(snap)backup(snap.save);record.base=snap?.revision||0;cache();await push();
    }else{backup(record.save);apply(snap?snap.save:fresh(),snap?.revision||0,false,snap?.modifiedAt||0);status('synced','已自動接續最新進度 · 舊版已保留救援備份');}
  }
  async function attach(user){
    if(!user){if(uid){status('error','請重新 Google 登入以同步；本機旅程仍保留。');}return;}
    if(uid===user.uid&&record){label=user.email||'Google 玩家';await sync();return;}
    if(busy()){status('error','請先離開雙人連線，再切換 Google 帳號。');return;}
    const token=++generation;if(!candidate){candidate=restore(getState());candidateTime=uid?0:Number(localStorage.getItem(GUEST_TIME)||0);}uid=user.uid;label=user.email||'Google 玩家';
    localStorage.setItem(ACTIVE,uid);
    const stored=localStorage.getItem(PREFIX+uid);record=stored?parse(stored):null;
    needsRead=!record;
    if(record)setState(restore(record.save));
    status('connecting','正在讀取你的雲端旅程…');
    const snap=unpack(await sdk.db.getDocFromServer(docRef()));if(token!==generation)return;
    if(record){await reconcile(snap);return;}
    if(snap){apply(snap.save,snap.revision,false,snap.modifiedAt);candidate=null;status('synced','已接續此 Google 帳號的最新進度');}
    else{apply(window.MindJourney.hasProgress(candidate)?candidate:fresh(),0,true,candidateTime||Date.now());candidate=null;status('pending','已登入 · 正在保存旅程');await sync();}
  }
  async function reconcile(snap){
    const rev=snap?.revision||0;
    if(record.base!==rev){
      await latest(snap);return;
    }
    if(record.dirty)await push();else status('synced','雲端進度已同步');
  }
  async function push(){
    const token=generation,id=uid,base=record.base,payload=JSON.stringify(record.save),modifiedAt=record.modifiedAt||Date.now(),ref=docRef();
    if(payload.length>750000)throw Error('存檔太大，請匯出備份後聯絡維護者。');
    const revision=await sdk.db.runTransaction(sdk.d,async tx=>{
      const current=unpack(await tx.get(ref)),actual=current?.revision||0;
      if(actual!==base){const e=Error('雲端版本已更新');e.code='save-conflict';throw e;}
      tx.set(ref,{schema:1,revision:actual+1,payload,modifiedAt,updatedAt:sdk.db.serverTimestamp()});return actual+1;
    });
    if(token!==generation||id!==uid)return;
    record.base=revision;record.dirty=JSON.stringify(record.save)!==payload;cache();lastSync=new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
    status(record.dirty?'pending':'synced',record.dirty?'本機已保存 · 還有更新等待同步':'雲端已保存 · '+lastSync);
    if(record.dirty){clearTimeout(timer);timer=setTimeout(sync,1500);}
  }
  async function sync(){
    if(booting||!uid||!sdk?.a.currentUser||sdk.a.currentUser.uid!==uid||inflight)return;
    if(!navigator.onLine){status('offline','離線已保存 · 連線後同步');return;}
    if(needsRead){try{await attach(sdk.a.currentUser);}catch(e){fail(e);}return;}
    if(!record)return;
    inflight=true;
    try{await reconcile(unpack(await sdk.db.getDocFromServer(docRef())));}
    catch(e){if(e.code==='save-conflict'){try{await latest(unpack(await sdk.db.getDocFromServer(docRef())));}catch(err){fail(err);}}else fail(e);}
    finally{inflight=false;}
  }
  async function login(){
    if(busy())return warning('請先離開雙人連線，再登入帳號。');
    if(phase==='signing-in')return;
    status('signing-in','正在開啟 Google 登入視窗…');
    const hint=setTimeout(()=>{if(phase==='signing-in')status('signing-in','請在 Google 視窗完成登入；若沒有視窗，請用 Chrome、Edge 或 Safari 開啟遊戲。');},20000);
    try{const s=await load();const provider=new s.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await s.auth.signInWithPopup(s.a,provider);}catch(e){fail(e);}finally{clearTimeout(hint);}
  }
  async function logout(){
    if(busy())return warning('請先離開雙人連線，再登出。');
    clearTimeout(timer);++generation;
    if(sdk)await sdk.auth.signOut(sdk.a);
    uid=null;record=null;label='';candidate=null;needsRead=false;localStorage.removeItem(ACTIVE);
    const raw=localStorage.getItem(GUEST);setState(raw?restore(JSON.parse(raw)):fresh());status('guest','已登出 · 訪客進度保存在此瀏覽器');
  }
  function restoreCache(){
    const id=localStorage.getItem(ACTIVE);if(!id||!/^[-A-Za-z0-9_]{1,128}$/.test(id))return;
    const raw=localStorage.getItem(PREFIX+id);if(!raw)return;
    record=parse(raw);uid=id;setState(restore(record.save));phase='offline';message='帳號本機進度已載入 · 等待連線';
  }
  async function init(){try{booting=true;restoreCache();}catch(e){warning('帳號快取無法讀取，原始資料已保留，請勿清除瀏覽資料。');}finally{booting=false;}changed();if(uid&&navigator.onLine)try{await load();}catch(e){fail(e);}}
  window.addEventListener('online',()=>{if(uid&&!sdk)load().catch(fail);else sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  window.addEventListener('storage',event=>{
    if(event.key===ACTIVE&&event.newValue!==uid){booting=true;status('error','另一分頁已切換帳號，請重新整理後繼續。');warning('為避免混用帳號，請重新整理這個分頁再遊玩。');return;}
    if(event.key!==(uid?PREFIX+uid:GUEST)||!event.newValue)return;
    if(busy()){warning('另一分頁有更新，請結束雙人連線後重新整理。');return;}
    try{if(uid){record=parse(event.newValue);setState(restore(record.save));}else setState(restore(JSON.parse(event.newValue)));changed();}catch(e){warning('另一分頁存檔無法讀取，請匯出目前進度備份。');}
  });
  return {snapshot,localSave,login,logout,sync,init,recovery:()=>uid?localStorage.getItem(PREFIX+uid+':recovery'):null};
};
