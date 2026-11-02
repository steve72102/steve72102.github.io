(function(root){
  'use strict';
  // This adapter changes a visual child only. World position, collisions, names,
  // saves, equipment IDs and the existing network movement intent stay untouched.
  const actors=new WeakMap(),media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const VIEWS=['right','down','left','up'],angles={right:0,down:90,left:180,up:270};
  const difference=(to,from)=>((to-from+540)%360)-180;
  function register(actor){
    if(!actor||!root.MindCharacterMotion)return actor;
    if(!actors.has(actor))actors.set(actor,{motion:root.MindCharacterMotion.create(),styles:new Map(),view:null,reduced:null,preference:null});
    actor.classList.add('motion-managed');return actor;
  }
  function style(actor,record,key,value){
    value=String(value);if(record.styles.get(key)===value)return;
    record.styles.set(key,value);actor.style.setProperty(key,value);
  }
  function attribute(actor,key,value){if(actor.dataset[key]!==value)actor.dataset[key]=value;}
  function update(actor,input){
    if(!root.MindCharacterMotion)return null;
    if(!actors.has(actor))register(actor);
    const record=actors.get(actor);if(!record)return null;
    const reduced=input.reducedMotion??!!media?.matches;
    record.motion=root.MindCharacterMotion.update(record.motion,{...input,reducedMotion:reduced});
    record.reduced=reduced;record.preference=!!media?.matches;const visual=record.motion.visual;
    // The available artwork has cardinal views. A small dead band prevents a
    // diagonal input from repeatedly swapping the same two pictures.
    const candidate=VIEWS[Math.round(visual.angle/90)%4];
    if(!record.view||input.teleport||Math.abs(difference(visual.angle,angles[record.view]))>51)record.view=candidate;
    const moving=visual.moving&&!reduced,run=visual.action==='run'&&!reduced;
    actor.classList.toggle('walking',moving);
    attribute(actor,'motionAction',visual.action);attribute(actor,'motionView',record.view);
    attribute(actor,'motionReduced',reduced?'true':'false');
    style(actor,record,'--motion-column',record.view==='up'?'33.333333%':record.view==='down'?'0%':'100%');
    style(actor,record,'--motion-row',run&&visual.phase>=.5?'100%':'0%');
    style(actor,record,'--motion-mirror',record.view==='left'?-1:1);
    // Restrained weight shift and landing response, bounded around the original
    // foot anchor. Static equipped art is not advertised as new limb animation.
    const stride=run?Math.sin(visual.phase*Math.PI*2):0;
    const lean=reduced?0:run?Math.cos(visual.angle*Math.PI/180)*1.2+stride*.55:visual.action==='push'?Math.cos(visual.angle*Math.PI/180)*.7:0;
    const landing=!reduced&&visual.action==='land'?1-visual.landProgress:0;
    const rise=!reduced&&visual.action==='rise';
    style(actor,record,'--motion-lean',lean.toFixed(3)+'deg');
    style(actor,record,'--motion-scale-x',(1+landing*.018-(rise?.006:0)).toFixed(4));
    style(actor,record,'--motion-scale-y',(1-landing*.035+(rise?.012:0)).toFixed(4));
    return visual;
  }
  function needsFrame(actor){
    // One stationary sample after the final interpolated move stops the gait.
    // Otherwise a remote with intent=false could remain on its last run frame.
    const record=actors.get(actor);return !!record&&(record.motion.visual.moving||record.motion.visual.needsFrame||record.preference!==!!media?.matches);
  }
  function dispose(actor){
    const record=actors.get(actor);if(!record)return;
    for(const key of record.styles.keys())actor.style.removeProperty?.(key);
    actor.classList.remove('motion-managed');delete actor.dataset.motionAction;delete actor.dataset.motionView;delete actor.dataset.motionReduced;
    actors.delete(actor);
  }
  root.MindAvatarMotion={register,update,needsFrame,dispose};
})(typeof window==='object'?window:globalThis);
