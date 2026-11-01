'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const O=require('../game/scene-objects.js');
function fixture(){
  let writes=0,queries=0,sceneReads=0,definitionReads=0;
  class El{
    constructor(tag,attrs={},children=[]){this.tag=tag;this.attrs={...attrs};this.dataset={};this.children=[];this.parentElement=null;this._hidden=!!attrs.hidden;this._text='';for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;this.style=new Proxy({setProperty:(key,value)=>{writes++;this.style[key]=value;}},{set:(target,key,value)=>{writes++;target[key]=value;return true;}});this.classList={contains:name=>(this.attrs.class||'').split(' ').includes(name),add:name=>{this.attrs.class=((this.attrs.class||'')+' '+name).trim();writes++;},toggle:(name,on)=>{const classes=new Set((this.attrs.class||'').split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.attrs.class=[...classes].join(' ');writes++;}};this.append(...children);}
    append(...children){for(const child of children.flat(Infinity)){if(child==null||child===false)continue;child.parentElement=this;this.children.push(child);}}
    get childElementCount(){return this.children.length;}
    get hidden(){return this._hidden;}
    set hidden(value){this._hidden=!!value;writes++;}
    get textContent(){return this._text;}
    set textContent(value){this._text=String(value);writes++;}
    closest(selector){let current=this;while(current){if(current.classList.contains(selector.slice(1)))return current;current=current.parentElement;}return null;}
    querySelectorAll(selector){queries++;const cls=selector.slice(1),walk=el=>el.children.flatMap(child=>[...(child.classList.contains(cls)?[child]:[]),...walk(child)]);return walk(this);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  }
  const node=(tag,attrs={},...children)=>new El(tag,attrs,children);
  const visual=(sprite,x,y,size=40)=>({sprite,x,y,width:size,height:size,anchorX:.5,anchorY:.9});
  const table={id:'left-table',x:150,y:470,w:120,d:45,height:55,movable:true,material:'wood',visual:visual('wood-table',150,494,180)};
  const chair={id:'side-chair',x:230,y:500,w:30,d:20,height:25,movable:true,material:'wood',visual:{...visual('wood-chair',230,507,65),flipX:true}};
  const definitions=[['glass','beaker','glass',true],['ceramic','mortar','ceramic',true],['book','books','paper',false],['plant','plant','plant',false]].map(([id,sprite,material,breakable],i)=>({id,name:id,kind:sprite,x:130+i*12,y:470,surface:'left-table',material,breakable,visual:visual(sprite,130+i*12,470)}));
  const base={kind:'classroom',surfaces:[{id:'wall-cabinet',x:900,y:300,height:90,hidden:true,movable:false},table,chair],glass:definitions};
  const state={furniture:{},props:Object.fromEntries(definitions.map(d=>[d.id,{x:d.x,y:d.y,z:55,support:'left-table',brokenUntil:0,removed:false,fallUntil:0,fromZ:0}])),injuries:{}};
  const P={scenes:['classroom:test'],definitions(){definitionReads++;return definitions;},scene(id,s){sceneReads++;return {...base,surfaces:base.surfaces.map(d=>({...d,x:d.x+(s?.furniture[d.id]?.dx||0),y:d.y+(s?.furniture[d.id]?.dy||0)}))};},cup(s,id,prop,now){const c=s.props[prop];return c.brokenUntil&&c.brokenUntil<=now?{...c,brokenUntil:0,removed:true}:c;},elevation(c,now){return c.fallUntil>now?c.z+c.fromZ*.5:c.z;}};
  const window={MindWalk:{WIDTH:1000,HEIGHT:667},MindScenePlay:P,MindSceneObjects:O,MindAmbient:()=>({})};
  vm.runInNewContext(fs.readFileSync(require.resolve('../game/scene-play-ui.js'),'utf8'),{window});
  // The builder and updater are intentionally different instances, as in the app.
  const builder=window.MindSceneUI({node}),updater=window.MindSceneUI({node});
  const world=node('section',{class:'walk-world'},builder.props(base)),section=node('section',{class:'walk-section'},world);
  const actor=node('div',{class:'walk-actor'});world.append(actor);
  const objects=()=>world.children.filter(el=>el.classList.contains('photo-object')),prop=id=>objects().find(el=>el.dataset.propId===id),furniture=id=>objects().find(el=>el.dataset.furnitureId===id),shards=id=>world.children.find(el=>el.classList.contains('photo-shards')&&el.dataset.propId===id);
  return {builder,updater,world,section,state,actor,node,base,prop,furniture,shards,objects,counts:()=>({writes,queries,sceneReads,definitionReads}),render:(now=0)=>updater.render(world,'classroom:test',state,[],'mine',now)};
}

test('photo props use only the original atlas and fixed background cabinetry is not duplicated',()=>{
  const f=fixture();assert.equal(f.objects().length,6);assert.equal(f.furniture('wall-cabinet'),undefined);
  for(const el of f.objects()){assert.equal(el.children.length,1);assert.match(el.children[0].style.backgroundImage,/assets\/scene-objects\/props\.png/);assert(!/study-table|study-chair|glass-cup|lab-glassware/.test(el.children[0].style.backgroundImage));assert(el.attrs['aria-label']);}
  assert(f.furniture('side-chair').children[0].classList.contains('photo-flipped'));
  const rect=O.SPRITE_RECTS?.beaker,size=O.ATLAS_SIZE;
  assert.equal(f.prop('glass').children[0].style.backgroundPosition,rect?rect[0]/(size[0]-rect[2])*100+'% '+rect[1]/(size[1]-rect[3])*100+'%':'100% 33.33333333333333%');
  assert.equal(f.shards('book'),undefined);assert.equal(f.shards('plant'),undefined);assert(f.shards('glass'));assert(f.shards('ceramic'));
});

test('each room can create its actual authored furniture and props without a generic central group',()=>{
  const f=fixture();for(const room of Object.values(O.rooms)){
    const scene={kind:room.key.startsWith('hall-')?'hall':'classroom',surfaces:room.surfaces,glass:room.props},nodes=f.builder.props(scene);
    assert.equal(nodes.filter(el=>el.dataset.furnitureId).length,room.surfaces.filter(s=>!s.hidden&&s.visual).length,room.key);
    assert.equal(nodes.filter(el=>el.classList.contains('photo-portable')).length,room.props.filter(p=>p.visual).length,room.key);
    assert(nodes.every(el=>!el.classList.contains('scene-table')&&!el.classList.contains('scene-chair')));
  }
});

test('surface art follows only its own physical displacement and portable height is projected in scene coordinates',()=>{
  const f=fixture();f.render();f.state.furniture['left-table']={dx:30,dy:12};f.state.props.glass.x+=30;f.state.props.glass.y+=12;f.render();
  assert.equal(f.furniture('left-table').style.left,'18%');assert.equal(f.furniture('left-table').style.top,(506/667*100)+'%');assert.equal(f.prop('glass').style.left,'16%');assert.equal(f.prop('glass').style.top,(427/667*100)+'%');assert.equal(f.furniture('side-chair').style.left,'23%');
});

test('falling books remain as floor objects and never create glass fragments',()=>{
  const f=fixture(),book=f.state.props.book;Object.assign(book,{support:null,z:0,fromZ:55,fallUntil:500});f.render(200);assert.equal(f.prop('book').hidden,false);assert(f.prop('book').classList.contains('is-falling'));assert.equal(f.prop('book').style.top,((470-27.5)/667*100)+'%');
  f.render(600);assert.equal(f.prop('book').hidden,false);assert(!f.prop('book').classList.contains('is-falling'));assert.equal(f.prop('book').style.top,(470/667*100)+'%');assert.equal(f.shards('book'),undefined);
});

test('glass and ceramic fragments expire without drawing the broken object again',()=>{
  const f=fixture();for(const id of ['glass','ceramic'])Object.assign(f.state.props[id],{z:0,support:null,brokenUntil:60500,fallUntil:0});f.render(1000);
  for(const id of ['glass','ceramic']){assert(f.prop(id).hidden);assert.equal(f.shards(id).hidden,false);assert.equal(f.shards(id).attrs['data-material'],id==='glass'?'glass':'ceramic');}
  f.render(60501);for(const id of ['glass','ceramic']){assert(f.prop(id).hidden);assert(f.shards(id).hidden);}
  f.render(120000);assert(f.prop('glass').hidden);assert(f.prop('ceramic').hidden);
});

test('stationary rendering reuses cached DOM and skips unchanged styles and labels',()=>{
  const f=fixture();f.render(0);const before=f.counts();for(let i=1;i<=15;i++)f.render(i*100);const after=f.counts();assert.equal(after.writes,before.writes);assert.equal(after.queries,before.queries);assert.equal(after.definitionReads,before.definitionReads);assert.equal(after.sceneReads-before.sceneReads,15,'one scene lookup per update, not per prop');
});

test('injury feedback appears only after an injury and updates newly replaced avatars',()=>{
  const f=fixture();f.render();const health=f.world.children.find(el=>el.classList.contains('scene-health'));assert(health.hidden);assert.equal(health.textContent,'');
  f.state.injuries.mine=8500;f.render(500);assert(f.actor.classList.contains('bleeding'));assert.equal(health.textContent,'踩到碎片 · 8 秒後止血');
  const replacement=f.node('div',{class:'walk-actor'});f.actor.parentElement=null;f.world.children[f.world.children.indexOf(f.actor)]=replacement;replacement.parentElement=f.world;f.render(1000);assert(replacement.classList.contains('bleeding'));
  f.render(9000);assert(!replacement.classList.contains('bleeding'));assert(health.hidden);
});

test('portable objects without a support surface render on the floor without a missing-table error',()=>{
  const f=fixture();f.base.glass[3].surface=null;Object.assign(f.state.props.plant,{support:null,z:0});assert.doesNotThrow(()=>f.render());assert.equal(f.prop('plant').hidden,false);assert.equal(f.prop('plant').style.top,(470/667*100)+'%');
});

test('measured atlas source rectangles retain the whole chair and preserve its aspect ratio',()=>{
  const f=fixture(),chair=f.base.surfaces.find(s=>s.id==='side-chair');Object.assign(chair.visual,{sourceRect:[16,0,299,358],sourceSize:[1254,1254]});
  const el=f.builder.props(f.base).find(el=>el.dataset.furnitureId==='side-chair'),art=el.children[0];
  assert.equal(art.style.backgroundSize,(1254/299*100)+'% '+(1254/358*100)+'%');assert.equal(art.style.backgroundPosition,(16/(1254-299)*100)+'% 0%');assert.notEqual(art.style.backgroundSize,'400% 400%');
  assert(Math.abs(parseFloat(art.style.width)-299/358*100)<1e-9);assert.equal(art.style.height,'100%');assert(parseFloat(art.style.left)>0);assert.equal(art.style.top,'0%');
});

test('fixed furniture occlusion reuses only its clipped background front face and does not move or intercept input',()=>{
  const f=fixture(),cabinet=f.base.surfaces[0];f.base.background='./assets/scene-objects/classroom-test-clean.webp';cabinet.occlusion=[[850,230],[950,230],[950,300],[850,300]];
  const layer=f.builder.props(f.base).find(el=>el.classList.contains('photo-occlusion'));assert(layer);assert.equal(layer.attrs['aria-hidden'],'true');assert.equal(layer.style.backgroundImage,'url("'+f.base.background+'")');assert.equal(layer.style.zIndex,'60');assert.equal(layer.style.clipPath,'polygon(85% '+(230/667*100)+'%,95% '+(230/667*100)+'%,95% '+(300/667*100)+'%,85% '+(300/667*100)+'%)');
  cabinet.movable=true;assert(!f.builder.props(f.base).some(el=>el.classList.contains('photo-occlusion')),'moving objects must use their own atlas sprite');
  const css=fs.readFileSync(require.resolve('../game/photo-scene.css'),'utf8');assert.match(css,/\.photo-occlusion\{[^}]*pointer-events:none/);
});
