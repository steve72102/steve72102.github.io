(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindWalk=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const WIDTH=1000,HEIGHT=667,SPEED=135;
  const doors=[
    {id:'pharmaceutics',name:'藥劑樓',x:245,y:230,out:{x:277,y:260}},
    {id:'pharmacology',name:'藥理樓',x:500,y:214,out:{x:500,y:251}},
    {id:'herbal',name:'生藥樓',x:800,y:269,out:{x:760,y:280}},
    {id:'battle',name:'對戰樓',x:815,y:489,out:{x:791,y:520}},
    {id:'life',name:'生活工坊',x:260,y:465,out:{x:280,y:500}}
  ];
  const points=[[500,535],[500,403],[445,380],[395,348],[395,310],[440,284],[500,270],[560,284],[605,310],[605,348],[555,380],
    [245,230],[280,262],[328,286],[500,214],[800,269],[745,283],[670,310],[260,465],[280,502],[390,535],[815,489],[785,533],[640,558]];
  const edges=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,1],[11,12],[12,13],[13,4],[6,14],[15,16],[16,17],[17,8],[18,19],[19,20],[20,0],[21,22],[22,23],[23,0]];
  const campus={kind:'campus',spawn:{x:500,y:500},nodes:points.map(([x,y])=>({x,y})),paths:edges.map(([a,b])=>({a:{x:points[a][0],y:points[a][1]},b:{x:points[b][0],y:points[b][1]},width:23})),portals:doors};
  function hall(name){return {kind:'hall',spawn:{x:450,y:560},nodes:[{x:575,y:415},{x:450,y:560},{x:850,y:485}],bounds:{left:230,right:940,top:395,bottom:628},portals:[{id:'exit',name:'回到校園',x:575,y:415},{id:'room',name,x:850,y:485}]};}
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function projection(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+t*dx,y:a.y+t*dy};}
  function walkable(scene,p){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
    if(scene.bounds){const b=scene.bounds;return p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;}
    return scene.paths.some(s=>distance(p,projection(p,s.a,s.b))<=s.width);
  }
  function nearest(scene,p){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return {...scene.spawn};
    if(walkable(scene,p))return {x:p.x,y:p.y};
    if(scene.bounds){const b=scene.bounds;return {x:Math.max(b.left,Math.min(b.right,p.x)),y:Math.max(b.top,Math.min(b.bottom,p.y))};}
    return scene.paths.map(s=>projection(p,s.a,s.b)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  }
  function clear(scene,a,b){const n=Math.max(1,Math.ceil(distance(a,b)/5));for(let i=0;i<=n;i++)if(!walkable(scene,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;}
  function move(scene,p,dx,dy,seconds,sprint=false){
    p=nearest(scene,p);const length=Math.hypot(dx,dy);if(!Number.isFinite(length)||!length||!Number.isFinite(seconds))return p;
    const amount=SPEED*(sprint?1.5:1)*Math.max(0,Math.min(.05,seconds)),x=dx/length*amount,y=dy/length*amount;
    const both={x:p.x+x,y:p.y+y};if(clear(scene,p,both))return both;
    // Slide along the path edge instead of crossing flowerbeds, water or walls.
    const horizontal={x:p.x+x,y:p.y},vertical={x:p.x,y:p.y+y};
    if(x&&clear(scene,p,horizontal))return horizontal;
    if(y&&clear(scene,p,vertical))return vertical;
    return p;
  }
  function route(scene,from,to){
    from=nearest(scene,from);to=nearest(scene,to);if(clear(scene,from,to))return [to];
    const nodes=[from,...scene.nodes,to],last=nodes.length-1,cost=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),seen=new Set();cost[0]=0;
    while(seen.size<nodes.length){let u=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(u<0||cost[i]<cost[u]))u=i;if(u<0||!Number.isFinite(cost[u]))break;if(u===last)break;seen.add(u);
      for(let v=1;v<nodes.length;v++)if(!seen.has(v)&&clear(scene,nodes[u],nodes[v])){const next=cost[u]+distance(nodes[u],nodes[v]);if(next<cost[v]){cost[v]=next;prev[v]=u;}}
    }
    if(!Number.isFinite(cost[last]))return [];
    const result=[];for(let n=last;n>0;n=prev[n])result.unshift(nodes[n]);return result;
  }
  function near(scene,p,radius=45){return scene.portals.filter(d=>distance(p,d)<=radius).sort((a,b)=>distance(p,a)-distance(p,b))[0]||null;}
  function direction(key){return {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[key]||null;}
  return {WIDTH,HEIGHT,SPEED,campus,hall,distance,walkable,nearest,clear,move,route,near,direction};
});
