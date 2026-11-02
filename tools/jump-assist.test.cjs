const test=require('node:test'),assert=require('node:assert/strict'),W=require('../game/campus-walk.js');
const rect=(x,y,w,d)=>[{x:x-w/2,y:y-d/2},{x:x+w/2,y:y-d/2},{x:x+w/2,y:y+d/2},{x:x-w/2,y:y+d/2}];
const table=(height=52,extra={})=>({id:'real-desk',x:500,y:500,height,polygon:rect(500,500,80,40),movable:true,jumpAssist:true,...extra});
const room=(surfaces=[],extra={})=>({kind:'hall',scale:1,spawn:{x:500,y:548},areas:[rect(500,333.5,1000,667)],blocked:[],nodes:[],paths:[],portals:[],surfaces,...extra});
const close=(a,b,epsilon=1e-7)=>assert(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('descending across a tabletop lands at the swept height before any horizontal nearest correction',()=>{
  const scene=room([table()]);
  for(const hz of [30,60,120]){
    const landed=W.jumpMove(scene,{x:500,y:500,z:53,vz:-250},1,0,1/hz);
    assert.equal(landed.z,52);assert.equal(landed.vz,0);assert.equal(landed.landed,true);assert.equal(landed.grounded,true);close(landed.x,500+W.speed(scene)/hz);assert.equal(landed.y,500);
    for(let i=0;i<60;i++){const still=W.jumpMove(scene,landed,0,0,1/hz);assert.equal(still.z,52);close(still.x,landed.x);}
  }
});

test('vertical and horizontal sweeps reject entering a desk after already falling below its top',()=>{
  const desk=table(52,{x:520,polygon:rect(520,500,40,40),jumpAssist:false}),scene=room([desk]);
  const result=W.jumpMove(scene,{x:498,y:500,z:53,vz:-250},1,0,1/30);
  assert(result.x<500);assert(result.z<52);assert.equal(result.landed,false);assert.equal(result.assisted,false);assert(W.walkable(scene,result,result.z));
});

test('small downward edge catches are bounded and require ongoing movement toward a marked desk',()=>{
  for(const scale of [1,1.25]){
    const desk=table(52,{x:520,polygon:rect(520,500,40,40)}),scene=room([desk],{scale}),body={x:497,y:500,z:53,vz:-250},dt=1/60;
    const result=W.jumpMove(scene,body,1,0,dt);assert.equal(result.assisted,true);assert.equal(result.z,52);assert(W.inside(result,desk.polygon));assert(result.x-body.x<=W.speed(scene)*dt+W.JUMP.edgeAssist/scale+.01);
    const released=W.jumpMove(scene,body,0,0,dt);assert.equal(released.assisted,false);assert.equal(released.x,body.x);assert(released.z<52,'release still permits gravity but no horizontal attraction');
    const away=W.jumpMove(scene,body,-1,0,dt);assert.equal(away.assisted,false);assert(away.x<body.x);
    const distant=W.jumpMove(scene,{...body,x:490},1,0,dt);assert.equal(distant.assisted,false);
  }
});

test('edge assistance cannot cross a wall or water strip and excludes stairs and high cabinets',()=>{
  const body={x:497,y:500,z:53,vz:-250};
  for(const extra of [{jumpAssist:false},{oneWay:true},{height:150}]){
    const desk=table(52,{x:520,polygon:rect(520,500,40,40),...extra}),scene=room([desk]);
    const result=W.jumpMove(scene,{...body,z:desk.height+1},1,0,1/60);assert.equal(result.assisted,false);assert(result.z<desk.height);
  }
  const desk=table(52,{x:520,polygon:rect(520,500,40,40)}),wall=rect(499,500,1,50);
  const blocked=W.jumpMove(room([desk],{blocked:[wall]}),body,1,0,1/60);assert.equal(blocked.assisted,false);assert(blocked.x<498.5);
  const acrossVoid=room([desk],{areas:[rect(248,333.5,496,667),rect(750,333.5,500,667)]});assert.equal(W.edgeLanding(acrossVoid,{x:496,y:500},1,0,52),null);
});

test('the analytic jump arc is consistent at 30/60/120 Hz and stays inside the existing height limit',()=>{
  for(const scale of [1,1.25]){
    const scene=room([],{scale}),expected=W.JUMP.speed**2/(2*W.JUMP.gravity*scale),peaks=[];
    for(const hz of [30,60,120]){
      let body={...scene.spawn,z:0,vz:W.jumpVelocity(scene)},peak=0;
      for(let i=0;i<hz*2;i++){body=W.jumpMove(scene,body,0,0,1/hz);peak=Math.max(peak,body.z);}
      assert.equal(body.z,0);assert.equal(body.vz,0);assert(peak<=expected+1e-7);assert(peak>=expected-.1);assert(peak<=110/scale);peaks.push(peak);
    }
    assert(Math.max(...peaks)-Math.min(...peaks)<.1);
  }
});

test('a running jump reaches every current desk/chair height at all three simulation rates',()=>{
  const heights=[22,40,42,43,44,46,47,48,52,55,77,78,82,83,90];
  for(const height of heights)for(const hz of [30,60,120]){
    const scene=room([table(height)]);let body={...scene.spawn,z:0,vz:W.jumpVelocity(scene)};
    for(let i=0;i<hz*2;i++)body=W.jumpMove(scene,body,0,body.y>500?-1:0,1/hz);
    assert.equal(body.z,height,`${height} at ${hz} Hz`);assert.equal(body.grounded,true);assert(W.inside(body,scene.surfaces[0].polygon));
  }
});

test('every marked object in the actual nine room layouts supports stable descent at 30/60/120 Hz',()=>{
  const scenes=[...['pharmaceutics','pharmacology','herbal','battle','life'].map(b=>W.hall('test',b)),...Object.values(W.classrooms)];let count=0;
  for(const scene of scenes)for(const object of scene.surfaces.filter(s=>s.jumpAssist)){
    const point=W.inside(object,object.polygon)?object:{x:object.polygon.reduce((n,p)=>n+p.x,0)/object.polygon.length,y:object.polygon.reduce((n,p)=>n+p.y,0)/object.polygon.length};assert(W.inside(point,object.polygon));count++;
    for(const hz of [30,60,120]){
      let body={x:point.x,y:point.y,z:object.height+12,vz:-180};
      for(let i=0;i<hz/2;i++)body=W.jumpMove(scene,body,0,0,1/hz);
      assert.equal(body.z,object.height,`${object.id} at ${hz} Hz`);assert.equal(body.grounded,true);close(body.x,point.x);close(body.y,point.y);
    }
  }
  assert(count>=100,'exercise real chairs/benches, not just one synthetic table');
});

test('moving a desk during flight updates landing geometry immediately without a stale support',()=>{
  const desk=table(),scene=room([desk]),fall={x:500,y:500,z:60,vz:-180};desk.x+=100;desk.polygon=desk.polygon.map(p=>({...p,x:p.x+100}));
  let left=fall,right={...fall,x:600};for(let i=0;i<60;i++){left=W.jumpMove(scene,left,0,0,1/60);right=W.jumpMove(scene,right,0,0,1/60);}
  assert.equal(left.z,0);assert.equal(right.z,52);assert.equal(left.x,500);assert.equal(right.x,600);
});

test('frame stalls are bounded and invalid input cannot create an invalid pose',()=>{
  const scene=room(),body={x:500,y:500,z:10,vz:0},result=W.jumpMove(scene,body,1,0,10);assert(result.x-body.x<=W.speed(scene)*.05+.001);assert(result.z>=0);
  assert.throws(()=>W.jumpMove(scene,{...body,vz:NaN},1,0,1/60),TypeError);assert.throws(()=>W.jumpMove(scene,body,Infinity,0,1/60),TypeError);
});
