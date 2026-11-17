'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const outfit=require('../../game/cast-outfit.js');

function element(tag){
  return {tagName:tag,children:[],attributes:{},className:'',textContent:'',
    setAttribute(name,value){this.attributes[name]=String(value);},
    getAttribute(name){return this.attributes[name]??null;},
    append(child){this.children.push(child);}};
}

test('missing outfit art shows gear data instead of a flat person',()=>{
  const previousWindow=global.window,previousDocument=global.document;
  const gear={id:'fountain-jacket',slot:'jacket',name:'溪藍研習衣'};
  global.document={createElement:element};
  global.window={
    MindAcademy:{character:()=>({id:'professor',name:'若光教授'})},
    MindAdventure:{SLOTS:{jacket:'外套',shirt:'衣服'},gear:id=>id===gear.id?gear:null},
    MindEngine:{ITEMS:[]}
  };
  try{
    const state={appearance:{character:'professor'},rpg:{loadout:{jacket:gear.id}}};
    const full=outfit.preview(state);
    const item=outfit.itemPreview(state,gear);
    for(const result of [full,item]){
      assert.equal(result.tagName,'div');
      assert.equal(result.getAttribute('data-art-status'),'equipment-only');
      assert.equal(result.children[1].children[0].textContent,'外套：溪藍研習衣');
    }
  }finally{global.window=previousWindow;global.document=previousDocument;}
});
