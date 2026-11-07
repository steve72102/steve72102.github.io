/* Original academy shop illustrations. Prices and purchase state remain in the game modules. */
window.MindShopArt=(()=>{
  'use strict';
  const ids=['north','central','south','east','bully','counter','bomb','shirk','diligence','supply-one','supply-three','supply-ten','star-ticket','coat-dawn','coat-herb','coat-star','boots-dawn','boots-path','boots-star','badge-seed','badge-prism','badge-sage'];
  const aliases={'supply-1':'supply-one','supply-3':'supply-three','supply-10':'supply-ten','wish-1':'star-ticket','shirk-1':'shirk','diligence-1':'diligence'};
  const key=id=>aliases[id]||id;
  const equipment=id=>window.MindAdventure?.gear(id)||(window.MindEngine?.ITEMS?.find(item=>item.id===id)?{...window.MindEngine.ITEMS.find(item=>item.id===id),slot:'handheld'}:null);
  const has=id=>ids.includes(key(id))||!!equipment(id);
  function image(node,id,name='',className='shop-item-image',state={}){
    if(!has(id))return null;
    const regions={north:'北部',central:'中部',south:'南部',east:'東部'};
    if(regions[key(id)])return node('span',{class:className+' shop-regional-art',role:'img','aria-label':name||'自以為'+regions[key(id)]+'最強'},
      node('img',{src:'./assets/shop/'+key(id)+'.webp',alt:'',width:768,height:768,loading:'lazy',decoding:'async'}),
      node('span',{class:'region-crown-text','aria-hidden':'true'},node('small',{},'自以為'),node('strong',{},regions[key(id)]+'最強')));
    const gear=equipment(id);
    if(gear){
      const academy=window.MindAcademy,look=academy?.restore(state?.appearance),hero=academy?.character(look?.character||'doctor');
      const style=(gear.style||'classic').replace(/[^a-z0-9-]/gi,'');
      // Use the same rendered cast artwork as the lobby. The coloured layer
      // is deliberately clipped below the face, preserving the approved 3D
      // character while making every level collection visibly distinct.
      return node('span',{class:className+' shop-equipment-actual portrait-equipped outfit-style-'+style,role:'img','aria-label':(name||gear.name)+' · '+hero.name+' 的立體裝備預覽'},
        node('img',{class:'portrait-equipped-art',src:'./assets/academy/'+hero.image,alt:'',loading:'lazy',decoding:'async'}),
        node('span',{class:'portrait-outfit-tint','data-outfit-style':style}),
        node('span',{class:'portrait-outfit-badge'},'Lv.'+(gear.level||10)));
    }
    return node('img',{class:className,src:'./assets/shop/'+key(id)+'.webp',alt:name,width:768,height:768,loading:'lazy',decoding:'async'});
  }
  function card(ctx,id,name,label){
    return ctx.node('button',{type:'button',class:'shop-artwork','aria-label':'放大欣賞'+name+'卡面',onClick:()=>ctx.openModal(
      image(ctx.node,id,name+'原創卡面','shop-art-expanded',ctx.getState?.()),ctx.node('h2',{},name),ctx.node('p',{class:'note'},window.MindAdventure?.gear(id)?'此圖與服飾背包、櫥窗和學院角色共用相同穿戴圖層。':'學院原創插畫 · 點關閉返回商城')
    )},image(ctx.node,id,'','shop-item-image',ctx.getState?.()),label?ctx.node('span',{class:'shop-art-label'},label):null,ctx.node('span',{class:'shop-art-zoom','aria-hidden':'true'},'⊕ 放大欣賞'));
  }
  return Object.freeze({has,image,card});
})();

