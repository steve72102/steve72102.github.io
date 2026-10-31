/* Original academy shop illustrations. Prices and purchase state remain in the game modules. */
window.MindShopArt=(()=>{
  'use strict';
  const ids=['north','central','south','east','bully','counter','bomb','shirk','diligence','supply-one','supply-three','supply-ten','star-ticket','coat-dawn','coat-herb','coat-star','boots-dawn','boots-path','boots-star','badge-seed','badge-prism','badge-sage'];
  const aliases={'supply-1':'supply-one','supply-3':'supply-three','supply-10':'supply-ten','wish-1':'star-ticket','shirk-1':'shirk','diligence-1':'diligence'};
  const key=id=>aliases[id]||id;
  const has=id=>ids.includes(key(id));
  function image(node,id,name='',className='shop-item-image'){
    if(!has(id))return null;
    return node('img',{class:className,src:'./assets/shop/'+key(id)+'.webp',alt:name,width:768,height:768,loading:'lazy',decoding:'async'});
  }
  function card(ctx,id,name,label){
    return ctx.node('button',{type:'button',class:'shop-artwork','aria-label':'放大欣賞'+name+'卡面',onClick:()=>ctx.openModal(
      image(ctx.node,id,name+'原創卡面','shop-art-expanded'),ctx.node('h2',{},name),ctx.node('p',{class:'note'},'學院原創插畫 · 點關閉返回商城')
    )},image(ctx.node,id),label?ctx.node('span',{class:'shop-art-label'},label):null,ctx.node('span',{class:'shop-art-zoom','aria-hidden':'true'},'⊕ 放大欣賞'));
  }
  return Object.freeze({has,image,card});
})();
