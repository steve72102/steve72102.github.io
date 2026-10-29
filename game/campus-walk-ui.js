window.MindWalkUI=function(options){
  'use strict';
  const {root,scene,initial,onPosition,onPortal,onMotion=()=>{},onPush=()=>{},onRouteCancel=()=>{}}=options;
  const W=window.MindWalk,world=root.querySelector('.walk-world'),actor=world.querySelector('.walk-actor'),label=root.querySelector('.walk-status'),action=root.querySelector('.walk-enter'),target=world.querySelector('.walk-target');
  const abort=new AbortController(),signal=abort.signal,keys=new Set(),touches=new Map();
  let z=0,vz=0,armed=null,latched=null;let pos=W.nearest(scene,initial||scene.spawn),path=[],frame=0,last=0,disposed=false,activated=false,facing=1,direction='down',lastMessage='',wasMoving=false;
  function listen(el,type,fn,opts={}){el.addEventListener(type,fn,{...opts,signal});}
  function stop(){keys.clear();touches.clear();path=[];actor.classList.remove('walking');root.querySelectorAll('.walk-direction').forEach(b=>b.classList.remove('held'));target.hidden=true;last=0;}
  function destroy(){if(disposed)return;disposed=true;stop();cancelAnimationFrame(frame);abort.abort();onPosition({...pos});}
  function focus(){world.focus({preventScroll:true});}
  function blocked(){return document.hidden||!!document.querySelector('dialog[open]');}
  function message(value){if(value!==lastMessage){label.textContent=value;lastMessage=value;}}
  function paint(moving=false,dx=0,dy=0){
    if(dx)facing=dx<0?-1:1;
    if(dx||dy)direction=Math.abs(dy)>Math.abs(dx)?dy<0?'up':'down':dx<0?'left':'right';
    actor.style.left=(pos.x/W.WIDTH*100)+'%';actor.style.top=(pos.y/W.HEIGHT*100)+'%';
    actor.style.setProperty('--facing',facing);actor.style.setProperty('--depth',scene.kind!=='hall'?(.76+pos.y/1300):1);
    actor.style.setProperty('--lift',(z*(world.offsetHeight||667)/667)+'px');actor.dataset.z=z.toFixed(1);actor.classList.toggle('jumping',vz!==0);actor.dataset.x=pos.x.toFixed(1);actor.dataset.y=pos.y.toFixed(1);actor.dataset.direction=direction;actor.classList.toggle('walking',moving);actor.style.zIndex=String(30+Math.round(pos.y/10)+(z>0?15:0));
    onMotion({...pos,z,direction,moving});camera();
    const door=W.near(scene,pos);action.disabled=!door;action.textContent=door?(door.verb||'進入')+' '+door.name:'走近標記即可互動';
    world.querySelectorAll('[data-walk-portal]').forEach(b=>b.classList.toggle('nearby',b.dataset.walkPortal===door?.id));
    message(path.length?'正在前往目的地 · 方向鍵可接手':door?'已到 '+door.name+' · 按 Enter 互動':scene.kind!=='hall'?'校園漫遊 · 點地面跑動，空白鍵跳躍':'樓館大廳 · 沿樓梯前往下一層');
  }
  function camera(){const viewport=root.querySelector('.world-viewport');if(!viewport)return;if(!document.body.classList.contains('academy-immersive')){world.style.transform='';return;}const width=world.offsetWidth,height=world.offsetHeight,x=Math.min(0,Math.max(viewport.clientWidth-width,viewport.clientWidth/2-pos.x/W.WIDTH*width)),y=Math.min(0,Math.max(viewport.clientHeight-height,viewport.clientHeight*.58-pos.y/W.HEIGHT*height));world.style.transform='translate3d('+x+'px,'+y+'px,0)';}
  function activate(door){if(!door||activated||disposed)return;latched=door.id;armed=null;stop();paint();if(door.kind!=='inspect'){activated=true;destroy();}onPortal(door.id);}
  function jump(){if(blocked()||vz)return;onRouteCancel();vz=360/(scene.scale||1);path=[];armed=null;focus();}
  function push(){if(blocked())return;onPush(direction);focus();}
  const jumpButton=root.querySelector('.walk-jump'),pushButton=root.querySelector('.walk-push');if(jumpButton)listen(jumpButton,'click',jump);if(pushButton)listen(pushButton,'click',push);
  function toward(p){if(blocked()||!p)return;armed=p.id||null;latched=null;keys.clear();touches.clear();path=W.route(scene,pos,p);const end=path.at(-1);target.hidden=!end;if(end){target.style.left=end.x/10+'%';target.style.top=end.y/W.HEIGHT*100+'%';}focus();paint();}
  function keydown(e){
    if(e.altKey||e.ctrlKey||e.metaKey||blocked()||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(!root.contains(e.target)&&e.target!==document.body&&e.target!==document.getElementById('main'))return;
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    if(W.direction(key)||key==='Shift'){e.preventDefault();onRouteCancel();keys.add(key);path=[];armed=null;target.hidden=true;}
    else if(key===' '&&!e.repeat){e.preventDefault();jump();}
    else if((key==='Enter'||key==='e')&&e.target===world){e.preventDefault();activate(W.near(scene,pos));}
    else if(key==='Escape'){stop();paint();}
  }
  listen(document,'keydown',keydown);listen(document,'keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
  listen(window,'blur',()=>{stop();paint();});listen(document,'visibilitychange',()=>{stop();paint();});
  listen(window,'resize',camera);
  listen(document,'focusin',e=>{if(!root.contains(e.target)){stop();paint();}});
  listen(world,'click',e=>{if(e.target.closest('button'))return;onRouteCancel();const r=world.getBoundingClientRect();toward({x:(e.clientX-r.left)/r.width*W.WIDTH,y:(e.clientY-r.top)/r.height*W.HEIGHT});});
  root.querySelectorAll('[data-walk-portal]').forEach(b=>listen(b,'click',()=>{onRouteCancel();toward(scene.portals.find(p=>p.id===b.dataset.walkPortal));}));
  listen(action,'click',()=>activate(W.near(scene,pos)));
  root.querySelectorAll('.walk-direction').forEach(b=>{
    const dir=b.dataset.direction;
    const release=e=>{touches.delete(e.pointerId);b.classList.remove('held');if(!touches.size&&!keys.size&&!path.length)paint();};
    listen(b,'pointerdown',e=>{if(e.button!==0||blocked())return;e.preventDefault();onRouteCancel();focus();path=[];target.hidden=true;touches.set(e.pointerId,dir);b.classList.add('held');b.setPointerCapture(e.pointerId);const d=W.direction(dir);pos=W.move(scene,pos,...d,.05,false,z);paint(true,d[0],d[1]);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,release);
    listen(b,'click',e=>{if(e.detail===0&&!blocked()){onRouteCancel();const d=W.direction(dir);path=[];pos=W.move(scene,pos,...d,.05,false,z);paint(true,d[0],d[1]);}});
  });
  function tick(now){
    if(disposed)return;if(!root.isConnected){destroy();return;}
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(blocked()){if(wasMoving||keys.size||touches.size||path.length){stop();paint();wasMoving=false;}last=0;frame=requestAnimationFrame(tick);return;}
    let dx=0,dy=0;for(const key of [...keys,...touches.values()]){const d=W.direction(key);if(d){dx+=d[0];dy+=d[1];}}
    const before=pos,beforeZ=z;
    const support=W.surface(scene,pos)?.height||0;if(vz||z>support){vz-=650/(scene.scale||1)*dt;z+=vz*dt;if(z<=support&&vz<0){z=support;vz=0;}}
    if(dx||dy)pos=W.move(scene,pos,dx,dy,dt,keys.has('Shift'),z);
    else if(path.length){let next=path[0];const dist=W.distance(pos,next);if(dist<=W.speed(scene)*dt){pos={...next};path.shift();if(!path.length)target.hidden=true;}else pos=W.move(scene,pos,next.x-pos.x,next.y-pos.y,dt,false,z);dx=pos.x-before.x;dy=pos.y-before.y;}
    const landed=W.surface(scene,pos)?.height||0;if(z<landed){z=landed;vz=0;}
    const moved=W.distance(before,pos)>.001;if(moved||wasMoving||beforeZ!==z)paint(moved,dx,dy);wasMoving=moved;
    const door=W.near(scene,pos,14);if(!door||door.id!==latched)latched=null;
    if(door&&door.id!==latched&&z<1&&(moved||armed===door.id)&&(door.auto!==false||armed===door.id)){activate(door);if(disposed)return;}
    frame=requestAnimationFrame(tick);
  }
  paint();frame=requestAnimationFrame(tick);
  return {destroy,toward,reframe:camera};
};
