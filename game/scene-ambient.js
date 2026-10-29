window.MindAmbient=function({node}){
  const NS='http://www.w3.org/2000/svg',types=['white-eye','bulbul','pigeon','sparrow'];
  function birds(kind){return node('div',{class:'campus-birds','aria-hidden':'true'},Array.from({length:28},(_,i)=>{const species=i%4,el=node('span',{class:'flight-bird bird-'+types[species]},node('span',{class:'species-sprite'})),x=kind==='hall'?38+Math.random()*50:3+Math.random()*94,y=kind==='hall'?15+Math.random()*22:8+Math.random()*25;el.style.cssText='left:'+x+'%;top:'+y+'%;--bird-col:'+(species%2*100)+'%;--bird-row:'+(Math.floor(species/2)*100)+'%;--bird-size:'+(species===2?1.9:1+Math.random()*.55)+'cqw;--dx:'+(Math.random()*18-9)+'cqw;--dy:'+(Math.random()*7-3.5)+'cqw;--duration:'+(16+Math.random()*21)+'s;--delay:-'+Math.random()*35+'s';return el;}));}
  function svgEl(tag,attrs){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
  function water(scene){if(!scene.water?.length)return [];const svg=svgEl('svg',{viewBox:'0 0 1000 667',class:'river-surface','aria-hidden':'true'}),defs=svgEl('defs',{});svg.append(defs);
    scene.water.forEach((zone,index)=>{const id='water-'+index,clip=svgEl('clipPath',{id}),shape=zone.shape==='ellipse'?svgEl('ellipse',{cx:zone.cx,cy:zone.cy,rx:zone.rx,ry:zone.ry}):svgEl('polygon',{points:zone.points.map(p=>p.join(',')).join(' ')});clip.append(shape);defs.append(clip);const group=svgEl('g',{'clip-path':'url(#'+id+')'});svg.append(group);
      if(zone.shape==='ellipse'){
        const mask=svgEl('mask',{id:'basin-water'});mask.append(svgEl('rect',{x:350,y:290,width:300,height:80,fill:'white'}),svgEl('ellipse',{cx:500,cy:325,rx:31,ry:13,fill:'black'}));defs.append(mask);group.setAttribute('mask','url(#basin-water)');
        for(let i=0;i<4;i++){const ripple=svgEl('ellipse',{cx:zone.cx+(i-1.5)*24,cy:zone.cy,rx:47+i*20,ry:7+i*3,class:'fountain-ripple'});ripple.style.animationDelay=-i*1.25+'s';group.append(ripple);}
        const ring=svgEl('ellipse',{cx:zone.cx,cy:zone.cy,rx:zone.rx*.87,ry:zone.ry*.7,class:'stream-thread pool-circulation'});group.append(ring);
      }else{const flow=zone.flow;if(!Array.isArray(flow)||flow.length<2)return;let d='M'+flow[0].join(' ');for(let i=1;i<flow.length;i++)d+=' L'+flow[i].join(' ');for(let i=0;i<4;i++){const p=svgEl('path',{d,class:'stream-thread current-'+i,transform:'translate('+(i-1.5)*2+','+(i%2*1.5)+')'});p.style.animationDelay=(-index-i*.7)+'s';group.append(p);}}
    });
    if(!scene.orb)return [svg];
    // The clean plate contains only the basin and pedestal: every jet and ring below moves.
    const jets=svgEl('svg',{viewBox:'0 0 1000 667',class:'fountain-jets','aria-hidden':'true'});
    [[430,330,51],[452,342,43],[500,346,38],[544,342,43],[563,330,51]].forEach(([x,y,h],i)=>{
      const jet=svgEl('g',{transform:'translate('+x+' '+y+')',class:'fountain-jet'});
      jet.style.setProperty('--jet-cycle',(4.4+i*.43)+'s');jet.style.setProperty('--jet-delay',(-i*1.37)+'s');
      const column=svgEl('g',{class:'jet-column'});
      column.append(svgEl('path',{d:'M-5 0 Q-3 -'+h+' 0 -'+h+' Q3 -'+h+' 5 0',class:'jet-sheet'}),svgEl('path',{d:'M0 0 Q-2 -'+(h*.5)+' 0 -'+h,class:'jet-core'}));
      for(let n=0;n<5;n++){const drop=svgEl('circle',{cx:(n-2)*1.9,cy:-h*(.4+n*.11),r:n%2?.7:1,class:'jet-drop'});drop.style.animationDelay=(-n*.19-i*.3)+'s';column.append(drop);}
      jet.append(column,svgEl('ellipse',{cx:0,cy:0,rx:8,ry:2.1,class:'jet-foam'}),svgEl('ellipse',{cx:0,cy:0,rx:16,ry:3.6,class:'jet-splash'}));jets.append(jet);
    });
    const orb=node('div',{class:'plaza-orb','aria-hidden':'true'},node('span',{class:'orb-stem'}),node('span',{class:'turning-sphere'},node('i')),node('span',{class:'armillary-ring ring-outer'}),node('span',{class:'armillary-ring ring-cross'}),node('span',{class:'armillary-ring ring-inner'}));orb.style.left=scene.orb.x/10+'%';orb.style.top=scene.orb.y/667*100+'%';return [svg,jets,orb];
  }
  return {birds,water};
};
