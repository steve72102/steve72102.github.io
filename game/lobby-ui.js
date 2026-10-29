window.MindAvatar=function({node,appearance,name,loadout,remote=false}){
  const A=window.MindAcademy,R=window.MindAdventure,look=A.restore(appearance),coat=R.gear(loadout?.coat),boots=R.gear(loadout?.boots),badge=R.gear(loadout?.badge);
  return node('div',{class:'walk-actor'+(remote?' remote-actor':' local-actor')+(coat?' coat-'+coat.color:'')+(boots?' has-boots':'')+(badge?' has-badge':''),'data-direction':'down','aria-label':name,role:'img'},node('span',{class:'traveler-shadow'}),node('span',{class:'outfit-aura','aria-hidden':'true'}),node('span',{class:'run-sprite sprite-'+look.character,'aria-hidden':'true'}),look.pet?node('img',{class:'walk-pet',src:'./assets/academy/'+A.pet(look.pet).image,alt:'',draggable:'false'}):null,node('span',{class:'player-name'},remote?name:'◆ '+name),badge?node('span',{class:'worn-badge','aria-hidden':'true'},'✦'):null);
};
window.MindLobbyUI=function(ctx){
  'use strict';const {node,btn,note,openModal,closeModal,getState}=ctx,L=window.MindLobby,W=window.MindWalk;
  let root=null,world=null,scene='campus',pose={scene:'campus',...W.campus.spawn,direction:'down',moving:false},remotes=new Map(),frame=0;
  const net=window.MindLobbyNetwork({onChange:update});
  function profile(){const s=getState();return {name:s.profile.name,appearance:s.appearance,loadout:s.rpg.loadout,...pose};}
  function position(actor,p){actor.style.left=p.x/W.WIDTH*100+'%';actor.style.top=p.y/W.HEIGHT*100+'%';actor.style.setProperty('--depth',scene==='campus'?(.76+p.y/1300):1);actor.dataset.direction=p.direction;actor.classList.toggle('walking',p.moving);actor.style.zIndex=String(30+Math.round(p.y/10));}
  function update(){
    if(!root||!world)return;const data=net.snapshot(),near=data.players.filter(p=>p.scene===scene),mine=data.selfId;
    const label=root.querySelector('.world-online-status');if(label)label.textContent=data.status==='connected'?'第 '+data.channel+' 大廳 · 此處 '+near.length+' 人 / 房內 '+data.players.length+' 人':data.message;
    root.querySelector('.world-online')?.classList.toggle('is-connected',data.status==='connected');
    const wanted=new Set();for(const p of near){if(p.id===mine)continue;wanted.add(p.id);let r=remotes.get(p.id);const identity=JSON.stringify([p.name,p.appearance,p.loadout]);if(r&&r.identity!==identity){r.actor.remove();remotes.delete(p.id);r=null;}if(!r){const actor=window.MindAvatar({node,appearance:p.appearance,name:p.name,loadout:p.loadout,remote:true});world.append(actor);r={actor,current:{...p},target:p,identity,seen:performance.now()};remotes.set(p.id,r);}r.target=p;r.seen=performance.now();position(r.actor,r.current);}
    for(const [id,r] of remotes)if(!wanted.has(id)){r.actor.remove();remotes.delete(id);}
  }
  let last=0;
  function animate(now){if(!world?.isConnected){frame=0;return;}const amount=1-Math.exp(-Math.min(100,now-last)/65);last=now;for(const r of remotes.values()){r.current={...r.target,x:r.current.x+(r.target.x-r.current.x)*amount,y:r.current.y+(r.target.y-r.current.y)*amount,moving:r.target.moving&&now-r.seen<900};position(r.actor,r.current);}frame=requestAnimationFrame(animate);}
  function bind(section,sceneId,initial){cancelAnimationFrame(frame);root=section;world=root.querySelector('.walk-world');scene=sceneId;remotes.clear();pose={scene,...initial,direction:'down',moving:false};net.refresh(profile());update();last=performance.now();frame=requestAnimationFrame(animate);}
  function move(p){pose={scene,...p};net.move(pose);const dot=root?.querySelector('.mini-self');if(dot){dot.style.left=p.x/10+'%';dot.style.top=p.y/W.HEIGHT*100+'%';}}
  function hide(){cancelAnimationFrame(frame);root=null;world=null;remotes.clear();pose={...pose,scene:'away',moving:false};net.move(pose);}
  function disconnect(){net.leave();}
  function dialog(){
    const data=net.snapshot(),picker=node('select',{id:'lobby-room'},Array.from({length:10},(_,i)=>node('option',{value:i+1},'第 '+(i+1)+' 大廳')));picker.value=String(data.channel);
    const place=p=>p.scene==='campus'?'校園步道':p.scene==='away'?'正在學習或整裝':window.MindAcademy.BUILDINGS.find(b=>p.scene.startsWith('hall:'+b.id+':'))?.name||'學院';
    openModal(node('p',{class:'eyebrow'},'MEET IN THE ACADEMY'),node('h2',{},'和朋友，在同一座學院相遇'),note('加入後，同房間玩家會看到你的遊戲暱稱、角色、衣著與所在位置。每房最多 8 人；選同一房、走進同一場景，就能看見彼此。'),node('label',{for:'lobby-room'},'選擇共同大廳'),picker,note(data.message),data.status==='connected'?node('ul',{class:'lobby-roster'},data.players.map(p=>node('li',{},node('strong',{},p.name+(p.id===data.selfId?'（你）':'')),node('span',{},place(p))))):null,node('div',{class:'modal-actions'},btn(data.status==='connected'?'切換／重新加入':'加入共同大廳',()=>{net.join(Number(picker.value),profile());closeModal();},'gold'),data.status!=='idle'?btn('離開，獨自漫遊',()=>{net.leave();closeModal();},'secondary'):null),note('位置透過玩家間連線同步，不傳送 Google 帳號、信箱或存檔。沒有其他玩家時，大廳只有你；沒有電腦玩家補位。'),note('共同大廳需網路與 PeerJS 連線服務；部分校園或公司網路可能無法直連。離線時仍可玩單人主線、答題與整理背包。'));
  }
  function button(){return node('button',{type:'button',class:'world-online',onClick:dialog},node('span',{class:'online-dot','aria-hidden':'true'}),node('span',{},node('strong',{},'共同大廳'),node('small',{class:'world-online-status'},'獨自漫遊 · 點此加入')));}
  return {bind,move,hide,disconnect,button,dialog,snapshot:net.snapshot};
};
