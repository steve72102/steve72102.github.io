'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const O=require('../game/scene-objects.js'),root=path.resolve(__dirname,'../game');
test('all original scene reconstruction assets are present, hash-matched, and atlas crops stay inside the actual PNG',()=>{
  const provenance=JSON.parse(fs.readFileSync(path.join(root,'assets/scene-objects/PROVENANCE.json'),'utf8'));
  assert.equal(provenance.assets.length,10);assert.equal(Object.keys(O.rooms).length,9);
  const files=new Set(provenance.assets.map(a=>'./assets/scene-objects/'+a.file));
  for(const room of Object.values(O.rooms)){assert(files.has(room.background));assert(files.has(room.atlas));}
  for(const a of provenance.assets){const data=fs.readFileSync(path.join(root,'assets/scene-objects',a.file));assert.equal(data.length,a.bytes,a.file);assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256,a.file);}
  const png=fs.readFileSync(path.join(root,O.ATLAS.slice(2)));assert.equal(png.subarray(1,4).toString(),'PNG');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.deepEqual([width,height],[...O.ATLAS_SIZE]);assert.equal(png[25],6,'transparent RGBA atlas');
  for(const [id,rect] of Object.entries(O.SPRITE_RECTS)){const [x,y,w,h]=rect;assert(rect.every(Number.isInteger),id);assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,id);}
});

test('every live scene asset is precached and object registry loads before navigation and physics',()=>{
  const scope={self:{registration:{scope:'https://example.test/game/'},addEventListener(){}},URL};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8')+'\nthis.assetList=ASSETS;',scope);
  const cached=new Set(scope.assetList);
  for(const file of ['./scene-objects.js','./wardrobe.css','./outfit-scene.css','./photo-scene.css',O.ATLAS,...Object.values(O.rooms).map(r=>r.background)])assert(cached.has(file),file+' must work after offline reload');
  for(const old of ['study-table','study-chair','glass-cup','lab-glassware-hq'])assert(!cached.has('./assets/academy/'+old+'.webp'),'retired prefab '+old);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),scripts=[...html.matchAll(/<script[^>]+src="\.\/([^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]);
  for(const later of ['campus-walk.js','furniture.js','scene-play.js'])assert(scripts.indexOf('scene-objects.js')>=0&&scripts.indexOf('scene-objects.js')<scripts.indexOf(later),later+' must see registry');
});
