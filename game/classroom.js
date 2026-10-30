(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindClassrooms=api;})(typeof window==='object'?window:this,function(){
  'use strict';
  const definitions={
    pharmaceutics:{name:'製劑實作教室',school:'臺大建築靈感',color:'mint',floor:[[45,500],[190,165],[810,165],[960,500],[930,545],[650,545],[650,655],[350,655],[350,545],[65,545]],tables:[[225,355,190,115,46],[758,355,190,115,46],[500,180,185,35,45]]},
    pharmacology:{name:'藥理案例研討室',school:'清大建築靈感',color:'violet',floor:[[45,500],[150,155],[850,155],[965,500],[930,540],[675,540],[675,655],[325,655],[325,540],[70,540]],tables:[[218,255,185,65,40],[165,397,230,78,42],[785,255,185,65,40],[830,397,230,78,42],[500,165,85,25,35]]},
    herbal:{name:'植物標本教室',school:'成大建築靈感',color:'leaf',floor:[[35,400],[160,155],[840,155],[965,400],[930,480],[730,535],[695,655],[305,655],[270,535],[70,480]],tables:[[200,340,210,135,44],[795,340,210,135,44],[500,178,220,35,45]]},
    battle:{name:'知識競技訓練室',school:'清大建築靈感',color:'rose',floor:[[65,470],[230,145],[770,145],[935,470],[875,530],[680,550],[670,655],[330,655],[320,550],[125,530]],tables:[[250,245,170,55,40],[210,350,200,70,43],[745,245,170,55,40],[795,350,200,70,43]]}
  };
  const rooms=Object.fromEntries(Object.entries(definitions).map(([building,d])=>[building,{...d,kind:'classroom',building,image:'classroom-'+building+'.webp',scale:1.25,spawn:{x:500,y:450},areas:[d.floor],blocked:[],nodes:[[500,620],[500,550],[500,450],[500,340],[500,240],[350,460],[650,460],[110,470],[890,470],[350,215],[650,215]],portals:[{id:'class-exit',name:'樓內大廳',x:500,y:620,kind:'inspect',auto:false,verb:'返回'},...(building==='battle'?[{id:'class-lesson',name:'怪物試煉',x:380,y:220,kind:'inspect',auto:false,verb:'開始'},{id:'class-duel',name:'雙人競技',x:620,y:220,kind:'inspect',auto:false,verb:'開始'}]:[{id:'class-lesson',name:'本班知識練習',x:500,y:235,kind:'inspect',auto:false,verb:'研讀'}])]}]));
  function channel(room){return typeof room==='string'&&/^[0-9]{1,6}_(pharmaceutics|pharmacology|herbal|battle)_[1-9][0-9]{0,4}$/.test(room)?'class-'+room:null;}
  function channelName(value){if(typeof value==='number')return '第 '+value+' 大廳';const m=/^class-[0-9]+_(pharmaceutics|pharmacology|herbal|battle)_([0-9]+)$/.exec(value||'');return m?({pharmaceutics:'藥劑樓',pharmacology:'藥理樓',herbal:'生藥樓',battle:'對戰樓'}[m[1]]+' · 第 '+m[2]+' 班'):'共同大廳';}
  return {rooms,channel,channelName};
});
