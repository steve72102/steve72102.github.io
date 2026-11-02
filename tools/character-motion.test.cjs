const test=require('node:test'),assert=require('node:assert/strict'),M=require('../game/character-motion.js');
const sample=(changes={})=>({x:100,y:100,z:0,groundZ:0,time:0,scene:'hall:herbal:practice',direction:'down',scale:1,intent:false,...changes});
const start=changes=>M.update(M.create(),sample(changes));
const close=(a,b,epsilon=1e-9)=>assert(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

test('actual displacement selects all eight headings even when the requested direction differs',()=>{
  const vectors=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  for(let i=0;i<vectors.length;i++){
    const [dx,dy]=vectors[i],previous=freeze(start({direction:M.HEADINGS[i]})),input=freeze(sample({x:100+dx*3,y:100+dy*3,time:20,intent:true,direction:'down'}));
    const result=M.update(previous,input);
    assert.equal(result.visual.targetHeading,M.HEADINGS[i]);assert.equal(result.visual.heading,M.HEADINGS[i]);assert.equal(result.visual.action,'run');assert(result.visual.frame>=1&&result.visual.frame<=8);
    assert.equal(previous.sample.x,100);assert.equal(input.x,100+dx*3);assert.notEqual(result.sample,previous.sample);
  }
});

test('stride follows distance, not display refresh rate, and sprinting advances it faster',()=>{
  function travel(frames,speed=135,scale=1){let state=start({scale,direction:'right'});for(let i=1;i<=frames;i++)state=M.update(state,sample({x:100+speed/scale*i/frames*.2,time:200*i/frames,scale,direction:'right',intent:true}));return state;}
  const at30=travel(6),at60=travel(12),at144=travel(29),sprint=travel(12,202.5),scaled=travel(12,135,1.25);
  close(at30.visual.phase,at60.visual.phase);close(at60.visual.phase,at144.visual.phase);close(at60.visual.phase,scaled.visual.phase);
  close(at60.visual.speed,135);close(sprint.visual.speed,202.5);close(sprint.visual.phase,40.5/M.STRIDE_DISTANCE);
  assert(sprint.visual.phase>at60.visual.phase);assert.equal(at60.sample.x,127,'presentation cannot add inertia to the supplied position');
});

test('a blocked player braces without running in place, then stops immediately on release',()=>{
  let state=start({direction:'right'});state=M.update(state,sample({x:104,time:20,direction:'right',intent:true}));const phase=state.visual.phase;
  state=M.update(state,sample({x:104,time:40,direction:'right',intent:true}));assert.equal(state.visual.action,'push');assert.equal(state.visual.moving,false);assert.equal(state.visual.frame,0);close(state.visual.phase,phase);
  state=M.update(state,sample({x:104,time:41,direction:'right',intent:false}));assert.equal(state.visual.action,'idle');assert.equal(state.visual.moving,false);assert.equal(state.visual.speed,0);assert.equal(state.sample.x,104);assert.equal(state.visual.needsFrame,false);
});

test('reverse turns ease visually and settle without moving the world coordinates',()=>{
  let state=start({direction:'right'});state=M.update(state,sample({x:96,time:20,direction:'left',intent:true}));
  assert.equal(state.visual.targetAngle,180);assert(state.visual.angle>0&&state.visual.angle<180);assert.equal(state.visual.turning,true);assert(state.visual.turnBlend>0&&state.visual.turnBlend<1);
  let previous=state.visual.angle;
  for(let time=40;time<=500;time+=20){state=M.update(state,sample({x:96,time,direction:'left',intent:false}));assert(state.visual.angle>=previous);assert.equal(state.sample.x,96);assert.equal(state.visual.action,'idle');previous=state.visual.angle;}
  assert.equal(state.visual.angle,180);assert.equal(state.visual.heading,'left');assert.equal(state.visual.turning,false);assert.equal(state.visual.needsFrame,false);
});

test('a turn across zero uses the short arc and boundary jitter cannot alternate views',()=>{
  let state=start({direction:'up-right'});state=M.update(state,sample({x:103,y:103,time:20,intent:true}));assert(state.visual.angle>315&&state.visual.angle<360,'315° to 45° turns through zero');
  state=start({direction:'right'});let x=100,y=100,time=0;
  for(const angle of [22,24,22,25,23,24]){x+=3*Math.cos(angle*Math.PI/180);y+=3*Math.sin(angle*Math.PI/180);time+=20;state=M.update(state,sample({x,y,time,intent:true,reducedMotion:true}));assert.equal(state.visual.heading,'right');}
  x+=3*Math.cos(30*Math.PI/180);y+=3*Math.sin(30*Math.PI/180);state=M.update(state,sample({x,y,time:time+20,intent:true,reducedMotion:true}));assert.equal(state.visual.heading,'down-right');
});

test('rise, apex, fall and landing derive from elevation while stride pauses in air',()=>{
  let state=start();state=M.update(state,sample({x:102,time:20,intent:true}));const phase=state.visual.phase;
  state=M.update(state,sample({x:104,z:8,time:40,airborne:true,verticalVelocity:300,intent:true}));assert.equal(state.visual.action,'rise');close(state.visual.phase,phase);
  state=M.update(state,sample({x:106,z:30,time:100,airborne:true,verticalVelocity:0,intent:false}));assert.equal(state.visual.action,'fall');assert.equal(state.visual.frame,0);close(state.visual.phase,phase);
  state=M.update(state,sample({x:106,z:14,time:160,airborne:true,verticalVelocity:-260}));assert.equal(state.visual.action,'fall');
  state=M.update(state,sample({x:106,z:0,time:220,airborne:false,verticalVelocity:0}));assert.equal(state.visual.action,'land');assert.equal(state.visual.landProgress,0);assert.equal(state.visual.needsFrame,true);
  state=M.update(state,sample({x:106,time:290}));close(state.visual.landProgress,.5);
  state=M.update(state,sample({x:106,time:360}));assert.equal(state.visual.action,'idle');assert.equal(state.visual.needsFrame,false);assert.equal(state.visual.landProgress,1);
});

test('a tabletop is ground at its support height, including remote inferred landings',()=>{
  let state=start({z:52,groundZ:52});assert.equal(state.visual.action,'idle');
  state=M.update(state,sample({x:103,z:52,groundZ:52,time:20,intent:true}));assert.equal(state.visual.action,'run');
  state=M.update(state,sample({x:105,z:60,groundZ:0,time:40}));assert.equal(state.visual.action,'rise');
  state=M.update(state,sample({x:105,z:52,groundZ:52,time:80}));assert.equal(state.visual.action,'land');
});

test('teleports, new floors, long frame gaps, reversed clocks and scale changes reset the gait',()=>{
  const moving=M.update(start({direction:'right'}),sample({x:104,time:20,intent:true,direction:'right'}));assert(moving.visual.phase>0);
  const transfers=[{x:900,time:40},{x:104,time:40,teleport:true},{x:104,time:40,scene:'hall:herbal:calculation'},{x:105,time:300},{x:104,time:19},{x:104,time:40,scale:1.25}];
  for(const change of transfers){const result=M.update(moving,sample({...change,direction:'left'}));assert.equal(result.visual.phase,0);assert.equal(result.visual.speed,0);assert.equal(result.visual.action,'idle');assert.equal(result.visual.heading,'left');assert.equal(result.visual.needsFrame,false);assert.equal(result.sample.x,change.x);}
});

test('duplicate timestamps remain finite, count an actual one-step displacement once and can stop',()=>{
  let state=start({direction:'right'});state=M.update(state,sample({x:106,time:0,intent:true,direction:'right'}));assert.equal(state.visual.action,'run');assert.equal(state.visual.speed,0);close(state.visual.phase,6/M.STRIDE_DISTANCE);
  state=M.update(state,sample({x:106,time:0,intent:false,direction:'right'}));assert.equal(state.visual.action,'idle');assert.equal(state.visual.speed,0);close(state.visual.phase,6/M.STRIDE_DISTANCE);
  for(const value of Object.values(state.visual).filter(v=>typeof v==='number'))assert(Number.isFinite(value));
});

test('reduced motion preserves facing and actual movement with no stride or turn/landing animation',()=>{
  let state=start({reducedMotion:true});state=M.update(state,sample({x:96,time:20,intent:true,reducedMotion:true}));assert.equal(state.visual.heading,'left');assert.equal(state.visual.angle,180);assert.equal(state.visual.action,'run');assert.equal(state.visual.frame,0);assert.equal(state.visual.phase,0);assert.equal(state.visual.needsFrame,false);
  state=M.update(state,sample({x:96,z:20,time:40,airborne:true,verticalVelocity:200,reducedMotion:true}));assert.equal(state.visual.action,'rise');
  state=M.update(state,sample({x:96,z:0,time:100,airborne:false,reducedMotion:true}));assert.equal(state.visual.action,'idle');assert.equal(state.visual.needsFrame,false);
});

test('invalid samples cannot produce NaN poses or mutate the previous valid state',()=>{
  const previous=freeze(start());for(const bad of [{x:NaN},{y:Infinity},{z:-Infinity},{time:NaN},{scale:0},{scale:-1},{scale:Infinity},{groundZ:NaN},{verticalVelocity:Infinity},{frameMs:Infinity},{frameMs:-1}])assert.throws(()=>M.update(previous,sample(bad)),TypeError);
  assert.equal(previous.visual.action,'idle');assert.equal(previous.sample.x,100);
});

test('resuming after skipped idle samples uses the current frame for turning and speed',()=>{
  for(const idle of [200,2000]){
    const previous=start({direction:'right'}),result=M.update(previous,sample({x:97.75,time:idle+1000/60,frameMs:1000/60,direction:'left',intent:true}));
    close(result.visual.speed,135);assert(result.visual.angle>0&&result.visual.angle<60);assert.equal(result.visual.turning,true);assert.equal(result.visual.action,'run');
    const stalled=M.update(previous,sample({x:97.75,time:1000,frameMs:1000,direction:'left',intent:true}));assert.equal(stalled.visual.action,'idle');assert.equal(stalled.visual.angle,180);
  }
});
