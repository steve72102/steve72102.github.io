window.MindSceneUI=function({node}){
  const W=window.MindWalk,P=window.MindScenePlay;
  function furniture(scene){return (scene.surfaces||[]).filter(s=>!s.hidden).map(s=>{const el=node('div',{class:'scene-furniture '+(s.id==='table'?'scene-table':'scene-chair')+(s.id==='chair-right'?' chair-mirror':''),'aria-hidden':'true','data-furniture-id':s.id},node('img',{class:'furniture-art',src:'./assets/academy/'+(s.id==='table'?'study-table.webp':'study-chair.webp'),alt:'',draggable:'false'}));el.style.cssText='left:'+s.x/10+'%;top:'+s.y/W.HEIGHT*100+'%;width:'+s.w/10+'%;height:'+s.d/W.HEIGHT*100+'%;--rise:'+s.height/10+'cqw;z-index:'+(30+Math.round(s.y/10));return el;});}
  function props(scene){
    if(!['hall','classroom'].includes(scene.kind))return [];
    return [...furniture(scene),...scene.glass.flatMap(d=>{
      const lab=d.kind!=='cup',i=['beaker','flask','cylinder','round-flask'].indexOf(d.kind);
      const art=lab?node('span',{class:'lab-glass-art'}):node('img',{src:'./assets/academy/glass-cup.webp',alt:'',draggable:'false'});
      if(lab)art.style.backgroundPosition=(i%2*100)+'% '+(Math.floor(i/2)*100)+'%';
      const cup=node('div',{class:'scene-cup'+(lab?' lab-glass':''),'data-prop-id':d.id,role:'img','aria-label':lab?'玻璃實驗器皿':'桌上的玻璃杯'},art);
      cup.style.width=d.width/10+'cqw';cup.style.setProperty('--glass-foot',([90.6,93.3,93.8,90.9][i]||95.5)+'%');
      return [cup,node('div',{class:'scene-shards','data-prop-id':d.id,role:'img','aria-label':'碎玻璃',hidden:true},Array.from({length:8},(_,i)=>{const piece=node('i');piece.style.setProperty('--i',i);return piece;}))];
    }),node('div',{class:'scene-health',role:'status','aria-live':'polite',hidden:true})];
  }
  function render(world,sceneId,state,players,mine,now){
    if(!world)return;
    if(P.scenes.includes(sceneId))for(const s of P.scene(sceneId,state).surfaces.filter(s=>!s.hidden)){const el=world.querySelector('[data-furniture-id="'+s.id+'"]');if(el){el.style.left=s.x/10+'%';el.style.top=s.y/W.HEIGHT*100+'%';el.style.zIndex=String(30+Math.round(s.y/10));}}
    for(const d of P.definitions(sceneId)){
      const c=P.cup(state,sceneId,d.id),cup=world.querySelector('.scene-cup[data-prop-id="'+d.id+'"]'),glass=world.querySelector('.scene-shards[data-prop-id="'+d.id+'"]'),height=P.scene(sceneId,state).surfaces.find(s=>s.id===d.surface).height;
      const broken=c.brokenUntil>now,elapsed=broken?P.GLASS_MS-(c.brokenUntil-now):0,fall=broken?Math.max(0,1-elapsed/350):1;
      if(cup){cup.hidden=broken&&(d.fragile||fall<=0);cup.classList.toggle('falling',broken);cup.style.setProperty('--rise',(broken?c.z+(height-c.z)*fall:height)/10+'cqw');cup.style.left=c.x/10+'%';cup.style.top=c.y/W.HEIGHT*100+'%';cup.style.zIndex=String(31+Math.round(c.y/10)+15);}
      if(glass){glass.hidden=!broken;glass.classList.toggle('fresh-shards',broken&&elapsed<450);glass.style.setProperty('--rise',c.z/10+'cqw');glass.style.left=c.x/10+'%';glass.style.top=c.y/W.HEIGHT*100+'%';glass.style.zIndex=String(c.z?31+Math.round(c.y/10)+15:28);}
    }
    for(const actor of world.querySelectorAll('.walk-actor')){const id=actor.dataset.playerId||mine,end=state.injuries[id]||0;actor.classList.toggle('bleeding',end>now);}
    const health=world.closest('.walk-section')?.querySelector('.scene-health'),end=state.injuries[mine]||0;
    if(health){health.hidden=end<=now;health.textContent='踩到碎玻璃 · '+Math.max(0,Math.ceil((end-now)/1000))+' 秒後止血';}
  }
  const ambient=window.MindAmbient({node});
  return {props,render,...ambient};
};
