(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindRasterOutfit=api;})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  const DIRECTIONS=['down','up','right','left'],SLOTS=['jacket','cape','shirt','pants','shoes','hat','accessory','handheld'];
  const PARTS={shirt:['shirt.torso','shirt.armL','shirt.armR'],jacket:['jacket.torso','jacket.armL','jacket.armR'],pants:['pants.pelvis','pants.legL','pants.legR','pants.pocketL','pants.pocketR'],shoes:['shoes.L','shoes.R'],cape:['cape.front','cape.back'],hat:['hat'],accessory:['accessory'],handheld:['handheld']},OPTIONAL_PARTS=new Set(['pants.pocketL','pants.pocketR']);
  const SPACE={width:320,height:544,foot:490},FRAME={width:72,height:120,columns:4,count:24};
  // Original four-view garment parts, articulated by a skeleton. These are
  // generated poses, not represented as 24 independently painted originals.
  const POSES=Object.freeze([
    ['idle',0],['idle',.5],...Array.from({length:8},(_,i)=>['run',i/8]),
    ['start',0],['start',1],['stop',0],['stop',1],['turn',0],['turn',1],
    ['rise',0],['rise',1],['apex',0],['fall',0],['fall',1],
    ['land',0],['land',.5],['land',1]
  ].map(Object.freeze));
  const SCENE_BYTES=64*1024*1024,SOURCE_BYTES=64*1024*1024,maskPaths=new WeakMap();
  function aborted(){const error=Error('服裝圖像請求已取消。');error.name='AbortError';return error;}
  // Shoulder, waist, hip and limb lengths are independent. A broad elder is not
  // produced by stretching a young scholar's entire picture, including the face.
  const BODIES={
    doctor:{height:450,shoulders:88,waist:68,hips:62,head:75,leg:185,arm:128,limb:29,fit:'regular'},
    professor:{height:450,shoulders:78,waist:56,hips:66,head:73,leg:190,arm:126,limb:27,fit:'slim'},
    graduate:{height:432,shoulders:83,waist:67,hips:64,head:78,leg:174,arm:122,limb:29,fit:'regular'},
    researcher:{height:420,shoulders:104,waist:89,hips:85,head:80,leg:168,arm:120,limb:35,fit:'broad'},
    'cedar-dean':{height:458,shoulders:80,waist:63,hips:62,head:75,leg:193,arm:129,limb:27,fit:'slim'},
    'herbal-mentor':{height:409,shoulders:103,waist:92,hips:88,head:80,leg:160,arm:116,limb:35,fit:'broad'},
    'lab-engineer':{height:452,shoulders:116,waist:95,hips:85,head:78,leg:182,arm:136,limb:36,fit:'broad'},
    'balance-analyst':{height:443,shoulders:85,waist:65,hips:69,head:74,leg:185,arm:126,limb:28,fit:'regular'},
    'dawn-intern':{height:405,shoulders:78,waist:58,hips:58,head:77,leg:159,arm:113,limb:26,fit:'short'},
    'river-fellow':{height:457,shoulders:86,waist:64,hips:62,head:76,leg:194,arm:130,limb:27,fit:'slim'}
  };
  // Opt-in UI calibration from the user's standing reference. World bodies and
  // scene atlas acquisition deliberately keep the original profiles. The JSON
  // beside reference.png records the same source rectangles and measurements.
  const GRADUATE_REFERENCE={"id":"graduate-reference-v1","character":"graduate","referenceScale":0.5070422535211268,"landmarks":{"top":58.0,"chin":135.5774647887324,"neck":155.35211267605632,"shoulder":158.3943661971831,"waist":260.30985915492954,"hip":282.11267605633805,"knee":363.23943661971833,"sole":490},"body":{"height":432,"shoulders":106.47887323943662,"waist":73.01408450704226,"hips":48.399487836107554,"head":86.70422535211267,"leg":187.88732394366195,"arm":120.67605633802816,"limb":27.887323943661972,"fit":"regular"},"geometry":{"legWidth":46.140845070422536,"shoeWidth":58.309859154929576,"shoulderHalfWidth":53.23943661971831,"wristX":{"L":53.74647887323943,"R":-51.71830985915493},"kneeHalfWidth":27.887323943661972,"ankleHalfWidth":34.478873239436616,"shirtTop":148.25352112676057,"shirtHem":266.90140845070425,"jacketHem":292.2535211267606,"calf":431.6901408450704,"fullHem":479.85915492957747,"equippedDownLegWidth":64},"atlases":{"graduate-reference-v1":{"src":"./assets/avatar-raster/graduate-reference-v1/reference.png","width":1774,"height":887},"graduate-reference-left-body":{"src":"./assets/painted-avatar/graduate-left-v1/left-actions-0-body-front.webp","width":256,"height":384},"graduate-reference-right-body":{"src":"./assets/painted-avatar/graduate-right-v1/right-actions-0-body-front.webp","width":256,"height":384}},"parts":{"down":{"head":{"atlas":"graduate-reference-v1","rect":[237,16,171,205],"mask":[[[0.0,0.0],[1.0,0.0],[1.0,0.8097561],[0.66081871,0.8097561],[0.63157895,0.86341463],[0.56725146,0.90243902],[0.52631579,0.97073171],[0.48538012,0.99512195],[0.44444444,0.92682927],[0.3625731,0.87317073],[0.32163743,0.8097561],[0.0,0.8097561]]],"neckMask":[[[0.35672515,0.76585366],[0.61403509,0.76585366],[0.64327485,0.83414634],[0.57309942,0.89268293],[0.52631579,0.97073171],[0.48538012,0.99512195],[0.44444444,0.92682927],[0.3625731,0.87317073],[0.32748538,0.81463415]]],"anchor":[0.4853801169590643,0.9463414634146341],"hatPin":[0.4853801169590643,0.2682926829268293]},"hands":{"L":{"atlas":"graduate-reference-v1","rect":[400,442,49,94],"anchor":[0.5306122448979592,0.1276595744680851],"displayWidth":24.845070422535212},"R":{"atlas":"graduate-reference-v1","rect":[194,442,44,93],"anchor":[0.5454545454545454,0.12903225806451613],"displayWidth":22.309859154929576}},"defaults":{"shirt.torso":{"atlas":"graduate-reference-v1","rect":[235,182,173,246],"referenceBox":[235,182,173,246],"displayWidth":87.71830985915493,"mask":[[[0.2716763,0.0],[0.69942197,0.0],[0.94219653,0.09349593],[1.0,0.2804878],[1.0,0.68292683],[0.97687861,0.93089431],[0.90751445,1.0],[0.06358382,1.0],[0.0,0.89837398],[0.0,0.68292683],[0.0,0.29674797],[0.06936416,0.12601626]]]},"shirt.armR":{"atlas":"graduate-reference-v1","rect":[183,202,75,184],"referenceBox":[183,202,75,184],"displayWidth":38.028169014084504,"mask":[[[0.61333333,0.0],[0.89333333,0.05978261],[1.0,0.23913043],[0.84,0.5],[0.77333333,0.75543478],[0.69333333,0.91847826],[0.54666667,1.0],[0.09333333,0.95652174],[0.0,0.85326087],[0.13333333,0.61956522],[0.25333333,0.35326087],[0.37333333,0.15217391]]],"sleeveEndRatio":0.6638655462184874,"pins":{"root":[0.5,0.07608695652173914],"joint":[0.5,0.7228260869565217],"tip":[0.5,0.9347826086956522]}},"shirt.armL":{"atlas":"graduate-reference-v1","rect":[393,202,64,184],"referenceBox":[393,202,64,184],"displayWidth":32.45070422535211,"mask":[[[0.21875,0.0],[0.546875,0.05978261],[0.75,0.22826087],[0.84375,0.50543478],[1.0,0.85326087],[0.890625,0.95652174],[0.359375,1.0],[0.203125,0.89673913],[0.125,0.71195652],[0.0,0.5],[0.0,0.2173913]]],"sleeveEndRatio":0.6638655462184874,"pins":{"root":[0.5,0.07608695652173914],"joint":[0.5,0.7228260869565217],"tip":[0.5,0.9347826086956522]}},"pants.pelvis":{"atlas":"graduate-reference-v1","rect":[224,415,190,49],"referenceBox":[224,415,190,49],"displayWidth":96.33802816901408,"mask":[[[0.08947368,0.0],[0.92631579,0.0],[0.95263158,1.0],[0.05789474,1.0]]]},"pants.legR":{"atlas":"graduate-reference-v1","rect":[204,463,116,342],"referenceBox":[204,463,116,342],"displayWidth":58.816901408450704,"mask":[[[0.26724138,0.0],[1.0,0.0],[1.0,0.11111111],[0.86206897,0.28947368],[0.80172414,0.4619883],[0.74137931,0.72222222],[0.69827586,0.89766082],[0.5862069,1.0],[0.12931034,1.0],[0.0,0.92397661],[0.02586207,0.80701754],[0.09482759,0.5877193],[0.12931034,0.37134503],[0.1637931,0.16666667]]],"pins":{"root":[0.5,0.02],"joint":[0.5,0.4590643274853801],"tip":[0.5,0.9678362573099415]}},"pants.legL":{"atlas":"graduate-reference-v1","rect":[320,463,116,342],"referenceBox":[320,463,116,342],"displayWidth":58.816901408450704,"mask":[[[0.0,0.0],[0.73275862,0.0],[0.78448276,0.16666667],[0.81034483,0.38304094],[0.85344828,0.58187135],[0.92241379,0.80994152],[1.0,0.92690058],[0.79310345,1.0],[0.30172414,1.0],[0.18965517,0.9005848],[0.15517241,0.72222222],[0.12068966,0.46491228],[0.07758621,0.28070175],[0.0,0.11111111]]],"pins":{"root":[0.5,0.02],"joint":[0.5,0.4590643274853801],"tip":[0.5,0.9678362573099415]}},"pants.pocketL":{"hidden":true},"pants.pocketR":{"hidden":true},"shoes.R":{"atlas":"graduate-reference-v1","rect":[177,789,121,84],"referenceBox":[177,789,121,84],"displayWidth":61.352112676056336},"shoes.L":{"atlas":"graduate-reference-v1","rect":[341,789,123,84],"referenceBox":[341,789,123,84],"displayWidth":62.36619718309859}},"bareHands":{"R":{"atlas":"graduate-reference-v1","rect":[193,369,45,166],"referenceBox":[193,369,45,166],"displayWidth":22.816901408450704,"anchor":[0.5555555555555556,0.5120481927710844]},"L":{"atlas":"graduate-reference-v1","rect":[401,369,48,166],"referenceBox":[401,369,48,166],"displayWidth":24.338028169014084,"anchor":[0.5208333333333334,0.5120481927710844]}}},"left":{"hands":{"L":{"atlas":"graduate-reference-left-body","rect":[89,191,20,27],"anchor":[0.78,0.84],"displayWidth":19},"R":{"atlas":"graduate-reference-left-body","rect":[100,208,17,16],"anchor":[0.88,0.35],"displayWidth":18}}},"right":{"hands":{"L":{"atlas":"graduate-reference-right-body","rect":[161,190,16,19],"anchor":[0.4,0.84],"displayWidth":17},"R":{"atlas":"graduate-reference-right-body","rect":[133,202,47,19],"anchor":[0.1,0.5],"displayWidth":36}}},"up":{"hands":{"L":{"hidden":true},"R":{"hidden":true}},"handheldHidden":true,"reason":"Own sealed up actions0 has no visible hand pixels; both hands and held book are naturally occluded by the torso."}}};
  function freezeTree(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeTree);Object.freeze(value);}return value;}
  freezeTree(GRADUATE_REFERENCE);
  function previewBodyProfile(character,options={}){return character==='graduate'&&options.bodyProfile===GRADUATE_REFERENCE.id?GRADUATE_REFERENCE:null;}
  const PROFILE_SOURCE_PATHS=new Set(Object.values(GRADUATE_REFERENCE.atlases).map(a=>a.src));
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,point=(x,y)=>({x,y});
  const shoeWidth=(p,part)=>p.bodyProfile?(p.bodyProfile.geometry.shoeWidth*(p.side?1.1:1)*(part.scale||1)):(p.side?52:42)*clamp(p.body.limb/29,.88,1.22)*(part.scale||1);
  const add=(a,b)=>point(a.x+b.x,a.y+b.y),sub=(a,b)=>point(a.x-b.x,a.y-b.y),length=v=>Math.hypot(v.x,v.y);
  function rotate(p,angle){const c=Math.cos(angle),s=Math.sin(angle);return point(p.x*c-p.y*s,p.x*s+p.y*c);}
  function direction(value,fallback='down'){
    if(DIRECTIONS.includes(value))return value;
    if(typeof value==='string'&&value.includes('-')){const bits=value.split('-');return bits.includes(fallback)?fallback:bits.includes('down')?'down':bits.includes('up')?'up':fallback;}
    return fallback;
  }
  function body(character,options={}){const profile=previewBodyProfile(character,options);return {...(profile?.body||BODIES[character]||BODIES.graduate)};}
  function ik(start,end,upper,lower,bend=1){
    const delta=sub(end,start),d=clamp(length(delta),Math.abs(upper-lower)+.001,upper+lower-.001),angle=Math.atan2(delta.y,delta.x),a=Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
    const joint=add(start,point(Math.cos(angle+bend*a)*upper,Math.sin(angle+bend*a)*upper));
    const tip=add(start,point(Math.cos(angle)*d,Math.sin(angle)*d));return {root:start,joint,tip};
  }
  function stride(phase){
    const p=((phase%1)+1)%1;
    if(p<.5)return {forward:1-4*p,lift:0,contact:true};
    const t=(p-.5)*2;return {forward:-1+2*t,lift:Math.sin(Math.PI*t),contact:false};
  }
  function pose(character,view='down',phase=0,action='idle',options={}){
    const profile=previewBodyProfile(character,options),b=body(character,options),d=direction(view),side=d==='left'||d==='right',facing=d==='left'?-1:1,run=action==='run',t=run?phase:0;
    const bob=run?Math.cos(t*Math.PI*4)*(profile?5:2.8):0,ankleY=SPACE.foot-20,hipY=profile?profile.landmarks.hip+bob:ankleY-b.leg+bob,shoulderY=profile?profile.landmarks.shoulder+bob:SPACE.foot-b.height+b.head+27+bob;
    const hipWidth=b.hips*(side?.23:.88),shoulderWidth=b.shoulders*(side?.22:1),viewWidth=side?.66:1;
    const p={character,direction:d,phase:t,action,body:b,side,viewWidth,bob,root:point(160,SPACE.foot),hip:point(160,hipY),chest:point(160,shoulderY+15),neck:point(160,shoulderY-14),headAngle:run?Math.sin(t*Math.PI*2)*.018:0,limbs:{},near:d==='left'?'L':'R'};
    if(profile){p.bodyProfile=profile;p.chest.y=shoulderY+15;p.neck.y=profile.landmarks.neck+bob;p.waist=point(160,profile.landmarks.waist+bob);p.kneeY=profile.landmarks.knee+bob;}
    for(const name of ['L','R']){
      const anatomical=name==='L'?1:-1,screen=d==='up'?-anatomical:anatomical,phase=t+(name==='R'?.5:0),s=run?stride(phase):{forward:0,lift:0,contact:true};
      const hip=point(160+screen*hipWidth/2,hipY),foot=point((profile&&!side?160+screen*profile.geometry.ankleHalfWidth:hip.x)+(side?s.forward*(profile?55:35)*facing:screen*s.forward*(profile?5:2)),ankleY-(side?s.lift*(profile?64:45):s.lift*(profile?58:30))+(side?0:s.forward*(profile?10:6)));
      const leg=side&&run?ik(hip,foot,b.leg*.51,b.leg*.51,-facing):{root:hip,joint:point(profile&&!side?160+screen*profile.geometry.kneeHalfWidth+(run?screen*s.lift*4:0):mix(hip.x,foot.x,.5)+(run?screen*s.lift*2:0),profile?p.kneeY-(run?s.lift*40:0):mix(hip.y,foot.y,.5)-(run?s.lift*6:0)),tip:foot};
      const shoulder=point(160+screen*shoulderWidth*(profile?.5:.475),shoulderY+(profile?0:22)),swing=run?Math.sin(phase*Math.PI*2):0;
      const wrist=point(profile&&!side&&!run?160+profile.geometry.wristX[name]*(d==='up'?-1:1):shoulder.x+(side?-swing*(profile?48:35)*facing:screen*(run?(profile?12:8):5)),shoulder.y+b.arm*(run?(profile?.62:.72):(profile?1:.97))+(run?swing*(profile?42:25):0));
      const arm=side?ik(shoulder,wrist,b.arm*.53,b.arm*.5,facing):{root:shoulder,joint:point(shoulder.x+screen*(run?4:3),shoulder.y+b.arm*.52+(run?swing*5:0)),tip:wrist};
      p.limbs[name]={arm,leg,contact:s.contact,footAngle:run?(side?facing*(s.contact?-.12:s.forward*.28):screen*s.lift*.06):0};
    }
    if(action==='idle'&&phase){
      const breath=Math.sin(phase*Math.PI)*1.1;p.chest.y-=breath;p.neck.y-=breath*.6;
      for(const limb of Object.values(p.limbs)){limb.arm.root.y-=breath;limb.arm.joint.y-=breath*.5;}
    }
    if(!run&&action!=='idle'){
      const progress=clamp(phase,0,1),spring=action==='land'?1-progress:0;
      const crouch=action==='start'?9*(1-progress):action==='stop'?5*(1-progress):spring*16;
      p.hip.y+=crouch;p.chest.y+=crouch*.7;p.neck.y+=crouch*.65;
      p.headAngle=action==='turn'?(progress-.5)*.11:action==='start'?.035:action==='stop'?-.025:0;
      for(const name of ['L','R']){
        const limb=p.limbs[name],sign=name==='L'?1:-1,air=['rise','apex','fall'].includes(action);
        let foot={...limb.leg.tip},wrist={...limb.arm.tip};
        const hip={x:limb.leg.root.x,y:limb.leg.root.y+crouch},shoulder={x:limb.arm.root.x,y:limb.arm.root.y+crouch*.7};
        if(air){
          const lift=action==='rise'?18+progress*12:action==='apex'?25:12*(1-progress);
          foot.y-=lift+(name==='L'?5:0);foot.x+=side?facing*sign*(action==='fall'?7:13):sign*5;
          wrist.y-=action==='fall'?25:44;wrist.x+=side?facing*15:sign*14;
          limb.contact=false;limb.footAngle=side?facing*(action==='fall'?.14:-.16):sign*.04;
        }else if(action==='start'||action==='stop'){
          foot.x+=side?facing*sign*(1-progress)*12:sign*(1-progress)*3;
          wrist.y-=16*(1-progress);wrist.x+=side?-facing*sign*(1-progress)*10:sign*3;
        }else if(action==='turn'){
          foot.x+=side?sign*(progress-.5)*12:sign*3;
          wrist.x+=side?facing*(progress-.5)*15:sign*(1-progress)*8;
        }else if(action==='land'){
          wrist.x+=side?facing*spring*12:sign*spring*12;wrist.y+=crouch*.4;
        }
        limb.leg=side?ik(hip,foot,b.leg*.51,b.leg*.51,-facing):{root:hip,joint:point(mix(hip.x,foot.x,.5)+sign*(air?5:spring*7),mix(hip.y,foot.y,.5)),tip:foot};
        limb.arm=side?ik(shoulder,wrist,b.arm*.53,b.arm*.5,facing):{root:shoulder,joint:point(mix(shoulder.x,wrist.x,.5)+sign*4,mix(shoulder.y,wrist.y,.5)),tip:wrist};
      }
      p.phase=progress;
    }
    return p;
  }
  // Continuous linear skinning around the knee/elbow. Every vertex in the shared
  // transition uses the same two matrices; neighboring triangles cannot expose a
  // hinge-shaped transparent gap. The original cloth pixels remain the texture.
  function limbMesh(limb,width,pins={}){
    const r=pins.root||[.5,.09],j=pins.joint||[.5,.52],tip=pins.tip||[.5,.93],a=sub(limb.joint,limb.root),b=sub(limb.tip,limb.joint),l1=length(a),l2=length(b),angle1=Math.atan2(a.y,a.x)-Math.PI/2,angle2=Math.atan2(b.y,b.x)-Math.PI/2;
    const rows=[0,r[1],Math.max(r[1],j[1]-.13),j[1],Math.min(tip[1],j[1]+.13),tip[1],1].sort((x,y)=>x-y);
    const vertices=[];
    for(const v of rows)for(const u of [0,.5,1]){
      const y=v<=j[1]?(v-r[1])/(j[1]-r[1])*l1:l1+(v-j[1])/(tip[1]-j[1])*l2;
      const center=v<=j[1]?mix(r[0],j[0],clamp((v-r[1])/(j[1]-r[1]),0,1)):mix(j[0],tip[0],clamp((v-j[1])/(tip[1]-j[1]),0,1));
      const x=(u-center)*width,upper=add(limb.root,rotate(point(x,y),angle1)),lower=add(limb.joint,rotate(point(x,y-l1),angle2)),w=clamp((v-(j[1]-.13))/.26,0,1);
      vertices.push({u,v,x:mix(upper.x,lower.x,w),y:mix(upper.y,lower.y,w)});
    }
    return grid(vertices,3,rows.length);
  }
  function grid(vertices,cols,rows){const triangles=[];for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){const a=y*cols+x,b=a+1,c=a+cols,d=c+1;triangles.push([a,b,c],[b,d,c]);}return {vertices,triangles};}
  function quad(x,y,w,h,angle=0,anchor=[.5,0]){
    const vertices=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>{const p=rotate(point((u-anchor[0])*w,(v-anchor[1])*h),angle);return {u,v,x:x+p.x,y:y+p.y};});return {vertices,triangles:[[0,1,2],[1,3,2]]};
  }
  function clothMesh(p,width,height,anchorY,kind,part={}){
    const rows=6,cols=5,vertices=[],swing=p.action==='run'?Math.sin(p.phase*Math.PI*2-(kind==='cape'?.8:.35)):p.action==='rise'?-.35:p.action==='fall'?.3:p.action==='turn'?(p.phase-.5)*.65:p.action==='land'?Math.sin(p.phase*Math.PI)*.32:0;
    const lengthScale=clamp(part.lengthScale||1,.8,1.8),hemStart=clamp(part.hemStart??.65,.4,.75),extra=height*(lengthScale-1);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const u=x/(cols-1),v=y/(rows-1),tail=Math.max(0,(v-.35)/.65),lag=(kind==='cape'?16:6)*swing*tail*tail;
      // Source collars occupy the upper fifth of legacy torso crops. In the
      // measured UI fit, compress that collar-to-shoulder interval separately
      // from chest/waist length; the head and all world geometry are untouched.
      const fittedV=p.bodyProfile&&!part.referenceBox&&(kind==='shirt'||kind==='jacket')?(v<=.2?v*.4:.08+(v-.2)*1.15):v;
      vertices.push({u,v,x:160+(u-.5)*width+lag,y:anchorY+fittedV*height+extra*clamp((v-hemStart)/(1-hemStart),0,1)+Math.abs(u-.5)*tail*swing*3});
    }
    return grid(vertices,cols,rows);
  }
  function triangleTransform(src,dst){
    const [a,b,c]=src,[p,q,r]=dst,den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(den)<1e-9)return null;
    return [(p.x*(b.y-c.y)+q.x*(c.y-a.y)+r.x*(a.y-b.y))/den,(p.y*(b.y-c.y)+q.y*(c.y-a.y)+r.y*(a.y-b.y))/den,(p.x*(c.x-b.x)+q.x*(a.x-c.x)+r.x*(b.x-a.x))/den,(p.y*(c.x-b.x)+q.y*(a.x-c.x)+r.y*(b.x-a.x))/den,(p.x*(b.x*c.y-c.x*b.y)+q.x*(c.x*a.y-a.x*c.y)+r.x*(a.x*b.y-b.x*a.y))/den,(p.y*(b.x*c.y-c.x*b.y)+q.y*(c.x*a.y-a.x*c.y)+r.y*(a.x*b.y-b.x*a.y))/den];
  }
  function checkedPart(part,manifest){
    if(!part||typeof part.atlas!=='string'||!Array.isArray(part.rect)||part.rect.length!==4)throw Error('服裝分件素材尚未備妥。');
    const atlas=manifest.atlases?.[part.atlas],[x,y,w,h]=part.rect;
    if(!atlas||![atlas.width,atlas.height,x,y,w,h].every(Number.isFinite)||w<=0||h<=0||x<0||y<0||x+w>atlas.width+.01||y+h>atlas.height+.01)throw Error('服裝素材裁切範圍不正確。');
    for(const key of ['scale','widthScale','lengthScale'])if(part[key]!==undefined&&!(Number.isFinite(part[key])&&part[key]>0&&part[key]<=4))throw Error('服裝版型比例不正確。');
    for(const key of ['anchor','solePin','hatPin'])if(part[key]&&(!Array.isArray(part[key])||part[key].length!==2||!part[key].every(v=>Number.isFinite(v)&&v>=-1&&v<=2)))throw Error('服裝定位標記不正確。');
    if(part.pins){const pins={root:[.5,.09],joint:[.5,.52],tip:[.5,.93],...part.pins};for(const key of ['root','joint','tip'])if(!Array.isArray(pins[key])||pins[key].length!==2||!pins[key].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('服裝關節標記不正確。');if(!(pins.root[1]<pins.joint[1]&&pins.joint[1]<pins.tip[1]))throw Error('服裝關節順序不正確。');}
    for(const key of ['mask','neckMask','cutouts'])if(part[key]){const polygons=typeof part[key][0]?.[0]==='number'?[part[key]]:part[key];if(!Array.isArray(polygons)||!polygons.length||polygons.length>64||polygons.some(poly=>!Array.isArray(poly)||poly.length<3||poly.length>8192||poly.some(p=>!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&v>=-.001&&v<=1.001))))throw Error('服裝裁切遮罩不正確。');}
    return part;
  }
  function appearance(state,env){
    const A=env.MindAcademy,R=env.MindAdventure,E=env.MindEngine,character=A?.character(state?.appearance?.character)?.id||state?.appearance?.character||'graduate',loadout={};
    if(!BODIES[character])throw Error('找不到角色版型。');
    for(const slot of SLOTS){const id=state?.rpg?.loadout?.[slot],gear=R?.gear(id);loadout[slot]=gear?.slot===slot||slot==='handheld'&&E?.ITEMS?.some(item=>item.id===id)?id:null;}
    return {character,loadout};
  }
  function plan(state,view,manifest,env,onlySlot=null,options={}){
    if(!manifest||manifest.version!==1)throw Error('服裝圖像正在準備中。');
    const look=appearance(state,env),d=direction(view),profile=previewBodyProfile(look.character,options),fit=body(look.character,options).fit,parts={},items={};
    if(profile)manifest={...manifest,atlases:{...manifest.atlases,...profile.atlases}};
    for(const slot of SLOTS){
      if(onlySlot&&slot!==onlySlot)continue;
      const id=look.loadout[slot],gear=env.MindAdventure?.gear(id),entry=id?(manifest.catalog?.[id]||(gear?.style?{kit:gear.style,slot}:null)):manifest.defaults?.[slot]?{kit:manifest.defaults[slot],slot}:null;
      if(!entry){if(id)throw Error('這件裝備的實際穿戴素材尚未完成。');continue;}
      const kit=manifest.kits?.[entry.kit],variant=kit?.bodyVariants?.[look.character]||kit?.bodyVariants?.[fit],raw=kit?.views?.[d],custom=variant?.views?.[d];
      if(!raw)throw Error('這套服裝缺少此方向的原畫。');
      for(const key of PARTS[slot]){const part=(!id&&profile?.parts[d]?.defaults?.[key])||custom?.parts?.[key]||raw.parts?.[key];if(part?.hidden||!part&&OPTIONAL_PARTS.has(key))continue;parts[key]={...checkedPart(part,manifest),slot,item:id||null};}
      if(!onlySlot)for(const side of ['L','R']){const key='hand.'+side,part=custom?.parts?.[key]||raw.parts?.[key];if(part&&!parts[key])parts[key]={...checkedPart(part,manifest),slot:'body'};}
      items[slot]=id||null;
    }
    if(!onlySlot){
      const head=profile?.parts[d]?.head||manifest.heads?.[look.character]?.[d];parts.head={...checkedPart(head,manifest),slot:'body'};
      if(head.neckMask){parts['head.neck']={...parts.head,mask:head.neckMask,cutouts:null};parts.head.cutouts=head.neckMask;}
      for(const side of ['L','R']){const key='hand.'+side,part=profile?(d==='down'&&!look.loadout.shirt&&!look.loadout.jacket?profile.parts[d].bareHands[side]:profile.parts[d]?.hands?.[side]):manifest.hands?.[look.character]?.[d]?.[side]||manifest.hands?.[d]?.[side];if(profile&&part?.hidden){delete parts[key];continue;}if(part)parts[key]={...checkedPart(part,manifest),slot:'body'};if(!parts[key])throw Error('角色手部素材尚未備妥。');}
      if(profile?.parts[d]?.handheldHidden)delete parts.handheld;
    }
    const result={character:look.character,direction:d,parts,items,onlySlot,key:JSON.stringify([manifest.revision||1,look.character,d,...SLOTS.map(slot=>look.loadout[slot]),onlySlot,...(profile?[profile.id]:[])])};
    if(profile){result.bodyProfile=profile.id;result.atlasOverrides=profile.atlases;}return result;
  }
  function partMesh(key,part,p){
    const b=p.body,s=part.scale||1,aspect=part.rect[3]/part.rect[2],side=p.side;
    if(p.bodyProfile&&part.referenceBox&&p.action==='idle'){const [x,y,w,h]=part.referenceBox,k=p.bodyProfile.referenceScale;return quad(160+(x+w/2-320)*k,SPACE.foot+(y-870)*k,w*k,h*k,0,[.5,0]);}
    if(/\.arm[LR]$/.test(key)){const n=key.at(-1);let arm=p.limbs[n].arm;if(p.bodyProfile){if(part.sleeveEndRatio){arm={...arm,tip:point(mix(arm.root.x,arm.tip.x,part.sleeveEndRatio),mix(arm.root.y,arm.tip.y,part.sleeveEndRatio))};}else arm={...arm,root:point(arm.root.x,arm.root.y+10),joint:point(arm.joint.x,arm.joint.y+4)};}return limbMesh(arm,(p.bodyProfile&&part.displayWidth?part.displayWidth:b.limb*(key.startsWith('jacket')?1.25:1.02))*s,part.pins);}
    // Equipped DOWN leg crops include transparent side margins. Fit the existing
    // pixels to the measured thigh silhouette without moving any joints or the
    // separate reference-pixel defaults. This avoids a flat gap below the pelvis.
    if(/\.leg[LR]$/.test(key)){const n=key.at(-1),g=p.bodyProfile?.geometry,width=p.bodyProfile?(p.direction==='down'&&part.item&&!part.referenceBox?g.equippedDownLegWidth:g.legWidth)*(side?.92:1):b.limb*(side?1.65:p.direction==='up'?2.2:2.65);return limbMesh(p.limbs[n].leg,width*s,part.pins);}
    if(/^pants\.pocket[LR]$/.test(key)){
      const n=key.at(-1),leg=p.limbs[n].leg,screen=(n==='L'?1:-1)*(p.direction==='up'?-1:1),angle=Math.atan2(leg.joint.y-leg.root.y,leg.joint.x-leg.root.x)-Math.PI/2,w=b.limb*s;
      const offset=rotate(point(screen*b.limb*.25,b.leg*.14),angle);return quad(leg.root.x+offset.x,leg.root.y+offset.y,w,w*aspect,angle,part.anchor||[screen>0?.2:.8,.05]);
    }
    if(key==='pants.pelvis'){const w=(p.bodyProfile?Math.max(b.waist,b.hips*1.35):b.hips*1.35)*p.viewWidth*s;return quad(p.hip.x,p.hip.y-13,w,Math.min(62,w*aspect),0,part.anchor||[.5,.25]);}
    if(key==='shirt.torso'||key==='jacket.torso'){
      const jacket=key.startsWith('jacket'),w=b.shoulders*(p.bodyProfile?(jacket?1.15:1.02):(jacket?1.38:1.18))*p.viewWidth*s,top=p.bodyProfile?p.bodyProfile.geometry.shirtTop+p.bob:p.neck.y+4;
      if(p.bodyProfile){const g=p.bodyProfile.geometry;let bottom=jacket?g.jacketHem:g.shirtHem;if(jacket&&part.garmentLength==='knee')bottom=p.bodyProfile.landmarks.knee;if(jacket&&part.garmentLength==='calf')bottom=g.calf;if(jacket&&part.garmentLength==='full')bottom=g.fullHem;return clothMesh(p,w,bottom+p.bob-top,top,jacket?'jacket':'shirt',part);}
      let h=clamp(w*aspect,(p.hip.y-p.chest.y)*1.05,(p.hip.y-p.chest.y)*(jacket?1.8:1.4));
      if(jacket&&part.garmentLength==='knee')h=SPACE.foot-b.leg*.52-top;
      if(jacket&&part.garmentLength==='calf')h=SPACE.foot-b.leg*.27-top;
      if(jacket&&part.garmentLength==='full')h=SPACE.foot-15-top;
      return clothMesh(p,w,h,p.neck.y+4,jacket?'jacket':'shirt',part);
    }
    if(key==='cape.front'||key==='cape.back'){
      const long=part.garmentLength==='calf'||part.garmentLength==='full',target=part.garmentLength==='full'?SPACE.foot-17-p.neck.y:SPACE.foot-b.leg*.28-p.neck.y;
      const w=long?Math.min(target/aspect,b.shoulders*2.65)*p.viewWidth*s:b.shoulders*(key.endsWith('front')?1.28:1.42)*p.viewWidth*s,h=long?target*s:clamp(w*aspect,35,b.height*.57);
      return clothMesh(p,w,h,p.neck.y+5,'cape');
    }
    if(key.startsWith('shoes.')){const n=key.at(-1),leg=p.limbs[n].leg,w=shoeWidth(p,part);return quad(leg.tip.x,leg.tip.y-2,w,w*aspect,p.limbs[n].footAngle,part.anchor||[.5,.45]);}
    if(key.startsWith('hand.')){const n=key.at(-1),arm=p.limbs[n].arm,w=(p.bodyProfile&&part.displayWidth?part.displayWidth:17)*s,angle=Math.atan2(arm.tip.y-arm.joint.y,arm.tip.x-arm.joint.x)-Math.PI/2;return quad(arm.tip.x,arm.tip.y,w,w*aspect,angle,part.anchor||[.5,.12]);}
    if(key==='handheld'){
      const hand=part.hand==='R'?'R':'L',arm=p.limbs[hand].arm,w=31*s,angle=Math.atan2(arm.tip.y-arm.joint.y,arm.tip.x-arm.joint.x)-Math.PI/2;
      return quad(arm.tip.x,arm.tip.y-5,w,w*aspect,angle*.65,part.anchor||[.35,.16]);
    }
    if(key==='head'||key==='head.neck'){
      const w=b.head*(p.bodyProfile?(side?.96:1):(part.widthScale||1))*s,h=w*aspect;return quad(p.neck.x,p.neck.y+(p.bodyProfile?0:14),w,h,p.headAngle,part.anchor||[.5,.88]);
    }
    if(key==='hat'){
      const head=p.headPart,w=b.head*(p.bodyProfile?1.16:1.28)*s,headWidth=b.head*(p.bodyProfile?(side?.96:1):(head?.widthScale||1))*(head?.scale||1),headHeight=head?headWidth*head.rect[3]/head.rect[2]:b.head,anchor=head?.anchor||[.5,.88];
      // Hat bands follow the skull/face rather than the bounding box of long or
      // curly hair. A measured pin can refine an authored side-view head.
      const x=p.neck.x+(head?.hatPin?(head.hatPin[0]-anchor[0])*headWidth:0),y=p.neck.y+(p.bodyProfile?0:14)+(head?.hatPin?(head.hatPin[1]-anchor[1])*headHeight:-b.head);
      return quad(x,y,w,w*aspect,p.headAngle,part.anchor||[.5,.65]);
    }
    if(key==='accessory'){
      const anatomical=part.side==='R'?-1:1,visible=!(p.direction==='up'&&part.backVisible!==true&&p.onlySlot!=='accessory');if(!visible)return null;
      const x=160+(side?(p.direction==='right'?-1:1)*8:anatomical*b.shoulders*.24),w=18*s;return quad(x,p.neck.y+37,w,w*aspect,0,part.anchor||[.5,.5]);
    }
    return null;
  }
  function layers(p,parts){
    const near=p.near,far=near==='L'?'R':'L',arm=n=>['shirt.arm'+n,'jacket.arm'+n,'handheld','hand.'+n],leg=n=>['pants.leg'+n,'pants.pocket'+n,'shoes.'+n];
    // The book belongs to an anatomical hand, not the side of the screen. Keep
    // the far hand behind the torso and the near hand in front in each view.
    const held=parts.handheld?.hand==='R'?'R':'L',armLayer=n=>arm(n).filter(key=>key!=='handheld'||held===n);
    const list=['cape.back',...leg(far),...armLayer(far),'pants.pelvis',...leg(near),'head.neck','shirt.torso','jacket.torso',...armLayer(near),'cape.front','accessory','head','hat'];
    if(p.direction==='up'){const i=list.indexOf('cape.back');list.splice(i,1);list.splice(list.indexOf('head'),0,'cape.back');}
    return list.filter((key,i)=>parts[key]&&list.indexOf(key)===i);
  }
  function fitFeet(p,parts){
    const limbs={...p.limbs};
    for(const n of ['L','R']){
      const part=parts['shoes.'+n];if(!part||p.bodyProfile&&part.referenceBox&&p.action==='idle')continue;const w=shoeWidth(p,part),h=w*part.rect[3]/part.rect[2],anchor=part.anchor||[.5,.45],sole=part.solePin||[.5,1];
      const offset=rotate(point((sole[0]-anchor[0])*w,(sole[1]-anchor[1])*h),p.limbs[n].footAngle),delta=22-offset.y,old=p.limbs[n].leg;
      // Calibrate the shin to the authored ankle/sole pair. The ankle marker in
      // the artwork stays fixed; a tall boot is not moved down off its leg just
      // to make its sole touch the ground.
      limbs[n]={...p.limbs[n],leg:{...old,joint:point(old.joint.x,old.joint.y+delta*.5),tip:point(old.tip.x,old.tip.y+delta)}};
    }
    return {...p,limbs};
  }
  function expandTriangle(points,pad){
    const [a,b,c]=points,sign=Math.sign((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))||1;
    return points.map((p,i)=>{const prev=points[(i+2)%3],next=points[(i+1)%3],e1=sub(p,prev),e2=sub(next,p),n1=point(sign*e1.y/length(e1),-sign*e1.x/length(e1)),n2=point(sign*e2.y/length(e2),-sign*e2.x/length(e2)),factor=Math.min(8*pad,pad/Math.max(.001,1+n1.x*n2.x+n1.y*n2.y));return point(p.x+(n1.x+n2.x)*factor,p.y+(n1.y+n2.y)*factor);});
  }
  function* drawPartSteps(ctx,part,source,mesh){
    if(!mesh)return;const [x,y,w,h]=part.rect,sx=source.scaleX||source.scale||1,sy=source.scaleY||source.scale||1,ox=source.x||0,oy=source.y||0;
    const px=u=>(x+u*w-ox)*sx,py=v=>(y+v*h-oy)*sy;
    let maskPath=null,polygons=null;
    if(part.mask){
      polygons=typeof part.mask[0]?.[0]==='number'?[part.mask]:part.mask;
      const Path=source.Path2D||root.Path2D;
      if(Path){const key=[...part.rect,sx,sy,ox,oy].join(',');let paths=maskPaths.get(part.mask);if(!paths){paths=new Map();maskPaths.set(part.mask,paths);}maskPath=paths.get(key);if(!maskPath){maskPath=new Path();for(const polygon of polygons){polygon.forEach(([u,v],i)=>maskPath[i?'lineTo':'moveTo'](px(u),py(v)));maskPath.closePath();}paths.set(key,maskPath);}}
    }
    const transform=ctx.getTransform?.(),pixel=transform?1/Math.max(.08,Math.min(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d))):1;
    for(const indices of mesh.triangles){
      const dst=indices.map(i=>mesh.vertices[i]),src=dst.map(v=>point(px(v.u),py(v.v))),m=triangleTransform(src,dst);if(!m)continue;
      const clip=expandTriangle(dst,pixel);
      ctx.save();try{
        ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);ctx.lineTo(clip[1].x,clip[1].y);ctx.lineTo(clip[2].x,clip[2].y);ctx.closePath();ctx.clip();ctx.transform(...m);
        ctx.beginPath();ctx.rect(px(0),py(0),w*sx,h*sy);ctx.clip();
        if(maskPath)ctx.clip(maskPath);else if(polygons){ctx.beginPath();for(const polygon of polygons){polygon.forEach(([u,v],i)=>ctx[i?'lineTo':'moveTo'](px(u),py(v)));ctx.closePath();}ctx.clip();}
        if(part.cutouts){const cutouts=typeof part.cutouts[0]?.[0]==='number'?[part.cutouts]:part.cutouts;ctx.beginPath();ctx.rect(px(0),py(0),w*sx,h*sy);for(const poly of cutouts){poly.forEach(([u,v],i)=>ctx[i?'lineTo':'moveTo'](px(u),py(v)));ctx.closePath();}ctx.clip('evenodd');}
        ctx.drawImage(source.image,0,0);
      }finally{ctx.restore();}
      yield;
    }
  }
  function* drawSteps(ctx,prepared,p,width,height,options={}){
    if(options.bodyProfile&&p.bodyProfile?.id!==options.bodyProfile)p=pose(p.character,p.direction,p.phase,p.action,options);
    p={...fitFeet(p,prepared.plan.parts),headPart:prepared.plan.parts.head,onlySlot:prepared.plan.onlySlot};ctx.save();try{ctx.clearRect(0,0,width,height);const list=layers(p,prepared.plan.parts).map(key=>[key,partMesh(key,prepared.plan.parts[key],p)]).filter(([,mesh])=>mesh);if(!list.length)return;
    if(prepared.plan.onlySlot){
      const vertices=list.flatMap(([,mesh])=>mesh.vertices),xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y),left=Math.min(...xs)-7,top=Math.min(...ys)-7,w=Math.max(...xs)-left+7,h=Math.max(...ys)-top+7,s=Math.min(width/w,height/h)*.88;
      ctx.translate((width-w*s)/2,(height-h*s)/2);ctx.scale(s,s);ctx.translate(-left,-top);
    }else ctx.scale(width/SPACE.width,height/SPACE.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';for(const [key,mesh] of list)yield* drawPartSteps(ctx,prepared.plan.parts[key],prepared.sources[prepared.plan.parts[key].atlas],mesh);
    }finally{ctx.restore();}
  }
  function draw(ctx,prepared,p,width,height,options={}){for(const unused of drawSteps(ctx,prepared,p,width,height,options)){} }
  function sourceRegion(parts,atlas){
    const left=Math.min(...parts.map(p=>p.rect[0])),top=Math.min(...parts.map(p=>p.rect[1])),right=Math.max(...parts.map(p=>p.rect[0]+p.rect[2])),bottom=Math.max(...parts.map(p=>p.rect[1]+p.rect[3]));
    // A two-source-pixel guard preserves filtering at the measured UV borders.
    const x=Math.max(0,Math.floor((left-2)/2)*2),y=Math.max(0,Math.floor((top-2)/2)*2);return {x,y,width:Math.min(atlas.width,Math.ceil((right+2)/2)*2)-x,height:Math.min(atlas.height,Math.ceil((bottom+2)/2)*2)-y};
  }
  function createCache(limit,dispose=()=>{}){
    const entries=new Map();let bytes=0,serial=0;
    function evict(required=0){for(const [key,e] of [...entries].filter(([,e])=>e.refs===0&&e.value).sort((a,b)=>a[1].used-b[1].used)){if(bytes+required<=limit)break;entries.delete(key);bytes-=e.bytes;dispose(e.value);}}
    function trim(){evict();}
    async function acquire(key,cost,produce,{signal}={}){
      if(signal?.aborted)throw aborted();
      if(!Number.isSafeInteger(cost)||cost<=0||cost>limit)throw Error('服裝快取尺寸超出限制。');
      let e=entries.get(key);
      if(!e){evict(cost);if(bytes+cost>limit)throw Error('服裝圖像忙碌中，稍後再試。');e={refs:0,bytes:cost,used:++serial,value:null,promise:null};entries.set(key,e);bytes+=cost;
        e.promise=Promise.resolve().then(()=>produce(()=>e.refs>0)).then(value=>{if(e.retired){dispose(value);throw aborted();}e.value=value;if(e.refs===0)trim();return value;},error=>{if(entries.get(key)===e){entries.delete(key);bytes-=cost;}throw error;});
      }
      e.refs++;e.used=++serial;let released=false;const release=()=>{if(released)return;released=true;e.refs=Math.max(0,e.refs-1);e.used=++serial;if(!e.refs&&!e.value&&entries.get(key)===e){e.retired=true;entries.delete(key);bytes-=e.bytes;}trim();};
      let onAbort;
      try{
        const value=signal?await Promise.race([e.promise,new Promise((resolve,reject)=>{onAbort=()=>{release();reject(aborted());};signal.addEventListener('abort',onAbort,{once:true});})]):await e.promise;
        if(signal?.aborted){release();throw aborted();}return {value,release};
      }catch(error){release();throw error;}finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
    }
    return {acquire,stats:()=>({bytes,limit,entries:entries.size,pinned:[...entries.values()].filter(e=>e.refs>0).length}),clear(){for(const [key,e] of entries)if(!e.refs&&e.value){entries.delete(key);bytes-=e.bytes;dispose(e.value);}}};
  }
  function createRuntime(env={}){
    const E={document:root.document,Image:root.Image,URL:root.URL,Path2D:root.Path2D,locationProtocol:root.location?.protocol||'',now:root.performance?.now?.bind(root.performance)||Date.now,MindAcademy:root.MindAcademy,MindAdventure:root.MindAdventure,MindEngine:root.MindEngine,MindRasterArt:root.MindRasterArt};
    // Browser host methods require their Window receiver. Copying a method into
    // a plain environment object and calling it there can throw Illegal invocation.
    for(const name of ['fetch','createImageBitmap','requestAnimationFrame','cancelAnimationFrame','matchMedia','requestIdleCallback','setTimeout'])if(typeof root[name]==='function')E[name]=root[name].bind(root);
    Object.assign(E,env);const manifest=()=>typeof E.manifest==='function'?E.manifest():E.MindRasterArt||root.MindRasterArt;
    const makeCanvas=(w,h)=>{const c=E.createCanvas?E.createCanvas(w,h):E.document.createElement('canvas');c.width=w;c.height=h;return c;};
    const sourceCache=createCache(SOURCE_BYTES,value=>value.image.close?.()),frameCache=createCache(SCENE_BYTES,value=>{if(value.objectURL)E.URL.revokeObjectURL(value.url);if(value.canvas){value.canvas.width=1;value.canvas.height=1;}});
    const previews=new WeakMap();let jobs=Promise.resolve();
    function queue(job){const next=jobs.catch(()=>{}).then(job);jobs=next.catch(()=>{});return next;}
    async function yieldTask(){if(E.yieldTask)return E.yieldTask();if(E.setTimeout)return new Promise(resolve=>E.setTimeout(resolve,0));}
    async function drawBudgeted(ctx,prepared,p,width,height,alive,budget){
      for(const unused of drawSteps(ctx,prepared,p,width,height)){
        if(!alive())throw aborted();
        // This is a cooperative budget: a single Canvas operation cannot be
        // preempted, but no second triangle starts after an expired 5ms slice.
        if(E.now()-budget.started>=5){await yieldTask();budget.started=E.now();if(!alive())throw aborted();}
      }
    }
    async function bitmap(atlas,tier,region,profileId=null){
      const scale=tier==='scene'?.5:1,w=Math.max(1,Math.round(region.width*scale)),h=Math.max(1,Math.round(region.height*scale)),mapping={x:region.x,y:region.y,scaleX:w/region.width,scaleY:h/region.height};
      if(E.loadImage)return {image:await E.loadImage(atlas.src,w,h,{...region,sourceWidth:atlas.width,sourceHeight:atlas.height}),...mapping};
      if(typeof atlas.src!=='string'||!(/^\.\/assets\/avatar-raster\/[a-z0-9-]+\.webp$/.test(atlas.src)||tier==='preview'&&profileId===GRADUATE_REFERENCE.id&&PROFILE_SOURCE_PATHS.has(atlas.src)))throw Error('服裝素材必須使用已登錄的本機路徑。');
      if(E.locationProtocol!=='file:'&&E.fetch&&E.createImageBitmap){const response=await E.fetch(atlas.src,{credentials:'same-origin'});if(!response.ok)throw Error('服裝圖像載入失敗。');const blob=await response.blob(),original=await E.createImageBitmap(blob);if(original.width!==atlas.width||original.height!==atlas.height){original.close();throw Error('服裝圖像尺寸與清單不一致。');}try{return {image:await E.createImageBitmap(original,region.x,region.y,region.width,region.height,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'}),...mapping};}finally{original.close();}}
      const image=await new Promise((resolve,reject)=>{const img=new E.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('服裝圖像載入失敗。'));img.src=atlas.src;});
      if((image.naturalWidth||image.width)!==atlas.width||(image.naturalHeight||image.height)!==atlas.height)throw Error('服裝圖像尺寸與清單不一致。');
      const c=makeCanvas(w,h);c.getContext('2d').drawImage(image,region.x,region.y,region.width,region.height,0,0,w,h);return {image:c,...mapping};
    }
    async function prepare(state,view,tier='scene',onlySlot=null,alive=()=>true,options={}){
      const base=manifest(),profile=tier==='preview'?previewBodyProfile(state?.appearance?.character,options):null,data=profile?{...base,atlases:{...base.atlases,...profile.atlases}}:base,p=plan(state,view,data,E,onlySlot,profile?options:{}),ids=[...new Set(Object.values(p.parts).map(part=>part.atlas))],handles=[];
      try{
        // Decode one texture at a time. All records refer to explicit measured
        // source rectangles; no runtime assumption about an imagegen grid.
        for(const id of ids){if(!alive())throw aborted();const atlas=data.atlases[id],region=sourceRegion(Object.values(p.parts).filter(part=>part.atlas===id),atlas),scale=tier==='scene'?.5:1,cost=Math.round(region.width*scale)*Math.round(region.height*scale)*4;handles.push([id,await sourceCache.acquire(JSON.stringify([data.revision||1,id,tier,...(profile?[profile.id]:[]),...Object.values(region)]),cost,()=>bitmap(atlas,tier,region,profile?.id))]);}if(!alive())throw aborted();
        return {plan:p,sources:Object.fromEntries(handles.map(([id,h])=>[id,{...h.value,Path2D:E.Path2D}])),release(){for(const [,handle] of handles)handle.release();}};
      }catch(error){for(const [,handle] of handles)handle.release();throw error;}
    }
    async function acquire(state,view='down',options={}){
      const p=plan(state,view,manifest(),E),cost=FRAME.width*FRAME.height*FRAME.count*4;
      return frameCache.acquire(p.key,cost,alive=>queue(async()=>{
        if(!alive())throw aborted();
        const prepared=await prepare(state,view,'scene',null,alive),canvas=makeCanvas(FRAME.width*FRAME.columns,FRAME.height*Math.ceil(FRAME.count/FRAME.columns)),ctx=canvas.getContext('2d');
        try{
          if(!alive())throw aborted();const budget={started:E.now()};
          for(let i=0;i<FRAME.count;i++){
            const x=i%FRAME.columns*FRAME.width,y=Math.floor(i/FRAME.columns)*FRAME.height,[action,phase]=POSES[i];ctx.save();try{ctx.beginPath();ctx.rect(x,y,FRAME.width,FRAME.height);ctx.clip();ctx.translate(x,y);await drawBudgeted(ctx,prepared,pose(p.character,p.direction,phase,action),FRAME.width,FRAME.height,alive,budget);}finally{ctx.restore();}
          }
          if(!alive())throw aborted();
          // The actor copies one cell from this shared canvas. No blob URL, CSP
          // broadening, per-actor bake, or per-actor animation clock is needed.
          return {...(E.canvasURL?await E.canvasURL(canvas):{}),canvas,...FRAME,direction:p.direction,key:p.key};
        }catch(error){canvas.width=1;canvas.height=1;throw error;}finally{prepared.release();}
      }),options);
    }
    function status(canvas,value,message=''){canvas.dataset.renderStatus=value;canvas.setAttribute?.('aria-label',message||'角色實際穿戴圖');}
    function stopPreview(record){if(record.frame)E.cancelAnimationFrame?.(record.frame);record.frame=0;}
    function dispose(canvas){const record=previews.get(canvas);if(!record)return;record.dead=true;record.epoch++;stopPreview(record);record.dialog?.removeEventListener?.('close',record.onDialogClose);record.dialog=null;record.prepared?.release();record.prepared=null;previews.delete(canvas);}
    function paintPreview(canvas,record,phase=0){
      if(!record.prepared)return;const p=pose(record.prepared.plan.character,record.prepared.plan.direction,phase,record.animate?'run':'idle',{bodyProfile:record.bodyProfile});draw(canvas.getContext('2d'),record.prepared,p,canvas.width,canvas.height);
    }
    function animatePreview(canvas,record){
      stopPreview(record);if(!record.animate||record.dead||!record.prepared)return;
      const tick=time=>{
        if(record.dead)return;if(canvas.isConnected)record.attached=true;else if(record.attached){dispose(canvas);return;}
        if(!record.attached){if(++record.attachWait>3){dispose(canvas);return;}record.frame=E.requestAnimationFrame(tick);return;}
        const dialog=canvas.closest?.('dialog');if(dialog?.open===false){dispose(canvas);return;}
        if(dialog&&record.dialog!==dialog){record.dialog?.removeEventListener?.('close',record.onDialogClose);record.dialog=dialog;record.onDialogClose=()=>dispose(canvas);dialog.addEventListener?.('close',record.onDialogClose);}
        if(!E.document?.hidden&&time-(record.lastDraw||0)>=1000/30){if(!record.started)record.started=time;paintPreview(canvas,record,(time-record.started)/650);record.lastDraw=time;}
        record.frame=E.requestAnimationFrame(tick);
      };
      record.frame=E.requestAnimationFrame(tick);
    }
    function setPose(canvas,options={}){
      const r=previews.get(canvas);if(!r||r.dead)return Promise.reject(Error('預覽已關閉。'));
      const d=direction(options.direction||r.direction),requested=Object.prototype.hasOwnProperty.call(options,'bodyProfile')?options.bodyProfile:r.bodyProfile,profile=previewBodyProfile(r.state?.appearance?.character,{bodyProfile:requested}),bodyProfile=profile?.id||null,changed=d!==r.direction||bodyProfile!==r.bodyProfile;r.direction=d;r.bodyProfile=bodyProfile;
      if(bodyProfile){canvas.dataset.bodyProfile=bodyProfile;canvas.dataset.renderMethod='authored-parts-skeletal';}else{delete canvas.dataset.bodyProfile;delete canvas.dataset.renderMethod;}if(typeof options.animate==='boolean')r.animate=options.animate&&!E.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(!changed&&r.prepared?.plan.direction===d){paintPreview(canvas,r);animatePreview(canvas,r);if(!r.animate){r.prepared.release();r.prepared=null;}r.promise=Promise.resolve(canvas);return r.promise;}
      const epoch=++r.epoch;stopPreview(r);status(canvas,'loading','正在載入實際服裝');
      r.promise=queue(()=>prepare(r.state,d,'preview',r.onlySlot,()=>!r.dead&&r.epoch===epoch,{bodyProfile})).then(prepared=>{
        if(r.dead||r.epoch!==epoch){prepared.release();return canvas;}r.prepared?.release();r.prepared=prepared;paintPreview(canvas,r);status(canvas,'ready');animatePreview(canvas,r);if(!r.animate){prepared.release();r.prepared=null;}return canvas;
      }).catch(error=>{if(!r.dead&&r.epoch===epoch){status(canvas,'error',error.message);r.error=error;}return canvas;});
      return r.promise;
    }
    function preview(state,options={}){
      const canvas=makeCanvas(options.width||320,options.height||544);canvas.className='outfit-preview raster-outfit-preview';canvas.setAttribute?.('role','img');if(!canvas.dataset)canvas.dataset={};
      const r={state:JSON.parse(JSON.stringify({appearance:state?.appearance,rpg:{loadout:state?.rpg?.loadout||{}}})),direction:direction(options.direction),animate:!!options.animate,onlySlot:options.onlySlot||null,epoch:0,dead:false,attached:false,attachWait:0,frame:0,prepared:null};previews.set(canvas,r);setPose(canvas,options);return canvas;
    }
    function itemPreview(state,id,options={}){
      const item=E.MindAdventure?.gear(id),knowledge=E.MindEngine?.ITEMS?.find(item=>item.id===id),slot=item?.slot||(knowledge?'handheld':null);if(!slot)throw Error('找不到這件裝配。');
      const copy={appearance:state?.appearance,rpg:{loadout:{[slot]:id}}};return preview(copy,{...options,onlySlot:slot,animate:false});
    }
    return {preview,itemPreview,setPose,ready:canvas=>previews.get(canvas)?.promise||Promise.resolve(canvas),dispose,acquire,prepare,describe:(state,options={})=>plan(state,options.direction||'down',manifest(),E,options.onlySlot||null,options),stats:()=>({frames:frameCache.stats(),sources:sourceCache.stats()}),clearUnused(){frameCache.clear();sourceCache.clear();},draw};
  }
  return {...createRuntime(),createRuntime,DIRECTIONS,SLOTS,PARTS,SPACE,FRAME,POSES,SCENE_BYTES,SOURCE_BYTES,direction,body,previewBodyProfile,pose,stride,ik,limbMesh,quad,clothMesh,triangleTransform,partMesh,layers,fitFeet,drawSteps,plan,checkedPart,appearance,createCache,sourceRegion};
});
