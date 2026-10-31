(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindCastOutfit=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Shared level motifs, with a different construction silhouette for every original character.
  const CUTS={
    doctor:{shoulder:27,hem:204,flare:1,cape:163,face:[23,29],hair:'short',glasses:true},
    professor:{shoulder:29,hem:234,flare:20,cape:188,face:[23,30],hair:'long'},
    graduate:{shoulder:32,hem:179,flare:7,cape:158,face:[26,27],hair:'fringe'},
    researcher:{shoulder:34,hem:188,flare:2,cape:149,face:[27,28],hair:'bob',goggles:true},
    'cedar-dean':{shoulder:28,hem:236,flare:10,cape:172,face:[23,31],hair:'silver',glasses:true},
    'herbal-mentor':{shoulder:34,hem:218,flare:18,cape:169,face:[27,27],hair:'silver-bob',glasses:true},
    'lab-engineer':{shoulder:39,hem:184,flare:1,cape:143,face:[27,29],hair:'gray'},
    'balance-analyst':{shoulder:28,hem:226,flare:8,cape:180,face:[23,31],hair:'streak'},
    'dawn-intern':{shoulder:29,hem:166,flare:8,cape:137,face:[26,26],hair:'bob',clip:true},
    'river-fellow':{shoulder:27,hem:198,flare:13,cape:154,face:[23,29],hair:'spiky'}
  };
  const COLORS={
    brown:['#775641','#2f5047','#efe6d6','#6a5a54'],lilac:['#a79ab7','#c6b7d1','#eee7da','#736e77'],
    cobalt:['#355d95','#d9e5ee','#f2ebda','#4b5260'],sage:['#779180','#b5c6b2','#f2f0e5','#6b7272'],
    ink:['#293e59','#c8c3cf','#f2ebdf','#4c4b55'],dusk:['#435873','#d7c8ad','#f2eddf','#4c515c'],
    teal:['#2c938e','#e5b2a0','#f6eedc','#5e6866'],mint:['#69ae9c','#a2d7be','#ecf5dc','#4f695f'],
    leaf:['#6d9164','#b4cba0','#f0ead9','#586a55'],violet:['#8a70a0','#cbbbdc','#f3ebee','#66607b'],
    gold:['#b59a59','#e9daa5','#fff6df','#6f674b'],rose:['#ba8b99','#e2c0cb','#f6edeb','#75656d'],
    sky:['#6f9bb7','#c2dce8','#f3f3e8','#566b7d']
  };
  function model(state,Academy,Adventure,Engine){
    const character=Academy.character(state.appearance?.character),cut=CUTS[character.id],loadout=state.rpg?.loadout||{};
    const items={};for(const slot of Object.keys(Adventure.SLOTS))items[slot]=Adventure.gear(loadout[slot])||Engine.ITEMS.find(i=>i.id===loadout[slot])||null;
    return {character,cut,items,palette:slot=>COLORS[items[slot]?.color]||COLORS.brown};
  }
  function preview(state){
    const A=window.MindAcademy,R=window.MindAdventure,E=window.MindEngine,{character,cut,items,palette}=model(state,A,R,E);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),set=(e,a)=>{for(const [k,v] of Object.entries(a))e.setAttribute(k,String(v));return e;};
    set(svg,{viewBox:'0 0 180 330',class:'outfit-preview','data-character':character.id,role:'img','aria-label':character.name+'八欄裝備試穿圖：'+Object.entries(R.SLOTS).map(([slot,label])=>label+' '+(items[slot]?.name||'未穿戴')).join('；')});
    let equipmentSlot='';
    const add=(tag,attrs)=>svg.appendChild(set(document.createElementNS(ns,tag),equipmentSlot?{...attrs,'data-equipment-slot':equipmentSlot}:attrs));
    const path=(d,fill,stroke='#554f4b',width=1.7)=>add('path',{d,fill,stroke,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round'});
    const line=(d,color,width=1.7)=>path(d,'none',color,width);
    const circle=(cx,cy,r,fill)=>add('circle',{cx,cy,r,fill});
    const p=slot=>palette(slot),has=slot=>!!items[slot],style=slot=>items[slot]?.style;
    const sh=cut.shoulder,sl=90-sh,sr=90+sh,hem=cut.hem,fl=cut.flare;
    add('ellipse',{cx:90,cy:315,rx:50,ry:8,fill:'#34584522'});
    equipmentSlot='cape';
    if(has('cape')){
      const c=p('cape'),length=Math.min(235,cut.cape+(style('cape')==='requiem'?24:0));
      path(`M${sl} 80Q90 69 ${sr} 80L${sr+12} ${length}Q90 ${length+21} ${sl-12} ${length}Z`,c[1],c[3]);
      if(style('cape')==='haydn')for(let x=72;x<=108;x+=12)line(`M${x} 92Q${x+3} 130 ${x} ${length-8}`,c[2],1.3);
      if(style('cape')==='tide')line(`M${sl-10} ${length-6}Q90 ${length+12} ${sr+10} ${length-6}`,c[0],2);
    }
    equipmentSlot='';
    // Body proportions remain character-specific even when items are mixed across levels.
    path(`M${sl+4} 72Q90 63 ${sr-4} 72L${sr-4} 158Q90 172 ${sl+4} 158Z`,'#e7d9c6');
    const pant=has('pants')?p('pants')[3]:'#a5a49a',leg=cut.shoulder>34?5:0;
    path(`M${sl+5} 145L90 145 86 289 ${67-leg} 289 ${sl-1} 182Z`,pant);
    path(`M90 145L${sr-5} 145 ${sr+1} 182 ${113+leg} 289 94 289Z`,pant);
    if(has('pants')){const c=p('pants');line('M90 148L90 198',c[2]);if(style('pants')==='bach')line(`M${sl+2} 187Q${sl+8} 225 74 266M${sr-2} 187Q${sr-8} 225 107 266`,c[0]);if(style('pants')==='haydn')for(const x of [70,77,104,111])line(`M${x} 168L${x} 260`,c[0],1);if(style('pants')==='tide')line('M70 240Q80 246 88 240M96 240Q107 246 115 240',c[1],2);}
    equipmentSlot=has('shoes')?'shoes':'';
    const shoe=has('shoes')?p('shoes')[0]:'#7e796e';path('M65 280L87 280 88 305Q73 312 54 304L56 292Z',shoe);path('M93 280L115 280 125 292 126 304Q106 312 92 305Z',shoe);
    if(has('shoes'))line('M57 301L86 301M94 301L123 301',p('shoes')[2],2);
    equipmentSlot='';
    path(`M${sl+3} 73L${sl-13} 84 36 145 47 152 ${sl-1} 120 ${sl} 162 ${sr} 162 ${sr+1} 120 133 152 144 145 ${sr+13} 84 ${sr-3} 73 90 82Z`,has('shirt')?p('shirt')[2]:'#ece9df');
    if(has('shirt')){const c=p('shirt');line('M78 73L90 85 102 73M90 85L90 154',c[3],1.5);if(style('shirt')==='letter')for(const y of [105,116,127])line(`M82 ${y}H98`,c[1],1);}
    if(has('jacket')){
      const c=p('jacket'),j=style('jacket'),leftHem=sl-fl,rightHem=sr+fl;
      path(`M${sl} 72L${sl-15} 83 35 145 47 153 ${sl-3} 118 ${leftHem} ${hem}Q${sl+9} ${hem+4} 87 ${hem}L88 81Z`,c[0],c[3]);
      path(`M${sr} 72L${sr+15} 83 145 145 133 153 ${sr+3} 118 ${rightHem} ${hem}Q${sr-9} ${hem+4} 93 ${hem}L92 81Z`,c[0],c[3]);
      if(j==='bach')line(`M${sl+8} 83Q${sl-4} 128 ${leftHem+5} ${hem-8}M${sr-8} 83Q${sr+4} 128 ${rightHem-5} ${hem-8}`,c[2],2);
      else if(j==='schumann')line(`M${sl+8} 133Q90 142 ${sr-8} 133`,c[2],2);
      else if(j==='mozart')path(`M${sl+3} 78L88 84 83 156 ${sl-4} ${Math.min(hem,177)}Z`,c[1],c[3],1);
      else if(j==='haydn')for(const x of [sl+5,sl+11,sr-11,sr-5])line(`M${x} 88L${x} ${Math.min(hem-5,185)}`,c[2],1.3);
      else if(j==='requiem')line(`M${sl+6} 83L${leftHem+4} ${hem-10}M${sr-6} 83L${rightHem-4} ${hem-10}`,c[2],1.5);
      else if(j==='letter')line(`M${sl+4} 120Q90 153 ${sr-4} 120`,c[1],2);
      else if(j==='tide')for(const y of [97,113,129])line(`M${sl+4} ${y}Q${sl+11} ${y-8} ${sl+18} ${y}M${sr-18} ${y}Q${sr-11} ${y-8} ${sr-4} ${y}`,c[1],1.7);
    }
    const skin='#efc6a6',hair=cut.hair.includes('silver')?'#c1bdba':cut.hair==='gray'?'#66615d':'#2e2b30';
    if(['long','streak'].includes(cut.hair))path('M67 25Q57 65 60 125L72 119 74 29Z',hair,hair);
    path('M77 58L77 72Q90 80 103 72L103 58Z',skin,'#ab7d63',1);
    add('ellipse',{cx:90,cy:39,rx:cut.face[0],ry:cut.face[1],fill:skin,stroke:'#a47a62','stroke-width':1.3});
    path(`M${90-cut.face[0]} 32Q65 8 86 7 113 5 ${90+cut.face[0]} 30L108 23Q90 17 72 29Z`,hair,hair);
    if(['bob','silver-bob'].includes(cut.hair))path('M64 27Q58 60 72 70L76 60M116 27Q121 60 108 70L104 60',hair,hair,5);
    if(cut.hair==='spiky')path('M64 25L70 7 78 14 85 3 93 11 102 3 110 15 118 24Z',hair,hair);
    if(cut.hair==='streak')line('M75 13Q81 20 79 34','#d1d0ce',3);
    if(cut.clip)path('M68 25L78 22 79 27 69 30Z','#79cbb7','#377e73',1);
    line('M78 44Q82 46 87 44M94 44Q98 46 103 44','#684943',1.4);line('M84 56Q90 60 96 56','#a36d66',1.4);
    if(cut.glasses)path('M73 37Q79 34 87 38L87 46Q80 50 74 45ZM93 38Q101 34 107 37L106 45Q99 50 93 46ZM87 40H93','none','#35383c',1.5);
    if(cut.goggles)path('M71 20Q79 14 87 20L87 27Q79 31 72 27ZM93 20Q101 14 109 20L108 27Q101 31 93 27Z','none','#5b676d',2);
    if(has('hat')){const c=p('hat');path(style('hat')==='schumann'?'M63 24Q65 4 90 6 115 4 117 24Z':style('hat')==='tide'?'M64 25Q66 3 90 7 114 3 116 25Z':'M62 25Q65 3 90 6 115 3 118 25Z',c[0],c[3]);path('M57 25Q90 34 123 25L120 31Q90 39 60 31Z',c[1],c[3],1);}
    equipmentSlot='accessory';
    if(has('accessory')){const c=p('accessory');circle(sr-5,107,5,c[2]);line(`M${sr-8} 107Q${sr-5} 101 ${sr-2} 107`,c[0],1.2);}
    equipmentSlot='';
    if(has('handheld')){const c=p('handheld');path('M116 148L148 140 153 180 120 187Z',c[0],c[3],2);line('M123 157L145 151M124 164L146 158',c[2],1.4);path('M117 166Q125 160 130 167L127 177 117 179Z',skin,'#a67255',1);}
    return svg;
  }
  // The shop and bag extract the very same SVG parts used by the character's try-on view.
  function itemPreview(state,item){
    if(!['cape','shoes','accessory'].includes(item.slot))return null;
    const s={...state,rpg:{...state.rpg,loadout:{[item.slot]:item.id}}},full=preview(s),cut=CUTS[window.MindAcademy.character(state.appearance?.character).id];
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    const box=item.slot==='cape'?[90-cut.shoulder-28,54,2*(cut.shoulder+28),cut.cape-12]:item.slot==='shoes'?[42,267,96,53]:[90+cut.shoulder-17,95,24,24];
    svg.setAttribute('viewBox',box.join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',item.name+'：遊戲試穿版型');
    svg.setAttribute('data-gear-id',item.id);
    for(const part of full.querySelectorAll('[data-equipment-slot="'+item.slot+'"]'))svg.append(part.cloneNode(true));
    return svg;
  }
  return {CUTS,COLORS,model,preview,itemPreview};
});
