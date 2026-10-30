// Align the east plaza route with the paving below the rear planter and lamp.
// Coordinates are feet positions in the existing 1000 x 667 artwork space.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=p=>path.join(root,p);
const art=JSON.parse(fs.readFileSync(file('tools/campus-plaza-art.json'),'utf8'));
const layout=require('../game/world-layout.js');
const route=art.routes.find(r=>r.id==='battle'),oldRoute=route.path;
const paving=[[825,381],[849,383],[867,390],[880,398],[902,401],[920,396],[922,405],[906,412],[885,417],[864,414],[842,414],[820,414]];
const planter=[[849,330],[1000,330],[1000,384],[965,390],[938,394],[928,389],[916,391],[902,397],[881,393],[874,387],[860,381],[854,374],[849,350]];
const waypoints=[[711,399],[786,395],[835,393],[860,400],[882,406],[902,407]];
route.path=waypoints;route.portal=[902,407];
route.visual='Follow the stone paving in front of the right lantern and rear flowerbed; stop before the foreground planting narrows the passage.';
art.anchors.southEast=route.portal;
const areaIndex=art.walkablePolygons.findIndex(p=>p.id==='south-east-path');
art.walkablePolygons[areaIndex].points=paving;
const obstacle={id:'right-rear-planter-and-lamp',shape:'polygon',points:planter};
const obstacleIndex=art.groundObstacles.findIndex(o=>o.id===obstacle.id);
if(obstacleIndex<0){art.groundObstacles.push(obstacle);layout.campus.blocked.push(planter);}
else {art.groundObstacles[obstacleIndex]=obstacle;layout.campus.blocked[obstacleIndex]=planter;}
// Preserve the expansion's extra scenes, connections, water and animated fountain.
layout.campus.areas[areaIndex+1]=paving;
layout.campus.nodes=layout.campus.nodes.filter(p=>!oldRoute.some(q=>p[0]===q[0]&&p[1]===q[1]));
layout.campus.nodes.push(...waypoints);
Object.assign(layout.campus.portals.find(p=>p.id==='battle'),{x:902,y:407,out:{x:835,y:393}});
fs.writeFileSync(file('tools/campus-plaza-art.json'),JSON.stringify(art,null,2)+'\n');
fs.writeFileSync(file('game/world-layout.js'),"(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindWorldLayout=api;})(typeof window==='object'?window:globalThis,function(){'use strict';return "+JSON.stringify(layout)+";});\n");
