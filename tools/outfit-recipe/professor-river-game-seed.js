/* Local HTTP QA fixture only. Injected by serve-professor-candidate.py; never shipped. */
(() => {
  'use strict';
  const E=window.MindEngine,C=window.MindCombat,A=window.MindAcademy,J=window.MindJourney,R=window.MindAdventure;
  const raw=Object.assign(E.fresh(),{arena:C.fresh(),appearance:A.fresh(),profile:J.profile(),rpg:R.fresh(),wishes:window.MindWish.fresh()});
  raw.appearance.character='professor';
  raw.profile={version:1,name:'教授分件隔離驗收',enrolled:true};
  raw.xp=2000;
  Object.assign(raw.rpg.loadout,{
    jacket:'wish-river-coat',cape:null,
    shirt:'style-fusion-academy-crossline-professor-common-shirt',
    pants:'style-fusion-academy-crossline-professor-common-pants',
    shoes:'style-fusion-academy-crossline-professor-common-shoes',hat:null,
    accessory:'style-fusion-academy-crossline-professor-common-accessory',
    handheld:'style-fusion-academy-crossline-professor-common-handheld'
  });
  for(const id of Object.values(raw.rpg.loadout))if(id)raw.rpg.items[id]=1;
  const fixture=JSON.stringify(raw),read=Storage.prototype.getItem,write=Storage.prototype.setItem;
  Storage.prototype.getItem=function(key){return key==='mind-quest-save-v4'?fixture:read.call(this,key)};
  Storage.prototype.setItem=function(key,value){if(key==='mind-quest-save-v4')return;return write.call(this,key,value)};
  document.documentElement.dataset.professorQa='in-memory-save';
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.createElement('button');
    button.id='professor-qa-run';button.type='button';button.textContent='QA：朝畫面下方跑';
    button.style.cssText='position:fixed;z-index:99999;left:8px;top:90px;padding:8px;background:#173b32;color:white';
    button.addEventListener('click',()=>{
      const observations=[];
      const sample=setInterval(()=>{
        const actor=document.querySelector('.walk-actor.local-actor');
        if(actor)observations.push([actor.dataset.motionAction,actor.dataset.paintedDirection,actor.dataset.paintedSheet,actor.dataset.paintedFrame,actor.dataset.paintedAssetStatus]);
      },50);
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
      setTimeout(()=>{
        document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',bubbles:true}));
        clearInterval(sample);
        document.documentElement.dataset.qaRunSamples=JSON.stringify(observations);
        document.documentElement.dataset.qaRunFinished='true';
      },4500);
    });
    document.body.append(button);
  });
})();
