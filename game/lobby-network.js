/* Public presence only. No account ID, email, save payload, coins or rewards travel here. */
window.MindLobbyNetwork=function(options){
  'use strict';const {onChange}=options,L=window.MindLobby,PREFIX='steve72102-academy-lobby1-',id=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
  let peer=null,upstream=null,connections=new Map(),self=null,players=[],channel=1,host=false,epoch=0,interval=null,timeout=null,retryTimer=null,lastBroadcast=0,lastSend=0,lastReceive=0,dirty=false,attempts=0,status='idle',message='獨自漫遊';
  function snapshot(){return {status,message,channel,players:players.map(p=>({...p})),selfId:id,host};}
  function notify(){onChange(snapshot());}
  function emit(c,type,fields={}){if(!c?.open)return false;try{c.send(JSON.stringify({v:L.VERSION,type,...fields}));return true;}catch(_){c.close();return false;}}
  function clean(){epoch++;clearInterval(interval);clearTimeout(timeout);clearTimeout(retryTimer);const old=peer;peer=null;upstream=null;connections.clear();players=[];old?.destroy();}
  function leave(){status='idle';message='獨自漫遊';clean();notify();}
  function fail(text){status='error';message=text;clean();notify();}
  function retry(){if(!['joining','connected','reconnecting'].includes(status))return;clean();if(++attempts>6){fail('共同大廳連線中斷，請按重新加入。單人進度仍保留。');return;}status='reconnecting';message='正在重新集合玩家…';notify();retryTimer=setTimeout(()=>open(true),500+Math.floor(Math.random()*1400));}
  function broadcast(){players=[self,...Array.from(connections.values()).filter(x=>x.player).map(x=>x.player)];for(const [c,entry] of connections)if(entry.player)emit(c,'world',{players});dirty=false;lastBroadcast=Date.now();notify();}
  function tick(){const now=Date.now();if(host){for(const [c,entry] of connections){if(now-entry.seen>30000){connections.delete(c);c.close();dirty=true;}}if(dirty||now-lastBroadcast>2500)broadcast();}else if(upstream?.open){if(now-lastReceive>30000){retry();return;}if(dirty||now-lastSend>2500){emit(upstream,'move',{pose:L.pose(self)});dirty=false;lastSend=now;}}}
  function attach(c,isHost){
    if(c.label!==L.VERSION||c.serialization!=='raw'){c.on('error',()=>{});c.close();return;}
    const token=epoch,entry={seen:Date.now(),started:Date.now(),count:0,player:null};
    if(isHost&&connections.size>=L.LIMIT-1){c.on('open',()=>{emit(c,'full');setTimeout(()=>c.close(),250);});c.on('error',()=>{});return;}
    if(isHost)connections.set(c,entry);else upstream=c;
    c.on('open',()=>{if(token!==epoch)return;if(!isHost){lastReceive=Date.now();emit(c,'join',{player:self});}});
    c.on('data',text=>{
      if(token!==epoch)return;
      try{
        const now=Date.now();if(now-entry.started>=1000){entry.started=now;entry.count=0;}if(++entry.count>25)throw Error('大廳資料過於頻繁');
        const p=L.packet(text);entry.seen=now;
        if(isHost){
          if(p.type==='join'&&!entry.player){if(p.player.id===id||Array.from(connections.values()).some(x=>x.player?.id===p.player.id))throw Error('重複玩家');entry.player=p.player;dirty=true;broadcast();return;}
          if(p.type==='move'&&entry.player){entry.player={...entry.player,...p.pose};dirty=true;return;}
          throw Error('大廳步驟不正確');
        }
        if(p.type==='full'){fail('這間大廳已滿 8 位，請選擇另一間。');return;}
        if(p.type!=='world'||!p.players.some(x=>x.id===id))throw Error('大廳回應不正確');
        clearTimeout(timeout);lastReceive=now;attempts=0;status='connected';message='已加入第 '+channel+' 大廳';players=p.players;notify();
      }catch(_){if(isHost){connections.delete(c);c.close();dirty=true;}else fail('收到不符合格式的大廳資料，已停止連線。');}
    });
    const closed=()=>{if(token!==epoch)return;if(isHost){connections.delete(c);dirty=true;broadcast();}else retry();};c.on('close',closed);c.on('error',closed);
  }
  function open(claim){
    const token=epoch;host=claim;const p=peer=new window.Peer(claim?PREFIX+channel:PREFIX+'visitor-'+id,{host:'0.peerjs.com',port:443,path:'/',secure:true,key:'peerjs',debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
    clearTimeout(timeout);timeout=setTimeout(()=>{if(token===epoch)fail('無法接上共同大廳。請換網路或稍後重試；單人探索仍可使用。');},22000);
    p.on('open',()=>{if(peer!==p)return;clearInterval(interval);interval=setInterval(tick,120);if(claim){clearTimeout(timeout);attempts=0;status='connected';message='已加入第 '+channel+' 大廳';dirty=true;broadcast();}else{try{attach(p.connect(PREFIX+channel,{reliable:true,serialization:'raw',label:L.VERSION}),false);}catch(_){fail('這個瀏覽器無法建立玩家連線。');}}});
    p.on('connection',c=>{if(peer===p&&host)attach(c,true);else c.close();});p.on('call',c=>c.close());
    p.on('error',e=>{if(peer!==p)return;if(e.type==='unavailable-id'&&claim){peer=null;p.destroy();open(false);return;}if(e.type==='peer-unavailable'){retry();return;}fail('大廳連線服務暫時無法使用，請稍後重新加入。');});
    p.on('disconnected',()=>{if(peer===p)retry();});
  }
  function join(room,profile){if(!Number.isInteger(room)||room<1||room>10)return;clean();channel=room;attempts=0;try{self=L.player({...profile,id});}catch(_){fail('請先完成角色命名，再加入大廳。');return;}if(!navigator.onLine||!window.Peer||!window.RTCPeerConnection||location.protocol==='file:'){fail('共同大廳需使用連網的網站版。單人模式可以繼續離線玩。');return;}status='joining';message='正在加入第 '+channel+' 大廳…';notify();open(true);}
  function move(pose){if(!self)return;try{const next=L.pose(pose);if(JSON.stringify(next)!==JSON.stringify(L.pose(self))){self={...self,...next};dirty=true;}}catch(_){} }
  function refresh(profile){if(!self)return;const next=L.player({...self,...profile,id});if(JSON.stringify(next.appearance)!==JSON.stringify(self.appearance)||JSON.stringify(next.loadout)!==JSON.stringify(self.loadout)||next.name!==self.name){const room=channel;join(room,next);}else move(next);}
  window.addEventListener('pagehide',leave);window.addEventListener('offline',()=>{if(status!=='idle')fail('目前離線。連網後可重新加入大廳。');});
  return {join,leave,move,refresh,snapshot};
};
