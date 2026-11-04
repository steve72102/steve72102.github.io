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
  // Opt-in calibration from the user's standing reference. Generic acquire and
  // world bodies keep original profiles; explicit acquireGraduateDown is the exception. The JSON
  // beside reference.png records the same source rectangles and measurements.
  const GRADUATE_REFERENCE={"id":"graduate-reference-v1","character":"graduate","referenceScale":0.5070422535211268,"landmarks":{"top":58.0,"chin":135.5774647887324,"neck":155.35211267605632,"shoulder":158.3943661971831,"waist":260.30985915492954,"hip":282.11267605633805,"knee":363.23943661971833,"sole":490},"body":{"height":432,"shoulders":106.47887323943662,"waist":73.01408450704226,"hips":48.399487836107554,"head":86.70422535211267,"leg":187.88732394366195,"arm":120.67605633802816,"limb":27.887323943661972,"fit":"regular"},"geometry":{"legWidth":46.140845070422536,"shoeWidth":58.309859154929576,"shoulderHalfWidth":53.23943661971831,"wristX":{"L":53.74647887323943,"R":-51.71830985915493},"kneeHalfWidth":27.887323943661972,"ankleHalfWidth":34.478873239436616,"shirtTop":148.25352112676057,"shirtHem":266.90140845070425,"jacketHem":292.2535211267606,"calf":431.6901408450704,"fullHem":479.85915492957747,"equippedDownLegWidth":64},"atlases":{"graduate-reference-v1":{"src":"./assets/avatar-raster/graduate-reference-v1/reference.png","width":1774,"height":887},"graduate-reference-left-body":{"src":"./assets/painted-avatar/graduate-left-v1/left-actions-0-body-front.webp","width":256,"height":384},"graduate-reference-right-body":{"src":"./assets/painted-avatar/graduate-right-v1/right-actions-0-body-front.webp","width":256,"height":384}},"parts":{"down":{"head":{"atlas":"graduate-reference-v1","rect":[237,16,171,205],"mask":[[[0.0,0.0],[1.0,0.0],[1.0,0.8097561],[0.66081871,0.8097561],[0.63157895,0.86341463],[0.56725146,0.90243902],[0.52631579,0.97073171],[0.48538012,0.99512195],[0.44444444,0.92682927],[0.3625731,0.87317073],[0.32163743,0.8097561],[0.0,0.8097561]]],"neckMask":[[[0.35672515,0.76585366],[0.61403509,0.76585366],[0.64327485,0.83414634],[0.57309942,0.89268293],[0.52631579,0.97073171],[0.48538012,0.99512195],[0.44444444,0.92682927],[0.3625731,0.87317073],[0.32748538,0.81463415]]],"anchor":[0.4853801169590643,0.9463414634146341],"hatPin":[0.4853801169590643,0.2682926829268293]},"hands":{"L":{"atlas":"graduate-reference-v1","rect":[400,442,49,94],"anchor":[0.5306122448979592,0.1276595744680851],"displayWidth":24.845070422535212},"R":{"atlas":"graduate-reference-v1","rect":[194,442,44,93],"anchor":[0.5454545454545454,0.12903225806451613],"displayWidth":22.309859154929576}},"defaults":{"shirt.torso":{"atlas":"graduate-reference-v1","rect":[235,182,173,246],"referenceBox":[235,182,173,246],"displayWidth":87.71830985915493,"mask":[[[0.2716763,0.0],[0.69942197,0.0],[0.94219653,0.09349593],[1.0,0.2804878],[1.0,0.68292683],[0.97687861,0.93089431],[0.90751445,1.0],[0.06358382,1.0],[0.0,0.89837398],[0.0,0.68292683],[0.0,0.29674797],[0.06936416,0.12601626]]]},"shirt.armR":{"atlas":"graduate-reference-v1","rect":[183,202,75,184],"referenceBox":[183,202,75,184],"displayWidth":38.028169014084504,"mask":[[[0.61333333,0.0],[0.89333333,0.05978261],[1.0,0.23913043],[0.84,0.5],[0.77333333,0.75543478],[0.69333333,0.91847826],[0.54666667,1.0],[0.09333333,0.95652174],[0.0,0.85326087],[0.13333333,0.61956522],[0.25333333,0.35326087],[0.37333333,0.15217391]]],"sleeveEndRatio":0.6638655462184874,"pins":{"root":[0.5,0.07608695652173914],"joint":[0.5,0.7228260869565217],"tip":[0.5,0.9347826086956522]}},"shirt.armL":{"atlas":"graduate-reference-v1","rect":[393,202,64,184],"referenceBox":[393,202,64,184],"displayWidth":32.45070422535211,"mask":[[[0.21875,0.0],[0.546875,0.05978261],[0.75,0.22826087],[0.84375,0.50543478],[1.0,0.85326087],[0.890625,0.95652174],[0.359375,1.0],[0.203125,0.89673913],[0.125,0.71195652],[0.0,0.5],[0.0,0.2173913]]],"sleeveEndRatio":0.6638655462184874,"pins":{"root":[0.5,0.07608695652173914],"joint":[0.5,0.7228260869565217],"tip":[0.5,0.9347826086956522]}},"pants.pelvis":{"atlas":"graduate-reference-v1","rect":[224,415,190,49],"referenceBox":[224,415,190,49],"displayWidth":96.33802816901408,"mask":[[[0.08947368,0.0],[0.92631579,0.0],[0.95263158,1.0],[0.05789474,1.0]]]},"pants.legR":{"atlas":"graduate-reference-v1","rect":[204,463,116,342],"referenceBox":[204,463,116,342],"displayWidth":58.816901408450704,"mask":[[[0.26724138,0.0],[1.0,0.0],[1.0,0.11111111],[0.86206897,0.28947368],[0.80172414,0.4619883],[0.74137931,0.72222222],[0.69827586,0.89766082],[0.5862069,1.0],[0.12931034,1.0],[0.0,0.92397661],[0.02586207,0.80701754],[0.09482759,0.5877193],[0.12931034,0.37134503],[0.1637931,0.16666667]]],"pins":{"root":[0.5,0.02],"joint":[0.5,0.4590643274853801],"tip":[0.5,0.9678362573099415]}},"pants.legL":{"atlas":"graduate-reference-v1","rect":[320,463,116,342],"referenceBox":[320,463,116,342],"displayWidth":58.816901408450704,"mask":[[[0.0,0.0],[0.73275862,0.0],[0.78448276,0.16666667],[0.81034483,0.38304094],[0.85344828,0.58187135],[0.92241379,0.80994152],[1.0,0.92690058],[0.79310345,1.0],[0.30172414,1.0],[0.18965517,0.9005848],[0.15517241,0.72222222],[0.12068966,0.46491228],[0.07758621,0.28070175],[0.0,0.11111111]]],"pins":{"root":[0.5,0.02],"joint":[0.5,0.4590643274853801],"tip":[0.5,0.9678362573099415]}},"pants.pocketL":{"hidden":true},"pants.pocketR":{"hidden":true},"shoes.R":{"atlas":"graduate-reference-v1","rect":[177,789,121,84],"referenceBox":[177,789,121,84],"displayWidth":61.352112676056336},"shoes.L":{"atlas":"graduate-reference-v1","rect":[341,789,123,84],"referenceBox":[341,789,123,84],"displayWidth":62.36619718309859}},"bareHands":{"R":{"atlas":"graduate-reference-v1","rect":[193,369,45,166],"referenceBox":[193,369,45,166],"displayWidth":22.816901408450704,"anchor":[0.5555555555555556,0.5120481927710844]},"L":{"atlas":"graduate-reference-v1","rect":[401,369,48,166],"referenceBox":[401,369,48,166],"displayWidth":24.338028169014084,"anchor":[0.5208333333333334,0.5120481927710844]}},"runHands":{"R":{"atlas":"graduate-reference-v1","rect":[855,276,69,64],"mask":[[[0.391304347826087,0.046875],[0.4782608695652174,0.03125],[0.5797101449275363,0.078125],[0.7536231884057971,0.125],[0.8695652173913043,0.171875],[0.927536231884058,0.28125],[0.9130434782608695,0.359375],[0.9565217391304348,0.421875],[0.927536231884058,0.5625],[0.8695652173913043,0.640625],[0.8405797101449275,0.75],[0.7391304347826086,0.828125],[0.6086956521739131,0.859375],[0.4927536231884058,0.828125],[0.36231884057971014,0.90625],[0.18840579710144928,0.953125],[0.0,0.90625],[0.0,0.625],[0.17391304347826086,0.484375],[0.2898550724637681,0.3125],[0.36231884057971014,0.171875]]],"anchor":[0.14492753623188406,0.796875],"displayWidth":27.6,"sourceArmAngle":-1.8657333856437035},"L":{"atlas":"graduate-reference-v1","rect":[1471,232,58,64],"mask":[[[0.20689655172413793,0.03125],[0.5689655172413793,0.03125],[0.6724137931034483,0.09375],[0.7413793103448276,0.28125],[0.8103448275862069,0.453125],[0.9655172413793104,0.609375],[0.9655172413793104,0.96875],[0.7241379310344828,0.921875],[0.5689655172413793,0.828125],[0.43103448275862066,0.71875],[0.27586206896551724,0.734375],[0.13793103448275862,0.6875],[0.06896551724137931,0.59375],[0.06896551724137931,0.484375],[0.034482758620689655,0.40625],[0.034482758620689655,0.328125],[0.0,0.265625],[0.05172413793103448,0.171875],[0.15517241379310345,0.125]]],"anchor":[0.8103448275862069,0.84375],"displayWidth":23.2,"sourceArmAngle":-3.989409626983199}},"runForearms":{"R":{"atlas":"graduate-reference-v1","rect":[193,369,45,96],"displayWidth":22.816901408450704,"anchor":[0.5555555555555556,0.8854166666666666]},"L":{"atlas":"graduate-reference-v1","rect":[401,369,48,96],"displayWidth":24.338028169014084,"anchor":[0.5208333333333334,0.8854166666666666]}}},"left":{"hands":{"L":{"atlas":"graduate-reference-left-body","rect":[89,191,20,27],"anchor":[0.78,0.84],"displayWidth":19},"R":{"atlas":"graduate-reference-left-body","rect":[100,208,17,16],"anchor":[0.88,0.35],"displayWidth":18}}},"right":{"hands":{"L":{"atlas":"graduate-reference-right-body","rect":[161,190,16,19],"anchor":[0.4,0.84],"displayWidth":17},"R":{"atlas":"graduate-reference-right-body","rect":[133,202,47,19],"anchor":[0.1,0.5],"displayWidth":36}}},"up":{"hands":{"L":{"hidden":true},"R":{"hidden":true}},"handheldHidden":true,"reason":"Own sealed up actions0 has no visible hand pixels; both hands and held book are naturally occluded by the torso.","equipmentCutouts":{"fruit-pineapple-jacket":{"jacket.torso":[[[0.0,0.433789954],[0.061728395,0.493150685],[0.160493827,0.529680365],[0.25308642,0.575342466],[0.148148148,0.621004566],[0.117283951,0.689497717],[0.0,0.689497717]],[[1.0,0.433789954],[0.944444444,0.493150685],[0.858024691,0.529680365],[0.783950617,0.575342466],[0.87037037,0.621004566],[0.913580247,0.689497717],[1.0,0.689497717]]]}}}},"directionFits":{"left":{"head":{"neckStartV":0.8084507042253521,"neckScale":0.55}},"up":{"arms":{"elbowHalfWidth":66,"wristHalfWidth":28,"elbowDrop":58,"wristDrop":75,"behindTorso":true,"shoulderInset":0,"occlusionOrder":"shirt sleeves < shirt torso < jacket sleeves < jacket torso < cape"}}},"enabledUiDirections":["down","left","up"],"downRun8":{"id":"graduate-down-run8-v1","method":"Own native parts with fixed 3D bone lengths and orthographic frontal projection; not eight newly painted frames.","frames":8,"phaseOffset":{"L":0,"R":0.5},"upperLeg":81.3941056007,"lowerLeg":106.9638559908,"upperArm":60.33802816901408,"lowerArm":60.33802816901408,"footY":[470,470,470,410,405,420,428,454],"footZ":[28,0,-28,-62,-55,-22,12,38],"footHalfX":[34.4788732394,34.4788732394,34.4788732394,42,36,24,18,24],"bodyBob":[8,12,6,-6,8,12,6,-6],"stanceEnd":0.25,"flightFrames":[3,7],"referenceSleeveForearmEnd":0.3277310924369748,"referencePantCuffRatio":0.8405797101449275,"canonical":{"normal":{"width":256,"height":384,"ground":[128,372],"scale":0.75,"translate":[8,4.5]},"compact":{"width":96,"height":144,"ground":[48,139.5],"scale":0.28125,"translate":[3,1.6875]}},"shoulderHalfWidth":39.5,"kneeOutwardBend":0.38,"referenceSleevePins":{"R":{"root":[0.72,0.09239130434782608],"joint":[0.41333333333333333,0.7336956521739131],"tip":[0.37333333333333335,0.9347826086956522]},"L":{"root":[0.265625,0.09239130434782608],"joint":[0.578125,0.7336956521739131],"tip":[0.59375,0.9347826086956522]}},"mesh":"RUN8-only shared joint cross-section; capped miter and adaptive knee/elbow width prevent UV-triangle reversal without moving bone endpoints.","referenceShoulderSeams":{"R":[[202,248],[220,248],[230,247],[240,245],[250,242],[280,238],[310,237]],"L":[[202,397],[220,397],[230,398],[240,400],[250,402],[280,405],[310,407]]},"sourceCutouts":{"pants.legR":{"atlas":"graduate-reference-v1","rect":[204,463,116,342],"cutouts":[[[0.0,0.0],[0.2413793103448276,0.0],[0.25,0.04678362573099415],[0.2672413793103448,0.08187134502923976],[0.2672413793103448,0.12573099415204678],[0.25862068965517243,0.15789473684210525],[0.23275862068965517,0.19298245614035087],[0.19827586206896552,0.21052631578947367],[0.0,0.21052631578947367]]],"sourcePolygonsXY":[[[204,463],[232,463],[233,479],[235,491],[235,506],[234,517],[231,529],[227,535],[204,535]]]},"pants.legL":{"atlas":"graduate-reference-v1","rect":[320,463,116,342],"cutouts":[[[1.0,0.0],[0.7844827586206896,0.0],[0.7758620689655172,0.04093567251461988],[0.7672413793103449,0.08187134502923976],[0.7586206896551724,0.12280701754385964],[0.75,0.1608187134502924],[0.7586206896551724,0.19005847953216373],[0.8017241379310345,0.21052631578947367],[1.0,0.21052631578947367]]],"sourcePolygonsXY":[[[436,463],[411,463],[410,477],[409,491],[408,505],[407,518],[408,528],[413,535],[436,535]]]},"shirt.torso":{"atlas":"graduate-reference-v1","rect":[235,182,173,246],"cutouts":[[[0.0,0.5853658536585366],[0.13872832369942195,0.6016260162601627],[0.1329479768786127,0.6219512195121951],[0.14450867052023122,0.6422764227642277],[0.15028901734104047,0.6626016260162602],[0.1329479768786127,0.6829268292682927],[0.11560693641618497,0.7032520325203252],[0.11560693641618497,0.7235772357723578],[0.12716763005780346,0.7439024390243902],[0.11560693641618497,0.7642276422764228],[0.09826589595375723,0.7845528455284553],[0.08670520231213873,0.8048780487804879],[0.09826589595375723,0.8252032520325203],[0.0,0.8455284552845529]],[[1.0,0.5853658536585366],[0.861271676300578,0.6016260162601627],[0.8554913294797688,0.6219512195121951],[0.8497109826589595,0.6422764227642277],[0.8439306358381503,0.6626016260162602],[0.8554913294797688,0.6829268292682927],[0.8728323699421965,0.7032520325203252],[0.8728323699421965,0.7235772357723578],[0.8670520231213873,0.7439024390243902],[0.8728323699421965,0.7642276422764228],[0.8901734104046243,0.7845528455284553],[0.9017341040462428,0.8048780487804879],[0.8901734104046243,0.8252032520325203],[0.9248554913294798,0.8455284552845529],[1.0,0.8455284552845529]]],"sourcePolygonsXY":[[[235,326],[259,330],[258,335],[260,340],[261,345],[258,350],[255,355],[255,360],[257,365],[255,370],[252,375],[250,380],[252,385],[235,390]],[[408,326],[384,330],[383,335],[382,340],[381,345],[383,350],[386,355],[386,360],[385,365],[386,370],[389,375],[391,380],[389,385],[395,390],[408,390]]]}}}};
  function freezeTree(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeTree);Object.freeze(value);}return value;}
  freezeTree(GRADUATE_REFERENCE);
  function previewBodyProfile(character,options={}){return character==='graduate'&&options.bodyProfile===GRADUATE_REFERENCE.id&&GRADUATE_REFERENCE.enabledUiDirections.includes(direction(options.direction))?GRADUATE_REFERENCE:null;}
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
  const GRADUATE_DOWN_FRAME=Object.freeze({width:96,height:144,columns:3,count:9});
  const GRADUATE_DOWN_LAYOUT=Object.freeze({idle:0,run:Object.freeze([1,2,3,4,5,6,7,8])});
  function cyclic(values,phase){const t=((phase%1)+1)%1*values.length,i=Math.floor(t),u=t-i,n=values.length,a=values[(i+n-1)%n],b=values[i],c=values[(i+1)%n],d=values[(i+2)%n];return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);}
  function ik3(start,target,upper,lower,bend){
    const delta={x:target.x-start.x,y:target.y-start.y,z:(target.z||0)-(start.z||0)},raw=Math.hypot(delta.x,delta.y,delta.z),d=clamp(raw,Math.abs(upper-lower)+.000001,upper+lower-.000001),axis={x:delta.x/raw,y:delta.y/raw,z:delta.z/raw};
    const dot=axis.x*bend.x+axis.y*bend.y+axis.z*bend.z,perp={x:bend.x-axis.x*dot,y:bend.y-axis.y*dot,z:bend.z-axis.z*dot},pl=Math.hypot(perp.x,perp.y,perp.z),along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
    const joint={x:start.x+axis.x*along+perp.x/pl*height,y:start.y+axis.y*along+perp.y/pl*height,z:(start.z||0)+axis.z*along+perp.z/pl*height},tip={x:start.x+axis.x*d,y:start.y+axis.y*d,z:(start.z||0)+axis.z*d};return {root:{...start,z:start.z||0},joint,tip};
  }
  // Athlete-informed 8-phase gait. Native directional textures remain the source;
  // these are articulated poses, not eight freshly painted athlete frames.
  const ATHLETE_RUN=freezeTree({id:'athlete-run8-v1',frames:8,stanceEnd:.25,
    footLift:[0,0,0,76,110,104,63,24],footForward:[32,0,-44,-66,-42,18,55,52],
    bodyBob:[19,22,19,-7,19,22,19,-7],armOpposition:.72,armOffsetDegrees:-6,torsoLeanDegrees:8,
    elbowDegrees:[93,91,88,84,91,97,101,97],kneeOutwardBend:.065,
    phaseNames:['touchdown','support','toe-off','flight-recovery','opposite-touchdown','opposite-support','opposite-toe-off','flight-extension']});
  function runProjection(view,v){
    // Proper yaw rotation of 3D anatomy. LEFT/RIGHT use their own source parts;
    // no image, face, hand, or UV is mirrored to produce the other direction.
    const yaw=view==='up'?Math.PI:view==='left'?-Math.acos(.22):view==='right'?Math.acos(.22):0,c=Math.cos(yaw),s=Math.sin(yaw);
    return {x:160+v.x*c+(v.z||0)*s,y:v.y,z:(v.z||0)*c-v.x*s};
  }
  function athleticRunPose(p,phase){
    const cfg=ATHLETE_RUN,profile=p.bodyProfile,graduate=p.direction==='down'&&profile?.downRun8,b=p.body,t=((phase%1)+1)%1,k=b.leg/187.8873239437;
    const bob=cyclic(cfg.bodyBob,t)*k,sway=Math.sin(t*Math.PI*2)*1.5*k,hipY=profile?profile.landmarks.hip:470-b.leg,shoulderY=profile?profile.landmarks.shoulder:SPACE.foot-b.height+b.head+49;
    const legUpper=graduate?graduate.upperLeg:b.leg*.44,legLower=graduate?graduate.lowerLeg:b.leg*.56,armUpper=graduate?graduate.upperArm:b.arm*.5,armLower=graduate?graduate.lowerArm:b.arm*.5;
    const shoulderHalf=graduate?graduate.shoulderHalfWidth:b.shoulders*(profile?.5:.475),hipHalf=b.hips*.44,leanAngle=cfg.torsoLeanDegrees*Math.PI/180;
    const torsoAt=(y,x=-sway)=>({x,y:hipY+bob+(y-hipY)*Math.cos(leanAngle),z:(hipY-y)*Math.sin(leanAngle)});
    p.phase=t;p.bob=bob;p.athleteRun8=cfg.id;p.runLengths={legUpper,legLower,armUpper,armLower};
    if(graduate)p.graduateRun8=graduate.id;
    p.hip=runProjection(p.direction,{x:sway,y:hipY+bob,z:0});
    p.chest=runProjection(p.direction,torsoAt(profile?profile.landmarks.shoulder+15:shoulderY-7));
    p.neck=runProjection(p.direction,torsoAt(profile?profile.landmarks.neck:shoulderY-36));
    if(profile)p.waist=runProjection(p.direction,torsoAt(profile.landmarks.waist,0));
    p.runTorsoLeanDegrees=cfg.torsoLeanDegrees;
    p.headAngle=0;p.phaseName=cfg.phaseNames[Math.floor(t*8)%8];
    for(const name of ['L','R']){
      const sign=name==='L'?1:-1,q=(t+(name==='R'?.5:0))%1,contact=q<=cfg.stanceEnd,root={x:sway+sign*hipHalf,y:hipY+bob,z:0};
      const track=profile?.geometry?.ankleHalfWidth||b.hips*.42,target={x:sign*track,y:470-(contact?0:Math.max(0,cyclic(cfg.footLift,q))*k),z:cyclic(cfg.footForward,q)*k};
      const bend={x:sign*cfg.kneeOutwardBend,y:0,z:1},leg=ik3(root,target,legUpper,legLower,bend);
      const oppositePhase=(q+.5)%1,oppositeContact=oppositePhase<=cfg.stanceEnd,oppositeRoot={x:sway-sign*hipHalf,y:hipY+bob,z:0},oppositeTarget={x:-sign*track,y:470-(oppositeContact?0:Math.max(0,cyclic(cfg.footLift,oppositePhase))*k),z:cyclic(cfg.footForward,oppositePhase)*k};
      const oppositeLeg=ik3(oppositeRoot,oppositeTarget,legUpper,legLower,{x:-sign*cfg.kneeOutwardBend,y:0,z:1}),thighAngle=l=>Math.atan2(l.joint.z-l.root.z,l.joint.y-l.root.y)*180/Math.PI;
      // The arm follows the OPPOSITE thigh, not the recovering ankle. This
      // distinction prevents the same-side arm and raised knee moving together.
      const upperDegrees=clamp(-cfg.armOpposition*(thighAngle(leg)-thighAngle(oppositeLeg))+cfg.armOffsetDegrees,-52,42);
      const upperAngle=upperDegrees*Math.PI/180,internal=cyclic(cfg.elbowDegrees,q)*Math.PI/180,foreAngle=upperAngle+Math.PI-internal;
      const shoulder=torsoAt(shoulderY,-sway+sign*shoulderHalf),elbowOut=2*k,foreIn=-6*k;
      const uSag=Math.sqrt(armUpper*armUpper-elbowOut*elbowOut),lSag=Math.sqrt(armLower*armLower-foreIn*foreIn);
      const elbow={x:shoulder.x+sign*elbowOut,y:shoulder.y+Math.cos(upperAngle)*uSag,z:shoulder.z+Math.sin(upperAngle)*uSag};
      const wrist={x:elbow.x+sign*foreIn,y:elbow.y+Math.cos(foreAngle)*lSag,z:elbow.z+Math.sin(foreAngle)*lSag};
      const project=v=>runProjection(p.direction,v),projectLimb=l=>({root:project(l.root),joint:project(l.joint),tip:project(l.tip)}),bendPoint=project(bend),origin=project({x:0,y:0,z:0});
      p.limbs[name]={leg:projectLimb(leg),arm:projectLimb({root:shoulder,joint:elbow,tip:wrist}),footTarget:project(target),kneeBend:{x:bendPoint.x-origin.x,y:bendPoint.y,z:bendPoint.z},contact,
        footAngle:contact?0:p.side?(p.direction==='left'?-1:1)*cyclic([0,0,0,-.26,-.46,-.22,.18,.15],q):sign*Math.sin(q*Math.PI*2)*.07,
        anatomical:{root,target,shoulder,elbow,wrist,leg,phase:q,upperArmDegrees:upperDegrees,thighDegrees:thighAngle(leg),oppositeThighDegrees:thighAngle(oppositeLeg),elbowInternalDegrees:internal*180/Math.PI}};
    }
    p.frontArm=p.limbs.L.arm.tip.z>=p.limbs.R.arm.tip.z?'L':'R';p.frontLeg=p.limbs.L.leg.joint.z>=p.limbs.R.leg.joint.z?'L':'R';
    p.flight=!p.limbs.L.contact&&!p.limbs.R.contact;return p;
  }
  function graduateDownRunPose(p,phase){return athleticRunPose(p,phase);}
  function pose(character,view='down',phase=0,action='idle',options={}){
    const d=direction(view),profile=previewBodyProfile(character,{...options,direction:d}),b=profile?{...profile.body}:body(character),side=d==='left'||d==='right',facing=d==='left'?-1:1,run=action==='run',t=run?phase:0;
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
    // The graduate's own rear idle source holds both forearms in front of the
    // torso, with no visible hands. Keep the existing sleeve textures on that
    // folded projection; torso ordering below occludes their open cuff ends.
    const rearArms=d==='up'&&profile?.directionFits?.up?.arms;
    if(rearArms)for(const name of ['L','R']){
      const screen=name==='L'?-1:1,old=p.limbs[name].arm,sway=run?Math.sin((t+(name==='R'?.5:0))*Math.PI*2)*3:0;
      p.limbs[name].arm={root:point(old.root.x-screen*(rearArms.shoulderInset||0),old.root.y),joint:point(160+screen*(rearArms.elbowHalfWidth+sway),old.root.y+rearArms.elbowDrop),tip:point(160+screen*rearArms.wristHalfWidth,old.root.y+rearArms.wristDrop)};
    }
    if(run)return athleticRunPose(p,phase);
    return p;
  }
  // Continuous linear skinning around the knee/elbow. Every vertex in the shared
  // transition uses the same two matrices; neighboring triangles cannot expose a
  // hinge-shaped transparent gap. The original cloth pixels remain the texture.
  function limbMesh(limb,width,pins={},extraRows=[],cols=3){
    const r=pins.root||[.5,.09],j=pins.joint||[.5,.52],tip=pins.tip||[.5,.93],a=sub(limb.joint,limb.root),b=sub(limb.tip,limb.joint),l1=length(a),l2=length(b),angle1=Math.atan2(a.y,a.x)-Math.PI/2,angle2=Math.atan2(b.y,b.x)-Math.PI/2;
    const rows=[0,r[1],Math.max(r[1],j[1]-.13),j[1],Math.min(tip[1],j[1]+.13),tip[1],1,...extraRows].sort((x,y)=>x-y);
    const vertices=[];
    for(const v of rows)for(const u of Array.from({length:cols},(_,i)=>i/(cols-1))){
      const y=v<=j[1]?(v-r[1])/(j[1]-r[1])*l1:l1+(v-j[1])/(tip[1]-j[1])*l2;
      const center=v<=j[1]?mix(r[0],j[0],clamp((v-r[1])/(j[1]-r[1]),0,1)):mix(j[0],tip[0],clamp((v-j[1])/(tip[1]-j[1]),0,1));
      const x=(u-center)*width,upper=add(limb.root,rotate(point(x,y),angle1)),lower=add(limb.joint,rotate(point(x,y-l1),angle2)),w=clamp((v-(j[1]-.13))/.26,0,1);
      vertices.push({u,v,x:mix(upper.x,lower.x,w),y:mix(upper.y,lower.y,w)});
    }
    return grid(vertices,cols,rows.length);
  }
  function referenceRunSleeveMesh(p,part,n,arm,width){
    const cfg=p.bodyProfile.downRun8,[sx,sy,sw,sh]=part.rect,k=p.bodyProfile.referenceScale,pins=cfg.referenceSleevePins[n],rows=[220,230,240,250,275,300].map(y=>(y-sy)/sh),mesh=limbMesh(arm,width,pins,rows,5),seams=cfg.referenceShoulderSeams[n];
    function seamAt(y){for(let i=1;i<seams.length;i++)if(y<=seams[i][0]){const a=seams[i-1],b=seams[i];return mix(a[1],b[1],clamp((y-a[0])/(b[0]-a[0]),0,1));}return seams.at(-1)[1];}
    for(const v of mesh.vertices){const x=sx+v.u*sw,y=sy+v.v*sh,seam=seamAt(y),inside=n==='R'?(x-(seam-22))/14:((seam+22)-x)/14,weight=clamp(inside,0,1)*clamp((315-y)/65,0,1),tv=(y-182)/246,target={x:mix(p.chest.x,p.hip.x,tv)+(x-321.5)*k,y:SPACE.foot+(y-870)*k+p.bob};v.x=mix(v.x,target.x,weight);v.y=mix(v.y,target.y,weight);}
    return mesh;
  }
  function joinedLimbMesh(limb,width,pins={}){
    const r=pins.root||[.5,.09],j=pins.joint||[.5,.52],t=pins.tip||[.5,.93],a=sub(limb.joint,limb.root),b=sub(limb.tip,limb.joint),l1=length(a),l2=length(b),d1=point(a.x/l1,a.y/l1),d2=point(b.x/l2,b.y/l2),n1=point(d1.y,-d1.x),n2=point(d2.y,-d2.x),dot=clamp(d1.x*d2.x+d1.y*d2.y,-.999,1),m=point((n1.x+n2.x)/(1+dot),(n1.y+n2.y)/(1+dot)),tanHalf=Math.sqrt((1-dot)/(1+dot));
    let jointWidth=Math.min(width,.7*Math.min(l1,l2)/(Math.max(j[0],1-j[0])*Math.max(.001,tanHalf))),mesh;
    for(let attempt=0;attempt<8;attempt++){
      const vertices=[],rows=[0,r[1],j[1],t[1],1];
      for(const v of rows)for(const u of [0,.5,1]){const qr=add(limb.root,point(n1.x*(u-r[0])*width,n1.y*(u-r[0])*width)),qj=add(limb.joint,point(m.x*(u-j[0])*jointWidth,m.y*(u-j[0])*jointWidth)),qt=add(limb.tip,point(n2.x*(u-t[0])*width,n2.y*(u-t[0])*width)),before=v<=j[1],q=before?(v-r[1])/(j[1]-r[1]):(v-j[1])/(t[1]-j[1]),from=before?qr:qj,to=before?qj:qt;vertices.push({u,v,x:mix(from.x,to.x,q),y:mix(from.y,to.y,q)});}
      mesh=grid(vertices,3,rows.length);if(mesh.triangles.every(ids=>{const [a,b,c]=ids.map(i=>vertices[i]);return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>=-.000001;}))return {...mesh,jointWidth};jointWidth*=.8;
    }
    return {...mesh,jointWidth};
  }
  function athleteLimbMesh(limb,width,pins={}){
    const r=pins.root||[.5,.09],j=pins.joint||[.5,.52],t=pins.tip||[.5,.93],vertices=[],triangles=[],overlap=.055;
    const segments=[{a:limb.root,b:limb.joint,pa:r,pb:j,lo:0,hi:Math.min(1,j[1]+overlap)},{a:limb.joint,b:limb.tip,pa:j,pb:t,lo:Math.max(0,j[1]-overlap),hi:1}];
    segments.sort((a,b)=>((a.a.z||0)+(a.b.z||0))-((b.a.z||0)+(b.b.z||0)));
    for(const seg of segments){
      const delta=sub(seg.b,seg.a),len=Math.max(.000001,length(delta)),normal=point(delta.y/len,-delta.x/len),start=vertices.length;
      for(const v of [seg.lo,seg.hi])for(const u of [0,1]){const q=(v-seg.pa[1])/(seg.pb[1]-seg.pa[1]),center=mix(seg.pa[0],seg.pb[0],q);vertices.push({u,v,x:mix(seg.a.x,seg.b.x,q)+normal.x*(u-center)*width,y:mix(seg.a.y,seg.b.y,q)+normal.y*(u-center)*width});}
      triangles.push([start,start+1,start+2],[start+1,start+3,start+2]);
    }
    return {vertices,triangles};
  }
  function grid(vertices,cols,rows){const triangles=[];for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){const a=y*cols+x,b=a+1,c=a+cols,d=c+1;triangles.push([a,b,c],[b,d,c]);}return {vertices,triangles};}
  function quad(x,y,w,h,angle=0,anchor=[.5,0]){
    const vertices=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>{const p=rotate(point((u-anchor[0])*w,(v-anchor[1])*h),angle);return {u,v,x:x+p.x,y:y+p.y};});return {vertices,triangles:[[0,1,2],[1,3,2]]};
  }
  // Body-specific garment tailoring, not a change to anatomy or saved items.
  // Professor's native PROVENANCE explicitly identifies a young adult woman.
  // Researcher/intern retain ordinary short daywear; no age is inferred.
  const TAILORED_FITS=freezeTree({
    professor:{id:'adult-tailored-academy-v1',jacketLength:.86,shirtLength:.98,waistEase:.92,adultSource:'assets/native-avatar/pineapple-professor/PROVENANCE.json'},
    researcher:{id:'short-daywear-v1',jacketLength:.95,shirtLength:1,waistEase:.98},
    'dawn-intern':{id:'short-daywear-v1',jacketLength:.94,shirtLength:1,waistEase:.98}
  });
  function tailoredGarment(p,part,kind){
    const fit=TAILORED_FITS[p.character];
    if(!fit||!part.item||!['shirt','jacket'].includes(kind)||['knee','calf','full'].includes(part.garmentLength))return {length:1,waist:1};
    return {length:kind==='jacket'?fit.jacketLength:fit.shirtLength,waist:fit.waistEase};
  }
  function clothMesh(p,width,height,anchorY,kind,part={}){
    const rows=6,cols=5,vertices=[],swing=p.action==='run'?Math.sin(p.phase*Math.PI*2-(kind==='cape'?.8:.35)):p.action==='rise'?-.35:p.action==='fall'?.3:p.action==='turn'?(p.phase-.5)*.65:p.action==='land'?Math.sin(p.phase*Math.PI)*.32:0;
    const tailoring=tailoredGarment(p,part,kind),lengthScale=clamp((part.lengthScale||1)*tailoring.length,.8,1.8),hemStart=clamp(part.hemStart??.65,.4,.75),extra=height*(lengthScale-1);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const u=x/(cols-1),v=y/(rows-1),tail=Math.max(0,(v-.35)/.65),lag=(kind==='cape'?16:6)*swing*tail*tail;
      // Source collars occupy the upper fifth of legacy torso crops. In the
      // measured UI fit, compress that collar-to-shoulder interval separately
      // from chest/waist length; the head and all world geometry are untouched.
      const fittedV=p.bodyProfile&&!part.referenceBox&&(kind==='shirt'||kind==='jacket')?(v<=.2?v*.4:.08+(v-.2)*1.15):v;
      vertices.push({u,v,x:(p.athleteRun8?mix(p.chest.x,p.hip.x,v):160)+(u-.5)*width*(1-(1-tailoring.waist)*Math.pow(Math.sin(Math.PI*v),2))+lag,y:anchorY+fittedV*height+extra*clamp((v-hemStart)/(1-hemStart),0,1)+Math.abs(u-.5)*tail*swing*3});
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
  // The native head contains an authored, character-specific neck. Reuse only
  // its interior skin (never a face, another actor's hand, or a flat tint) to
  // construct the hidden anatomical base before the eight garments are drawn.
  // This is procedural source-pixel skinning, not newly painted body artwork.
  function neckInterval(head,v){
    const polygons=typeof head.neckMask?.[0]?.[0]==='number'?[head.neckMask]:head.neckMask||[],spans=[];
    for(const polygon of polygons){const crossings=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if((a[1]<=v&&b[1]>v)||(b[1]<=v&&a[1]>v))crossings.push(a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1]));}crossings.sort((a,b)=>a-b);for(let i=0;i+1<crossings.length;i+=2)spans.push([crossings[i],crossings[i+1]]);}
    return spans.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0]||null;
  }
  function bodySkinPart(head,character){
    const points=(typeof head.neckMask?.[0]?.[0]==='number'?[head.neckMask]:head.neckMask||[]).flat();if(!points.length)return null;
    const low=Math.min(...points.map(v=>v[1])),high=Math.max(...points.map(v=>v[1])),span=high-low,top=low+span*.79,bottom=low+span*.92;
    const intervals=Array.from({length:9},(_,i)=>neckInterval(head,mix(top,bottom,i/8))).filter(Boolean);if(!intervals.length)return null;
    const left=Math.max(...intervals.map(v=>v[0])),right=Math.min(...intervals.map(v=>v[1]));if(!(right>left))return null;
    const inset=(right-left)*.18,u0=left+inset,u1=right-inset,[x,y,w,h]=head.rect,upper=neckInterval(head,low+span*.24),lower=neckInterval(head,low+span*.64),contracted=upper&&lower&&(lower[1]-lower[0])<(upper[1]-upper[0])*.75,neckY=low+span*(contracted?.24:.64),neck=neckInterval(head,neckY);
    if(!neck)return null;
    return {atlas:head.atlas,rect:[x+u0*w,y+top*h,(u1-u0)*w,(bottom-top)*h],slot:'body',bodySkin:true,skinOwner:character,sourceHeadRect:head.rect.slice(),skinUV:[u0,top,u1,bottom],neckUV:[neck[0],neckY,neck[1],high]};
  }
  // These are the open, rear-facing collar interiors in the native garment
  // sources, not transparent holes painted over the completed outfit. Keep the
  // original lining behind the body and its front rim/lapels above the body.
  // Closed high collars and the approved reference shirt are not reclassified.
  const NATIVE_REAR_COLLARS={
    // Coordinates are source pixels relative to the listed, verified crop.
    // This registry intentionally has no generic UV-cutout fallback: a closed
    // collar or an unreviewed garment must not lose its front material.
    'fruit-berry|75,27,117,187|shirt.torso':[[40,0],[77,0],[79,7],[77,14],[70,19],[62,21],[55,21],[47,19],[41,14],[39,7]],
    'fruit-berry|59,221,157,225|jacket.torso':[[60,0],[97,0],[99,8],[96,17],[90,22],[67,22],[61,17],[58,8]],
    'fruit-berry|13,877,258,180|cape.front':[[108,0],[151,0],[153,8],[152,16],[148,23],[113,23],[109,16],[106,8]],
    'bach|75,25,113,176|shirt.torso':[[39,0],[76,0],[78,6],[77,13],[71,18],[66,22],[63,27],[60,32],[57,35],[54,30],[52,26],[49,22],[44,18],[40,13],[38,6]],
    'bach|44,213,176,230|jacket.torso':[[70,0],[105,0],[111,7],[110,14],[105,18],[71,18],[66,14],[65,8]],
    'fruit-pineapple|72,28,123,185|shirt.torso':[[44,0],[83,0],[86,6],[84,13],[79,18],[74,22],[71,27],[68,33],[64,35],[60,31],[57,26],[54,22],[48,18],[44,13],[42,6]],
    'fruit-pineapple|63,218,158,220|jacket.torso':[[55,0],[95,0],[99,7],[99,16],[97,23],[92,28],[61,28],[56,24],[53,16],[53,8]]
  };
  function rearCollarOpening(key,part,d){
    if(d!=='down'||part.referenceBox)return null;const polygon=NATIVE_REAR_COLLARS[part.atlas+'|'+part.rect.join(',')+'|'+key];return polygon?polygon.map(([x,y])=>[x/part.rect[2],y/part.rect[3]]):null;
  }
  function meshPoint(mesh,u,v){
    for(const ids of mesh.triangles){const [a,b,c]=ids.map(i=>mesh.vertices[i]),den=(b.v-c.v)*(a.u-c.u)+(c.u-b.u)*(a.v-c.v);if(Math.abs(den)<1e-10)continue;const x=((b.v-c.v)*(u-c.u)+(c.u-b.u)*(v-c.v))/den,y=((c.v-a.v)*(u-c.u)+(a.u-c.u)*(v-c.v))/den,z=1-x-y;if(Math.min(x,y,z)>=-1e-6)return point(x*a.x+y*b.x+z*c.x,x*a.y+y*b.y+z*c.y);}
    throw Error('身體與原生頭部的接點超出來源範圍。');
  }
  // Offline-measured opaque shoulder landmarks. Guard both source crops;
  // unknown garments retain their native mesh. No runtime alpha readback.
  const NATIVE_SLEEVE_SEAMS={"up|shirt.armL|bach|271,47,54,133":{"torso":["bach",330,25,112,172],"cap":[0.6957671957671957,0.02631578947368421],"socket":[0.08035714285714286,0.1511627906976744],"capMode":"whole"},"up|shirt.armR|bach|446,47,54,133":{"torso":["bach",330,25,112,172],"cap":[0.3253968253968254,0.02631578947368421],"socket":[0.9017857142857143,0.1511627906976744],"capMode":"whole"},"up|jacket.armL|bach|267,243,54,130":{"torso":["bach",306,212,173,233],"cap":[0.6759259259259259,0.07307692307692308],"socket":[0.18208092485549132,0.15665236051502146]},"up|jacket.armR|bach|465,243,55,130":{"torso":["bach",306,212,173,233],"cap":[0.33636363636363636,0.07307692307692308],"socket":[0.8121387283236994,0.15665236051502146]},"down|jacket.armL|bach|203,242,53,131":{"torso":["bach",44,213,176,230],"cap":[0.3490566037735849,0.07251908396946564],"socket":[0.8210227272727273,0.15869565217391304]},"down|jacket.armR|bach|11,243,54,130":{"torso":["bach",44,213,176,230],"cap":[0.6759259259259259,0.07307692307692308],"socket":[0.20738636363636365,0.15869565217391304]},"up|shirt.armL|fruit-berry|267,52,61,147":{"torso":["fruit-berry",327,27,122,188],"cap":[0.6990632318501171,0.03741496598639456],"socket":[0.0778688524590164,0.17287234042553193],"capMode":"whole","capBand":0.27,"overlap":4},"up|shirt.armR|fruit-berry|447,52,62,147":{"torso":["fruit-berry",327,27,122,188],"cap":[0.3084677419354839,0.05102040816326531],"socket":[0.9385245901639344,0.17287234042553193],"capMode":"whole","capBand":0.35,"overlap":6},"up|shirt.armL|fruit-pineapple|272,64,58,135":{"torso":["fruit-pineapple",334,28,130,186],"cap":[0.6099137931034483,0.025925925925925925],"socket":[0.057692307692307696,0.18548387096774194],"capMode":"whole","capBand":0.35,"overlap":6},"up|shirt.armR|fruit-pineapple|467,64,58,135":{"torso":["fruit-pineapple",334,28,130,186],"cap":[0.3879310344827586,0.025925925925925925],"socket":[0.9576923076923077,0.18548387096774194],"capMode":"whole","capBand":0.35,"overlap":6}};
  function sleeveSeamRecord(key,part,torso,d){
    const fit=NATIVE_SLEEVE_SEAMS[d+'|'+key+'|'+part.atlas+'|'+part.rect.join(',')];
    return fit&&torso&&fit.torso.join(',')===[torso.atlas,...torso.rect].join(',')?{cap:fit.cap,socket:fit.socket,capMode:fit.capMode||'inner',capBand:fit.capBand,overlap:fit.overlap,torso}:null;
  }
  function splitNativeMeshAt(mesh,axis,value){
    // Insert the measured source cap without extrapolating its neighbors. Each
    // cut subdivides the original affine triangles; source UV coverage stays
    // exact and the undeformed native mesh does not move.
    const vertices=mesh.vertices.map(q=>({...q})),triangles=[],ids=new Map(vertices.map((q,i)=>[[q.u,q.v,q.x,q.y].map(n=>n.toFixed(12)).join(','),i]));
    const addVertex=q=>{const key=[q.u,q.v,q.x,q.y].map(n=>n.toFixed(12)).join(',');if(ids.has(key))return ids.get(key);const i=vertices.length;vertices.push(q);ids.set(key,i);return i;};
    for(const tri of mesh.triangles){const polygon=tri.map(i=>vertices[i]);if(polygon.every(q=>q[axis]<=value+1e-10)||polygon.every(q=>q[axis]>=value-1e-10)){triangles.push(tri);continue;}
      for(const sign of [-1,1]){const clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=sign*(a[axis]-value)>=-1e-10,insideB=sign*(b[axis]-value)>=-1e-10;if(insideA)clipped.push(a);if(insideA!==insideB){const t=(value-a[axis])/(b[axis]-a[axis]);clipped.push({u:mix(a.u,b.u,t),v:mix(a.v,b.v,t),x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});}}
        const face=clipped.map(addVertex);for(let i=1;i<face.length-1;i++){const a=vertices[face[0]],b=vertices[face[i]],c=vertices[face[i+1]];if(Math.abs((b.u-a.u)*(c.v-a.v)-(b.v-a.v)*(c.u-a.u))>1e-12)triangles.push([face[0],face[i],face[i+1]]);}}
    }return {...mesh,vertices,triangles};
  }
  function bindSleeveSeam(mesh,part,p){
    const fit=part.shoulderSeam;if(!fit)return mesh;
    if(fit.capMode!=='whole'){mesh=splitNativeMeshAt(mesh,'u',fit.cap[0]);mesh=splitNativeMeshAt(mesh,'v',fit.cap[1]);}
    const torso=partMesh(part.slot+'.torso',fit.torso,p),source=meshPoint(mesh,...fit.cap),target=meshPoint(torso,...fit.socket),inward=target.x<p.chest.x?1:-1,dx=target.x+inward*(fit.overlap??(fit.capMode==='whole'?4:1.25))-source.x,dy=target.y-source.y,capV=fit.cap[1],jointV=part.pins?.joint?.[1]??.52;
    // The measured plain-shirt cap is attached as one band; jacket fits bind
    // only its inner half. Every elbow/wrist row, source UV and body/pose joint
    // stay fixed. The original torso occludes the small native-pixel overlap.
    return {...mesh,vertices:mesh.vertices.map(q=>{const w=clamp((jointV-q.v)/(jointV-(fit.capMode==='whole'?(fit.capBand??.22):capV)),0,1)*(fit.capMode==='whole'?1:clamp((q.u-.5)/(fit.cap[0]-.5),0,1));return w?{...q,x:q.x+dx*w,y:q.y+dy*w}:q;})};
  }
  function bodyBaseMesh(key,part,p){
    // All actors use the same surface rule with their own body dimensions and
    // native neck pixels. Shoulder markers describe the authored cloth seam;
    // they are not an invitation to add another skin radius outside the body.
    const b=p.body,k=b.shoulders/210;
    if(key==='body.torso'){
      const head=partMesh('head',p.headPart,p),[u0,v,u1]=part.neckUV,a=meshPoint(head,u0+(u1-u0)*.09,v),z=meshPoint(head,u1-(u1-u0)*.09,v),neckCenter=(a.x+z.x)/2,neckWidth=Math.abs(z.x-a.x),neckY=(a.y+z.y)/2;
      // Calibrated inside the approved source contour: sloping trapezius,
      // rounded acromion, narrower ribcage and each actor's own waist/hip.
      // The 210-unit shoulder reference supplies ratios, not a shared body.
      const shoulderY=Math.max(neckY+24*k,(p.limbs.L.arm.root.y+p.limbs.R.arm.root.y)/2+16*k),neckBaseY=mix(neckY,shoulderY,.40),chestY=Math.max(shoulderY+12*k,p.chest.y+28*k),waistY=p.waist?.y||mix(chestY,p.hip.y,.76),hipSpan=Math.abs(p.limbs.L.leg.root.x-p.limbs.R.leg.root.x)+b.limb*.62;
      const rows=[[neckCenter,neckY,neckWidth,0,0],[mix(neckCenter,p.chest.x,.2),neckBaseY,neckWidth*1.06,.10,0],[p.chest.x,mix(neckBaseY,shoulderY,.5),140*k*p.viewWidth,.21,4*k],[p.chest.x,shoulderY,184*k*p.viewWidth,.32,7*k],[p.chest.x,chestY,156*k*p.viewWidth,.47,0],[mix(p.chest.x,p.hip.x,.8),waistY,b.waist*.89*p.viewWidth,.80,0],[p.hip.x,p.hip.y,Math.max(b.hips*.98*p.viewWidth,hipSpan),1,0]],vertices=[];
      for(const [cx,cy,w,v,curve] of rows)for(const u of [0,.25,.5,.75,1])vertices.push({u,v,x:cx+(u-.5)*w,y:cy-curve*(1-Math.pow(Math.abs(u-.5)*2,2))});return grid(vertices,5,rows.length);
    }
    const n=key.at(-1),arm=key.startsWith('body.arm'),original=p.limbs[n][arm?'arm':'leg'],inward=original.root.x<p.chest.x?1:-1;
    // Keep all pose joints fixed. Reconstruct the skin capsule inside and
    // below the original surface attachment, joining its actual elbow/wrist.
    const limb=arm?{...original,root:point(original.root.x+inward*20*k,original.root.y+24*k),joint:point(original.joint.x+inward*8*k,original.joint.y)}:original,width=b.limb*(arm?.66:.9),mesh=joinedLimbMesh(limb,width,{root:[.5,.025],joint:[.5,.52],tip:[.5,.975]});
    for(let row=0;row<mesh.vertices.length;row+=3){const center=mesh.vertices[row+1],v=center.v,taper=v<=.025?mix(.12,.8,v/.025):v<=.52?mix(.8,.9,(v-.025)/.495):mix(.9,arm?.62:.58,(v-.52)/.48);for(let i=0;i<3;i++){const q=mesh.vertices[row+i];q.x=center.x+(q.x-center.x)*taper;q.y=center.y+(q.y-center.y)*taper;}}
    return mesh;
  }
  // Exact visible RGBA fragments from each actor's own accepted source; no
  // generic Bach hand is used as proof of identity. Source-view reuse is explicit.
  const OWN_HAND_ATLAS=freezeTree({"src":"./assets/avatar-raster/own-native-front-hand-fragments-v1.png","width":256,"height":704});
  const OWN_HAND_PARTS=freezeTree({"doctor":{"R":{"ownerCharacter":"doctor","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,16,21,21],"anchor":[0.09523809523809523,0.5714285714285714],"displayWidth":32.03389830508475,"sourceArmAngle":-1.7359450042095235,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/doctor-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"doctor","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,16,22,22],"anchor":[0.8636363636363636,0.5909090909090909],"displayWidth":33.559322033898304,"sourceArmAngle":-4.446136931233765,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/doctor-v1/down-actions-0-body-front.webp","visibleOnly":true}},"professor":{"R":{"ownerCharacter":"professor","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,80,20,21],"anchor":[0.2,0.8095238095238095],"displayWidth":30.508474576271183,"sourceArmAngle":-2.4149503129080676,"sourceDirection":"right","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/professor-v1/right-actions-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"professor","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,80,20,20],"anchor":[0.85,0.8],"displayWidth":30.508474576271183,"sourceArmAngle":-3.9795738785981833,"sourceDirection":"left","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/professor-v1/left-actions-body-front.webp","visibleOnly":true}},"researcher":{"R":{"ownerCharacter":"researcher","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,144,24,20],"anchor":[0.08333333333333333,0.75],"displayWidth":36.52173913043478,"sourceArmAngle":-1.9379701606131157,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/researcher-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"researcher","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,144,25,17],"anchor":[0.92,0.5294117647058824],"displayWidth":38.04347826086957,"sourceArmAngle":-4.641081515599399,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/researcher-v1/down-actions-0-body-front.webp","visibleOnly":true}},"cedar-dean":{"R":{"ownerCharacter":"cedar-dean","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,208,22,23],"anchor":[0.13636363636363635,0.7391304347826086],"displayWidth":33.6989966555184,"sourceArmAngle":-2.158798930342464,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/cedar-dean-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"cedar-dean","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,208,25,21],"anchor":[0.92,0.7142857142857143],"displayWidth":38.29431438127091,"sourceArmAngle":-4.369365039963986,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/cedar-dean-v1/down-actions-0-body-front.webp","visibleOnly":true}},"herbal-mentor":{"R":{"ownerCharacter":"herbal-mentor","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,272,25,23],"anchor":[0.12,0.8260869565217391],"displayWidth":38.01115241635687,"sourceArmAngle":-2.0988707752212563,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/herbal-mentor-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"herbal-mentor","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,272,25,21],"anchor":[0.92,0.6190476190476191],"displayWidth":38.01115241635687,"sourceArmAngle":-4.501295647161943,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/herbal-mentor-v1/down-actions-0-body-front.webp","visibleOnly":true}},"lab-engineer":{"R":{"ownerCharacter":"lab-engineer","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,336,27,25],"anchor":[0.1111111111111111,0.84],"displayWidth":42.67132867132867,"sourceArmAngle":-2.1421338066285234,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/lab-engineer-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"lab-engineer","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,336,30,20],"anchor":[0.9,0.6],"displayWidth":47.41258741258741,"sourceArmAngle":-4.579837448088016,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/lab-engineer-v1/down-actions-0-body-front.webp","visibleOnly":true}},"balance-analyst":{"R":{"ownerCharacter":"balance-analyst","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,400,26,23],"anchor":[0.11538461538461539,0.782608695652174],"displayWidth":39.5807560137457,"sourceArmAngle":-1.97568811307998,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/balance-analyst-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"balance-analyst","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,400,26,20],"anchor":[0.8846153846153846,0.65],"displayWidth":39.5807560137457,"sourceArmAngle":-4.485590132330804,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/balance-analyst-v1/down-actions-0-body-front.webp","visibleOnly":true}},"dawn-intern":{"R":{"ownerCharacter":"dawn-intern","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,464,22,19],"anchor":[0.13636363636363635,0.7894736842105263],"displayWidth":33.49624060150376,"sourceArmAngle":-2.0344439357957027,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/dawn-intern-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"dawn-intern","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,464,25,17],"anchor":[0.92,0.5294117647058824],"displayWidth":38.06390977443609,"sourceArmAngle":-4.635617089114912,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/dawn-intern-v1/down-actions-0-body-front.webp","visibleOnly":true}},"river-fellow":{"R":{"ownerCharacter":"river-fellow","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,528,26,23],"anchor":[0.11538461538461539,0.8260869565217391],"displayWidth":39.73913043478261,"sourceArmAngle":-2.0344439357957027,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/river-fellow-v1/down-actions-0-body-front.webp","visibleOnly":true},"L":{"ownerCharacter":"river-fellow","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,528,25,19],"anchor":[0.88,0.631578947368421],"displayWidth":38.21070234113713,"sourceArmAngle":-4.559739651989425,"sourceDirection":"down","sourcePose":{"sheet":"actions","frame":0},"sourceFile":"./assets/painted-avatar/river-fellow-v1/down-actions-0-body-front.webp","visibleOnly":true}},"graduate":{"R":{"ownerCharacter":"graduate","anatomicalHand":"R","atlas":"own-native-front-hand-fragments-v1","rect":[24,592,69,64],"anchor":[0.14492753623188406,0.796875],"displayWidth":27.6,"sourceArmAngle":-1.8657333856437035,"sourceDirection":"down","sourcePose":{"referencePose":"center-run","gameFrame":null},"sourceFile":"./assets/avatar-raster/graduate-reference-v1/reference.png","visibleOnly":true},"L":{"ownerCharacter":"graduate","anatomicalHand":"L","atlas":"own-native-front-hand-fragments-v1","rect":[152,592,58,64],"anchor":[0.8103448275862069,0.84375],"displayWidth":23.2,"sourceArmAngle":-3.989409626983199,"sourceDirection":"down","sourcePose":{"referencePose":"rightmost-run","gameFrame":null},"sourceFile":"./assets/avatar-raster/graduate-reference-v1/reference.png","visibleOnly":true}}});
  const withOwnHands=data=>({...data,atlases:{...data.atlases,'own-native-front-hand-fragments-v1':OWN_HAND_ATLAS}});
  function plan(state,view,manifest,env,onlySlot=null,options={}){
    if(!manifest||manifest.version!==1)throw Error('服裝圖像正在準備中。');
    manifest=withOwnHands(manifest);
    const look=appearance(state,env),d=direction(view),profile=previewBodyProfile(look.character,{...options,direction:d}),fit=body(look.character,{...options,direction:d}).fit,parts={},items={};
    if(profile)manifest={...manifest,atlases:{...manifest.atlases,...profile.atlases}};
    for(const slot of SLOTS){
      if(onlySlot&&slot!==onlySlot)continue;
      const id=look.loadout[slot],gear=env.MindAdventure?.gear(id),entry=id?(manifest.catalog?.[id]||(gear?.style?{kit:gear.style,slot}:null)):manifest.defaults?.[slot]?{kit:manifest.defaults[slot],slot}:null;
      if(!entry){if(id)throw Error('這件裝備的實際穿戴素材尚未完成。');continue;}
      const kit=manifest.kits?.[entry.kit],variant=kit?.bodyVariants?.[look.character]||kit?.bodyVariants?.[fit],raw=kit?.views?.[d],custom=variant?.views?.[d];
      if(!raw)throw Error('這套服裝缺少此方向的原畫。');
      for(const key of PARTS[slot]){const part=(!id&&profile?.parts[d]?.defaults?.[key])||custom?.parts?.[key]||raw.parts?.[key];if(part?.hidden||!part&&OPTIONAL_PARTS.has(key))continue;const cutouts=id&&profile?.parts[d]?.equipmentCutouts?.[id]?.[key];parts[key]={...checkedPart(cutouts?{...part,cutouts:[...(part.cutouts?(typeof part.cutouts[0]?.[0]==='number'?[part.cutouts]:part.cutouts):[]),...cutouts]}:part,manifest),slot,item:id||null};}
      if(!onlySlot)for(const side of ['L','R']){const key='hand.'+side,part=custom?.parts?.[key]||raw.parts?.[key];if(part&&!parts[key])parts[key]={...checkedPart(part,manifest),slot:'body'};}
      items[slot]=id||null;
    }
    // Full wear and the single-item card use identical front/rear garment
    // records. With no body present the card simply draws both original halves.
    for(const key of ['shirt.torso','jacket.torso','cape.front']){const part=parts[key],opening=part&&rearCollarOpening(key,part,d);if(!opening)continue;parts[key+'.rearCollar']={...part,mask:[opening],cutouts:null,meshKey:key,neckCoverageOverlap:true};parts[key]={...part,cutouts:[...(part.cutouts?(typeof part.cutouts[0]?.[0]==='number'?[part.cutouts]:part.cutouts):[]),opening]};}
    for(const slot of ['shirt','jacket'])for(const n of ['L','R']){const key=slot+'.arm'+n,part=parts[key],fit=part&&sleeveSeamRecord(key,part,parts[slot+'.torso'],d);if(fit)parts[key]={...part,shoulderSeam:fit};}
    if(!onlySlot){
      const head=profile?.parts[d]?.head||manifest.heads?.[look.character]?.[d];parts.head={...checkedPart(head,manifest),slot:'body'};
      if(head.neckMask){parts['head.neck']={...parts.head,mask:head.neckMask,cutouts:null,neckCoverageOverlap:true};parts.head.cutouts=head.neckMask;}
      const skin=bodySkinPart(head,look.character);if(skin)for(const key of ['body.torso','body.armL','body.armR','body.legL','body.legR'])parts[key]={...skin};
      for(const side of ['L','R']){const key='hand.'+side,part=profile?(d==='down'&&!look.loadout.shirt&&!look.loadout.jacket?profile.parts[d].bareHands[side]:profile.parts[d]?.hands?.[side]):manifest.hands?.[look.character]?.[d]?.[side]||manifest.hands?.[d]?.[side];if(profile&&part?.hidden){delete parts[key];continue;}const own=OWN_HAND_PARTS[look.character]?.[side],selected=profile?part:(own||part);if(selected)parts[key]={...checkedPart(selected,manifest),slot:'body'};if(!parts[key])throw Error('角色手部素材尚未備妥。');}
      for(const n of ['L','R']){const own=OWN_HAND_PARTS[look.character]?.[n];if(own)parts['hand.athlete'+n]={...checkedPart(own,manifest),slot:'body'};}
      if(profile?.parts[d]?.runHands)for(const n of ['L','R']){parts['hand.run'+n]={...checkedPart(profile.parts[d].runHands[n],manifest),slot:'body'};if(!look.loadout.shirt&&!look.loadout.jacket)parts['forearm.run'+n]={...checkedPart(profile.parts[d].runForearms[n],manifest),slot:'body'};}
      if(profile?.parts[d]?.handheldHidden){
        // The sealed UP idle hides both hands and its book. A new run can move
        // that same hand into view; retain the exact equipped source for it.
        if(parts.handheld)parts['handheld.athlete']={...parts.handheld};
        delete parts.handheld;
      }
    }
    const result={character:look.character,direction:d,parts,items,onlySlot,key:JSON.stringify([manifest.revision||1,look.character,d,...SLOTS.map(slot=>look.loadout[slot]),onlySlot,...(profile?[profile.id]:[])])};
    if(profile){result.bodyProfile=profile.id;result.atlasOverrides=profile.atlases;}return result;
  }
  // Measured own-head source contacts; only these verified atlas/crop pairs.
  // The world point follows the existing head mesh, including neck-fit and turn.
  const NATIVE_HAT_CONTACTS={
    'fruit-citrus|782,1083,221,148':[0.49667,0.16710814091828424],
    'fruit-pineapple|813,1099,199,111':[0.49667,0.1417263995277709]
  };
  function nativeHatContact(head,hat,p){
    if(p.character!=='graduate'||p.direction!=='left'||p.bodyProfile?.id!=='graduate-reference-v1'||head?.atlas!=='heads-left'||head.rect.join(',')!=='605,92,300,355')return null;
    const pin=NATIVE_HAT_CONTACTS[hat.atlas+'|'+hat.rect.join(',')];return pin?meshPoint(partMesh('head',head,p),pin[0],pin[1]):null;
  }
  function partMesh(key,part,p){
    if(part.meshKey)return partMesh(part.meshKey,{...part,meshKey:null},p);
    const b=p.body,s=part.scale||1,aspect=part.rect[3]/part.rect[2],side=p.side;
    if(part.bodySkin)return bodyBaseMesh(key,part,p);
    if(p.bodyProfile&&part.referenceBox&&p.action==='idle'){const [x,y,w,h]=part.referenceBox,k=p.bodyProfile.referenceScale;return quad(160+(x+w/2-320)*k,SPACE.foot+(y-870)*k,w*k,h*k,0,[.5,0]);}
    if(p.graduateRun8&&part.referenceBox&&(key==='shirt.torso'||key==='pants.pelvis')){
      const [x,y,w,h]=part.referenceBox,k=p.bodyProfile.referenceScale,top=SPACE.foot+(y-870)*k+p.bob,cx=160+(x+w/2-320)*k+(p.hip.x-160);
      if(key==='shirt.torso')return clothMesh(p,w*k,h*k,top,'shirt',part);return quad(cx,top,w*k,h*k,0,[.5,0]);
    }
    if(/\.arm[LR]$/.test(key)){const n=key.at(-1);let arm=p.limbs[n].arm;if(p.bodyProfile){if(part.sleeveEndRatio){const start=p.graduateRun8?arm.joint:arm.root,ratio=p.graduateRun8?p.bodyProfile.downRun8.referenceSleeveForearmEnd:part.sleeveEndRatio;arm={...arm,tip:point(mix(start.x,arm.tip.x,ratio),mix(start.y,arm.tip.y,ratio))};}else arm={...arm,root:point(arm.root.x,arm.root.y+10),joint:point(arm.joint.x,arm.joint.y+4)};}const width=(p.bodyProfile&&part.displayWidth?part.displayWidth:b.limb*(key.startsWith('jacket')?1.25:1.02))*s;const mesh=p.graduateRun8&&part.referenceBox?athleteLimbMesh(arm,width,p.bodyProfile.downRun8.referenceSleevePins[n]):(p.athleteRun8?athleteLimbMesh:limbMesh)(arm,width,part.pins);return bindSleeveSeam(mesh,part,p);}
    // Equipped DOWN leg crops include transparent side margins. Fit the existing
    // pixels to the measured thigh silhouette without moving any joints or the
    // separate reference-pixel defaults. This avoids a flat gap below the pelvis.
    if(/\.leg[LR]$/.test(key)){const n=key.at(-1),g=p.bodyProfile?.geometry,width=p.graduateRun8&&part.referenceBox?part.displayWidth:p.bodyProfile?(p.direction==='down'&&part.item&&!part.referenceBox?g.equippedDownLegWidth:g.legWidth)*(side?.92:1):b.limb*(side?1.65:p.direction==='up'?2.2:2.65);let leg=p.limbs[n].leg;if(p.graduateRun8&&part.referenceBox){const r=p.bodyProfile.downRun8.referencePantCuffRatio;leg={...leg,tip:point(mix(leg.joint.x,leg.tip.x,r),mix(leg.joint.y,leg.tip.y,r))};}return (p.athleteRun8?athleteLimbMesh:limbMesh)(leg,width*s,part.pins);}
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
    if(key.startsWith('forearm.run')){const n=key.at(-1),arm=p.limbs[n].arm,w=part.displayWidth*s,foreshorten=length(sub(arm.tip,arm.joint))/p.bodyProfile.downRun8.lowerArm,angle=Math.atan2(arm.tip.y-arm.joint.y,arm.tip.x-arm.joint.x)-Math.PI/2;return quad(arm.tip.x,arm.tip.y,w,w*aspect*foreshorten,angle,part.anchor);}
    if(key.startsWith('hand.')){const n=key.at(-1),arm=p.limbs[n].arm,w=((p.bodyProfile||part.ownerCharacter===p.character)&&part.displayWidth?part.displayWidth:17)*s,angle=Math.atan2(arm.tip.y-arm.joint.y,arm.tip.x-arm.joint.x)-Math.PI/2-(part.sourceArmAngle||0);return quad(arm.tip.x,arm.tip.y,w,w*aspect,angle,part.anchor||[.5,.12]);}
    if(key==='handheld'){
      const hand=part.hand==='R'?'R':'L',arm=p.limbs[hand].arm,w=31*s,angle=Math.atan2(arm.tip.y-arm.joint.y,arm.tip.x-arm.joint.x)-Math.PI/2;
      return quad(arm.tip.x,arm.tip.y-5,w,w*aspect,angle*.65,part.anchor||[.35,.16]);
    }
    if(key==='head'||key==='head.neck'){
      const w=b.head*(p.bodyProfile?(side?.96:1):(part.widthScale||1))*s,h=w*aspect,anchor=part.anchor||[.5,.88],fit=p.bodyProfile?.directionFits?.[p.direction]?.head;
      if(fit){
        const split=fit.neckStartV,map=v=>v<=split?v:split+(v-split)*fit.neckScale,mappedAnchor=map(anchor[1]),vertices=[];
        // Source y < 287 is the native hair/face. Only the lower neck band is
        // shortened; head/face retain one uniform scale and a rigid translation.
        for(const v of [0,split,1])for(const u of [0,1]){const q=rotate(point((u-anchor[0])*w,(map(v)-mappedAnchor)*h),p.headAngle);vertices.push({u,v,x:p.neck.x+q.x,y:p.neck.y+q.y});}
        return grid(vertices,2,3);
      }
      return quad(p.neck.x,p.neck.y+(p.bodyProfile?0:14),w,h,p.headAngle,anchor);
    }
    if(key==='hat'){
      const head=p.headPart,w=b.head*(p.bodyProfile?1.16:1.28)*s,headWidth=b.head*(p.bodyProfile?(side?.96:1):(head?.widthScale||1))*(head?.scale||1),headHeight=head?headWidth*head.rect[3]/head.rect[2]:b.head,anchor=head?.anchor||[.5,.88];
      const measuredContact=nativeHatContact(head,part,p);if(measuredContact)return quad(measuredContact.x,measuredContact.y,w,w*aspect,p.headAngle,part.anchor||[.5,.65]);
      // Hat bands follow the skull/face rather than the bounding box of long or
      // curly hair. A measured pin can refine an authored side-view head.
      const fit=p.bodyProfile?.directionFits?.[p.direction]?.head,headShift=fit?Math.max(0,anchor[1]-fit.neckStartV)*(1-fit.neckScale)*headHeight:0;
      const x=p.neck.x+(head?.hatPin?(head.hatPin[0]-anchor[0])*headWidth:0),y=p.neck.y+(p.bodyProfile?0:14)+(head?.hatPin?(head.hatPin[1]-anchor[1])*headHeight:-b.head)+headShift;
      return quad(x,y,w,w*aspect,p.headAngle,part.anchor||[.5,.65]);
    }
    if(key==='accessory'){
      const anatomical=part.side==='R'?-1:1,visible=!(p.direction==='up'&&part.backVisible!==true&&p.onlySlot!=='accessory');if(!visible)return null;
      const x=160+(side?(p.direction==='right'?-1:1)*8:anatomical*b.shoulders*.24),w=18*s;return quad(x,p.neck.y+37,w,w*aspect,0,part.anchor||[.5,.5]);
    }
    return null;
  }
  function layers(p,parts){
    const near=p.near,far=near==='L'?'R':'L',arm=n=>['shirt.arm'+n,'jacket.arm'+n,...(p.graduateRun8?['forearm.run'+n]:[]),'handheld',p.graduateRun8?'hand.run'+n:'hand.'+n],leg=n=>['pants.leg'+n,'pants.pocket'+n,'shoes.'+n],base=['body.leg'+far,'body.leg'+near,'body.arm'+far,'body.arm'+near,'shirt.torso.rearCollar','jacket.torso.rearCollar','cape.front.rearCollar','body.torso'];
    // The book belongs to an anatomical hand, not the side of the screen. Keep
    // the far hand behind the torso and the near hand in front in each view.
    const held=parts.handheld?.hand==='R'?'R':'L',armLayer=n=>arm(n).filter(key=>key!=='handheld'||held===n);
    if(p.athleteRun8){const frontArm=p.frontArm,backArm=frontArm==='L'?'R':'L',frontLeg=p.frontLeg,backLeg=frontLeg==='L'?'R':'L',list=['cape.back',...base,...leg(backLeg),...armLayer(backArm),'pants.pelvis','head.neck','shirt.torso','jacket.torso','cape.front','accessory',...leg(frontLeg),...armLayer(frontArm),'head','hat'];if(p.direction==='up'){list.splice(list.indexOf('cape.back'),1);list.splice(list.indexOf('head'),0,'cape.back');}return list.filter((key,i)=>parts[key]&&list.indexOf(key)===i);}
    const list=['cape.back',...base,...leg(far),...armLayer(far),'pants.pelvis',...leg(near),'head.neck','shirt.torso','jacket.torso',...armLayer(near),'cape.front','accessory','head','hat'];
    if(p.direction==='up'){
      if(p.bodyProfile?.directionFits?.up?.arms?.behindTorso){
        // Each sleeve terminates behind its own torso. The outer jacket sleeves
        // must still cover the shirt torso, otherwise removing the extra source
        // sleeve pixels would expose false white seams through the gold coat.
        for(const slot of ['shirt','jacket']){const keys=[slot+'.arm'+far,slot+'.arm'+near];for(const key of keys){const i=list.indexOf(key);if(i>=0)list.splice(i,1);}list.splice(list.indexOf(slot+'.torso'),0,...keys);}
      }
      const i=list.indexOf('cape.back');list.splice(i,1);list.splice(list.indexOf('head'),0,'cape.back');
    }
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
      limbs[n]={...p.limbs[n],leg:p.athleteRun8?ik3(old.root,{...p.limbs[n].footTarget,y:p.limbs[n].footTarget.y+delta},p.runLengths.legUpper,p.runLengths.legLower,p.limbs[n].kneeBend):{...old,joint:point(old.joint.x,old.joint.y+delta*.5),tip:point(old.tip.x,old.tip.y+delta)}};
    }
    return {...p,limbs,...(p.athleteRun8?{frontLeg:limbs.L.leg.joint.z>=limbs.R.leg.joint.z?'L':'R'}:{})};
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
      if(Path){const key=[...part.rect,sx,sy,ox,oy,!!part.neckCoverageOverlap].join(',');let paths=maskPaths.get(part.mask);if(!paths){paths=new Map();maskPaths.set(part.mask,paths);}maskPath=paths.get(key);if(!maskPath){maskPath=new Path();const offsets=part.neckCoverageOverlap?[[0,0],[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,-2],[-2,2],[2,2]]:[[0,0]];for(const [dx,dy] of offsets)for(const polygon of polygons){polygon.forEach(([u,v],i)=>maskPath[i?'lineTo':'moveTo'](px(u)+dx*sx,py(v)+dy*sy));maskPath.closePath();}paths.set(key,maskPath);}}
    }
    const transform=ctx.getTransform?.(),pixel=transform?1/Math.max(.08,Math.min(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d))):1;
    for(const indices of mesh.triangles){
      const dst=indices.map(i=>mesh.vertices[i]),src=dst.map(v=>point(px(v.u),py(v.v))),m=triangleTransform(src,dst);if(!m)continue;
      const clip=expandTriangle(dst,pixel);
      ctx.save();try{
        ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);ctx.lineTo(clip[1].x,clip[1].y);ctx.lineTo(clip[2].x,clip[2].y);ctx.closePath();ctx.clip();ctx.transform(...m);
        ctx.beginPath();ctx.rect(px(0),py(0),w*sx,h*sy);ctx.clip();
        if(maskPath)ctx.clip(maskPath);else if(polygons){ctx.beginPath();const offsets=part.neckCoverageOverlap?[[0,0],[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,-2],[-2,2],[2,2]]:[[0,0]];for(const [dx,dy] of offsets)for(const polygon of polygons){polygon.forEach(([u,v],i)=>ctx[i?'lineTo':'moveTo'](px(u)+dx*sx,py(v)+dy*sy));ctx.closePath();}ctx.clip();}
        if(part.cutouts){const cutouts=typeof part.cutouts[0]?.[0]==='number'?[part.cutouts]:part.cutouts;ctx.beginPath();ctx.rect(px(0),py(0),w*sx,h*sy);for(const poly of cutouts){poly.forEach(([u,v],i)=>ctx[i?'lineTo':'moveTo'](px(u),py(v)));ctx.closePath();}ctx.clip('evenodd');}
        ctx.drawImage(source.image,0,0);
      }finally{ctx.restore();}
      yield;
    }
  }
  function partsForPose(parts,p){
    if(p.athleteRun8&&!p.graduateRun8){parts={...parts};for(const n of ['L','R'])if(parts['hand.athlete'+n])parts['hand.'+n]=parts['hand.athlete'+n];if(parts['handheld.athlete'])parts.handheld=parts['handheld.athlete'];}
    if(!p.graduateRun8)return parts;const clips=p.bodyProfile.downRun8.sourceCutouts||{};
    return Object.fromEntries(Object.entries(parts).map(([key,part])=>{const clip=clips[key];if(!clip||part.atlas!==clip.atlas||part.rect.some((v,i)=>v!==clip.rect[i]))return [key,part];return [key,{...part,cutouts:[...(part.cutouts||[]),...clip.cutouts]}];}));
  }
  function* drawSteps(ctx,prepared,p,width,height,options={}){
    if(options.bodyProfile&&p.bodyProfile?.id!==options.bodyProfile)p=pose(p.character,p.direction,p.phase,p.action,options);
    const parts=partsForPose(prepared.plan.parts,p);p={...fitFeet(p,parts),headPart:parts.head,onlySlot:prepared.plan.onlySlot};ctx.save();try{ctx.clearRect(0,0,width,height);const list=layers(p,parts).map(key=>[key,partMesh(key,parts[key],p)]).filter(([,mesh])=>mesh);if(!list.length)return;
    if(prepared.plan.onlySlot){
      const vertices=list.flatMap(([,mesh])=>mesh.vertices),xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y),left=Math.min(...xs)-7,top=Math.min(...ys)-7,w=Math.max(...xs)-left+7,h=Math.max(...ys)-top+7,s=Math.min(width/w,height/h)*.88;
      ctx.translate((width-w*s)/2,(height-h*s)/2);ctx.scale(s,s);ctx.translate(-left,-top);
    }else if(options.canonicalGraduateDown||options.canonicalActor){const k=width/256*.75;ctx.translate(width/2,height*372/384);ctx.scale(k,k);ctx.translate(-160,-490);}else ctx.scale(width/SPACE.width,height/SPACE.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';for(const [key,mesh] of list)yield* drawPartSteps(ctx,parts[key],prepared.sources[parts[key].atlas],mesh);
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
    async function drawBudgeted(ctx,prepared,p,width,height,alive,budget,options={}){
      for(const unused of drawSteps(ctx,prepared,p,width,height,options)){
        if(!alive())throw aborted();
        // This is a cooperative budget: a single Canvas operation cannot be
        // preempted, but no second triangle starts after an expired 5ms slice.
        if(E.now()-budget.started>=5){await yieldTask();budget.started=E.now();if(!alive())throw aborted();}
      }
    }
    async function bitmap(atlas,tier,region,profileId=null){
      const scale=tier==='scene'?.5:1,w=Math.max(1,Math.round(region.width*scale)),h=Math.max(1,Math.round(region.height*scale)),mapping={x:region.x,y:region.y,scaleX:w/region.width,scaleY:h/region.height};
      if(E.loadImage)return {image:await E.loadImage(atlas.src,w,h,{...region,sourceWidth:atlas.width,sourceHeight:atlas.height}),...mapping};
      if(typeof atlas.src!=='string'||!(/^\.\/assets\/avatar-raster\/[a-z0-9-]+\.webp$/.test(atlas.src)||atlas.src===OWN_HAND_ATLAS.src||profileId===GRADUATE_REFERENCE.id&&((tier==='preview'||tier==='athlete-scene')&&PROFILE_SOURCE_PATHS.has(atlas.src)||tier==='graduate-down-scene'&&atlas.src==='./assets/avatar-raster/graduate-reference-v1/reference.png')))throw Error('服裝素材必須使用已登錄的本機路徑。');
      if(E.locationProtocol!=='file:'&&E.fetch&&E.createImageBitmap){const response=await E.fetch(atlas.src,{credentials:'same-origin'});if(!response.ok)throw Error('服裝圖像載入失敗。');const blob=await response.blob(),original=await E.createImageBitmap(blob);if(original.width!==atlas.width||original.height!==atlas.height){original.close();throw Error('服裝圖像尺寸與清單不一致。');}try{return {image:await E.createImageBitmap(original,region.x,region.y,region.width,region.height,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'}),...mapping};}finally{original.close();}}
      const image=await new Promise((resolve,reject)=>{const img=new E.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('服裝圖像載入失敗。'));img.src=atlas.src;});
      if((image.naturalWidth||image.width)!==atlas.width||(image.naturalHeight||image.height)!==atlas.height)throw Error('服裝圖像尺寸與清單不一致。');
      const c=makeCanvas(w,h);c.getContext('2d').drawImage(image,region.x,region.y,region.width,region.height,0,0,w,h);return {image:c,...mapping};
    }
    async function prepare(state,view,tier='scene',onlySlot=null,alive=()=>true,options={}){
      const base=withOwnHands(manifest()),profile=tier==='preview'||tier==='athlete-scene'||tier==='graduate-down-scene'&&direction(view)==='down'?previewBodyProfile(state?.appearance?.character,{...options,direction:view}):null,data=profile?{...base,atlases:{...base.atlases,...profile.atlases}}:base,p=plan(state,view,data,E,onlySlot,profile?options:{}),ids=[...new Set(Object.values(p.parts).map(part=>part.atlas))],handles=[];
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
    // One compact RUN8 atlas per character / independent view / real eight IDs.
    // Original directional body parts feed the athlete skeleton; this is not
    // eight newly painted frames, and it never replaces the source atlases.
    async function acquireAthleteRun(state,view='down',options={}){
      const snapshot=JSON.parse(JSON.stringify({appearance:state?.appearance,rpg:{loadout:state?.rpg?.loadout||{}}})),d=direction(view);
      const opts={bodyProfile:snapshot.appearance?.character==='graduate'?GRADUATE_REFERENCE.id:null,direction:d},p=plan(snapshot,d,manifest(),E,null,opts),profile=p.bodyProfile||null;
      const F={width:96,height:144,columns:4,count:8},key=JSON.stringify(['native-body-athlete-run8-v1',p.key]),cost=F.width*F.height*F.count*4;
      return frameCache.acquire(key,cost,alive=>queue(async()=>{
        if(!alive())throw aborted();const prepared=await prepare(snapshot,d,'athlete-scene',null,alive,opts),canvas=makeCanvas(F.width*F.columns,F.height*Math.ceil(F.count/F.columns)),ctx=canvas.getContext('2d');
        try{const budget={started:E.now()};for(let i=0;i<8;i++){if(!alive())throw aborted();const x=i%F.columns*F.width,y=Math.floor(i/F.columns)*F.height,p=pose(prepared.plan.character,d,i/8,'run',opts);ctx.save();try{ctx.beginPath();ctx.rect(x,y,F.width,F.height);ctx.clip();ctx.translate(x,y);await drawBudgeted(ctx,prepared,p,F.width,F.height,alive,budget,{canonicalActor:true});}finally{ctx.restore();}}
          if(!alive())throw aborted();return {canvas,...F,character:p.character,direction:d,ground:{x:48,y:139.5},anchor:[48,139.5],layout:{run:[0,1,2,3,4,5,6,7]},profile,motion:'athlete-run8-v1',bodyFit:'native-body-underlay-v1',renderMethod:'native-parts-athlete-skeleton',key};
        }catch(error){canvas.width=1;canvas.height=1;throw error;}finally{prepared.release();}
      }),options);
    }
    async function acquireGraduateDown(state,options={}){
      const snapshot=JSON.parse(JSON.stringify({appearance:state?.appearance,rpg:{loadout:state?.rpg?.loadout||{}}}));
      if(appearance(snapshot,E).character!=='graduate')throw Error('此跑步分件只支援 graduate。');
      const opts={bodyProfile:GRADUATE_REFERENCE.id,direction:'down'},p=plan(snapshot,'down',manifest(),E,null,opts),key=JSON.stringify([GRADUATE_REFERENCE.downRun8.id,p.key]),F=GRADUATE_DOWN_FRAME,cost=F.width*F.height*F.count*4;
      return frameCache.acquire(key,cost,alive=>queue(async()=>{
        if(!alive())throw aborted();const prepared=await prepare(snapshot,'down','graduate-down-scene',null,alive,opts),canvas=makeCanvas(F.width*F.columns,F.height*Math.ceil(F.count/F.columns)),ctx=canvas.getContext('2d');
        try{const budget={started:E.now()};for(let i=0;i<F.count;i++){if(!alive())throw aborted();const x=i%F.columns*F.width,y=Math.floor(i/F.columns)*F.height,p=pose('graduate','down',i===0?0:(i-1)/8,i===0?'idle':'run',opts);ctx.save();try{ctx.beginPath();ctx.rect(x,y,F.width,F.height);ctx.clip();ctx.translate(x,y);await drawBudgeted(ctx,prepared,p,F.width,F.height,alive,budget,{canonicalGraduateDown:true});}finally{ctx.restore();}}
          if(!alive())throw aborted();return {...(E.canvasURL?await E.canvasURL(canvas):{}),canvas,...F,direction:'down',ground:{x:48,y:139.5},anchor:[48,139.5],layout:GRADUATE_DOWN_LAYOUT,profile:GRADUATE_REFERENCE.id,renderMethod:'authored-parts-skeletal',key};
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
      const d=direction(options.direction||r.direction),requested=Object.prototype.hasOwnProperty.call(options,'bodyProfile')?options.bodyProfile:r.requestedBodyProfile,profile=previewBodyProfile(r.state?.appearance?.character,{bodyProfile:requested,direction:d}),bodyProfile=profile?.id||null,changed=d!==r.direction||bodyProfile!==r.bodyProfile;r.direction=d;r.requestedBodyProfile=requested;r.bodyProfile=bodyProfile;
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
    return {preview,itemPreview,setPose,ready:canvas=>previews.get(canvas)?.promise||Promise.resolve(canvas),dispose,acquire,acquireAthleteRun,acquireGraduateDown,prepare,describe:(state,options={})=>plan(state,options.direction||'down',manifest(),E,options.onlySlot||null,options),stats:()=>({frames:frameCache.stats(),sources:sourceCache.stats()}),clearUnused(){frameCache.clear();sourceCache.clear();},draw};
  }
  return {...createRuntime(),createRuntime,DIRECTIONS,SLOTS,PARTS,SPACE,FRAME,POSES,SCENE_BYTES,SOURCE_BYTES,direction,body,previewBodyProfile,pose,stride,ik,ik3,cyclic,graduateDownRunPose,athleticRunPose,runProjection,ATHLETE_RUN,athleteLimbMesh,GRADUATE_DOWN_FRAME,GRADUATE_DOWN_LAYOUT,limbMesh,joinedLimbMesh,referenceRunSleeveMesh,quad,clothMesh,TAILORED_FITS,tailoredGarment,triangleTransform,partMesh,layers,fitFeet,drawSteps,partsForPose,plan,checkedPart,appearance,createCache,sourceRegion,OWN_HAND_ATLAS,OWN_HAND_PARTS};
});
