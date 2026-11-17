'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('every wish prize uses its own dimensional equipment image',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../game/shop-art.js'),'utf8');
  const ids=['mint-coat','cedar-coat','sakura-coat','river-coat','mint-hat','cedar-hat','sakura-hat','river-hat','prism-coat','bloom-coat','prism-hat','bloom-hat','aurora-coat','aurora-hat','zenith-coat'].map(id=>'wish-'+id);
  const window={MindAdventure:{gear:id=>ids.includes(id)?{id,name:id,source:'fountain'}:id==='unpainted-gear'?{id,name:id,source:'fruit'}:null},MindEngine:{ITEMS:[]}};
  vm.runInNewContext(source,{window});
  const node=(tag,attributes,...children)=>({tag,attributes,children});
  const paths=[];
  for(const id of ids){
    assert.equal(window.MindShopArt.hasGearArt(id),true,id);
    const image=window.MindShopArt.image(node,id,id);
    assert.equal(image.attributes.role,'img');
    assert.equal(image.children[0].tag,'img');
    const src=image.children[0].attributes.src;
    assert.equal(fs.existsSync(path.join(__dirname,'../../game',src)),true,src);
    paths.push(src);
  }
  assert.equal(new Set(paths).size,ids.length);
  assert.equal(window.MindShopArt.hasGearArt('unpainted-gear'),false);
  assert.equal(window.MindShopArt.image(node,'unpainted-gear','No art'),null);
});
