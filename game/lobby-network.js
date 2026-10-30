/* Public presence only. No account ID, email, save payload, coins or rewards travel here. */
window.MindLobbyNetwork=function(options){
  'use strict';const {onChange}=options,L=window.MindLobby,P=window.MindScenePlay,PREFIX='steve72102-academy-'+L.VERSION+'-',id=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
  let messages=[],requests=[],outgoing=new Set(),socialEvents=[],lastTalk=-2000,lastFriend=-2000;let environment=P.fresh();let peer=null,upstream=null,connections=new Map(),self=null,players=[],channel=1,host=false,epoch=0,interval=null,timeout=null,retryTimer=null,lastBroadcast=0,lastSend=0,lastReceive=0,dirty=false,attempts=0,status='idle',message='獨自漫遊';
  const channelName=()=>window.MindClassrooms.channelName(channel),capacity=()=>typeof channel==='string'?50:L.LIMIT;
  function snapshot(){return {status,message,channel,players:players.map(p=>({...p})),selfId:id,host,environment:P.snapshot(environment,Date.now()),messages:messages.slice(),requests:requests.slice(),socialEvents:socialEvents.slice()};}
  function notify(){onChange(snapshot());}
  function emit(c,type,fields={}){if(!c?.open)return false;try{c.send(JSON.stringify({v:L.VERSION,type,...fields}));return true;}catch(_){c.close();return false;}}
  function clean(){epoch++;clearInterval(interval);clearTimeout(timeout);clearTimeout(retryTimer);const old=peer;peer=null;upstream=null;connections.clear();players=[];old?.destroy();}
  function leave(){messages=[];requests=[];outgoing.clear();socialEvents=[];environment=P.fresh();status='idle';message='獨自漫遊';clean();notify();}
  function fail(text){status='error';message=text;clean();notify();}
  function retry(){if(!['joining','connected','reconnecting'].includes(status))return;clean();if(++attempts>6){fail('共同大廳連線中斷，請按重新加入。單人進度仍保留。');return;}status='reconnecting';message='正在重新集合玩家…';notify();retryTimer=setTimeout(()=>open(true),500+Math.floor(Math.random()*1400));}
  function broadcast(full=true){players=[self,...Array.from(connections.values()).filter(x=>x.player).map(x=>x.player)];const data=full?{v:L.VERSION,type:'world',players,environment:P.snapshot(environment,Date.now())}:{v:L.VERSION,type:'motion',rows:players.map((p,i)=>[i,Math.round(p.x*10),Math.round(p.y*10),Math.round((p.z||0)*10),L.scenes.indexOf(p.scene),L.DIRECTIONS.indexOf(p.direction),p.moving?1:0]),environment:P.snapshot(environment,Date.now())};const encoded=JSON.stringify(data);for(const [c,entry] of connections)if(entry.player&&c.open)try{c.send(encoded);}catch(_){c.close();}dirty=false;lastBroadcast=Date.now();notify();}
  function tick(){const now=Date.now();if(host){if(P.step(environment,[self,...Array.from(connections.values()).map(x=>x.player).filter(Boolean)],now))dirty=true;for(const [c,entry] of connections){if(now-entry.seen>30000){connections.delete(c);c.close();dirty=true;}}if(dirty||now-lastBroadcast>2500)broadcast(false);}else if(upstream?.open){if(now-lastReceive>30000){retry();return;}if(dirty||now-lastSend>2500){emit(upstream,'move',{pose:L.pose(self)});dirty=false;lastSend=now;}}}
  function attach(c,isHost){
    if(c.label!==L.VERSION||c.serialization!=='raw'){c.on('error',()=>{});c.close();return;}
    const token=epoch,entry={seen:Date.now(),started:Date.now(),count:0,player:null};
    if(isHost&&connections.size>=capacity()-1){c.on('open',()=>{emit(c,'full');setTimeout(()=>c.close(),250);});c.on('error',()=>{});return;}
    if(isHost)connections.set(c,entry);else upstream=c;
    c.on('open',()=>{if(token!==epoch)return;if(!isHost){lastReceive=Date.now();emit(c,'join',{player:self});}});
    c.on('data',text=>{
      if(token!==epoch)return;
      try{
        const now=Date.now();if(now-entry.started>=1000){entry.started=now;entry.count=0;}if(++entry.count>25)throw Error('大廳資料過於頻繁');
        const p=L.packet(text);entry.seen=now;
        if(isHost){
          if(p.type==='join'&&!entry.player){if(p.player.id===id||Array.from(connections.values()).some(x=>x.player?.id===p.player.id))throw Error('重複玩家');entry.player=p.player;dirty=true;broadcast();return;}
          if(p.type==='profile'&&entry.player){if(p.player.id!==entry.player.id||p.player.socialId!==entry.player.socialId)throw Error('玩家識別碼不符');entry.player=p.player;broadcast();return;}
          if(p.type==='talk'&&entry.player){if(now-(entry.lastTalk||-2000)>=1000){entry.lastTalk=now;relayChat(entry.player,p);}return;}
          if(p.type==='friend'&&entry.player){if(now-(entry.lastFriend||-2000)>=1000){entry.lastFriend=now;relayFriend(entry.player,p);}return;}
          if(p.type==='interact'&&entry.player){if(P.push(environment,entry.player,p.action,now))dirty=true;return;}
          if(p.type==='move'&&entry.player){entry.player={...entry.player,...p.pose};dirty=true;return;}
          throw Error('大廳步驟不正確');
        }
        if(p.type==='chat'){receiveChat(p);return;}if(p.type==='friend'){receiveFriend(p);return;}if(p.type==='motion'){if(p.rows.length!==players.length)throw Error('玩家名單尚未同步');players=p.rows.map((r,i)=>{if(r[0]!==i)throw Error('玩家次序不正確');return {...players[i],...L.pose({scene:L.scenes[r[4]],x:r[1]/10,y:r[2]/10,z:r[3]/10,direction:L.DIRECTIONS[r[5]],moving:!!r[6]})};});environment=P.restore(p.environment,now);lastReceive=now;notify();return;}
        if(p.type==='full'){fail('這個房間已滿 '+capacity()+' 位，請稍後再試。');return;}
        if(p.type!=='world'||!p.players.some(x=>x.id===id))throw Error('大廳回應不正確');
        clearTimeout(timeout);lastReceive=now;attempts=0;status='connected';message='已加入 '+channelName();players=p.players;environment=P.restore(p.environment,now);notify();
      }catch(_){if(isHost){connections.delete(c);c.close();dirty=true;}else fail('收到不符合格式的大廳資料，已停止連線。');}
    });
    const closed=()=>{if(token!==epoch)return;if(isHost){connections.delete(c);dirty=true;broadcast();}else retry();};c.on('close',closed);c.on('error',closed);
  }
  function open(claim){
    const token=epoch;host=claim;const p=peer=new window.Peer(claim?PREFIX+channel:PREFIX+'visitor-'+id,{host:'0.peerjs.com',port:443,path:'/',secure:true,key:'peerjs',debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
    clearTimeout(timeout);timeout=setTimeout(()=>{if(token===epoch)fail('無法接上共同大廳。請換網路或稍後重試；單人探索仍可使用。');},22000);
    p.on('open',()=>{if(peer!==p)return;clearInterval(interval);interval=setInterval(tick,200);if(claim){clearTimeout(timeout);attempts=0;status='connected';message='已加入 '+channelName();dirty=true;broadcast();}else{try{attach(p.connect(PREFIX+channel,{reliable:true,serialization:'raw',label:L.VERSION}),false);}catch(_){fail('這個瀏覽器無法建立玩家連線。');}}});
    p.on('connection',c=>{if(peer===p&&host)attach(c,true);else c.close();});p.on('call',c=>c.close());
    p.on('error',e=>{if(peer!==p)return;if(e.type==='unavailable-id'&&claim){peer=null;p.destroy();open(false);return;}if(e.type==='peer-unavailable'){retry();return;}fail('大廳連線服務暫時無法使用，請稍後重新加入。');});
    p.on('disconnected',()=>{if(peer===p)retry();});
  }
  function join(room,profile){messages=[];requests=[];outgoing.clear();socialEvents=[];environment=P.fresh();if(!(Number.isInteger(room)&&room>=1&&room<=10)&&!(typeof room==='string'&&room.startsWith('class-')&&window.MindClassrooms.channel(room.slice(6))===room))return;clean();channel=room;attempts=0;try{self=L.player({...profile,id});}catch(_){fail('請先完成角色命名，再加入大廳。');return;}if(!navigator.onLine||!window.Peer||!window.RTCPeerConnection||location.protocol==='file:'){fail('共同大廳需使用連網的網站版。單人模式可以繼續離線玩。');return;}status='joining';message='正在加入 '+channelName()+'…';notify();open(true);}
  function move(pose){if(!self)return;try{const next=L.pose(pose);if(JSON.stringify(next)!==JSON.stringify(L.pose(self))){self={...self,...next};dirty=true;}}catch(_){} }
  function refresh(profile){if(!self)return;const next=L.player({...self,...profile,id});if(next.socialId!==self.socialId){join(channel,next);return;}if(JSON.stringify(next.appearance)!==JSON.stringify(self.appearance)||JSON.stringify(next.loadout)!==JSON.stringify(self.loadout)||next.name!==self.name||next.knowledge!==self.knowledge||next.counterAt!==self.counterAt){self=next;dirty=true;if(status==='connected'){if(host)broadcast();else emit(upstream,'profile',{player:self});}}else move(next);}
  window.addEventListener('pagehide',leave);window.addEventListener('offline',()=>{if(status!=='idle')fail('目前離線。連網後可重新加入大廳。');});
  function interact(action){if(status!=='connected')return false;if(host){const ok=P.push(environment,self,action,Date.now());if(ok){dirty=true;broadcast();}return ok;}emit(upstream,'move',{pose:L.pose(self)});return emit(upstream,'interact',{action});}
  function receiveChat(p){messages.push({sender:p.sender,name:p.name,target:p.target,text:p.text});messages=messages.slice(-80);notify();}
  function relayChat(from,p){const target=p.target;if(target&&!players.some(x=>x.id===target))return;const message={sender:from.id,name:from.name,target,text:p.text};if(!target||target===id||from.id===id)receiveChat(message);for(const [c,e] of connections)if(e.player&&(!target||e.player.id===target||e.player.id===from.id))emit(c,'chat',message);}
  function say(text,target=null){if(status!=='connected'||Date.now()-lastTalk<1000)return false;try{const p=L.packet(JSON.stringify({v:L.VERSION,type:'talk',text,target}));lastTalk=Date.now();if(host)relayChat(self,p);else emit(upstream,'talk',p);return true;}catch(_){return false;}}
  function receiveFriend(p){if(!p.from||p.target!==id)return;if(p.mode==='request'){if(!requests.some(x=>x.id===p.from.id))requests.push(p.from);requests=requests.slice(-60);}else if(p.mode==='accept'&&outgoing.has(p.from.id)){outgoing.delete(p.from.id);socialEvents.push(p.from);socialEvents=socialEvents.slice(-100);}else if(p.mode==='decline')outgoing.delete(p.from.id);notify();}
  function relayFriend(from,p){const packet={mode:p.mode,target:p.target,from:{id:from.id,socialId:from.socialId,name:from.name}};if(p.target===id)receiveFriend(packet);else for(const [c,e] of connections)if(e.player?.id===p.target)emit(c,'friend',packet);}
  function friend(mode,target){if(status!=='connected'||Date.now()-lastFriend<1000||target===id||!players.some(p=>p.id===target))return false;lastFriend=Date.now();if(mode==='request')outgoing.add(target);else requests=requests.filter(p=>p.id!==target);const packet={mode,target};if(host)relayFriend(self,packet);else emit(upstream,'friend',packet);notify();return true;}
  function takeFriends(){const result=socialEvents;socialEvents=[];return result;}
  return {join,leave,move,refresh,snapshot,interact,say,friend,takeFriends};
};
