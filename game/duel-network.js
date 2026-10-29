/* Only session data travels over the data channel. Save files never leave the device. */
window.MindDuelNetwork=function(options){
  'use strict';
  const {questions,onChange,onAnswer,random}=options;
  const D=window.MindDuel, PREFIX='steve72102-mq3-', byId=new Map(questions.map(q=>[q.id,q]));
  let peer=null,connection=null,generation=0,deadline=0,timer=null,connectTimer=null,retryTimer=null,lastSeen=0,lastPing=0,ownReveal=null,revealed=false,answerPending=false,attempts=0;
  let data={status:'idle',message:'',game:null,mode:null,code:'',subject:null,profile:null,host:false};
  const active=()=>['connecting','waiting','handshake','connected'].includes(data.status);
  const notify=()=>onChange(data);
  function nonce(){const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
  async function digest(index,choice,salt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(D.commitmentText(index,choice,salt)));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
  function send(type,fields={}){if(!connection?.open)throw Error('連線已中斷');connection.send(JSON.stringify({v:D.VERSION,type,...fields}));}
  function clean(){generation++;clearInterval(timer);clearTimeout(connectTimer);clearTimeout(retryTimer);const p=peer;peer=null;connection=null;p?.destroy();ownReveal=null;revealed=false;answerPending=false;}
  function fail(message){if(!active())return;data.status='error';data.message=message;clean();notify();}
  function leave(){if(connection?.open)try{send('leave');}catch(_){}clean();data={status:'idle',message:'',game:null,mode:null,code:'',subject:null,profile:null,host:false};notify();}
  function setStage(){const s=data.game;deadline=Date.now()+(s?.phase==='prep'?180000:120000);}
  function change(){
    const s=data.game;
    if(s?.phase==='done'){data.status='done';data.message='對戰完成';clearInterval(timer);clearTimeout(connectTimer);const token=generation;setTimeout(()=>{if(token===generation&&data.status==='done')clean();},1000);}
    notify();
  }
  function health(){
    clearInterval(timer);lastSeen=Date.now();lastPing=0;setStage();
    timer=setInterval(()=>{
      if(data.status!=='connected')return;
      const now=Date.now();
      if(now-lastSeen>75000){fail('對手的連線已失去回應。本場不判勝負，已獲得的答題經驗仍保留。');return;}
      if(now>deadline){fail('此步驟等待超時，對戰已結束。請雙方保持頁面開啟，再重新配對。');return;}
      if(now-lastPing>5000){lastPing=now;try{send('ping');}catch(_){fail('連線已中斷，請重新配對。');}}
      const label=document.getElementById('duel-time');if(label)label.textContent=Math.max(0,Math.ceil((deadline-now)/1000))+' 秒';
    },1000);
  }
  function connected(){clearTimeout(connectTimer);data.status='connected';data.message='雙方已連線';health();notify();}
  async function revealIfReady(token){
    const s=data.game;if(!s||!s.commits.every(Boolean)||!ownReveal||revealed)return;
    revealed=true;
    send('reveal',ownReveal);
    if(token!==generation)return;
    if(!D.reveal(s,0,ownReveal.choice,ownReveal.index))throw Error('答案步驟不一致');
    settle();
  }
  function settle(){
    const s=data.game;if(!s)return;
    const q=byId.get(s.ids[s.index]);
    if(D.settleQuestion(s,q)){onAnswer(q,s.answers[0][s.index].correct);setStage();change();}
    else notify();
  }
  async function receive(text,token){
    if(token!==generation)return;
    const m=D.packet(text);lastSeen=Date.now();
    if(m.type==='ping')return;
    if(m.type==='leave'){fail('對手已離開，本場不判勝負。已獲得的答題經驗仍保留。');return;}
    if(m.type==='busy'&&data.status==='handshake'){retryQueue();return;}
    if(m.type==='hello'&&data.host&&data.status==='handshake'&&!data.game){
      if(m.bank!==D.BANK||(data.mode==='auto'&&m.subject!==data.subject))throw Error('題庫版本或科目不同，請雙方更新遊戲');
      const other=D.profile(m.profile), config=D.create(data.subject,questions,random);
      data.game=D.fresh(config,data.profile,other);send('match',{...config,profile:data.profile});return;
    }
    if(m.type==='match'&&!data.host&&data.status==='handshake'&&!data.game){
      const config=D.match(m,questions,data.mode==='auto'?data.subject:null);
      data.subject=config.subject;data.game=D.fresh(config,data.profile,config.opponent);send('ack');connected();return;
    }
    if(m.type==='ack'&&data.host&&data.status==='handshake'&&data.game){
      // Free the queue ID only after both browsers have agreed on this match.
      peer.disconnect();connected();return;
    }
    const s=data.game;if(data.status!=='connected'||!s)throw Error('對戰步驟不一致');
    if(m.type==='ready'&&m.round===s.round){if(!D.ready(s,1))throw Error('準備步驟不一致');if(s.phase==='question')setStage();change();return;}
    if(m.type==='commit'){
      if(!D.commit(s,1,m.hash,m.index))throw Error('交卷步驟不一致');
      await revealIfReady(token);if(token===generation)notify();return;
    }
    if(m.type==='reveal'){
      if(s.phase!=='question'||m.index!==s.index||!s.commits.every(Boolean)||s.reveals[1]!==null)throw Error('答案步驟不一致');
      const hash=await digest(m.index,m.choice,m.nonce);
      if(token!==generation)return;
      if(hash!==s.commits[1]||!D.reveal(s,1,m.choice,m.index))throw Error('對手的答案驗證失敗');
      settle();return;
    }
    if(m.type==='next'&&m.index===s.index){
      const index=s.index,phase=s.phase;
      if(!D.next(s,1))throw Error('換題步驟不一致');
      if(s.index!==index||s.phase!==phase){ownReveal=null;revealed=false;setStage();}change();return;
    }
    throw Error('收到不符合目前回合的資料');
  }
  function attach(c,host){
    if(c.label!==D.VERSION){c.on('error',()=>{});c.close();return;}
    if(connection||c.serialization!=='raw'){
      c.on('open',()=>{if(c.serialization==='raw')c.send(JSON.stringify({v:D.VERSION,type:'busy'}));setTimeout(()=>c.close(),500);});
      c.on('error',()=>{});return;
    }
    connection=c;data.host=host;data.status='handshake';data.message='正在與另一位玩家建立連線…';notify();
    clearTimeout(connectTimer);connectTimer=setTimeout(()=>fail('無法建立玩家之間的連線。可換成家用網路或手機熱點後重試；部分公司／校園網路會阻擋連線。'),25000);
    const token=generation;let chain=Promise.resolve(),windowStart=Date.now(),count=0;
    c.on('open',()=>{if(token!==generation)return;if(!host)try{send('hello',{bank:D.BANK,subject:data.subject,profile:data.profile});}catch(_){fail('連線未能完成。');}});
    c.on('data',text=>{
      if(token!==generation)return;
      if(Date.now()-windowStart>10000){windowStart=Date.now();count=0;}
      if(++count>80){fail('連線資料過於頻繁，已停止本場對戰。');return;}
      chain=chain.then(()=>receive(text,token)).catch(e=>{if(token===generation)fail(e.message+'。請重新配對。');});
    });
    c.on('close',()=>{if(token===generation)fail('對手已斷線或離開，本場不判勝負。已獲得的答題經驗仍保留。');});
    c.on('error',()=>{if(token===generation)fail('玩家連線發生錯誤，請重新配對。');});
  }
  function retryQueue(){
    if(data.mode!=='auto'){fail('房間已滿或已開始，請朋友重新建立房間。');return;}
    if(++attempts>8){fail('配對暫時忙碌，請稍後再試，或使用房號邀請朋友。');return;}
    clean();data.game=null;data.status='connecting';data.message='正在尋找下一位同科玩家…';notify();
    retryTimer=setTimeout(()=>openPeer(true),700+Math.floor(random()*1300));
  }
  function openPeer(claim){
    if(!active())return;
    const id=claim?(data.mode==='auto'?PREFIX+'queue-'+data.subject:PREFIX+'room-'+data.code):PREFIX+'player-'+nonce();
    data.host=claim;
    const p=peer=new window.Peer(id,{host:'0.peerjs.com',port:443,path:'/',secure:true,key:'peerjs',debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
    clearTimeout(connectTimer);connectTimer=setTimeout(()=>fail('連線服務暫時沒有回應。請稍後重試；單人遊戲仍可使用。'),20000);
    p.on('open',()=>{
      if(peer!==p)return;
      if(claim){clearTimeout(connectTimer);data.status='waiting';data.message=data.mode==='auto'?'正在等候同科玩家加入…':'房間已開啟，等候朋友加入…';notify();}
      else{
        const target=data.mode==='auto'?PREFIX+'queue-'+data.subject:PREFIX+'room-'+data.code;
        try{attach(p.connect(target,{reliable:true,serialization:'raw',label:D.VERSION}),false);}catch(_){fail('瀏覽器無法建立對戰連線，請更新瀏覽器後重試。');}
      }
    });
    p.on('connection',c=>{if(peer!==p){c.close();return;}attach(c,true);});
    p.on('call',call=>call.close());
    p.on('error',e=>{
      if(peer!==p)return;
      if(e.type==='unavailable-id'&&claim&&data.mode==='auto'){
        peer=null;p.destroy();openPeer(false);return;
      }
      if(e.type==='peer-unavailable'&&data.mode==='auto'){retryQueue();return;}
      if(data.status==='connected'&&connection?.open&&['network','socket-error','socket-closed'].includes(e.type))return;
      fail(e.type==='peer-unavailable'?'找不到這個房間。請確認房號、朋友仍停留在等待畫面，且雙方使用最新版遊戲。':e.type==='unavailable-id'?'此房號暫時無法使用，請重新建立房間。':'連線服務無法使用。請確認網路後重試；單人遊戲不受影響。');
    });
    p.on('disconnected',()=>{if(peer===p&&data.status!=='connected'&&!(data.status==='handshake'&&data.game))fail('配對服務已斷線，請重新開始。');});
  }
  function start({mode,subject,profile,code=''}){
    if(active())return;
    if(!navigator.onLine){data.status='error';data.message='雙人對戰需要網路，單人冒險可繼續離線遊玩。';notify();return;}
    if(!window.Peer||!window.RTCPeerConnection||!crypto?.subtle||location.protocol==='file:'){data.status='error';data.message='請用最新版 Chrome、Edge 或 Firefox 開啟網站版，再使用雙人連線。';notify();return;}
    try{
      const mine=D.profile(profile);if(!['auto','host','join'].includes(mode)||!window.MindEngine.SUBJECTS[subject])throw Error('連線設定不正確');
      if(mode==='join'&&!/^[A-HJ-NP-Z2-9]{10}$/.test(code))throw Error('請填入 10 碼房號（不含空格）');
      clean();attempts=0;
      if(mode==='host'){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',a=new Uint8Array(10);crypto.getRandomValues(a);code=Array.from(a,x=>chars[x%32]).join('');}
      data={status:'connecting',message:'正在連線…',game:null,mode,subject,profile:mine,code,host:false};notify();openPeer(mode!=='join');
    }catch(e){clean();data.status='error';data.message=e.message;notify();}
  }
  function ready(){const s=data.game;if(data.status!=='connected'||!s||!D.ready(s,0))return;try{send('ready',{round:s.round});if(s.phase==='question')setStage();change();}catch(_){fail('連線已中斷。');}}
  async function answer(choice){
    const s=data.game;if(data.status!=='connected'||!s||s.phase!=='question'||s.commits[0]||answerPending)return;
    const token=generation;answerPending=true;
    try{
      const salt=nonce(),index=s.index,hash=await digest(index,choice,salt);
      if(token!==generation)return;
      if(!D.commit(s,0,hash,index))throw Error('交卷失敗');
      ownReveal={index,choice,nonce:salt};send('commit',{index,hash});await revealIfReady(token);if(token===generation)notify();
    }catch(e){if(token===generation)fail(e.message+'，請重新配對。');}finally{if(token===generation)answerPending=false;}
  }
  function next(){const s=data.game;if(data.status!=='connected'||!s||s.phase!=='feedback'||s.next[0])return;try{const index=s.index;send('next',{index});D.next(s,0);if(s.index!==index||s.phase!=='feedback'){ownReveal=null;revealed=false;setStage();}change();}catch(_){fail('連線已中斷。');}}
  window.addEventListener('pagehide',clean);
  window.addEventListener('beforeunload',e=>{if(active()){e.preventDefault();e.returnValue='';}});
  window.addEventListener('offline',()=>fail('網路已中斷，本場不判勝負。連線恢復後可以重新配對。'));
  return {start,leave,ready,answer,next,active,snapshot:()=>data,remaining:()=>Math.max(0,Math.ceil((deadline-Date.now())/1000))};
};
