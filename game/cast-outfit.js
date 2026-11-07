(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindCastOutfit=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Shared, body-fitted shapes: the shop, try-on and scene use this same renderer.
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
    sky:['#6f9bb7','#c2dce8','#f3f3e8','#566b7d'],
    citrus:['#f29c38','#167f91','#fff3cf','#235266','#ef6c56','#98cb69'],
    berry:['#ac4269','#537fad','#fff0da','#4b405c','#ec9ca8','#a3bb80'],
    pomelo:['#91b958','#4d9790','#fff5cd','#416b67','#e9b869','#e7e7a1'],
    pineapple:['#e9b43e','#177873','#fff1ce','#355e62','#e87d42','#9eb457'],
    cherry:['#d74465','#4052a0','#fff4e3','#333f69','#faab7b','#88c9b0'],
    grape:['#7751ad','#3c8caa','#f3e9f6','#3c385d','#df87b9','#81cbbd']
  };
  const SHAPES={
    bach:{hem:187,cape:118,flare:4,collar:'field'},schumann:{hem:160,cape:111,flare:5,collar:'round'},
    mozart:{hem:166,cape:107,flare:2,collar:'angle'},haydn:{hem:169,cape:114,flare:7,collar:'round'},
    requiem:{hem:221,cape:156,flare:9,collar:'stand'},letter:{hem:163,cape:116,flare:6,collar:'field'},tide:{hem:166,cape:112,flare:9,collar:'open'},
    citrus:{hem:150,cape:111,flare:5,collar:'sailor'},berry:{hem:160,cape:124,flare:9,collar:'yoke'},
    pomelo:{hem:213,cape:147,flare:12,collar:'wrap'},pineapple:{hem:166,cape:110,flare:3,collar:'work'},
    cherry:{hem:142,cape:106,flare:2,collar:'bomber'},grape:{hem:184,cape:139,flare:8,collar:'angle'}
  };
  const FRUIT=new Set(['citrus','berry','pomelo','pineapple','cherry','grape']);
  function model(state,Academy,Adventure,Engine){
    const character=Academy.character(state.appearance?.character),cut=CUTS[character.id]||CUTS.doctor,loadout=state.rpg?.loadout||{};
    const items={};for(const slot of Object.keys(Adventure.SLOTS))items[slot]=Adventure.gear(loadout[slot])||Engine.ITEMS.find(i=>i.id===loadout[slot])||null;
    return {character,cut,items,palette:slot=>COLORS[items[slot]?.color]||COLORS.brown};
  }
  function tint(color,amount){
    const n=parseInt(color.slice(1),16),f=v=>Math.round(amount>=0?v+(255-v)*amount:v*(1+amount));
    return '#'+[n>>16&255,n>>8&255,n&255].map(v=>f(v).toString(16).padStart(2,'0')).join('');
  }
  const GRADUATE_REFERENCE='graduate-reference-v1';
  const GRADUATE_UI_DIRECTIONS=Object.freeze(['down','left','up']);
  // UI-only vector fallback for the accepted graduate reference. Coordinates
  // are fitted by anatomical region; no bitmap or other character is stretched.
  const graduateY={
    head:[[7,32.625],[66,76.2623239437]],
    neck:[[59,71.0858614101],[73,89.0968309859],[82,97.9167659817]],
    frontNeck:[[59,71.0858614101],[73,88],[82,86.7711267606]],
    torso:[[73,89.0968309859],[164,146.4242957746],[187,158.6883802817],[236,204.3221830986],[311,275.625]],
    arm:[[73,89.0968309859],[116,123.6073943662],[145,154.9806338028],[156,167.2447183099],[164,178.9383802817]],
    pants:[[144,146.4242957746],[187,158.6883802817],[236,204.3221830986],[287,253.3],[311,275.625]],
    shoes:[[279,251.25],[307.2666666667,275.625]]
  };
  function fitted(value,points){
    let i=1;while(i<points.length-1&&value>points[i][0])i++;
    const [a,b]=[points[i-1],points[i]];return a[1]+(value-a[0])*(b[1]-a[1])/(b[0]-a[0]);
  }
  function graduatePoint(x,y,region,frontNeck=false,view='down'){
    if(region==='up-torso')region='torso';
    const dx=x-90;
    if(region==='head')return [90+dx*(47.0598591549/52),fitted(y,graduateY.head)];
    if(region==='neck')return [90+dx*.5,fitted(y,frontNeck?graduateY.frontNeck:graduateY.neck)];
    if(region==='shadow')return [90+dx*.94,280.125+(y-316)*.8];
    const wristScale=(dx<0?29.0915492958:30.2323943662)/49;
    if(region==='handheld'||region==='grip')return [(view==='left'?60.9084507042:120.2323943662)+(x-139)*.75,167.2447183099+(y-165)*.75];
    if(region==='hand')return [90+dx*wristScale,fitted(y,graduateY.arm)];
    if(region==='shoes')return [(dx<0?70.6056338028:109.3943661972)+(x-(dx<0?67:113))*(32.7992957746/38),fitted(y,graduateY.shoes)];
    if(region==='pants')return [90+dx*fitted(y,[[144,41.0704225352/54],[187,47.6302816901/68],[236,1.1],[287,1.2]]),fitted(y,graduateY.pants)];
    const bodyX=90+dx*fitted(y,[[73,59.8943661972/64],[164,41.0704225352/62],[187,47.6302816901/68],[236,1],[311,1]]);let bodyY=fitted(y,graduateY.torso);
    if(region==='accessory'&&view==='left')return [66+(x-115)*.8,fitted(112,graduateY.torso)+(y-112)*.8];
    if(region==='cape'||region==='accessory')return [bodyX,bodyY];
    if(frontNeck&&region==='torso'&&y>=73&&y<=82){
      const centre=Math.max(0,1-Math.abs(dx)/20),collarY=87.3855633803+(y-80)*.35;
      bodyY+=(collarY-bodyY)*centre;
    }
    const arm=y<=155?Math.max(0,Math.min(1,(Math.abs(dx)-40)/4)):0;
    const armX=90+dx*fitted(y,[[73,59.8943661972/64],[145,wristScale]]),armY=fitted(y,graduateY.arm);
    return [bodyX+(armX-bodyX)*arm,bodyY+(armY-bodyY)*arm];
  }
  function graduatePath(data,region,frontNeck=false,view='down'){
    const tokens=data.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/g)||[],out=[];
    const sizes={M:2,L:2,H:1,V:1,Q:4,C:6,S:4,T:2};let i=0,command='',x=0,y=0,start=[0,0];
    const number=n=>String(Math.round(n*10000)/10000);
    while(i<tokens.length){
      if(/^[a-zA-Z]$/.test(tokens[i]))command=tokens[i++];
      const kind=command.toUpperCase(),relative=command!==kind;
      if(kind==='Z'){out.push('Z');[x,y]=start;command='';continue;}
      const count=sizes[kind];if(!count||i+count>tokens.length)throw Error('Unsupported graduate preview path');
      const values=tokens.slice(i,i+count).map(Number);i+=count;
      if(values.some(n=>!Number.isFinite(n)))throw Error('Invalid graduate preview point');
      if(kind==='H'||kind==='V'){
        if(kind==='H')x=values[0]+(relative?x:0);else y=values[0]+(relative?y:0);
        out.push('L'+graduatePoint(x,y,region,frontNeck,view).map(number).join(' '));continue;
      }
      const points=[];for(let k=0;k<count;k+=2)points.push([values[k]+(relative?x:0),values[k+1]+(relative?y:0)]);
      out.push(kind+points.flatMap(point=>graduatePoint(...point,region,frontNeck,view).map(number)).join(' '));
      [x,y]=points[points.length-1];if(kind==='M'){start=[x,y];command=relative?'l':'L';}
    }
    return out.join(' ');
  }
  function graduateAttributes(tag,attrs,region,frontNeck=false,view='down'){
    const a={...attrs};
    if(region==='profile-direct'||region==='folded-up-arm')return a;
    if(tag==='path')a.d=graduatePath(a.d,region,frontNeck,view);
    else if(tag==='ellipse'){
      const [cx,cy]=graduatePoint(a.cx,a.cy,region,frontNeck,view),left=graduatePoint(a.cx-a.rx,a.cy,region,frontNeck,view),right=graduatePoint(a.cx+a.rx,a.cy,region,frontNeck,view),top=graduatePoint(a.cx,a.cy-a.ry,region,frontNeck,view),bottom=graduatePoint(a.cx,a.cy+a.ry,region,frontNeck,view);
      const handLeft=a.cx<90;a.cx=cx;a.cy=cy;a.rx=region==='hand'?a.rx*(handLeft?.9804137324:1.0918243838):Math.abs(right[0]-left[0])/2;a.ry=region==='hand'?a.ry*(11.6936619718/8):Math.abs(bottom[1]-top[1])/2;
    }
    return a;
  }
  function preview(state,options={}){
    if(options.original!==false){
      const character=window.MindAcademy.character(state.appearance?.character);
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
      svg.setAttribute('viewBox','0 0 180 330');svg.setAttribute('role','img');svg.setAttribute('aria-label',character.name);
      image.setAttribute('href','./assets/academy/'+character.image);image.setAttribute('width','180');image.setAttribute('height','330');image.setAttribute('preserveAspectRatio','xMidYMax meet');svg.append(image);return svg;
    }
    const A=window.MindAcademy,R=window.MindAdventure,E=window.MindEngine,{character,cut,items,palette}=model(state,A,R,E);
    const direction=['up','right','left'].includes(options.direction)?options.direction:'down',back=direction==='up',side=direction==='right'||direction==='left';
    // Existing world callers explicitly disable raster and do not opt into a
    // bodyProfile. An explicit profile survives the UI's asset-failure fallback.
    // The accepted front and fitted left/back UI views share one body policy.
    // RIGHT and default world callers retain the sealed resolver order.
    const bodyProfile=character.id==='graduate'&&GRADUATE_UI_DIRECTIONS.includes(direction)&&(options.bodyProfile===GRADUATE_REFERENCE||(options.bodyProfile!==false&&options.raster!==false))?GRADUATE_REFERENCE:null;
    const loadout=Object.fromEntries(Object.keys(R.SLOTS).map(s=>[s,state.rpg?.loadout?.[s]||null]));
    const actualLabel=character.name+'八欄實際穿戴圖：'+Object.entries(R.SLOTS).map(([s,label])=>label+' '+(items[s]?.name||'未穿戴')).join('；');
    if(bodyProfile){
      const layered=options.raster!==false&&window.MindLayeredAvatar?.preview(state,{...options,direction,bodyProfile,label:options.label||actualLabel,fallback:()=>preview(state,{...options,bodyProfile,painted:false,native:false,raster:false})});
      if(layered){
        if(layered.dataset?.renderMethod==='vector-fallback')return layered;
        layered.setAttribute('data-body-profile',bodyProfile);layered.setAttribute('data-render-method','authored-parts-skeletal');layered.setAttribute('data-art-method','authored-parts-skeletal-preview');layered.setAttribute('data-loadout',JSON.stringify(loadout));
        return layered;
      }
    }
    const painted=!bodyProfile&&options.painted!==false&&window.MindPaintedAvatar?.preview(state,{...options,direction,label:character.name+'八欄實際穿戴圖：'+Object.entries(R.SLOTS).map(([s,label])=>label+' '+(items[s]?.name||'未穿戴')).join('；'),fallback:(requested={})=>preview(state,{...options,...requested,painted:false})});
    if(painted)return painted;
    const native=!bodyProfile&&options.native!==false&&window.MindNativeAvatar?.preview(state,{direction,label:character.name+'八欄實際穿戴圖：'+Object.entries(R.SLOTS).map(([s,label])=>label+' '+(items[s]?.name||'未穿戴')).join('；'),fallback:()=>preview(state,{...options,painted:false,native:false})});
    if(native)return native;
    const layered=!bodyProfile&&options.raster!==false&&window.MindLayeredAvatar?.preview(state,{...options,direction,fallback:()=>preview(state,{...options,painted:false,native:false,raster:false})});
    if(layered)return layered;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),set=(e,a)=>{for(const [k,v] of Object.entries(a))e.setAttribute(k,String(v));return e;};
    set(svg,{xmlns:ns,viewBox:'0 0 180 330',class:'outfit-preview','data-character':character.id,'data-view':direction,role:'img','aria-label':character.name+'八欄實際穿戴圖：'+Object.entries(R.SLOTS).map(([s,label])=>label+' '+(items[s]?.name||'未穿戴')).join('；')});
    if(bodyProfile)set(svg,{viewBox:'0 0 180 306',width:180,height:306,preserveAspectRatio:'xMidYMax meet','data-body-profile':bodyProfile,'data-render-method':'vector-fallback','data-art-method':'vector-fallback-preview','data-fallback-loadout':'actual-loadout','data-loadout':JSON.stringify(loadout),'data-foot-anchor':'90 275.625','data-occluded-slots':back?['accessory','handheld'].filter(s=>items[s]).join(' '):'','data-occluded-body-parts':back?'hands':''});
    if(bodyProfile&&direction==='left')svg.setAttribute('data-side-method','independent-left-vector');
    if(bodyProfile&&back)svg.setAttribute('data-arm-occlusion','folded-front-behind-torso');
    let slot='',project=side,anatomy='torso';
    function add(tag,attrs){
      const region=slot==='hat'?'head':slot==='cape'?'cape':slot==='accessory'?'accessory':slot==='handheld'?'handheld':anatomy,a=bodyProfile?graduateAttributes(tag,attrs,region,true,direction):{...attrs};
      if(slot){a['data-equipment-slot']=slot;a['data-gear-id']=items[slot]?.id||'';}
      if(bodyProfile&&back&&anatomy==='folded-up-arm')a['data-profile-part']='folded-sleeve';
      if(bodyProfile&&back&&anatomy==='up-torso')a['data-profile-part']='occluding-torso';
      if(project)a.transform=(bodyProfile&&direction==='left'?(slot==='hat'?'translate(13.5 0) scale(.85 1)':'translate(36 0) scale(.6 1)'):(direction==='left'?'translate(144 0) scale(-.6 1)':'translate(36 0) scale(.6 1)'))+(a.transform?' '+a.transform:'');
      return svg.appendChild(set(document.createElementNS(ns,tag),a));
    }
    const path=(d,fill,stroke='#514d53',width=1.1)=>add('path',{d,fill,stroke,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round'});
    const line=(d,c,w=1.1)=>path(d,'none',c,w);
    const ellipse=(cx,cy,rx,ry,fill,stroke='none',width=1)=>add('ellipse',{cx,cy,rx,ry,fill,stroke,'stroke-width':width});
    const circle=(cx,cy,r,fill,stroke='none',width=1)=>ellipse(cx,cy,r,r,fill,stroke,width);
    const p=s=>palette(s),has=s=>!!items[s],style=s=>items[s]?.style,shape=s=>SHAPES[style(s)]||{hem:cut.hem,cape:Math.min(170,cut.cape),flare:cut.flare,collar:'field'};
    const sh=cut.shoulder,sl=90-sh,sr=90+sh,bodyShift=(cut.hem-198)*.14;
    const skin=['cedar-dean','lab-engineer'].includes(character.id)?'#ddb08e':character.id==='herbal-mentor'?'#e5b79b':'#efc6a6',skinEdge='#a87965';
    const hair=cut.hair.includes('silver')?'#c1bdba':cut.hair==='gray'?'#66615d':'#302e38';
    function garment(d,color){path(d,color,tint(color,-.37),1.1);}
    function foldedUpSleeves(color,cuffColor=null){
      // Both forearms turn toward the chest. The following torso is painted
      // over their wrists, so hidden hands never leave an empty rear cuff.
      const previous=anatomy;anatomy='folded-up-arm';
      garment('M64 89.0968L54 94Q47 109 46 123Q47 130 68 136L81 127Q66 125 62 119L68 100Z',color);
      garment('M116 89.0968L126 94Q133 110 134 124Q133 131 112 136L99 127Q114 125 118 120L112 100Z',color);
      line('M50 125Q57 131 67 133',tint(color,.15),1.5);line('M130 126Q123 131 113 133',tint(color,.15),1.5);
      if(cuffColor){garment('M69 127L80 126 82 133 70 136Z',cuffColor);garment('M111 127L100 126 98 133 110 136Z',cuffColor);}
      anatomy=previous;
    }
    function motif(kind,x,y,r,c){
      const a=c[4]||c[0],green=c[5]||c[1];
      if(kind==='citrus'||kind==='pomelo'){
        circle(x,y,r,c[2],a,.9);circle(x,y,r*.76,kind==='pomelo'?c[0]:a);
        for(let k=0;k<6;k++){const t=k*Math.PI/3;line('M'+x+' '+y+'L'+(x+Math.cos(t)*r*.65)+' '+(y+Math.sin(t)*r*.65),c[2],.65);}
        path('M'+x+' '+(y-r)+'Q'+(x+r*.7)+' '+(y-r*1.8)+' '+(x+r)+' '+(y-r*.8)+'Q'+(x+r*.4)+' '+(y-r*.7)+' '+x+' '+(y-r)+'Z',green,'none');
      }else if(kind==='berry'){
        path('M'+(x-r)+' '+(y-r*.4)+'Q'+x+' '+(y-r*1.1)+' '+(x+r)+' '+(y-r*.4)+'Q'+(x+r*.65)+' '+(y+r*.5)+' '+x+' '+(y+r)+'Q'+(x-r*.65)+' '+(y+r*.5)+' '+(x-r)+' '+(y-r*.4)+'Z',c[0],c[3],.6);
        path('M'+(x-r*.8)+' '+(y-r*.6)+'L'+(x-r*.2)+' '+(y-r*.4)+' '+x+' '+(y-r)+' '+(x+r*.25)+' '+(y-r*.4)+' '+(x+r*.8)+' '+(y-r*.6),green,green,.6);
        for(const [dx,dy] of [[-.45,0],[.4,.1],[0,.55]])ellipse(x+dx*r,y+dy*r,.45,.8,c[2]);
      }else if(kind==='pineapple'){
        ellipse(x,y,r*.75,r,c[0],c[3],.65);
        for(const z of [-.35,.3]){line('M'+(x-r*.55)+' '+(y+z*r-r*.3)+'L'+(x+r*.55)+' '+(y+z*r+r*.3),c[4],.65);line('M'+(x-r*.55)+' '+(y+z*r+r*.3)+'L'+(x+r*.55)+' '+(y+z*r-r*.3),c[4],.65);}
        path('M'+(x-r*.4)+' '+(y-r*.8)+'L'+(x-r*.8)+' '+(y-r*1.6)+' '+(x-r*.1)+' '+(y-r*1.2)+' '+x+' '+(y-r*1.9)+' '+(x+r*.2)+' '+(y-r*1.2)+' '+(x+r*.8)+' '+(y-r*1.6)+' '+(x+r*.4)+' '+(y-r*.8)+'Z',green,'none');
      }else if(kind==='cherry'){
        line('M'+(x-r*.5)+' '+(y+r*.2)+'Q'+(x-r*.3)+' '+(y-r*.8)+' '+(x+r*.3)+' '+(y-r)+'L'+(x+r*.6)+' '+(y+r*.1),green,.9);
        circle(x-r*.5,y+r*.3,r*.56,c[0],c[3],.5);circle(x+r*.6,y+r*.4,r*.56,c[0],c[3],.5);
        circle(x-r*.64,y+r*.13,r*.13,c[2]);circle(x+r*.46,y+r*.23,r*.13,c[2]);
        path('M'+(x+r*.2)+' '+(y-r)+'Q'+(x+r)+' '+(y-r*1.5)+' '+(x+r*1.3)+' '+(y-r*.7)+'Z',green,'none');
      }else if(kind==='grape'){
        for(const [dx,dy] of [[-.5,-.35],[.5,-.35],[-.7,.35],[.25,.3],[-.1,1]])circle(x+dx*r,y+dy*r,r*.51,c[0],c[2],.55);
        path('M'+x+' '+(y-r*.8)+'Q'+(x+r*.5)+' '+(y-r*1.7)+' '+(x+r*1.2)+' '+(y-r*.9)+'L'+x+' '+(y-r*.8)+'Z',green,'none');
      }
    }
    function seams(kind,c,x1,x2,y1,y2){
      const mid=(x1+x2)/2;
      if(kind==='bach')line('M'+(x1+5)+' '+y1+'Q'+(x2-4)+' '+((y1+y2)/2)+' '+(x1+4)+' '+y2,c[2],1.35);
      else if(kind==='haydn')for(let k=0;k<4;k++)line('M'+(x1+3+k*3)+' '+y1+'L'+(x1+3+k*3)+' '+y2,c[2],.8);
      else if(kind==='tide'){
        for(let y=y1+5;y<y2-5;y+=16){path('M'+x1+' '+y+'Q'+mid+' '+(y-9)+' '+x2+' '+y+'Q'+mid+' '+(y+8)+' '+x1+' '+y+'Z',c[1],'none');line('M'+x1+' '+y+'Q'+mid+' '+(y-1)+' '+x2+' '+y,c[2],.75);}
      }else if(kind==='citrus'){
        for(let y=y1+7,n=0;y<y2;y+=12,n++)path('M'+x1+' '+y+'L'+(x1+5)+' '+(y-5)+' '+x2+' '+(y-2)+' '+(x2-5)+' '+(y+3)+'Z',n%2?c[4]:c[1],'none');
      }else if(kind==='berry'){
        line('M'+x1+' '+(y1+6)+'L'+mid+' '+(y1+12)+' '+x2+' '+(y1+6),c[2],1.4);
        line('M'+x1+' '+(y1+10)+'L'+mid+' '+(y1+16)+' '+x2+' '+(y1+10),c[4],.8);
        for(const x of [x1+3,x2-3])line('M'+x+' '+(y1+20)+'V'+y2,c[2],.65);
      }else if(kind==='pomelo'){
        line('M'+x1+' '+y1+'Q'+x2+' '+((y1+y2)/2)+' '+mid+' '+y2,c[1],1.1);
        line('M'+(x1+4)+' '+y1+'Q'+(x2+2)+' '+((y1+y2)/2)+' '+(mid+5)+' '+y2,c[2],.8);
      }else if(kind==='pineapple'){
        path('M'+x1+' '+y1+'Q'+x2+' '+y1+' '+x2+' '+(y1+16)+'L'+x2+' '+(y1+23)+'Q'+mid+' '+(y1+10)+' '+x1+' '+(y1+11)+'Z',c[1],'none');
        line('M'+x1+' '+(y1+18)+'Q'+mid+' '+(y1+15)+' '+x2+' '+(y1+29),c[4],2.8);
      }else if(kind==='cherry'){
        line('M'+x1+' '+y1+'L'+x2+' '+(y1+13)+' '+x1+' '+(y1+26),c[2],2.3);line('M'+x1+' '+(y1+5)+'L'+x2+' '+(y1+18),c[4],1.5);
      }else if(kind==='grape'){
        path('M'+x1+' '+y1+'L'+x2+' '+(y1+8)+' '+mid+' '+(y1+18)+' '+x1+' '+(y1+11)+'Z',c[1],'none');
        line('M'+x1+' '+(y1+24)+'L'+mid+' '+(y1+29)+' '+x2+' '+(y1+23),c[4],1.7);line('M'+x1+' '+(y2-5)+'L'+mid+' '+(y2-9)+' '+x2+' '+(y2-5),c[5],1.1);
      }else if(kind==='requiem'){
        for(let y=y1+3;y<y2;y+=9)path('M'+mid+' '+y+'L'+(mid+2)+' '+(y+3)+' '+mid+' '+(y+6)+' '+(mid-2)+' '+(y+3)+'Z','none',c[2],.65);
      }else if(kind==='letter')line('M'+x1+' '+y1+'Q'+x2+' '+((y1+y2)/2)+' '+x1+' '+y2,c[1],1.3);
    }
    function cape(rear){
      if(!has('cape'))return;slot='cape';
      const c=p('cape'),j=style('cape'),s=shape('cape'),len=s.cape+(cut.cape-160)*.15;
      if(rear){
        const d=j==='grape'?'M'+(sl-4)+' 78Q90 67 '+(sr+4)+' 78L'+(sr+14)+' '+len+' '+(sr-5)+' '+(len-7)+' 90 '+(len+17)+' '+(sl-14)+' '+len+'Z':j==='pomelo'||j==='requiem'?'M'+(sl-2)+' 77Q90 66 '+(sr+3)+' 77L'+(sr+8)+' '+(len-8)+'Q90 '+(len+19)+' '+(sl-14)+' '+(len+20)+'Z':'M'+(sl-2)+' 77Q90 67 '+(sr+2)+' 77L'+(sr+15)+' '+len+'Q90 '+(len+18)+' '+(sl-15)+' '+len+'Z';
        garment(d,c[1]);line('M'+(sl+3)+' 82Q90 76 '+(sr-3)+' 82',c[2],1.1);line('M'+(sl-9)+' '+(len-1)+'Q90 '+(len+15)+' '+(sr+9)+' '+(len-1),c[0],2.1);
        if(back)seams(j,c,78,102,89,len-5);
      }else{
        const end=j==='pomelo'||j==='requiem'?137:110;
        garment('M'+sl+' 75L76 70Q90 82 104 70L'+sr+' 75 '+(sr+9)+' '+end+'Q108 '+(end+5)+' 91 91Q72 '+(end+6)+' '+(sl-9)+' '+end+'Z',c[1]);
        line('M78 75L90 90 102 75',c[2],2.4);
        if(j==='tide'){line('M'+(sl-6)+' 104Q72 110 85 93M95 93Q110 110 '+(sr+6)+' 104',c[0],3);line('M'+(sl-7)+' 108Q72 114 85 97M95 97Q110 114 '+(sr+7)+' 108',c[1],1);}
        if(j==='letter'||j==='mozart'||j==='grape')path('M'+(sl+1)+' 83L86 93 '+(sl-7)+' 107Z',c[2],c[0],.7);
        if(FRUIT.has(j))motif(j,sr-1,91,4.1,c);
        else if(j==='haydn')for(let x=sl-1;x<sl+10;x+=3)line('M'+x+' 85L'+(x-3)+' 103',c[2],.8);
      }
      slot='';
    }
    project=false;anatomy='shadow';ellipse(90,316,side?31:45,6,'#3553451f');anatomy='torso';project=side;if(!back)cape(true);
    anatomy='pants';
    slot=has('pants')?'pants':'';
    const pc=has('pants')?p('pants'):['#8d8c88','#b4b0a3','#e9e3d4','#777a78'],pk=style('pants');
    const wide=['pomelo','cherry','grape','requiem'].includes(pk),leg=cut.shoulder>34?4:0,edge=wide?5:0;
    garment('M'+(sl+5)+' 144Q90 139 '+(sr-5)+' 144L'+(sr+2)+' 187 '+(116+leg+edge)+' 287Q106 292 95 287L90 196 85 287Q74 292 '+(64-leg-edge)+' 287L'+(sl-2)+' 187Z',pc[3]);
    line('M90 151L90 196M'+(sl+6)+' 155Q90 160 '+(sr-6)+' 155',tint(pc[3],-.25),1);line('M'+(sl+8)+' 164Q70 195 '+(71-leg)+' 274M'+(sr-8)+' 164Q110 195 '+(109+leg)+' 274',tint(pc[3],.17),2.1);
    if(has('pants')){
      if(FRUIT.has(pk)){line('M'+(sl+4)+' 168L'+(64-leg-edge)+' 280',pc[1],3.2);line('M'+(sr-4)+' 168L'+(116+leg+edge)+' 280',pc[0],3.2);}
      if(['bach','haydn','pineapple'].includes(pk))for(const x of [sl+4,sr-17]){garment('M'+x+' 187H'+(x+14)+'V211Q'+(x+7)+' 214 '+x+' 211Z',tint(pc[3],.17));line('M'+x+' 192H'+(x+14),pc[1],1.4);}
      if(pk==='cherry'){path('M'+(64-leg)+' 256L'+(59-leg)+' 286 84 287 84 256Z',pc[1],'none');path('M96 256L96 287 '+(121+leg)+' 286 '+(116+leg)+' 256Z',pc[1],'none');}
      if(pk==='grape')for(const x of [65-leg,109+leg])line('M'+x+' 249L'+(x+6)+' 255 '+x+' 263',pc[4],1.8);
      if(!FRUIT.has(pk))seams(pk,pc,sl+7,sl+15,171,260);
      line('M'+(64-leg-edge)+' 283Q75 287 85 283M95 283Q106 287 '+(116+leg+edge)+' 283',pc[2],1);
    }
    anatomy='shoes';slot=has('shoes')?'shoes':'';
    const sc=has('shoes')?p('shoes'):['#7b7771','#ada59a','#e9e0d0','#595953'],sk=style('shoes');
    for(const sign of [-1,1]){
      const x=90+sign*(15+leg),d=sign<0?'M'+(x-10)+' 279L'+(x+10)+' 279 '+(x+11)+' 303Q'+x+' 311 '+(x-27)+' 304L'+(x-25)+' 294Z':'M'+(x-10)+' 279L'+(x+10)+' 279 '+(x+25)+' 294 '+(x+27)+' 304Q'+x+' 311 '+(x-11)+' 303Z';
      garment(d,sc[0]);line('M'+(x-12)+' 300Q'+x+' 304 '+(x+13)+' 300',sc[2],3.1);path('M'+(x-7)+' 282H'+(x+7)+'L'+(x+10)+' 293H'+(x-10)+'Z',sc[1],sc[3],.7);
      if(!back)for(let y=285;y<=291;y+=3)line('M'+(x-6)+' '+y+'H'+(x+6),sc[2],.8);if(FRUIT.has(sk))circle(x+sign*12,295,2.1,sc[4]);
    }
    anatomy='torso';slot=has('shirt')?'shirt':'';
    const tc=has('shirt')?p('shirt'):['#abb3a7','#a4bca8','#f3eddf','#6d7e74'],tk=style('shirt');
    if(bodyProfile&&back){
      foldedUpSleeves(tc[2]);anatomy='up-torso';
      garment('M'+(sl+3)+' 73L'+(sl+1)+' 164Q90 171 '+(sr-1)+' 164L'+(sr-3)+' 73Q90 68 '+(sl+3)+' 73Z',tc[2]);anatomy='torso';
    }else{
      garment('M'+(sl+3)+' 73L'+(sl-11)+' 83 36 145 47 153 '+(sl-2)+' 116 '+(sl+1)+' 164Q90 171 '+(sr-1)+' 164L'+(sr+2)+' 116 133 153 144 145 '+(sr+11)+' 83 '+(sr-3)+' 73 90 80Z',tc[2]);
      line('M'+(sl-7)+' 91L43 142M'+(sr+7)+' 91L137 142',tint(tc[2],-.11),2.6);
    }
    if(has('shirt')&&!back){
      if(['mozart','requiem','grape','pomelo'].includes(tk))garment('M78 69Q90 74 102 69L104 82Q90 87 76 82Z',tint(tc[2],-.035));else line('M77 74Q90 90 103 74',tc[3],1.1);
      if(tk==='letter'||tk==='citrus')for(let y=100;y<150;y+=9)line('M'+(sl+6)+' '+y+'H'+(sr-6),tc[1],1.4);
      else if(FRUIT.has(tk)){path('M79 91L90 100 101 91 101 98 90 107 79 98Z',tc[1],'none');motif(tk,90,124,5,tc);}
      else{line('M90 86V158',tint(tc[2],-.16),.9);for(const y of [97,113,129,145])circle(91,y,1.1,tc[3]);}
    }
    if(has('jacket')){
      slot='jacket';const c=p('jacket'),j=style('jacket'),s=shape('jacket'),hem=s.hem+bodyShift,fl=s.flare+cut.flare*.2,lh=sl-fl,rh=sr+fl;
      const left='M'+sl+' 73L'+(sl-12)+' 82Q'+(sl-16)+' 113 35 145L47 154 '+(sl-2)+' 116 '+lh+' '+(hem-2)+'Q'+(sl+9)+' '+(hem+5)+' 86 '+hem+'L87 82Z';
      const right='M'+sr+' 73L'+(sr+12)+' 82Q'+(sr+16)+' 113 145 145L133 154 '+(sr+2)+' 116 '+rh+' '+(hem-2)+'Q'+(sr-9)+' '+(hem+5)+' 94 '+hem+'L93 82Z';
      if(bodyProfile&&back){
        foldedUpSleeves(c[0],c[1]);anatomy='up-torso';
        garment('M'+sl+' 73L'+lh+' '+(hem-2)+'Q90 '+(hem+6)+' '+rh+' '+(hem-2)+'L'+sr+' 73Q90 65 '+sl+' 73Z',c[0]);anatomy='torso';
      }else if(back)garment('M'+sl+' 73L'+(sl-12)+' 82Q'+(sl-16)+' 113 35 145L47 154 '+(sl-2)+' 116 '+lh+' '+(hem-2)+'Q90 '+(hem+6)+' '+rh+' '+(hem-2)+'L'+(sr+2)+' 116 133 154 145 145Q'+(sr+16)+' 113 '+(sr+12)+' 82L'+sr+' 73Q90 65 '+sl+' 73Z',c[0]);
      else{garment(left,c[0]);garment(right,c[0]);}
      if(!(bodyProfile&&back)){
        line('M'+(sl-5)+' 88Q'+(sl-8)+' 118 40 145M'+(sr+5)+' 88Q'+(sr+8)+' 118 140 145',tint(c[0],.19),2.2);
        garment('M35 143L48 148 46 155 34 150Z',c[1]);garment('M132 148L145 143 146 150 134 155Z',c[1]);
      }
      if(back){seams(j,c,sl+9,sr-9,94,hem-8);line('M90 86V'+(hem-5),tint(c[0],-.15),.7);if(FRUIT.has(j))motif(j,90,126,8,c);}
      else{
        if(['wrap','stand'].includes(s.collar)){path('M79 72L88 81 83 '+(hem-8)+' 78 '+(hem-8)+' 83 84 '+(sl+7)+' 77Z',c[1],c[2],.6);line('M97 82L100 '+(hem-7),c[2],1.1);}
        else if(s.collar==='bomber'){path('M77 73L88 81 85 97 77 84Z',c[1],c[3],.8);path('M103 73L92 81 95 97 103 84Z',c[1],c[3],.8);}
        else{path('M77 73L88 82 81 102 '+(sl+10)+' 85Z',c[1],c[3],.8);path('M103 73L92 82 99 102 '+(sr-10)+' 85Z',c[1],c[3],.8);}
        for(const x of [sl+9,sr-9])seams(j,c,x-5,x+6,102,hem-9);
        if(['bach','letter','pineapple','haydn','berry'].includes(j))for(const x of [sl+3,sr-18]){const y=Math.min(hem-30,139);garment('M'+x+' '+y+'H'+(x+15)+'V'+(y+17)+'Q'+(x+7)+' '+(y+20)+' '+x+' '+(y+17)+'Z',c[1]);path('M'+x+' '+y+'H'+(x+15)+'L'+(x+13)+' '+(y+5)+'H'+(x+2)+'Z',c[2],c[3],.65);circle(x+7,y+3,1,c[0]);}
        for(let y=99;y<hem-10;y+=17)circle(95,y,1.3,c[2],c[3],.5);
        if(j==='mozart'||j==='grape')path('M'+(sl+2)+' 83L82 102 81 126 '+(sl+1)+' 113Z',c[1],c[3],.7);
        if(j==='berry')path('M'+(sl-1)+' 81L'+(sl+5)+' 94 79 88 82 96 '+(sl+4)+' 106 '+(sl-4)+' 96Z',c[2],c[3],.7);
      }
      line('M'+(lh+3)+' '+(hem-5)+'Q90 '+(hem+1)+' '+(rh-3)+' '+(hem-5),c[1],2);
    }
    if(back)cape(true);else cape(false);
    slot='';anatomy='hand';if(!(bodyProfile&&back)){ellipse(41,156,6.4,8,skin,skinEdge,.8);ellipse(139,156,6.4,8,skin,skinEdge,.8);}anatomy='head';
    if(['long','streak','silver-bob','bob'].includes(cut.hair)&&back)garment('M67 31Q54 68 63 99Q90 111 117 99Q126 68 113 31Z',hair);
    anatomy='neck';path('M78 59L78 73Q90 82 102 73L102 59Z',skin,skinEdge,.85);anatomy='head';project=false;
    if(bodyProfile&&direction==='left'){
      // Independently described graduate LEFT contour; no right-facing image
      // or vector is reflected to create this low-detail failure preview.
      anatomy='profile-direct';
      path('M98 36Q84 31 74 40L71 49 69 54 63 58 69 62 71 69Q76 77 87 78L94 75 100 67Q111 59 107 47Z',skin,skinEdge,.9);
      path('M108 50Q112 39 100 34Q91 29 80 34L71 34 74 39 67 41 73 44 70 49 77 46 80 52 86 47 91 53 95 50 100 61 106 66Q111 59 108 50Z',hair,hair,.8);
      ellipse(99,59,4.1,5.7,skin,skinEdge,.7);
      line('M72.8 51.5Q76 49.8 79.8 51',tint(hair,.09),1.3);
      ellipse(76.5,55.6,2.8,3.4,'#fffaf0');ellipse(75.8,55.9,1.5,2.5,'#514547');circle(75.2,54.8,.6,'#fffaf0');
      line('M69.8 62.5L72 63M70.7 67Q74 68.5 78 67','#a16768',.9);anatomy='head';
    }else if(side){
      const start=svg.children.length;
      path('M77 15Q100 9 109 28L111 37 119 43 111 48 108 58Q101 68 85 64L78 69 73 53Q60 40 77 15Z',skin,skinEdge,.9);
      path('M75 14Q93 4 105 18L109 31 99 25 96 42 89 39 86 53 77 57Q65 43 69 27Z',hair,hair,.8);
      ellipse(88,43,4.5,6,skin,skinEdge,.7);line('M103 36L108 36M106 54L111 53','#684b48',1.2);
      if(cut.glasses)path('M99 32H112L112 41H101ZM99 35L89 35','none','#41404b',1.5);
      if(cut.goggles)path('M99 19L110 24 108 29 98 25Z',COLORS.sky[1],'#52646b',1);
      if(cut.hair.includes('silver')||cut.hair==='gray')line('M99 48L102 49M100 50L103 51',skinEdge,.55);
      if(direction==='left')for(let i=start;i<svg.children.length;i++)svg.children[i].setAttribute('transform','translate(180 0) scale(-1 1)');
    }else if(back){
      ellipse(90,39,cut.face[0],cut.face[1],skin,skinEdge,.8);
      path('M'+(90-cut.face[0])+' 34Q62 4 89 7Q117 4 '+(90+cut.face[0])+' 34L111 61Q90 75 69 61Z',hair,hair,.8);
      for(const x of [77,87,98])line('M'+x+' 16Q'+(x-4)+' 39 '+x+' 60',tint(hair,.13),1.3);
    }else{
      if(['long','streak'].includes(cut.hair))path('M67 25Q55 70 62 113L73 106 77 27Z',hair,hair,.8);
      ellipse(90,39,cut.face[0],cut.face[1],skin,skinEdge,.85);ellipse(90-cut.face[0]+1,42,3.5,6,skin,skinEdge,.7);ellipse(90+cut.face[0]-1,42,3.5,6,skin,skinEdge,.7);
      path('M'+(90-cut.face[0])+' 33Q64 9 86 7 113 4 '+(90+cut.face[0])+' 30L107 23 102 34 95 24 89 32 83 23 72 33Z',hair,hair,.8);
      if(cut.hair==='fringe')path('M68 25L78 36 84 24 91 35 100 24 108 31 110 20Z',hair,hair);
      if(['bob','silver-bob'].includes(cut.hair))path('M65 26Q58 52 71 69L75 61 71 32M115 26Q122 52 109 69L105 61 109 32',hair,hair,3);
      if(cut.hair==='spiky')path('M65 25L70 9 78 15 85 4 93 13 103 5 110 17 117 25Z',hair,hair);
      if(cut.hair==='streak')line('M76 13Q82 20 80 31','#d5d3d8',3);
      if(cut.clip)path('M68 26L77 23 78 27 69 30Z','#84cab9','#467e75',.7);
      line('M77 37Q82 34 86 37M94 37Q99 34 104 37',tint(hair,.09),1.4);
      for(const x of [82,99]){ellipse(x,43,3.1,3.6,'#fffaf0');ellipse(x,43.5,1.7,2.6,'#514547');circle(x+.6,42.4,.65,'#fffaf0');}
      line('M90 44L88 51 91 52',skinEdge,.7);line('M84 57Q90 60 96 57','#a16768',1.1);
      if(cut.glasses)path('M73 37Q79 34 87 38L87 46Q80 50 74 45ZM93 38Q101 34 107 37L106 45Q99 50 93 46ZM87 40H93','none','#41404b',1.4);
      if(cut.goggles)path('M71 19Q79 14 87 19L87 26Q79 30 72 26ZM93 19Q101 14 109 19L108 26Q101 30 93 26Z',COLORS.sky[1],'#52646b',1.3);
      if(cut.hair.includes('silver')||cut.hair==='gray')line('M74 51L78 52M102 52L107 50M80 61Q90 66 100 61',skinEdge,.6);
    }
    project=side;
    if(has('hat')){
      slot='hat';const c=p('hat'),j=style('hat');
      if(j==='berry'){garment('M65 23L72 7Q90 16 108 7L115 23Z',c[1]);garment('M52 25Q68 32 90 28Q111 32 128 25Q120 39 90 35Q61 39 52 25Z',c[0]);}
      else if(j==='cherry'){garment('M64 24Q69 5 95 8Q115 8 118 23L111 28 66 28Z',c[0]);path('M69 25Q90 30 117 25L121 30Q96 38 68 31Z',c[1],c[3],.8);}
      else if(j==='grape'){garment('M66 23L75 10 104 8 115 24 90 30Z',c[0]);garment('M57 27L90 32 123 26 120 32 89 39 60 33Z',c[1]);line('M76 14L90 21 105 13',c[4],1.2);}
      else if(j==='schumann'){garment('M63 26Q64 5 90 7Q116 5 117 26Z',c[0]);garment('M62 24Q90 32 118 24V32Q90 39 62 32Z',c[1]);for(let x=69;x<116;x+=5)line('M'+x+' 26V32',c[2],.8);}
      else{garment('M64 25Q66 4 90 8Q114 4 116 25Z',j==='tide'||j==='pomelo'?c[2]:c[0]);garment('M55 26Q90 34 125 26L121 33Q90 42 59 33Z',c[1]);line('M66 24Q90 31 114 24',c[2],1.8);}
      if(!back&&FRUIT.has(j))motif(j,108,24,3.5,c);
      if(j==='tide'){line('M66 20Q90 28 114 20',c[0],2);path('M111 27L125 39 117 40 108 29Z',c[1],c[0],.6);}
      if(back)line('M83 24H97',c[2],1.4);
    }
    if(has('accessory')&&!(bodyProfile&&back)){
      slot='accessory';const c=p('accessory'),j=style('accessory'),x=back?sr-3:sr-7,y=back?85:112;
      if(FRUIT.has(j))motif(j,x,y,5.3,c);
      else if(j==='bach')line('M'+(x-5)+' '+(y+3)+'Q'+x+' '+(y-7)+' '+(x+5)+' '+(y-2),c[2],2);
      else if(j==='requiem')for(const [dx,dy] of [[0,-6],[6,-1],[3,5],[-4,4],[-6,-2]])path('M'+x+' '+y+'L'+(x+dx)+' '+(y+dy)+' '+(x+dx/2+1)+' '+(y+dy/2-1)+'Z',c[2],c[0],.5);
      else{circle(x,y,5.8,c[1],c[0],1);path('M'+(x-3)+' '+y+'L'+x+' '+(y-3)+' '+(x+3)+' '+y+' '+x+' '+(y+3)+'Z',c[2],c[0],.6);}
    }
    if(has('handheld')&&!(bodyProfile&&back)){
      slot='handheld';const c=p('handheld'),j=style('handheld'),x=sr+6;
      garment('M'+x+' 146L'+(x+25)+' 142 '+(x+29)+' 179 '+(x+4)+' 184Z',c[0]);path('M'+(x+3)+' 146L'+(x+24)+' 143 '+(x+25)+' 147 '+(x+4)+' 151Z',c[2],c[3],.6);
      line('M'+(x+4)+' 151L'+(x+7)+' 180',c[1],2.2);line('M'+(x+23)+' 148L'+(x+26)+' 178',c[1],2.2);
      if(FRUIT.has(j))motif(j,x+16,162,6,c);else if(j==='tide')seams('tide',c,x+8,x+22,155,177);
      else{line('M'+(x+10)+' 157L'+(x+21)+' 155M'+(x+11)+' 164L'+(x+22)+' 162',c[2],1.1);if(j==='letter')line('M'+(x+9)+' 172L'+(x+15)+' 167 '+(x+22)+' 171',c[1],1.2);}
      slot='';anatomy='grip';path('M'+(x-1)+' 163Q'+(x+7)+' 158 '+(x+11)+' 165L'+(x+8)+' 173 '+x+' 174Z',skin,skinEdge,.75);
    }
    return svg;
  }
  function itemPreview(state,item,options={}){
    const R=window.MindAdventure;if(!item||!Object.hasOwn(R.SLOTS,item.slot))return null;
    const painted=options.painted!==false&&window.MindPaintedAvatar?.itemPreview(state,item,{...options,fallback:(requested={})=>itemPreview(state,item,{...options,...requested,painted:false})});if(painted)return painted;
    const native=options.native!==false&&window.MindNativeAvatar?.itemPreview(state,item,{fallback:()=>itemPreview(state,item,{...options,painted:false,native:false})});if(native)return native;
    const bodyProfile=state.appearance?.character==='graduate'?GRADUATE_REFERENCE:null;
    const layered=options.raster!==false&&window.MindLayeredAvatar?.itemPreview(state,item,{bodyProfile,fallback:()=>itemPreview(state,item,{...options,painted:false,native:false,raster:false})});if(layered)return layered;
    const s={...state,rpg:{...state.rpg,loadout:{[item.slot]:item.id}}},full=preview(s,{painted:false,native:false,raster:false,bodyProfile,original:false}),cut=CUTS[window.MindAcademy.character(state.appearance?.character).id]||CUTS.doctor;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    const boxes={jacket:[20,64,140,188],cape:[25,63,130,144],shirt:[25,64,130,112],pants:[34,136,112,161],shoes:[38,269,104,45],hat:[45,0,90,49],accessory:[90+cut.shoulder-18,99,28,28],handheld:[90+cut.shoulder,132,44,60]};
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('viewBox',(bodyProfile?[0,0,180,306]:boxes[item.slot]).join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',item.name+'：遊戲實際穿戴版型');svg.setAttribute('data-gear-id',item.id);
    for(const part of full.querySelectorAll('[data-equipment-slot="'+item.slot+'"]'))svg.append(part.cloneNode(true));
    return svg;
  }
  return {CUTS,COLORS,SHAPES,model,preview,itemPreview};
});

