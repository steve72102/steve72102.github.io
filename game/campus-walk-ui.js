window.MindWalkUI=function(options){
  'use strict';
  const {root,scene,initial,onPosition,onPortal}=options;
  const W=window.MindWalk,world=root.querySelector('.walk-world'),actor=world.querySelector('.walk-actor'),label=root.querySelector('.walk-status'),action=root.querySelector('.walk-enter'),target=world.querySelector('.walk-target');
  const abort=new AbortController(),signal=abort.signal,keys=new Set(),touches=new Map();
  let pos=W.nearest(scene,initial||scene.spawn),path=[],frame=0,last=0,disposed=false,activated=false,facing=1,lastMessage='',wasMoving=false;
  function listen(el,type,fn,opts={}){el.addEventListener(type,fn,{...opts,signal});}
  function stop(){keys.clear();touches.clear();path=[];actor.classList.remove('walking');root.querySelectorAll('.walk-direction').forEach(b=>b.classList.remove('held'));target.hidden=true;last=0;}
  function destroy(){if(disposed)return;disposed=true;stop();cancelAnimationFrame(frame);abort.abort();onPosition({...pos});}
  function focus(){world.focus({preventScroll:true});}
  function blocked(){return document.hidden||!!document.querySelector('dialog[open]');}
  function message(value){if(value!==lastMessage){label.textContent=value;lastMessage=value;}}
  function paint(moving=false,dx=0){
    if(dx)facing=dx<0?-1:1;
    actor.style.left=(pos.x/W.WIDTH*100)+'%';actor.style.top=(pos.y/W.HEIGHT*100)+'%';
    actor.style.setProperty('--facing',facing);actor.style.setProperty('--depth',scene.kind==='campus'?(.76+pos.y/1300):1);
    actor.dataset.x=pos.x.toFixed(1);actor.dataset.y=pos.y.toFixed(1);actor.classList.toggle('walking',moving);
    const door=W.near(scene,pos);action.disabled=!door;action.textContent=door?'進入 '+door.name:'靠近入口即可進入';
    world.querySelectorAll('[data-walk-portal]').forEach(b=>b.classList.toggle('nearby',b.dataset.walkPortal===door?.id));
    message(path.length?'正在沿步道前往目的地 · 方向鍵可接手':door?'已到 '+door.name+' · 再靠近一點，或按 Enter 進入':scene.kind==='campus'?'校園漫遊 · 沿步道探索五座樓館':'樓館大廳 · 走向入口進入關卡，或回到校園');
  }
  function activate(door){if(!door||activated||disposed)return;activated=true;destroy();onPortal(door.id);}
  function toward(p){if(blocked())return;keys.clear();touches.clear();path=W.route(scene,pos,p);const end=path.at(-1);target.hidden=!end;if(end){target.style.left=end.x/10+'%';target.style.top=end.y/W.HEIGHT*100+'%';}focus();paint();}
  function keydown(e){
    if(e.altKey||e.ctrlKey||e.metaKey||blocked()||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(!root.contains(e.target)&&e.target!==document.body&&e.target!==document.getElementById('main'))return;
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    if(W.direction(key)||key==='Shift'){e.preventDefault();keys.add(key);path=[];target.hidden=true;}
    else if((key==='Enter'||key==='e')&&e.target===world){e.preventDefault();activate(W.near(scene,pos));}
    else if(key==='Escape'){stop();paint();}
  }
  listen(document,'keydown',keydown);listen(document,'keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
  listen(window,'blur',()=>{stop();paint();});listen(document,'visibilitychange',()=>{stop();paint();});
  listen(document,'focusin',e=>{if(!root.contains(e.target)){stop();paint();}});
  listen(world,'click',e=>{if(e.target.closest('button'))return;const r=world.getBoundingClientRect();toward({x:(e.clientX-r.left)/r.width*W.WIDTH,y:(e.clientY-r.top)/r.height*W.HEIGHT});});
  root.querySelectorAll('[data-walk-portal]').forEach(b=>listen(b,'click',()=>toward(scene.portals.find(p=>p.id===b.dataset.walkPortal))));
  listen(action,'click',()=>activate(W.near(scene,pos)));
  root.querySelectorAll('.walk-direction').forEach(b=>{
    const dir=b.dataset.direction;
    const release=e=>{touches.delete(e.pointerId);b.classList.remove('held');};
    listen(b,'pointerdown',e=>{if(e.button!==0||blocked())return;e.preventDefault();focus();path=[];target.hidden=true;touches.set(e.pointerId,dir);b.classList.add('held');b.setPointerCapture(e.pointerId);const d=W.direction(dir);pos=W.move(scene,pos,...d,.05);paint(true,d[0]);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,release);
    listen(b,'click',e=>{if(e.detail===0&&!blocked()){const d=W.direction(dir);path=[];pos=W.move(scene,pos,...d,.05);paint(true,d[0]);}});
  });
  function tick(now){
    if(disposed)return;if(!root.isConnected){destroy();return;}
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(blocked()){stop();paint();frame=requestAnimationFrame(tick);return;}
    let dx=0,dy=0;for(const key of [...keys,...touches.values()]){const d=W.direction(key);if(d){dx+=d[0];dy+=d[1];}}
    const before=pos;
    if(dx||dy)pos=W.move(scene,pos,dx,dy,dt,keys.has('Shift'));
    else if(path.length){let next=path[0];const dist=W.distance(pos,next);if(dist<=W.SPEED*dt){pos={...next};path.shift();if(!path.length)target.hidden=true;}else pos=W.move(scene,pos,next.x-pos.x,next.y-pos.y,dt);dx=pos.x-before.x;}
    const moved=W.distance(before,pos)>.001;if(moved||wasMoving)paint(moved,dx);wasMoving=moved;
    if(moved){const door=W.near(scene,pos,14);if(door){activate(door);return;}}
    frame=requestAnimationFrame(tick);
  }
  paint();frame=requestAnimationFrame(tick);
  return {destroy,toward};
};
