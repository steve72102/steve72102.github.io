(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./world-layout.js'):root.MindWorldLayout);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindWalk=api;})(typeof window==='object'?window:globalThis,function(D){
  'use strict';
  const WIDTH=1000,HEIGHT=667,SPEED=135;
  const point=([x,y])=>({x,y}),poly=points=>points.map(point),rect=(x,y,w,d)=>poly([[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]]);

  function layout(raw){return {...raw,areas:raw.areas.map(poly),blocked:(raw.blocked||[]).map(poly),nodes:raw.nodes.map(p=>Array.isArray(p)?point(p):p),surfaces:[],paths:[]};}
  const campus=layout(D.campus),districts=Object.fromEntries(Object.entries(D.districts).map(([id,d])=>[id,layout(d)]));
  function district(id){return districts[id]||campus;}
  const hallCache=new Map();
  function hall(name,building='pharmaceutics'){
    if(!name&&hallCache.has(building))return hallCache.get(building);
    const modern=['pharmacology','battle'].includes(building),garden=['herbal','life'].includes(building);
    const areas=modern?[poly([[45,655],[985,655],[985,368],[778,368],[770,405],[347,406],[347,443],[155,480],[45,495]]),poly([[580,407],[690,407],[779,212],[729,212]]),poly([[675,222],[955,222],[955,185],[693,185]])]:garden?[poly([[125,655],[985,655],[985,432],[908,405],[606,405],[606,428],[505,428],[402,400],[202,393],[205,352],[186,352],[175,412],[140,480]])]:[poly([[15,655],[985,655],[985,398],[330,386],[205,456],[205,560],[15,630]]),poly([[462,389],[726,389],[726,350],[468,350]])];
    const stairs=modern?{x:748,y:218}:{x:garden?211:885,y:garden?401:416};
    const surfaces=[{id:'table',x:480,y:510,w:200,d:64,height:52},{id:'chair-left',x:350,y:535,w:54,d:32,height:25},{id:'chair-right',x:610,y:535,w:54,d:32,height:25}].map(s=>({...s,polygon:rect(s.x,s.y,s.w,s.d)}));
    surfaces[0].polygon=poly([[384.4,509.3],[428.8,493.9],[575.6,502.9],[551.6,525.7]]);
    if(!modern&&!garden)surfaces.push({id:'existing-desk',x:154,y:490,w:100,d:55,height:90,hidden:true,polygon:rect(154,490,100,55)});
    const scene={kind:'hall',building,modern,spawn:{x:450,y:590},areas,surfaces,paths:[],nodes:[],portals:[{id:'exit',name:'回到校園',x:modern?873:garden?823:585,y:modern?369:garden?416:356},{id:'room',name,x:modern?932:garden?230:832,y:modern?408:garden?409:416},{id:'stairs',name:modern?'樓梯平台':'樓梯間',...stairs,kind:'inspect',verb:'使用',auto:true}]};
    // Graph vertices follow the illustrated floor, stair flight and upper landing.
    scene.nodes=[scene.spawn,...scene.portals,point([480,575]),point([370,570]),point([590,570]),point([370,470]),point([590,460]),point([720,440]),...(modern?[[635,400],[710,265],[750,215],[820,211],[810,410],[870,410]]:garden?[[210,430],[300,437],[530,450],[810,445]]:[[250,460],[400,410],[585,382],[710,410]]).map(point)];
    const custom=D.halls[building];if(custom){scene.areas=custom.areas.map(poly);scene.spawn={...custom.spawn};scene.nodes=[...custom.nodes.map(point),...scene.nodes];scene.portals=[{id:'exit',name:'回到前庭',...custom.exit},{id:'room',name,...custom.room},{id:'stairs',name:'樓梯平台',...custom.stairs,kind:'inspect',verb:'使用',auto:true}];scene.nodes.push(...scene.portals);}
    if(!name)hallCache.set(building,scene);return scene;
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function projection(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+t*dx,y:a.y+t*dy};}
  function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);if(Math.abs(cross)<.001*(Math.abs(b.x-a.x)+Math.abs(b.y-a.y)+1)&&p.x>=Math.min(a.x,b.x)-.001&&p.x<=Math.max(a.x,b.x)+.001&&p.y>=Math.min(a.y,b.y)-.001&&p.y<=Math.max(a.y,b.y)+.001)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
  function surface(scene,p){return (scene.surfaces||[]).filter(s=>inside(p,s.polygon)).sort((a,b)=>b.height-a.height)[0]||null;}
  function ground(scene,p){if((scene.blocked||[]).some(a=>inside(p,a)))return false;return (scene.areas||[]).some(a=>inside(p,a))||(scene.paths||[]).some(s=>distance(p,projection(p,s.a,s.b))<=s.width);}
  function walkable(scene,p,z=0){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;const s=surface(scene,p);return (ground(scene,p)||!!s)&&(!s||z>=s.height-.1);}
  function nearest(scene,p,z=0){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return {...scene.spawn};if(walkable(scene,p,z))return {x:p.x,y:p.y};
    const candidates=[scene.spawn,...scene.nodes];for(const a of [...(scene.areas||[]),...(scene.blocked||[])])for(let i=0;i<a.length;i++)candidates.push(projection(p,a[i],a[(i+1)%a.length]));for(const s of scene.paths||[])candidates.push(projection(p,s.a,s.b));
    for(const s of scene.surfaces||[])for(let i=0;i<s.polygon.length;i++){const q=projection(p,s.polygon[i],s.polygon[(i+1)%s.polygon.length]),dx=q.x-s.x,dy=q.y-s.y,l=Math.hypot(dx,dy)||1;candidates.push({x:q.x+dx/l*2,y:q.y+dy/l*2});}
    return {...candidates.filter(q=>walkable(scene,q,z)).sort((a,b)=>distance(p,a)-distance(p,b))[0]};
  }
  function clear(scene,a,b,z=0){
    if(!walkable(scene,a,z)||!walkable(scene,b,z))return false;
    if(scene.paths?.length){const n=Math.max(1,Math.ceil(distance(a,b)/3));for(let i=1;i<n;i++)if(!walkable(scene,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},z))return false;return true;}
    const dx=b.x-a.x,dy=b.y-a.y,cuts=[0,1],polygons=[...(scene.areas||[]),...(scene.blocked||[]),...(scene.surfaces||[]).map(s=>s.polygon)];
    for(const polygon of polygons)for(let i=0;i<polygon.length;i++){const c=polygon[i],d=polygon[(i+1)%polygon.length],ex=d.x-c.x,ey=d.y-c.y,det=dx*ey-dy*ex;if(Math.abs(det)<1e-9)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/det,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/det;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}
    cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(!walkable(scene,{x:a.x+dx*t,y:a.y+dy*t},z))return false;}return true;
  }
  function move(scene,p,dx,dy,seconds,sprint=false,z=0){p=nearest(scene,p,z);const length=Math.hypot(dx,dy);if(!Number.isFinite(length)||!length||!Number.isFinite(seconds))return p;const amount=SPEED*(sprint?1.5:1)*Math.max(0,Math.min(.05,seconds)),x=dx/length*amount,y=dy/length*amount,both={x:p.x+x,y:p.y+y};if(clear(scene,p,both,z))return both;const horizontal={x:p.x+x,y:p.y},vertical={x:p.x,y:p.y+y};if(x&&clear(scene,p,horizontal,z))return horizontal;if(y&&clear(scene,p,vertical,z))return vertical;return p;}
  function route(scene,from,to){from=nearest(scene,from);to=nearest(scene,to);if(clear(scene,from,to))return [to];const nodes=[from,...scene.nodes.filter(p=>walkable(scene,p)),to],last=nodes.length-1,cost=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),seen=new Set();cost[0]=0;while(seen.size<nodes.length){let u=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(u<0||cost[i]<cost[u]))u=i;if(u<0||!Number.isFinite(cost[u]))break;if(u===last)break;seen.add(u);for(let v=1;v<nodes.length;v++)if(!seen.has(v)&&clear(scene,nodes[u],nodes[v])){const next=cost[u]+distance(nodes[u],nodes[v]);if(next<cost[v]){cost[v]=next;prev[v]=u;}}}if(!Number.isFinite(cost[last]))return [];const result=[];for(let n=last;n>0;n=prev[n])result.unshift(nodes[n]);return result;}
  function near(scene,p,radius=45){return scene.portals.filter(d=>distance(p,d)<=radius).sort((a,b)=>distance(p,a)-distance(p,b))[0]||null;}
  function direction(key){return {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[key]||null;}
  return {WIDTH,HEIGHT,SPEED,campus,district,hall,distance,projection,inside,surface,ground,walkable,nearest,clear,move,route,near,direction};
});
