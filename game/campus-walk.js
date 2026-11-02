(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./world-layout.js'):root.MindWorldLayout,typeof module==='object'&&module.exports?require('./classroom.js'):root.MindClassrooms,typeof module==='object'&&module.exports?require('./scene-objects.js'):root.MindSceneObjects);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindWalk=api;})(typeof window==='object'?window:globalThis,function(D,Q,O){
  'use strict';
  const WIDTH=1000,HEIGHT=667,SPEED=135;
  const point=([x,y])=>({x,y}),poly=points=>points.map(point),rect=(x,y,w,d)=>poly([[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]]);

  function layout(raw){return {...raw,areas:raw.areas.map(poly),blocked:(raw.blocked||[]).map(poly),nodes:raw.nodes.map(p=>Array.isArray(p)?point(p):p),surfaces:[],paths:[]};}
  const campus=layout(D.campus),districts=Object.fromEntries(Object.entries(D.districts).map(([id,d])=>[id,layout(d)]));
  const trails=Object.fromEntries(Object.entries(D.trails||{}).map(([id,d])=>[id,layout(d)]));
  const outdoors={campus,...Object.fromEntries(Object.entries(districts).map(([id,d])=>['district:'+id,d])),...Object.fromEntries(Object.entries(trails).map(([id,d])=>['trail:'+id,d]))};
  const outdoor=id=>outdoors[id]||null,speed=scene=>SPEED/(scene.scale||1);
  function travelRoute(from,to){
    if(!outdoors[from]||!outdoors[to])return null;if(from===to)return [];
    // Follow geographic distances on the academy overview, including the two outer loops.
    const queue=[{id:from,steps:[],cost:0}],costs=new Map([[from,0]]);
    while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const current=queue.shift();if(current.cost>costs.get(current.id))continue;if(current.id===to)return current.steps;for(const p of outdoors[current.id].portals){if(!outdoors[p.to])continue;const cost=current.cost+distance(mapPoint(current.id),mapPoint(p.to))+1;if(cost>=(costs.get(p.to)??Infinity))continue;costs.set(p.to,cost);queue.push({id:p.to,cost,steps:[...current.steps,{scene:current.id,portal:p.id,to:p.to,arrival:p.arrival}]});}}return null;
  }
  function arrival(from,portalId){const p=outdoors[from]?.portals.find(p=>p.id===portalId),next=outdoors[p?.to];if(!next)return null;const gate=next.portals.find(q=>q.id===p.arrival);return {scene:p.to,position:nearest(next,gate?.out||next.spawn)};}
  function mapPoint(id){const outside=id.startsWith('hall:')?'district:'+id.split(':')[1]:id;return outdoors[outside]?.mapPoint||{x:500,y:355};}
  function district(id){return districts[id]||campus;}
  function photoLayout(scene,key){
    const room=O.get(key);if(!room)throw Error('找不到原景物件配置：'+key);
    scene.roomKey=room.key;scene.background=room.background;scene.atlas=room.atlas;scene.artSource=room.source;
    scene.surfaces=room.surfaces.map(s=>({...s,polygon:poly(s.polygon),...(s.visual?{visual:{...s.visual}}:{})}));
    scene.glass=room.props.map(p=>({...p,visual:{...p.visual}}));scene.fixtures=room.fixtures.map(p=>({...p}));
    if(room.extraAreas)scene.areas.push(...room.extraAreas.map(poly));if(room.portalPositions)scene.portals=scene.portals.map(p=>({...p,...room.portalPositions[p.id]}));return scene;
  }
  const classrooms=Object.fromEntries(Object.entries(Q.rooms).map(([id,raw])=>[id,photoLayout(layout(raw),'classroom-'+id)]));
  const hallCache=new Map();
  function hall(name,building='pharmaceutics'){
    if(!name&&hallCache.has(building))return hallCache.get(building);
    const modern=['pharmacology','battle'].includes(building),garden=['herbal','life'].includes(building);
    const areas=modern?[poly([[45,655],[985,655],[985,368],[778,368],[770,405],[347,406],[347,443],[155,480],[45,495]]),poly([[580,407],[690,407],[779,212],[729,212]]),poly([[675,222],[955,222],[955,185],[693,185]])]:garden?[poly([[125,655],[985,655],[985,432],[908,405],[606,405],[606,428],[505,428],[402,400],[202,393],[205,352],[186,352],[175,412],[140,480]])]:[poly([[15,655],[985,655],[985,398],[330,386],[205,456],[205,560],[15,630]]),poly([[462,389],[726,389],[726,350],[468,350]])];
    const stairs=modern?{x:748,y:218}:{x:garden?211:885,y:garden?401:416};
    const scene={kind:'hall',building,modern,spawn:{x:450,y:590},areas,surfaces:[],paths:[],nodes:[],portals:[{id:'exit',name:'回到校園',x:modern?873:garden?823:585,y:modern?369:garden?416:356},{id:'room',kind:'inspect',name,x:modern?932:garden?230:832,y:modern?408:garden?409:416},{id:'stairs',name:modern?'樓梯平台':'樓梯間',...stairs,kind:'inspect',verb:'使用',auto:true}]};
    // Graph vertices follow the illustrated floor, stair flight and upper landing.
    scene.nodes=[scene.spawn,...scene.portals,point([480,575]),point([370,570]),point([590,570]),point([370,470]),point([590,460]),point([720,440]),...(modern?[[635,400],[710,265],[750,215],[820,211],[810,410],[870,410]]:garden?[[210,430],[300,437],[530,450],[810,445]]:[[250,460],[400,410],[585,382],[710,410]]).map(point)];
    const custom=D.halls[building];if(custom){scene.areas=custom.areas.map(poly);scene.spawn={...custom.spawn};scene.nodes=[...custom.nodes.map(point),...scene.nodes];scene.portals=[{id:'exit',name:'回到前庭',...custom.exit},{id:'room',kind:'inspect',name,...custom.room},{id:'stairs',name:'樓梯平台',...custom.stairs,kind:'inspect',verb:'使用',auto:true}];scene.nodes.push(...scene.portals);}
    photoLayout(scene,'hall-'+building);if(!name)hallCache.set(building,scene);return scene;
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function projection(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+t*dx,y:a.y+t*dy};}
  function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);if(Math.abs(cross)<.001*(Math.abs(b.x-a.x)+Math.abs(b.y-a.y)+1)&&p.x>=Math.min(a.x,b.x)-.001&&p.x<=Math.max(a.x,b.x)+.001&&p.y>=Math.min(a.y,b.y)-.001&&p.y<=Math.max(a.y,b.y)+.001)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
  function surface(scene,p,z=Infinity){return (scene.surfaces||[]).filter(s=>s.height<=z+.1&&inside(p,s.polygon)).sort((a,b)=>b.height-a.height)[0]||null;}
  function maxElevation(scene){return Math.max(200,...(scene.surfaces||[]).map(s=>s.height+110));}
  function ground(scene,p){if((scene.blocked||[]).some(a=>inside(p,a)))return false;return (scene.areas||[]).some(a=>inside(p,a))||(scene.paths||[]).some(s=>distance(p,projection(p,s.a,s.b))<=s.width);}
  function walkable(scene,p,z=0){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;const surfaces=(scene.surfaces||[]).filter(s=>inside(p,s.polygon));return (ground(scene,p)||surfaces.some(s=>z>=s.height-.1))&&surfaces.every(s=>s.oneWay||z>=s.height-.1);}
  function nearest(scene,p,z=0){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return {...scene.spawn};if(walkable(scene,p,z))return {x:p.x,y:p.y};
    const candidates=[scene.spawn,...scene.nodes];for(const a of [...(scene.areas||[]),...(scene.blocked||[])])for(let i=0;i<a.length;i++)candidates.push(projection(p,a[i],a[(i+1)%a.length]));for(const s of scene.paths||[])candidates.push(projection(p,s.a,s.b));
    for(const s of scene.surfaces||[])for(let i=0;i<s.polygon.length;i++){const q=projection(p,s.polygon[i],s.polygon[(i+1)%s.polygon.length]),dx=q.x-s.x,dy=q.y-s.y,l=Math.hypot(dx,dy)||1;candidates.push({x:q.x+dx/l*2,y:q.y+dy/l*2});}
    return {...candidates.filter(q=>walkable(scene,q,z)).sort((a,b)=>distance(p,a)-distance(p,b))[0]};
  }
  function deskArrival(scene){
    // Arrive on the floor in front of the destination table, never on its surface.
    const table=(scene.surfaces||[]).find(s=>s.arrival)||(scene.surfaces||[]).find(s=>s.height>=30&&s.height<=120);
    if(!table)return nearest(scene,scene.spawn);
    const front=Math.max(...table.polygon.map(p=>p.y)),candidates=[];
    for(const gap of [28,44,64])for(const offset of [0,-32,32,-64,64])candidates.push({x:table.x+offset,y:front+gap});
    return candidates.find(p=>walkable(scene,p)&&!near(scene,p,45))||nearest(scene,scene.spawn);
  }
  function clear(scene,a,b,z=0){
    if(!walkable(scene,a,z)||!walkable(scene,b,z))return false;
    if(scene.paths?.length){const n=Math.max(1,Math.ceil(distance(a,b)/3));for(let i=1;i<n;i++)if(!walkable(scene,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},z))return false;return true;}
    const dx=b.x-a.x,dy=b.y-a.y,cuts=[0,1],polygons=[...(scene.areas||[]),...(scene.blocked||[]),...(scene.surfaces||[]).map(s=>s.polygon)];
    for(const polygon of polygons)for(let i=0;i<polygon.length;i++){const c=polygon[i],d=polygon[(i+1)%polygon.length],ex=d.x-c.x,ey=d.y-c.y,det=dx*ey-dy*ex;if(Math.abs(det)<1e-9)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/det,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/det;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}
    cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(!walkable(scene,{x:a.x+dx*t,y:a.y+dy*t},z))return false;}return true;
  }
  function move(scene,p,dx,dy,seconds,sprint=false,z=0){p=nearest(scene,p,z);const length=Math.hypot(dx,dy);if(!Number.isFinite(length)||!length||!Number.isFinite(seconds))return p;const amount=speed(scene)*(sprint?1.5:1)*Math.max(0,Math.min(.05,seconds)),x=dx/length*amount,y=dy/length*amount,both={x:p.x+x,y:p.y+y};if(clear(scene,p,both,z))return both;const horizontal={x:p.x+x,y:p.y},vertical={x:p.x,y:p.y+y};if(x&&clear(scene,p,horizontal,z))return horizontal;if(y&&clear(scene,p,vertical,z))return vertical;return p;}
  const JUMP=Object.freeze({speed:375,gravity:650,bufferMs:120,coyoteMs:100,edgeAssist:6,maxAssistHeight:90});
  function jumpVelocity(scene){return JUMP.speed/(scene.scale||1);}
  function edgeLanding(scene,p,dx,dy,height){
    const scale=scene.scale||1,radius=JUMP.edgeAssist/scale,length=Math.hypot(dx,dy);
    if(!length||height>JUMP.maxAssistHeight/scale||!ground(scene,p))return null;
    const candidates=[];
    for(const s of scene.surfaces||[]){
      if(s.jumpAssist!==true||s.oneWay||Math.abs(s.height-height)>.01||inside(p,s.polygon))continue;
      for(let i=0;i<s.polygon.length;i++){
        const edge=projection(p,s.polygon[i],s.polygon[(i+1)%s.polygon.length]),inward=Math.hypot(s.x-edge.x,s.y-edge.y)||1;
        const q={x:edge.x+(s.x-edge.x)/inward*.25/scale,y:edge.y+(s.y-edge.y)/inward*.25/scale},gap=distance(p,q);
        // A released input never gets a horizontal nudge. Only catch a small
        // miss toward an explicitly marked desk/chair, over legal floor.
        if(gap>radius||gap<.001||((q.x-p.x)*dx+(q.y-p.y)*dy)/(gap*length)<.25||!inside(q,s.polygon)||!ground(scene,q)||!clear(scene,p,q,height))continue;
        candidates.push({surface:s,point:q,distance:gap});
      }
    }
    return candidates.sort((a,b)=>a.distance-b.distance)[0]||null;
  }
  function jumpMove(scene,body,dx,dy,seconds,sprint=false,target=null){
    const dt=Math.max(0,Math.min(.05,seconds)),scale=scene.scale||1,g=JUMP.gravity/scale;
    if(![body.x,body.y,body.z,body.vz,dx,dy,dt].every(Number.isFinite))throw TypeError('Invalid jump movement');
    let p={x:body.x,y:body.y},z=Math.max(0,body.z),vz=body.vz,landed=false,assisted=false;
    const advance=(duration,height)=>{
      if(!duration||!(dx||dy))return;
      const remaining=target?Math.min(duration,distance(p,target)/(speed(scene)*(sprint?1.5:1))):duration;
      p=move(scene,p,dx,dy,remaining,sprint,height);
    };
    const support=surface(scene,p,z)?.height||0;
    if(vz<=0&&Math.abs(z-support)<=.1){
      z=support;vz=0;advance(dt,z);
    }else if(dt){
      const startZ=z,startVz=vz,at=t=>startZ+startVz*t-g*t*t/2;
      // Split at every crossed tabletop, including the exact descending
      // intersection. Horizontal collision sees the correct elevation on each
      // interval, so a frame can never tunnel through a desk then be ejected.
      const events=[{time:dt,height:null}],heights=new Set([0,...(scene.surfaces||[]).map(s=>s.height)]);
      for(const height of heights){
        const discriminant=startVz*startVz+2*g*(startZ-height);if(discriminant<0)continue;
        const root=Math.sqrt(discriminant);
        for(const time of [(startVz-root)/g,(startVz+root)/g])if(time>1e-9&&time<=dt+1e-9)events.push({time:Math.min(dt,time),height});
      }
      events.sort((a,b)=>a.time-b.time);let elapsed=0;
      for(const event of events){
        const end=event.time;advance(end-elapsed,Math.max(0,Math.min(at(elapsed),at(end))));elapsed=end;
        const height=event.height;if(height===null||startVz-g*end>=0)continue;
        const direct=height===0?{height:0}:(scene.surfaces||[]).find(s=>Math.abs(s.height-height)<.01&&inside(p,s.polygon));
        const catchEdge=direct?null:edgeLanding(scene,p,dx,dy,height);
        if(!direct&&!catchEdge)continue;
        if(catchEdge){p=catchEdge.point;assisted=true;}
        z=height;vz=0;landed=true;advance(dt-end,height);break;
      }
      if(!landed){z=Math.max(0,at(dt));vz=z===0?0:startVz-g*dt;}
    }
    const finalSupport=surface(scene,p,z)?.height||0,grounded=vz===0&&Math.abs(z-finalSupport)<=.1&&walkable(scene,p,z);
    return {...p,z,vz,grounded,landed,assisted};
  }
  function route(scene,from,to){
    from=nearest(scene,from);to=nearest(scene,to);if(clear(scene,from,to))return [to];
    // Bounds are scoped to this route, so moved furniture can never leave a stale
    // geometry cache. The exact polygon tests still decide every visible edge.
    const box=polygon=>({polygon,minX:Math.min(...polygon.map(p=>p.x)),maxX:Math.max(...polygon.map(p=>p.x)),minY:Math.min(...polygon.map(p=>p.y)),maxY:Math.max(...polygon.map(p=>p.y))});
    const areas=(scene.areas||[]).map(box),blocked=(scene.blocked||[]).map(box),surfaces=(scene.surfaces||[]).map(s=>({...box(s.polygon),surface:s})),polygons=[...areas,...blocked,...surfaces];
    const contains=(b,p)=>p.x>=b.minX-.001&&p.x<=b.maxX+.001&&p.y>=b.minY-.001&&p.y<=b.maxY+.001&&inside(p,b.polygon);
    const valid=p=>{const on=surfaces.filter(s=>contains(s,p)),ground=!blocked.some(b=>contains(b,p))&&(areas.some(a=>contains(a,p))||(scene.paths||[]).some(s=>distance(p,projection(p,s.a,s.b))<=s.width));return (ground||on.some(s=>s.surface.height<=.1))&&on.every(s=>s.surface.oneWay||s.surface.height<=.1);};
    function visible(a,b){
      if(scene.paths?.length)return clear(scene,a,b);
      const dx=b.x-a.x,dy=b.y-a.y,minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y),cuts=[0,1];
      for(const bound of polygons){if(bound.maxX<minX||bound.minX>maxX||bound.maxY<minY||bound.minY>maxY)continue;const polygon=bound.polygon;for(let i=0;i<polygon.length;i++){const c=polygon[i],d=polygon[(i+1)%polygon.length],ex=d.x-c.x,ey=d.y-c.y,det=dx*ey-dy*ex;if(Math.abs(det)<1e-9)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/det,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/det;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}}
      cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(!valid({x:a.x+dx*t,y:a.y+dy*t}))return false;}return true;
    }
    if(!valid(from)||!valid(to))return [];
    const corners=(scene.surfaces||[]).flatMap(s=>s.polygon.map(p=>{const d=Math.hypot(p.x-s.x,p.y-s.y)||1;return {x:p.x+(p.x-s.x)/d*3,y:p.y+(p.y-s.y)/d*3};}));
    const nodes=[...new Map([from,...scene.nodes,...corners].filter(valid).map(p=>[p.x.toFixed(4)+':'+p.y.toFixed(4),p])).values()];nodes.push(to);
    const last=nodes.length-1,cost=nodes.map(()=>Infinity),heuristic=nodes.map(p=>distance(p,to)),prev=nodes.map(()=>-1),seen=new Set(),edges=new Map(),order=[last,...nodes.map((_,i)=>i).filter(i=>i>0&&i!==last)];cost[0]=0;
    const connected=(a,b)=>{const key=Math.min(a,b)*nodes.length+Math.max(a,b);if(!edges.has(key))edges.set(key,visible(nodes[a],nodes[b]));return edges.get(key);};
    while(seen.size<nodes.length){let u=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(u<0||cost[i]+heuristic[i]<cost[u]+heuristic[u]))u=i;if(u<0||!Number.isFinite(cost[u]))break;if(u===last)break;seen.add(u);
      // Try the destination first; a known complete path gives a safe A* bound.
      for(const v of order){if(seen.has(v))continue;const next=cost[u]+distance(nodes[u],nodes[v]);if(next>=cost[v]||next+heuristic[v]>=cost[last])continue;if(connected(u,v)){cost[v]=next;prev[v]=u;}}
    }
    if(!Number.isFinite(cost[last]))return [];const result=[];for(let n=last;n>0;n=prev[n])result.unshift(nodes[n]);
    // Validate only the chosen edges against the public movement predicate.
    let previous=from;for(const next of result){if(!clear(scene,previous,next))return [];previous=next;}return result;
  }
  function near(scene,p,radius=45){return scene.portals.filter(d=>distance(p,d)<=radius/(scene.scale||1)).sort((a,b)=>distance(p,a)-distance(p,b))[0]||null;}
  function direction(key){return {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[key]||null;}
  return {WIDTH,HEIGHT,SPEED,campus,district,hall,classrooms,trails,outdoors,outdoor,speed,travelRoute,arrival,mapPoint,distance,projection,inside,surface,maxElevation,ground,walkable,nearest,deskArrival,clear,move,JUMP,jumpVelocity,edgeLanding,jumpMove,route,near,direction};
});
