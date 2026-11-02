'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../game/scene-objects.js'),W=require('../game/campus-walk.js'),A=require('../game/academy.js'),F=require('../game/furniture.js');
const world=key=>key.startsWith('hall-')?W.hall('',key.slice(5)):W.classrooms[key.slice(10)];
const sceneId=key=>key.startsWith('classroom-')?'classroom:'+key.slice(10):'hall:'+key.slice(5)+':'+A.floors(key.slice(5))[0].id;

test('nine illustrated interiors each use one clean plate and their own observed object registry',()=>{
  assert.equal(Object.keys(O.rooms).length,9);assert.equal(new Set(Object.values(O.rooms).map(r=>r.background)).size,9);assert.equal(Object.values(O.SPRITES).length,16);assert.deepEqual(Object.values(O.SPRITES),Array.from({length:16},(_,i)=>i));
  for(const [key,r] of Object.entries(O.rooms)){const s=world(key);assert.equal(s.roomKey,key);assert.equal(s.background,'./assets/illustrated-scenes/'+key+'.webp');assert.equal(s.atlas,O.ATLAS);assert.equal(s.artSource,r.source);assert.equal(O.get(sceneId(key)),r);for(const f of s.fixtures){assert.equal(f.interaction,'inspect');assert(typeof f.inspectionText==='string'&&f.inspectionText.length>10,f.id+' has a player-facing observation');}assert.equal(new Set([...s.surfaces,...s.glass,...s.fixtures].map(x=>x.id)).size,s.surfaces.length+s.glass.length+s.fixtures.length);}
  assert.equal(O.get('hall:invented:practice'),null);assert.equal(O.get(null),null);
});
test('all old centre furniture configurations are absent and the illustrated open hall floors stay empty',()=>{
  for(const key of Object.keys(O.rooms)){const s=world(key);for(const object of [...s.surfaces,...s.glass])assert(!['table','chair-left','chair-right','cup'].includes(object.id),key+' '+object.id);if(key.startsWith('hall-'))assert(W.walkable(s,{x:480,y:510}),key+' original open central floor');}
  assert.equal(O.rooms['hall-pharmacology'].props.some(p=>/^lab-\d-\d$/.test(p.id)),false,'the twelve former synthetic shelf vessels are removed');
});
test('every movable photo furniture footprint starts on legal floor and outside entrances and other furniture',()=>{
  for(const key of Object.keys(O.rooms)){const sid=sceneId(key),state={furniture:{},cups:{}},s=world(key);for(const object of s.surfaces.filter(s=>s.movable)){state.furniture[sid+'#'+object.id]={dx:0,dy:0};assert(F.valid(state,sid,object.id),key+' '+object.id);delete state.furniture[sid+'#'+object.id];
    const approaches=object.polygon.map((a,i)=>{const b=object.polygon[(i+1)%object.polygon.length],x=(a.x+b.x)/2,y=(a.y+b.y)/2,dx=x-object.x,dy=y-object.y,len=Math.hypot(dx,dy)||1;return {x:x+dx/len*4,y:y+dy/len*4};});assert(approaches.some(p=>W.walkable(s,p)),key+' '+object.id+' has a ground approach');
  }}
});
test('each loose object uses a real support, explicit material and matching independent visual',()=>{
  const materials=new Set();for(const key of Object.keys(O.rooms)){const s=world(key);for(const object of s.glass){materials.add(object.material);assert(O.MATERIALS[object.material],object.id);assert.equal(object.movable,true);assert(Number.isFinite(object.mass)&&object.mass>0);assert(Number.isFinite(object.friction)&&object.friction>0);assert.equal(object.breakable,['glass','ceramic'].includes(object.material));assert.equal(object.sharp,object.breakable);
    if(object.surface!==null){const support=s.surfaces.find(x=>x.id===object.surface);assert(support,object.id);assert(W.inside(object,support.polygon),object.id+' stays on its support');assert(W.walkable(s,object,support.height),object.id+' support accepts a landing');}else assert(W.ground(s,object));
    assert(Object.hasOwn(O.SPRITES,object.visual.sprite));assert.equal(object.visual.width,object.visual.height,'atlas tiles retain their original aspect ratio');assert.equal(object.visual.x,object.x);assert.equal(object.visual.y,object.y);assert.equal(object.visual.anchorY,O.SPRITE_ANCHORS[object.visual.sprite]);
  }}assert(materials.has('glass'));assert(materials.has('ceramic'));assert(materials.has('metal'));assert(materials.has('paper'));assert(materials.has('wood'));assert(materials.has('stone'));
});
test('fixed stone islands, built-in cabinets and shelves have physical support without duplicate artwork',()=>{
  for(const key of Object.keys(O.rooms))for(const surface of world(key).surfaces){assert.equal(surface.hidden,!surface.movable);if(surface.movable){assert(surface.visual);assert(Object.hasOwn(O.SPRITES,surface.visual.sprite));assert.equal(surface.visual.width,surface.visual.height);}else{assert.equal(surface.visual,undefined);assert(surface.height>0);}}
  const prep=world('classroom-pharmaceutics');for(const id of ['prep-left-island','prep-right-island','prep-teacher-bench']){const s=prep.surfaces.find(x=>x.id===id);assert(s&&!s.movable&&s.material==='stone');}
});
test('all entrances and teaching positions remain reachable around the actual photo furniture',()=>{
  for(const key of Object.keys(O.rooms)){const s=world(key);assert(W.walkable(s,s.spawn),key);for(const portal of s.portals){assert(W.walkable(s,portal),key+' '+portal.id);const route=W.route(s,s.spawn,portal);assert(route.length,key+' '+portal.id);let from=s.spawn;for(const point of route){assert(W.clear(s,from,point),key+' route segment');from=point;}assert(W.distance(from,portal)<.1);}}
});
test('new-floor arrivals use each real room desk or bench after its geometry changes',()=>{
  for(const building of A.BUILDINGS){const s=W.hall('arrival',building.id),desk=s.surfaces.find(x=>x.arrival),first=W.deskArrival(s);assert(desk,building.id);assert(W.walkable(s,first));assert(first.y>Math.max(...desk.polygon.map(p=>p.y)));assert.equal(W.near(s,first,45),null);const old=O.get('hall:'+building.id).surfaces.find(x=>x.id===desk.id),saved=JSON.stringify(old);desk.x+=20;desk.y+=10;desk.polygon=desk.polygon.map(p=>({x:p.x+20,y:p.y+10}));const moved=W.deskArrival(s);assert(W.walkable(s,moved));assert.notDeepEqual(moved,first);assert.equal(JSON.stringify(old),saved,'live scene shifts never mutate source room data');}
});

test('battle display counter has a connected ground approach and a legal jump landing',()=>{
  const scene=W.hall('counter approach','battle'),counter=scene.surfaces.find(s=>s.id==='battle-display-counter'),approach={x:959,y:415};
  assert(W.walkable(scene,approach));assert(W.route(scene,scene.spawn,approach).length);assert(!W.walkable(scene,{x:959,y:400}));assert(W.clear(scene,approach,{x:959,y:400},counter.height));
  for(const object of scene.glass)assert(W.clear(scene,{x:959,y:400},object,counter.height),object.id+' reachable while standing on its real counter');
});
test('dense classroom routes retain valid segments around every current furniture footprint',()=>{
  const pairs=[[{x:70,y:480},{x:920,y:190}],[{x:100,y:380},{x:880,y:260}],[{x:150,y:220},{x:500,y:620}]];
  for(const building of ['pharmacology','battle','pharmaceutics','herbal']){
    const original=W.classrooms[building],scene={...original,surfaces:original.surfaces.map(s=>({...s,polygon:s.polygon.map(p=>({...p}))}))};
    for(const [start,goal] of pairs){const from=W.nearest(scene,start),to=W.nearest(scene,goal);assert(!W.clear(scene,from,to),'exercise a blocked direct path');const path=W.route(scene,from,to);assert(path.length,building);let previous=from;for(const next of path){assert(W.clear(scene,previous,next),building);previous=next;}assert(W.distance(previous,to)<.01);}
    const moved=scene.surfaces.find(s=>s.movable);moved.x+=9;moved.y+=7;moved.polygon=moved.polygon.map(p=>({x:p.x+9,y:p.y+7}));const from=W.nearest(scene,pairs[0][0]),to=W.nearest(scene,pairs[0][1]),path=W.route(scene,from,to);assert(path.length,building+' after an actual geometry change');let previous=from;for(const next of path){assert(W.clear(scene,previous,next));previous=next;}assert(W.distance(previous,to)<.01);
  }
});
test('measured atlas crops stay in bounds and tabletop ground anchors project onto the rendered wood surface',()=>{
  const fs=require('node:fs'),path=require('node:path');assert.deepEqual(O.ATLAS_SIZE,[1254,1254]);
  for(const sprite of Object.keys(O.SPRITES)){const [x,y,w,h]=O.SPRITE_RECTS[sprite];assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=O.ATLAS_SIZE[0]&&y+h<=O.ATLAS_SIZE[1]);}
  for(const room of Object.values(O.rooms))assert(fs.existsSync(path.join(__dirname,'../game',room.background.replace('./',''))),room.background);
  // Independently measured tabletop pixels in the wood-table source crop.
  const plane=[[16,104],[267,32],[330,80],[66,154]],tables=[['hall-pharmaceutics','ntu-foreground-desk'],['hall-herbal','herbal-front-desk'],['hall-herbal','herbal-mid-desk']];
  for(const [key,id] of tables){const scene=world(key),surface=scene.surfaces.find(s=>s.id===id),v=surface.visual,scale=v.width/336,top=v.y-v.anchorY*267*scale,rendered=plane.map(([x,y])=>({x:v.x-v.width/2+x*scale,y:top+y*scale}));
    for(const prop of scene.glass.filter(p=>p.surface===id))assert(W.inside({x:prop.x,y:prop.y-surface.height},rendered),prop.id+' sits on the drawn tabletop');
    for(const p of rendered.filter(p=>p.x>=5)){const foot={x:p.x,y:p.y+surface.height};assert(W.inside(foot,surface.polygon)||Math.min(...surface.polygon.map((a,i)=>W.distance(foot,W.projection(foot,a,surface.polygon[(i+1)%surface.polygon.length]))))<.02,id+' visible outer edge is physical within authored 0.01-unit rounding');}
  }
});
