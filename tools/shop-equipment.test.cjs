const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../game/academy.js'),R=require('../game/adventure.js'),E=require('../game/engine.js'),W=require('../game/campus-walk.js');
class Element{
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];}
  setAttribute(k,v){this.attrs[k]=String(v);}
  append(...nodes){this.children.push(...nodes);}
  appendChild(n){this.append(n);return n;}
  querySelectorAll(selector){const slot=selector.match(/="([^"]+)"/)[1];return this.children.flatMap(n=>[...(n.attrs['data-equipment-slot']===slot?[n]:[]),...n.querySelectorAll(selector)]);}
  cloneNode(){const n=new Element(this.tag);n.attrs={...this.attrs};n.children=this.children.map(c=>c.cloneNode());return n;}
}
const window={MindAcademy:A,MindAdventure:R,MindEngine:E};
vm.runInNewContext(fs.readFileSync(require.resolve('../game/cast-outfit.js'),'utf8'),{window,document:{createElementNS:(_,tag)=>new Element(tag)}});
const O=window.MindCastOutfit;
test('every catalog garment uses the exact wearable shapes and colors for all ten characters',()=>{
  const items=R.GEAR;assert.equal(items.filter(g=>/^(coat|boots|badge)-/.test(g.id)).length,9);assert.equal(items.filter(g=>g.source==='fruit').length,48);
  for(const c of A.CHARACTERS)for(const item of items){const state={appearance:{character:c.id},rpg:{loadout:{[item.slot]:item.id}}};
    const full=O.preview(state),card=O.itemPreview(state,item),parts=full.querySelectorAll('[data-equipment-slot="'+item.slot+'"]');
    assert(parts.length>0,item.id);assert.equal(card.attrs['data-gear-id'],item.id);
    assert.equal(JSON.stringify(card.children),JSON.stringify(parts),c.id+' '+item.id+' must match the actual try-on');
    if(item.slot!=='handheld')assert.equal(card.querySelectorAll('[data-equipment-slot="handheld"]').length,0);
  }
});
test('all thirteen sets retain all eight equipped pieces in each view without mutating a character save',()=>{
  for(const set of [...R.STYLE_SETS,...R.FRUIT_SETS])for(const c of A.CHARACTERS){
    const loadout=Object.fromEntries(R.setIds(set).map(id=>[R.gear(id).slot,id]));
    const state={appearance:{character:c.id},rpg:{loadout}},before=JSON.stringify(state);
    for(const direction of ['down','up','right','left']){
      const full=O.preview(state,{direction});assert.equal(full.attrs['data-character'],c.id);
      assert(!/NaN|undefined/.test(JSON.stringify(full)),set.key+' '+c.id+' '+direction);
      for(const [slot,id] of Object.entries(loadout)){
        const parts=full.querySelectorAll('[data-equipment-slot="'+slot+'"]');assert(parts.length>0,slot+' is visibly represented in '+direction);
        assert(parts.every(part=>part.attrs['data-gear-id']===id));
      }
    }
    assert.equal(JSON.stringify(state),before,'try-on must be read-only');
  }
});
test('fountain stall blocks its counter but leaves every campus entrance reachable from both sides',()=>{
  const s=W.campus,shop=s.portals.find(p=>p.id==='shop');assert(shop);assert(!W.walkable(s,{x:650,y:492}));assert(!W.clear(s,{x:650,y:460},{x:650,y:530}));
  for(const from of [s.spawn,{x:580,y:480},{x:730,y:520},...s.portals])for(const to of [shop,...s.portals]){const route=W.route(s,from,to);assert(route.length);let p=from;for(const next of route){assert(W.clear(s,p,next));p=next;}assert(W.distance(p,to)<.01);}
  assert.equal(shop.auto,false,'passing by or returning must not unexpectedly reopen the shop');
});
