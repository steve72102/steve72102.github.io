const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../game/academy.js'),E=require('../game/engine.js'),C=require('../game/combat.js'),R=require('../game/adventure.js');

class El{
  constructor(tag,attrs={},children=[]){this.tag=tag;this.attrs={...attrs};this.children=children.flat(Infinity).filter(v=>v!==null&&v!==undefined&&v!==false);this.disabled=!!attrs.disabled;}
  append(...children){this.children.push(...children.flat(Infinity).filter(v=>v!==null&&v!==undefined&&v!==false));}
  appendChild(child){this.append(child);return child;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  get text(){return this.children.map(v=>v instanceof El?v.text:String(v)).join(' ');}
}
const flatten=value=>(Array.isArray(value)?value:[value]).flatMap(v=>v instanceof El?[v,...v.children.flatMap(flatten)]:[]);
const classes=(tree,name)=>flatten(tree).filter(el=>(el.attrs.class||'').split(' ').includes(name));
const buttons=tree=>flatten(tree).filter(el=>el.tag==='button');
function click(tree,label){const button=buttons(tree).find(el=>el.text===label);assert(button,'button exists: '+label);assert(!button.disabled,'button enabled: '+label);button.attrs.onClick();return button;}
function fixture(day='2026-11-01'){
  const state={...E.fresh(),arena:C.fresh(),rpg:R.fresh(),profile:{name:'衣研室學員'},appearance:A.fresh()};state.arena.coins=10000;
  let modal=[],tree=[],mode='shop',saveCount=0;const payments=[],messages=[],previews=[];
  const node=(tag,attrs={},...children)=>new El(tag,attrs,children),btn=(text,onClick,cls='',disabled=false)=>node('button',{onClick,class:'button '+cls,disabled},text);
  const window={MindAcademy:A,MindAdventure:{...R,shopSeasonStatus:id=>R.shopSeasonStatus(id,day)},MindEngine:E,MindCombat:C,MindCastOutfit:{
    preview(s){const snapshot=JSON.parse(JSON.stringify(s));previews.push(snapshot);return node('svg',{class:'outfit-preview','data-character':s.appearance.character,'data-loadout':JSON.stringify(s.rpg.loadout)});},
    itemPreview(s,g){return node('svg',{'data-gear-id':g.id,'data-character':s.appearance?.character||A.fresh().character});}
  }};
  const context={window,document:{createElementNS:(_,tag)=>node(tag)}};
  for(const file of ['shop-art.js','adventure-ui.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../game/'+file),'utf8'),context);
  const ctx={node,btn,note:text=>node('p',{class:'note'},text),title(){},go:view=>{mode=view;render();},save(){saveCount++;},render,toast:text=>messages.push(text),openModal:(...children)=>{modal=children;},closeModal:()=>{modal=[];},getState:()=>state,portrait:()=>node('div'),lore(){},money:(...args)=>payments.push(args)};
  const ui=window.MindAdventureUI(ctx);
  function render(){tree=ui[mode]();}
  function show(view){mode=view;render();return tree;}
  return {state,ui,window,payments,messages,previews,show,get tree(){return tree;},get modal(){return modal;},get saves(){return saveCount;}};
}

test('fruit storefront groups six real current-character previews and leaves the nine classic garments intact',()=>{
  const f=fixture(),before=JSON.stringify(f.state);f.state.appearance.character='lab-engineer';const saved=JSON.stringify(f.state);f.show('shop');
  const cards=classes(f.tree,'fruit-set-card');assert.equal(cards.length,6);assert.equal(classes(f.tree,'outfit-card').length,9);
  for(const card of cards){const key=card.attrs['data-outfit-set'],svg=classes(card,'outfit-preview')[0],loadout=JSON.parse(svg.attrs['data-loadout']);assert.equal(svg.attrs['data-character'],'lab-engineer');assert.equal(Object.keys(loadout).length,8);for(const slot of Object.keys(R.SLOTS))assert.equal(loadout[slot],'fruit-'+key+'-'+slot);assert.equal(classes(card,'fruit-piece').length,8);assert.equal(classes(card,'fruit-piece-picker')[0].tag,'details');}
  assert.notEqual(before,saved);assert.equal(JSON.stringify(f.state),saved,'looking at shop never grants or equips anything');
});

test('ten-character fit gallery renders the selected set without changing the selected character or save',()=>{
  const f=fixture(),before=JSON.stringify(f.state);f.show('shop');const card=classes(f.tree,'fruit-set-card')[2];click(card,'查看十人版型');
  const previews=classes(f.modal,'outfit-preview');assert.equal(previews.length,10);assert.deepEqual(new Set(previews.map(el=>el.attrs['data-character'])),new Set(A.CHARACTERS.map(c=>c.id)));
  for(const svg of previews)assert(Object.values(JSON.parse(svg.attrs['data-loadout'])).every(id=>id.startsWith('fruit-pomelo-')));
  assert.equal(JSON.stringify(f.state),before);assert.equal(f.saves,0);
});

test('single-piece preview preserves the other seven slots and confirmed purchase uses the existing money transaction',()=>{
  const f=fixture();R.grant(f.state,'coat-dawn');R.equip(f.state,'coat-dawn');const before=JSON.stringify(f.state);f.show('shop');const piece=classes(classes(f.tree,'fruit-set-card')[0],'fruit-piece')[0];click(piece,'單件試穿');
  const svg=classes(f.modal,'outfit-preview')[0],loadout=JSON.parse(svg.attrs['data-loadout']);assert.equal(loadout.jacket,'fruit-citrus-jacket');assert.equal(loadout.cape,'coat-dawn');assert.equal(JSON.stringify(f.state),before);
  click(f.modal,'購買這件 · 240 金幣');click(f.modal,'確認購買 · 240 金幣');assert.equal(f.payments.length,1);assert.equal(f.payments[0][0],'gear-buy');assert.equal(f.payments[0][1],'fruit-citrus-jacket');assert.equal(JSON.stringify(f.state),before,'the UI must not grant an item ahead of the money transaction');
});

test('fruit full-set equip stays disabled until all eight pieces are owned and then applies the whole outfit',()=>{
  const f=fixture(),ids=Object.keys(R.SLOTS).map(slot=>'fruit-grape-'+slot);for(const id of ids.slice(0,7))assert(R.buy(f.state,id));f.show('shop');let card=classes(f.tree,'fruit-set-card').find(el=>el.attrs['data-outfit-set']==='grape');assert(buttons(card).find(el=>el.text==='收集八件後可整套穿戴').disabled);
  assert(R.buy(f.state,ids[7]));f.show('shop');card=classes(f.tree,'fruit-set-card').find(el=>el.attrs['data-outfit-set']==='grape');click(card,'穿上已購整套');for(const id of ids)assert.equal(f.state.rpg.loadout[R.gear(id).slot],id);assert.equal(f.saves,1);assert.equal(f.state.equipped,null);assert.equal(R.count(f.state),0);
});

test('unaffordable fruit purchases are disabled and preview never supplies an equip action for unowned clothes',()=>{
  const f=fixture();f.state.arena.coins=0;const before=JSON.stringify(f.state);f.show('shop');const card=classes(f.tree,'fruit-set-card')[0];assert.equal(buttons(card).filter(el=>el.text==='金幣不足'&&el.disabled).length,8);
  f.ui.detail('fruit-cherry-hat');assert(buttons(f.modal).find(el=>el.text==='購買這件 · 140 金幣').disabled);assert(!buttons(f.modal).some(el=>el.text==='穿戴這件裝備'));assert.equal(JSON.stringify(f.state),before);
});

test('milestone wardrobe shows seven actual set previews and reserves original images for the reference action',()=>{
  const f=fixture();f.state.xp=8900;f.show('bag');click(f.tree,'等級造型衣櫥');const cards=classes(f.tree,'live-style-card');assert.equal(cards.length,7);
  for(const card of cards){assert.equal(classes(card,'outfit-preview').length,1);assert.equal(flatten(card).filter(el=>el.tag==='img').length,0);assert(buttons(card).some(el=>el.text==='原始設計圖'));assert(buttons(card).some(el=>el.text==='查看十人版型'));}
  click(cards[0],'穿上整套');for(const slot of Object.keys(R.SLOTS))assert.equal(f.state.rpg.loadout[slot],'style-bach-'+slot);assert.equal(f.saves,1);
});

test('shop art dispatches every real gear item to its shared wearable renderer while preserving coupon art',()=>{
  const f=fixture(),node=(tag,attrs={},...children)=>new El(tag,attrs,children);
  for(const g of R.GEAR){assert(f.window.MindShopArt.has(g.id));const svg=f.window.MindShopArt.image(node,g.id,g.name,'shop-item-image',f.state);assert.equal(svg.tag,'svg',g.id);assert.equal(svg.attrs['data-gear-id'],g.id);}
  for(const id of ['bully','counter','bomb','shirk','diligence']){const img=f.window.MindShopArt.image(node,id);assert.equal(img.tag,'img');assert.equal(img.attrs.src,'./assets/shop/'+id+'.webp');}
  assert.equal(f.window.MindShopArt.image(node,'not-a-real-garment'),null);
});


test('season headings use real metadata, upcoming themes stay hidden, and archived clothes remain available',()=>{
  const current=fixture('2026-11-01');current.show('shop');assert.equal(classes(current.tree,'fruit-season').length,1);assert.equal(classes(current.tree,'fruit-season-heading')[0].text,'2026 第四季 · 果園即興 本季精選');assert.equal(classes(current.tree,'fruit-music-theme').length,6);for(const set of R.FRUIT_SETS)assert(classes(current.tree,'fruit-music-theme').some(el=>el.text.startsWith(set.music+' × ')));
  const future=fixture('2026-09-30');future.show('shop');assert.equal(classes(future.tree,'fruit-season').length,0);assert.equal(classes(future.tree,'fruit-set-card').length,0);assert.equal(classes(future.tree,'outfit-card').length,9);
  const archive=fixture('2027-01-01');const ids=R.setIds('citrus');for(const id of ids)R.grant(archive.state,id);archive.show('shop');assert.equal(classes(archive.tree,'fruit-set-card').length,6);assert.equal(classes(archive.tree,'fruit-season-status')[0].text,'歷季典藏');click(classes(archive.tree,'fruit-set-card')[0],'穿上已購整套');assert.equal(archive.state.rpg.loadout.jacket,'fruit-citrus-jacket');
});
