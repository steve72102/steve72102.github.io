/* Original academy shop illustrations. Prices and purchase state remain in the game modules. */
window.MindShopArt=(()=>{
  'use strict';
  const ids=['north','central','south','east','bully','counter','bomb','shirk','diligence','supply-one','supply-three','supply-ten','star-ticket','coat-dawn','coat-herb','coat-star','boots-dawn','boots-path','boots-star','badge-seed','badge-prism','badge-sage'];
  const aliases={'supply-1':'supply-one','supply-3':'supply-three','supply-10':'supply-ten','wish-1':'star-ticket','shirk-1':'shirk','diligence-1':'diligence'};
  const gearArtwork=Object.freeze({
    ...Object.fromEntries(['coat-dawn','coat-herb','coat-star','boots-dawn','boots-path','boots-star','badge-seed','badge-prism','badge-sage'].map(id=>[id,'./assets/shop/'+id+'.webp'])),
    ...Object.fromEntries(['wish-mint-coat','wish-cedar-coat','wish-sakura-coat','wish-river-coat','wish-mint-hat','wish-cedar-hat','wish-sakura-hat','wish-river-hat','wish-prism-coat','wish-bloom-coat','wish-prism-hat','wish-bloom-hat','wish-aurora-coat','wish-aurora-hat','wish-zenith-coat'].map(id=>[id,'./assets/shop/'+id+'-v1.jpg']))
  });
  const key=id=>aliases[id]||id;
  const equipment=id=>window.MindAdventure?.gear(id)||(window.MindEngine?.ITEMS?.find(item=>item.id===id)?{...window.MindEngine.ITEMS.find(item=>item.id===id),slot:'handheld'}:null);
  const hasGearArt=id=>!!gearArtwork[id]||equipment(id)?.source==='crossline-professor';
  const has=id=>ids.includes(key(id))||hasGearArt(id);
  function image(node,id,name='',className='shop-item-image',state={}){
    if(!has(id))return null;
    const regions={north:'北部',central:'中部',south:'南部',east:'東部'};
    if(regions[key(id)])return node('span',{class:className+' shop-regional-art',role:'img','aria-label':name||'自以為'+regions[key(id)]+'最強'},
      node('img',{src:'./assets/shop/'+key(id)+'.webp',alt:'',width:768,height:768,loading:'lazy',decoding:'async'}),
      node('span',{class:'region-crown-text','aria-hidden':'true'},node('small',{},'自以為'),node('strong',{},regions[key(id)]+'最強')));
    const gear=equipment(id);
    if(gear){
      if(gear.source==='crossline-professor'){
        return node('span',{class:className+' shop-equipment-actual crossline-actual-art',role:'img','aria-label':(name||gear.name)+' · 無人物裝備原畫'},
          node('img',{src:'./assets/shop/crossline-professor-common-'+gear.slot+'-v1.png',alt:'',loading:'lazy',decoding:'async'}));
      }
      if(gearArtwork[id])return node('span',{class:className+' shop-equipment-actual equipment-art',role:'img','aria-label':(name||gear.name)+' · 立體單件裝備圖'},
        node('img',{src:gearArtwork[id],alt:'',loading:'lazy',decoding:'async'}));
      return null;
    }
    return node('img',{class:className,src:'./assets/shop/'+key(id)+'.webp',alt:name,width:768,height:768,loading:'lazy',decoding:'async'});
  }
  function card(ctx,id,name,label){
    return ctx.node('button',{type:'button',class:'shop-artwork','aria-label':'放大欣賞'+name+'卡面',onClick:()=>ctx.openModal(
      image(ctx.node,id,name+'原創卡面','shop-art-expanded',ctx.getState?.()),ctx.node('h2',{},name),ctx.node('p',{class:'note'},window.MindAdventure?.gear(id)?.source==='crossline-professor'?'此圖是單件裝備原畫；試穿與場景會顯示實際穿戴分件。':'學院原創插畫 · 點關閉返回商城')
    )},image(ctx.node,id,'','shop-item-image',ctx.getState?.()),label?ctx.node('span',{class:'shop-art-label'},label):null,ctx.node('span',{class:'shop-art-zoom','aria-hidden':'true'},'⊕ 放大欣賞'));
  }
  return Object.freeze({has,hasGearArt,image,card});
})();

