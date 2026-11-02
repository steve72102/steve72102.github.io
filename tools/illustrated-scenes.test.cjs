'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const W=require('../game/campus-walk.js'),P=require('../game/scene-play.js'),O=require('../game/scene-objects.js');
const signatures=require('./stage4-scenes-geometry.json');
const provenance=require('../game/assets/illustrated-scenes/STAGE4-PROVENANCE.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('all nine outdoors and all eighteen interior floor/class scenes preserve the delivered Stage3 geometry',()=>{
  const scenes={...W.outdoors,...Object.fromEntries(P.scenes.map(id=>[id,P.scene(id,P.fresh())]))};
  assert.deepEqual(Object.keys(scenes),Object.keys(signatures.scenes));
  for(const [id,scene] of Object.entries(scenes)){
    const geometry=Object.fromEntries(signatures.fields.filter(k=>scene[k]!==undefined).map(k=>[k,scene[k]]));
    assert.equal(sha(JSON.stringify(geometry)),signatures.scenes[id],id+' collision, furniture, portal, water and orbital geometry remains unchanged');
    assert.match(scene.background,/^\.\/assets\/illustrated-scenes\/[a-z-]+\.webp$/);
  }
});

test('eighteen added illustrated plates have their recorded bytes and hashes, with the Stage3 classroom retained',()=>{
  assert.equal(provenance.assets.length,18);
  const keys=new Set();
  for(const item of provenance.assets){
    assert(!keys.has(item.key));keys.add(item.key);
    assert.deepEqual(item.dimensions,[1536,1024]);
    const data=fs.readFileSync(path.join(__dirname,'..',item.runtime));
    assert.equal(data.length,item.runtimeBytes,item.key);assert.equal(sha(data),item.runtimeSHA256,item.key);
    assert(!item.runtime.includes('classroom-pharmaceutics'), 'the first-batch image is excluded from new assets');
  }
  const retained=fs.readFileSync(path.join(__dirname,'../game/assets/illustrated-scenes/classroom-pharmaceutics.webp'));
  assert.equal(sha(retained),'cb0a1f4d7f504b47ab33d0bc223fc0e7cbb4851f9d853b9e64e25bbde7e914f4');
  assert.equal(Object.values(O.rooms).filter(r=>r.background.includes('/illustrated-scenes/')).length,9);
});

test('all district and outer-loop links retain legal dry approaches and the herb island and fountain stay solid',()=>{
  for(const [id,scene] of Object.entries(W.outdoors)){
    assert(W.walkable(scene,scene.spawn),id+' spawn');
    for(const portal of scene.portals){
      const end=W.nearest(scene,portal),route=W.route(scene,scene.spawn,end);
      assert(route.length&&W.distance(route.at(-1),end)<3,id+' '+portal.id+' reachable');
      let start=scene.spawn;for(const point of route){assert(W.clear(scene,start,point),id+' '+portal.id+' dry route');start=point;}
    }
  }
  assert(!W.walkable(W.campus,{x:500,y:340}));
  assert(!W.walkable(W.trails.west,{x:430,y:320}));
  assert(W.walkable(W.trails.east,{x:950,y:270}),'existing east bridge viewpoint stays reachable');
});

test('background failure handling updates the plate and all fixed occlusion images together',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../game/academy-ui.js'),'utf8');
  assert(source.includes("image.dataset.sceneArtStatus='fallback';image.src=fallback"));
  assert(source.includes("querySelectorAll('.photo-occlusion')"));
  assert(source.includes("layer.style.backgroundImage='url(\"'+fallback+'\")'"));
  // This contract check complements the real browser intentional-404 scenario.
  assert(source.includes("function overviewImage(attrs={})"));
  assert(source.includes("src:sceneImage(scene,legacy)"));
});
