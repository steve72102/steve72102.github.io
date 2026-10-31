/* Original academy shop illustrations. Prices and purchase state remain in the game modules. */
window.MindShopArt=(()=>{
  'use strict';
  const ids=['north','central','south','east','bully','counter','bomb','shirk','diligence','supply-one','supply-three','supply-ten','star-ticket','coat-dawn','coat-herb','coat-star','boots-dawn','boots-path','boots-star','badge-seed','badge-prism','badge-sage'];
  const aliases={'supply-1':'supply-one','supply-3':'supply-three','supply-10':'supply-ten','wish-1':'star-ticket','shirk-1':'shirk','diligence-1':'diligence'};
  const key=id=>aliases[id]||id;
  const has=id=>ids.includes(key(id));
  function image(node,id,name='',className='shop-item-image',state={}){
    if(!has(id))return null;
    const regions={north:'北部',central:'中部',south:'南部',east:'東部'};
    if(regions[key(id)])return node('span',{class:className+' shop-regional-art',role:'img','aria-label':name||'自以為'+regions[key(id)]+'最強'},
      node('img',{src:'./assets/shop/'+key(id)+'.webp',alt:'',width:768,height:768,loading:'lazy',decoding:'async'}),
      node('span',{class:'region-crown-text','aria-hidden':'true'},node('small',{},'自以為'),node('strong',{},regions[key(id)]+'最強')));
    const gear=window.MindAdventure?.gear(id);
    if(gear&&/^(coat|boots|badge)-/.test(id)&&window.MindCastOutfit?.itemPreview){const svg=window.MindCastOutfit.itemPreview(state,gear);if(svg){svg.setAttribute('class',className+' shop-equipment-actual');return svg;}}
    return node('img',{class:className,src:'./assets/shop/'+key(id)+'.webp',alt:name,width:768,height:768,loading:'lazy',decoding:'async'});
  }
  function card(ctx,id,name,label){
    return ctx.node('button',{type:'button',class:'shop-artwork','aria-label':'放大欣賞'+name+'卡面',onClick:()=>ctx.openModal(
      image(ctx.node,id,name+'原創卡面','shop-art-expanded',ctx.getState?.()),ctx.node('h2',{},name),ctx.node('p',{class:'note'},/^(coat|boots|badge)-/.test(id)?'此圖與服飾背包的角色試穿共用相同版型與顏色。':'學院原創插畫 · 點關閉返回商城')
    )},image(ctx.node,id,'','shop-item-image',ctx.getState?.()),label?ctx.node('span',{class:'shop-art-label'},label):null,ctx.node('span',{class:'shop-art-zoom','aria-hidden':'true'},'⊕ 放大欣賞'));
  }
  return Object.freeze({has,image,card});
})();
