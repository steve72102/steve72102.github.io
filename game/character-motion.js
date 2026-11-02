(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindCharacterMotion=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Presentation only: no world position, collision, save or network mutation.
  // Angles use screen coordinates: right=0, down=90, left=180, up=270.
  const HEADINGS=Object.freeze(['right','down-right','down','down-left','left','up-left','up','up-right']);
  const STRIDE_DISTANCE=64,TURN_MS=65,LAND_MS=140,MAX_GAP_MS=250,EPSILON=.001;
  const wrap=value=>(value%360+360)%360,unit=value=>((value%1)+1)%1,clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const difference=(to,from)=>((to-from+540)%360)-180;
  const headingIndex=angle=>Math.round(wrap(angle)/45)%8;
  function finite(value,label){if(!Number.isFinite(value))throw TypeError('Invalid character motion '+label);return value;}
  function emptyVisual(){return {heading:'down',headingIndex:2,targetHeading:'down',angle:90,targetAngle:90,turning:false,turnBlend:1,phase:0,frame:0,speed:0,moving:false,action:'idle',landProgress:1,reducedMotion:false,needsFrame:false};}
  function create(){return {sample:null,angle:90,targetAngle:90,turnTravel:0,turnSign:1,phase:0,headingIndex:2,airborne:false,landAt:null,visual:emptyVisual()};}
  function update(previous,input){
    if(!input||typeof input!=='object')throw TypeError('Character motion needs a position sample');
    const x=finite(input.x,'x'),y=finite(input.y,'y'),z=finite(input.z??0,'z'),time=finite(input.time,'time'),scale=finite(input.scale??1,'scale');
    if(scale<=0)throw TypeError('Character motion scale must be positive');
    const groundZ=finite(input.groundZ??0,'groundZ'),scene=String(input.scene??''),intent=input.intent===true,reducedMotion=input.reducedMotion===true;
    const prev=previous?.sample?previous:create(),sample=prev.sample,dt=sample?time-sample.time:0,dx=sample?x-sample.x:0,dy=sample?y-sample.y:0,dz=sample?z-sample.z:0,distance=Math.hypot(dx,dy);
    // Consumers can skip idle drawings while their RAF clock keeps advancing.
    // Resume with this frame's duration, never the accumulated time at rest.
    const frameMs=input.frameMs===undefined?dt:finite(input.frameMs,'frameMs');
    if(frameMs<0&&input.frameMs!==undefined)throw TypeError('Character motion frameMs must not be negative');
    const continuousRest=input.frameMs!==undefined&&frameMs<=MAX_GAP_MS&&['idle','push'].includes(prev.visual.action);
    const explicitVelocity=input.verticalVelocity===undefined?null:finite(input.verticalVelocity,'verticalVelocity');
    const velocity=explicitVelocity??(dt>0?clamp(dz*1000/dt,-2000/scale,2000/scale):0);
    const airborne=typeof input.airborne==='boolean'?input.airborne:z>groundZ+.05||velocity>.05;
    const hinted=HEADINGS.indexOf(input.direction),hint=hinted<0?prev.targetAngle:hinted*45;
    // A delayed tab, scene transfer or correction must not look like a sprint.
    // The threshold exceeds legal running/jumping deltas; it changes only poses.
    const reset=!sample||input.teleport===true||scene!==sample.scene||scale!==sample.scale||dt<0||(dt>MAX_GAP_MS&&!continuousRest)||frameMs>MAX_GAP_MS||distance>Math.max(48/scale,Math.max(0,frameMs)*.6/scale)||Math.abs(dz)>150/scale+Math.max(0,dt)/scale;
    if(reset){
      const angle=wrap(hint),index=headingIndex(angle),action=airborne?(velocity>0?'rise':'fall'):'idle';
      return {sample:{x,y,z,time,scene,scale},angle,targetAngle:angle,turnTravel:0,turnSign:1,phase:0,headingIndex:index,airborne,landAt:null,visual:{...emptyVisual(),heading:HEADINGS[index],headingIndex:index,targetHeading:HEADINGS[index],angle,targetAngle:angle,action,reducedMotion}};
    }
    const moving=distance>EPSILON;
    // Wall slides face the displacement, not the requested (blocked) vector.
    const targetAngle=moving?wrap(Math.atan2(dy,dx)*180/Math.PI):intent?wrap(hint):prev.targetAngle;
    let turn=difference(targetAngle,prev.angle),turnSign=prev.turnSign;
    if(Math.abs(turn)===180)turn=180*turnSign;
    else if(Math.abs(turn)>.01)turnSign=Math.sign(turn);
    const turnTravel=Math.abs(difference(targetAngle,prev.targetAngle))>.01?Math.abs(turn):prev.turnTravel;
    let angle=reducedMotion?targetAngle:wrap(prev.angle+turn*(1-Math.exp(-Math.max(0,frameMs)/TURN_MS)));
    if(Math.abs(difference(targetAngle,angle))<.6)angle=targetAngle;
    const error=Math.abs(difference(targetAngle,angle)),turning=!reducedMotion&&error>.6;
    // Four degrees of hysteresis avoid alternating views at a diagonal boundary.
    const index=Math.abs(difference(angle,prev.headingIndex*45))<=26.5?prev.headingIndex:headingIndex(angle);
    let landAt=reducedMotion||airborne?null:prev.airborne?time:prev.landAt;
    if(landAt!==null&&time-landAt>=LAND_MS)landAt=null;
    const landProgress=landAt===null?1:clamp((time-landAt)/LAND_MS,0,1);
    const phase=reducedMotion?0:!airborne&&!prev.airborne?unit(prev.phase+distance*scale/STRIDE_DISTANCE):prev.phase;
    const action=airborne?(velocity>0?'rise':'fall'):landAt!==null?'land':moving?'run':intent&&dt>0?'push':'idle';
    const frame=!reducedMotion&&action==='run'?1+Math.floor(phase*8):0;
    const visual={heading:HEADINGS[index],headingIndex:index,targetHeading:HEADINGS[headingIndex(targetAngle)],angle,targetAngle,turning,turnBlend:turning?clamp(1-error/Math.max(1,turnTravel),0,1):1,phase,frame,speed:frameMs>0?distance*1000/frameMs:0,moving,action,landProgress,reducedMotion,needsFrame:turning||landAt!==null};
    return {sample:{x,y,z,time,scene,scale},angle,targetAngle,turnTravel,turnSign,phase,headingIndex:index,airborne,landAt,visual};
  }
  return {HEADINGS,STRIDE_DISTANCE,TURN_MS,LAND_MS,MAX_GAP_MS,create,update};
});
