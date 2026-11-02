window.MindWalkUI=function(options){
  'use strict';
  const {root,scene,initial,onPosition,onPortal,onMotion=()=>{},onPush=()=>{},onRouteCancel=()=>{}}=options;
  const W=window.MindWalk,world=root.querySelector('.walk-world'),actor=world.querySelector('.walk-actor'),label=root.querySelector('.walk-status'),action=root.querySelector('.walk-enter'),target=world.querySelector('.walk-target');
  const abort=new AbortController(),signal=abort.signal,keys=new Set(),touches=new Map();
  const motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)'),motionScene=options.sceneId||scene.roomKey||scene.kind;
  let frameTime=0,motionFresh=true;
  let gesture=null,suppressClickUntil=0;const stick=root.querySelector('.walk-touch-stick'),knob=stick?.querySelector('i'),joystick=root.querySelector('.walk-joystick'),joyKnob=joystick?.querySelector('i');
  function resetKnobs(){if(knob)knob.style.transform='';if(joyKnob)joyKnob.style.transform='';joystick?.classList.remove('held');}
  let z=0,vz=0,jumpUntil=-Infinity,lastGroundedAt=-Infinity,jumpSpent=false,armed=null,latched=null;let pos=W.nearest(scene,initial||scene.spawn),path=[],frame=0,last=0,disposed=false,activated=false,facing=1,direction='down',lastMessage='',wasMoving=false;
  function listen(el,type,fn,opts={}){el.addEventListener(type,fn,{...opts,signal});}
  function stop(){jumpUntil=-Infinity;lastGroundedAt=-Infinity;armed=null;gesture=null;resetKnobs();if(stick)stick.hidden=true;keys.clear();touches.clear();path=[];actor.classList.remove('walking');root.querySelectorAll('.walk-direction').forEach(b=>b.classList.remove('held'));target.hidden=true;last=0;}
  function destroy(){if(disposed)return;disposed=true;stop();cancelAnimationFrame(frame);abort.abort();window.MindAvatarMotion?.dispose(actor);onPosition({...pos});}
  function focus(){world.focus({preventScroll:true});}
  function blocked(){return document.hidden||!!document.querySelector('dialog[open]');}
  function message(value){if(value!==lastMessage){label.textContent=value;lastMessage=value;}}
  function nearbyAction(){const portal=W.near(scene,pos);if(portal)return portal;return (scene.inspections||[]).filter(item=>W.distance(pos,item)<=40/(scene.scale||1)).sort((a,b)=>W.distance(pos,a)-W.distance(pos,b))[0]||null;}
  function drawMotion(moving,now=window.performance?.now?.()??frameTime,frameMs=0){
    if(disposed||!window.MindAvatarMotion)return;
    const groundZ=W.surface(scene,pos,z)?.height||0;
    window.MindAvatarMotion.update(actor,{...pos,z,time:now,frameMs,scene:motionScene,scale:scene.scale||1,groundZ,airborne:vz!==0||z>groundZ+.05,verticalVelocity:vz,intent:moving,direction,reducedMotion:motionPreference?.matches===true,teleport:motionFresh});
    motionFresh=false;
  }
  function paint(moving=false,dx=0,dy=0,now=window.performance?.now?.()??frameTime,frameMs=0){
    if(dx)facing=dx<0?-1:1;
    if(dx||dy)direction=Math.abs(dy)>Math.abs(dx)?dy<0?'up':'down':dx<0?'left':'right';
    actor.style.left=(pos.x/W.WIDTH*100)+'%';actor.style.top=(pos.y/W.HEIGHT*100)+'%';
    actor.style.setProperty('--facing',facing);actor.style.setProperty('--depth',scene.kind!=='hall'?(.76+pos.y/1300):1);
    actor.style.setProperty('--lift',(z*(world.offsetHeight||667)/667)+'px');actor.dataset.z=z.toFixed(1);actor.classList.toggle('jumping',vz!==0);actor.dataset.x=pos.x.toFixed(1);actor.dataset.y=pos.y.toFixed(1);actor.dataset.direction=direction;actor.classList.toggle('walking',moving);actor.style.zIndex=String(30+Math.round(pos.y/10)+(z>0?15:0));
    wasMoving=moving;drawMotion(moving,now,frameMs);
    onMotion({...pos,z,direction,moving});camera();
    const door=nearbyAction();action.disabled=!door;action.textContent=door?(door.verb||'進入')+' '+door.name:'走近標記即可互動';
    world.querySelectorAll('[data-walk-portal]').forEach(b=>b.classList.toggle('nearby',b.dataset.walkPortal===door?.id));
    message(path.length?'正在前往目的地 · 方向鍵可接手':door?'已到 '+door.name+' · 按 Enter 互動':scene.kind!=='hall'?'校園漫遊 · 點地面跑動，空白鍵跳躍':'樓館大廳 · 沿樓梯前往下一層');
  }
  function camera(){const viewport=root.querySelector('.world-viewport');if(!viewport)return;if(!document.body.classList.contains('academy-immersive')){world.style.transform='';return;}const width=world.offsetWidth,height=world.offsetHeight,x=Math.min(0,Math.max(viewport.clientWidth-width,viewport.clientWidth/2-pos.x/W.WIDTH*width)),y=Math.min(0,Math.max(viewport.clientHeight-height,viewport.clientHeight*.58-(pos.y-Math.max(0,z-70))/W.HEIGHT*height));world.style.transform='translate3d('+x+'px,'+y+'px,0)';}
  function activate(door){if(!door||activated||disposed)return;latched=door.id;armed=null;stop();paint();if(door.kind!=='inspect'){activated=true;destroy();}onPortal(door.id);}
  function grounded(){return vz<=0&&Math.abs(z-(W.surface(scene,pos,z)?.height||0))<=.1&&W.walkable(scene,pos,z);}
  function launchJump(now){
    const supported=grounded();if(supported){lastGroundedAt=now;jumpSpent=false;}
    if(jumpUntil<now){jumpUntil=-Infinity;return false;}
    if(jumpSpent||(!supported&&now-lastGroundedAt>W.JUMP.coyoteMs))return false;
    vz=W.jumpVelocity(scene);jumpUntil=-Infinity;lastGroundedAt=-Infinity;jumpSpent=true;return true;
  }
  function jump(){if(blocked()||disposed)return;onRouteCancel();path=[];armed=null;target.hidden=true;const now=window.performance?.now?.()??frameTime;jumpUntil=now+W.JUMP.bufferMs;launchJump(now);focus();}
  function push(){if(blocked())return;onPush(direction);focus();}
  const jumpButton=root.querySelector('.walk-jump'),pushButton=root.querySelector('.walk-push');if(jumpButton)listen(jumpButton,'click',jump);if(pushButton)listen(pushButton,'click',push);
  function toward(p){if(blocked()||!p||disposed)return;stop();armed=p.id||null;latched=null;path=W.route(scene,pos,p);const end=path.at(-1);target.hidden=!end;if(end){target.style.left=end.x/10+'%';target.style.top=end.y/W.HEIGHT*100+'%';}focus();paint();}
  function keydown(e){
    if(e.altKey||e.ctrlKey||e.metaKey||blocked()||e.target.closest('input,textarea,select,button,a,summary,[role="button"],[contenteditable="true"]'))return;
    if(!root.contains(e.target)&&e.target!==document.body&&e.target!==document.getElementById('main'))return;
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    if(W.direction(key)||key==='Shift'){e.preventDefault();onRouteCancel();keys.add(key);path=[];armed=null;target.hidden=true;}
    else if(key===' '&&!e.repeat){e.preventDefault();jump();}
    else if((key==='Enter'||key==='e')&&!e.repeat&&e.target===world){e.preventDefault();activate(nearbyAction());}
    else if(key==='Escape'){stop();paint();}
  }
  listen(document,'keydown',keydown);listen(document,'keyup',e=>{const released=keys.delete(e.key.length===1?e.key.toLowerCase():e.key);if(released&&!path.length&&!touches.size&&![...keys].some(key=>W.direction(key))&&!(gesture?.active&&(gesture.dx||gesture.dy)))paint();});
  listen(window,'blur',()=>{stop();paint();});listen(document,'visibilitychange',()=>{stop();paint();});
  listen(window,'resize',camera);
  if(motionPreference?.addEventListener)listen(motionPreference,'change',()=>drawMotion(wasMoving));
  listen(document,'focusin',e=>{if(!root.contains(e.target)){stop();paint();}});
  listen(world,'click',e=>{if(e.target.closest('button,[role="button"]')||Date.now()<suppressClickUntil)return;onRouteCancel();const r=world.getBoundingClientRect();toward({x:(e.clientX-r.left)/r.width*W.WIDTH,y:(e.clientY-r.top)/r.height*W.HEIGHT});});
  root.querySelectorAll('[data-walk-portal]').forEach(b=>listen(b,'click',()=>{onRouteCancel();toward(scene.portals.find(p=>p.id===b.dataset.walkPortal));}));

  function steer(){
    if(!gesture)return;if(!gesture.active){gesture.active=true;keys.clear();touches.clear();path=[];armed=null;target.hidden=true;onRouteCancel();focus();}
    if(gesture.fixed)joystick?.classList.add('held');
    if(stick&&!gesture.fixed){stick.hidden=false;stick.style.left=gesture.x+'px';stick.style.top=gesture.y+'px';}
    const activeKnob=gesture.fixed?joyKnob:knob;if(activeKnob)activeKnob.style.transform='translate('+gesture.dx*34+'px,'+gesture.dy*34+'px)';
  }
  listen(world,'pointerdown',e=>{
    if(!['touch','pen'].includes(e.pointerType)||gesture||blocked()||e.target.closest('button,[role="button"],input,select,textarea,a'))return;
    e.preventDefault();keys.clear();touches.clear();path=[];armed=null;target.hidden=true;onRouteCancel();paint();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dx:0,dy:0,active:false,started:null};
    world.setPointerCapture(e.pointerId);suppressClickUntil=Date.now()+700;
  });
  function moveGesture(e){
    if(!gesture||e.pointerId!==gesture.id)return;e.preventDefault();gesture.lastX=e.clientX;gesture.lastY=e.clientY;
    const x=e.clientX-gesture.x,y=e.clientY-gesture.y,d=Math.hypot(x,y),scale=Math.max(48,d);
    gesture.dx=d<8?0:x/scale;gesture.dy=d<8?0:y/scale;if(d>=10||gesture.active)steer();
  }
  listen(world,'pointermove',moveGesture);
  function releaseGesture(e){
    if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;resetKnobs();if(stick)stick.hidden=true;
    suppressClickUntil=Date.now()+700;e.preventDefault();
    if(e.type==='pointerup'&&!g.fixed&&!g.active&&!blocked()){onRouteCancel();const r=world.getBoundingClientRect();toward({x:(g.lastX-r.left)/r.width*W.WIDTH,y:(g.lastY-r.top)/r.height*W.HEIGHT});}
    else{path=[];target.hidden=true;paint();}
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(world,type,releaseGesture);

  if(joystick){
    listen(joystick,'pointerdown',e=>{
      if(gesture||blocked()||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();stop();onRouteCancel();armed=null;focus();
      const r=joystick.getBoundingClientRect();gesture={id:e.pointerId,x:r.left+r.width/2,y:r.top+r.height/2,lastX:e.clientX,lastY:e.clientY,dx:0,dy:0,active:true,fixed:true,started:null};
      joystick.setPointerCapture(e.pointerId);suppressClickUntil=Date.now()+700;moveGesture(e);steer();
    });
    listen(joystick,'pointermove',moveGesture);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(joystick,type,releaseGesture);
    listen(joystick,'click',e=>e.preventDefault());
  }
  listen(action,'click',()=>activate(nearbyAction()));
  root.querySelectorAll('.walk-direction').forEach(b=>{
    const dir=b.dataset.direction;
    const release=e=>{touches.delete(e.pointerId);b.classList.remove('held');if(!touches.size&&!keys.size&&!path.length)paint();};
    listen(b,'pointerdown',e=>{if(e.button!==0||blocked())return;e.preventDefault();onRouteCancel();focus();path=[];armed=null;target.hidden=true;touches.set(e.pointerId,dir);b.classList.add('held');b.setPointerCapture(e.pointerId);const d=W.direction(dir);pos=W.move(scene,pos,...d,.05,false,z);paint(true,d[0],d[1],undefined,50);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,release);
    listen(b,'click',e=>{if(e.detail===0&&!blocked()){onRouteCancel();const d=W.direction(dir);path=[];armed=null;target.hidden=true;pos=W.move(scene,pos,...d,.05,false,z);paint(true,d[0],d[1],undefined,50);}});
  });
  function tick(now){
    if(disposed)return;if(!root.isConnected){destroy();return;}
    const frameMs=frameTime?Math.max(0,now-frameTime):0,dt=last?Math.max(0,Math.min(.05,(now-last)/1000)):0;last=now;frameTime=now;
    if(blocked()){if(wasMoving||keys.size||touches.size||path.length||gesture||jumpUntil>-Infinity){stop();paint(false,0,0,now,frameMs);wasMoving=false;}else if(window.MindAvatarMotion?.needsFrame(actor))drawMotion(false,now,frameMs);last=0;frame=requestAnimationFrame(tick);return;}
    let dx=0,dy=0;for(const key of [...keys,...touches.values()]){const d=W.direction(key);if(d){dx+=d[0];dy+=d[1];}}
    if(gesture){if(gesture.started===null)gesture.started=now;if(!gesture.active&&now-gesture.started>=160)steer();if(gesture.active){dx+=gesture.dx;dy+=gesture.dy;}}
    const before=pos,beforeZ=z,following=!(dx||dy)&&path.length>0;let destination=null;
    launchJump(now);
    if(following){
      // Another player may have pushed furniture after this route was planned.
      if(!W.clear(scene,pos,path[0],z))path=W.route(scene,pos,path.at(-1));
      const next=path[0];
      if(next&&W.clear(scene,pos,next,z)){destination=next;dx=next.x-pos.x;dy=next.y-pos.y;}
      else{path=[];armed=null;}
    }
    const motion=W.jumpMove(scene,{...pos,z,vz},dx,dy,dt,!following&&keys.has('Shift'),destination);
    pos={x:motion.x,y:motion.y};z=motion.z;vz=motion.vz;
    if(following){if(destination&&W.distance(pos,destination)<.001)path.shift();if(!path.length)target.hidden=true;dx=pos.x-before.x;dy=pos.y-before.y;}
    if(motion.grounded||motion.landed){lastGroundedAt=now;jumpSpent=false;launchJump(now);}
    const moved=W.distance(before,pos)>.001,intent=moved||!!(dx||dy);if(intent||wasMoving||beforeZ!==z)paint(intent,dx,dy,now,frameMs);else if(window.MindAvatarMotion?.needsFrame(actor))drawMotion(false,now,frameMs);wasMoving=intent;
    const door=armed?scene.portals.find(p=>p.id===armed&&W.distance(p,pos)<=14/(scene.scale||1)):W.near(scene,pos,14);if(!door||door.id!==latched)latched=null;
    if(door&&door.id!==latched&&z<1&&(moved||armed===door.id)&&(door.auto!==false||armed===door.id)){activate(door);if(disposed)return;}
    frame=requestAnimationFrame(tick);
  }
  paint();frame=requestAnimationFrame(tick);
  return {destroy,toward,reframe:camera};
};
