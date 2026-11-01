'use strict';
// Optional local raster audit: use the actual game renderer and scene adapter.
// Run: node tools/render-outfit-audit.cjs /absolute/path/report.json
// Requires sharp; SHARP_MODULE may point to an existing installation. No network writes.
// The DOM and XMLSerializer below are fixtures; this does not emulate a browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),A=require(root+'/game/academy.js'),R=require(root+'/game/adventure.js'),E=require(root+'/game/engine.js'),L=require(root+'/game/lobby.js');
const sharp=require(process.env.SHARP_MODULE||'sharp');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
class El{
  constructor(tag,attrs={},children=[],ns='http://www.w3.org/2000/svg'){this.tag=tag;this.namespaceURI=ns;this.attrs={...attrs};this.children=[];this.dataset={};this.style={setProperty(k,v){this[k]=String(v);}};this.classList={contains:c=>(this.attrs.class||'').split(' ').includes(c),add:c=>{this.attrs.class=((this.attrs.class||'')+' '+c).trim();},toggle:(c,on)=>{const list=new Set((this.attrs.class||'').split(' ').filter(Boolean));if(on)list.add(c);else list.delete(c);this.attrs.class=[...list].join(' ');},remove(){}};for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;this.append(...children);}
  setAttribute(k,v){this.attrs[k]=String(v);}
  setAttributeNS(ns,k,v){this.setAttribute(k,v);}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  append(...children){for(const c of children.flat(Infinity)){if(c==null||c===false)continue;this.children.push(c);if(c instanceof El)c.parentElement=this;}}
  appendChild(c){this.append(c);return c;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);}
  cloneNode(){return new El(this.tag,{...this.attrs},this.children.map(c=>c instanceof El?c.cloneNode(true):c),this.namespaceURI);}
  querySelectorAll(selector){const m=selector.match(/^\[([^=\]]+)(?:=["']([^"']+)["'])?\]$/);const match=el=>m?m[2]===undefined?Object.hasOwn(el.attrs,m[1]):el.attrs[m[1]]===m[2]:selector.startsWith('.')?(el.attrs.class||'').split(' ').includes(selector.slice(1)):el.tag===selector;return this.children.flatMap(c=>c instanceof El?[...(match(c)?[c]:[]),...c.querySelectorAll(selector)]:[]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  set textContent(v){this.children=[String(v)];}
  get textContent(){return this.children.map(c=>c instanceof El?c.textContent:String(c)).join('');}
}
const serialize=(el,top=true)=>{
  if(!(el instanceof El))return esc(el);const attrs={...el.attrs};
  if(top&&el.namespaceURI&&!attrs.xmlns)attrs.xmlns=el.namespaceURI;
  return '<'+el.tag+Object.entries(attrs).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('')+'>'+el.children.map(c=>serialize(c,false)).join('')+'</'+el.tag+'>';
};
const document={createElementNS:(ns,tag)=>new El(tag,{},[],ns),createTextNode:text=>String(text)};
const window={MindAcademy:A,MindAdventure:R,MindEngine:E,MindLobby:L};
const context={window,document,XMLSerializer:class{serializeToString(el){return serialize(el);}},Date};
for(const file of ['cast-outfit.js','lobby-ui.js','shop-art.js'])vm.runInNewContext(fs.readFileSync(root+'/game/'+file,'utf8'),context);
const node=(tag,attrs={},...children)=>new El(tag,attrs,children,null);
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
async function decode(svg){assert.equal((svg.match(/\sxmlns=/g)||[]).length,1,'exactly one namespace declaration');assert(!/NaN|undefined/.test(svg),'finite SVG data');const {data,info}=await sharp(Buffer.from(svg)).resize(180,330).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,180);assert.equal(info.height,330);let visible=0;for(let i=3;i<data.length;i+=4)if(data[i])visible++;assert(visible>20,'visible image pixels');return {hash:hash(data),bytes:Buffer.byteLength(svg),visible};}
module.exports={A,R,E,window,serialize,El,sharp};
if(require.main===module)(async()=>{
  const report={kind:'actual-renderer + scene-adapter + fixture XML + sharp rasterization; not a browser test',sceneImages:0,itemImages:0,directionGroups:[],bytes:{min:Infinity,max:0},errors:[]};
  for(const set of [...R.STYLE_SETS,...R.FRUIT_SETS])for(const person of A.CHARACTERS){
    const loadout=Object.fromEntries(R.setIds(set).map(id=>[R.gear(id).slot,id])),appearance={version:1,character:person.id,pet:null};
    const actor=window.MindAvatar({node,appearance,name:'Render audit',loadout});const images=actor.querySelectorAll('img');assert.equal(images.length,3);const digests=[];
    for(const image of images){const svg=decodeURIComponent(image.attrs.src.slice(image.attrs.src.indexOf(',')+1));try{const r=await decode(svg);digests.push(r.hash);report.bytes.min=Math.min(report.bytes.min,r.bytes);report.bytes.max=Math.max(report.bytes.max,r.bytes);report.sceneImages++;}catch(error){report.errors.push({set:set.key,character:person.id,class:image.attrs.class,error:String(error)});}}
    report.directionGroups.push({set:set.key,character:person.id,distinct:new Set(digests).size});
  }
  for(const g of R.GEAR)for(const person of A.CHARACTERS){
    try{const item=window.MindShopArt.image(node,g.id,g.name,'shop-item-image',{appearance:{version:1,pet:null,character:person.id},rpg:{loadout:{}}});assert.equal(item.tag,'svg','every garment must use real SVG, never a missing PNG');await decode(serialize(item));report.itemImages++;}catch(error){report.errors.push({item:g.id,character:person.id,error:String(error)});}
  }
  report.directionFailures=report.directionGroups.filter(g=>g.distinct!==3);delete report.directionGroups;
  fs.writeFileSync(path.resolve(process.argv[2]||'outfit-render-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.errors.length||report.directionFailures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
