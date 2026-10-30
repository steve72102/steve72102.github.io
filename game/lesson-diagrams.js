(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindLessonDiagrams=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // Only this local catalogue can supply image URLs; question text is never HTML.
  const catalogue={
    'fused-ring-count':{title:'五員環說的是原子總數',width:680,height:355,alt:'Carbazole 由兩個六員苯環夾住一個五員含氮環，共三環，只有一個環內氮。Indole 由一個苯環與一個五員含氮環融合，共兩環，也只有一個環內氮。',caption:'五員環有五個環原子，不代表五個氮。圖中省略氫與其他取代基。'},
    'ring-nitrogen':{title:'四種環型，一眼比較',width:680,height:540,alt:'Quinazoline 是兩個融合環，含兩個環內氮；quinoline 只有一個。Piperazine 是六元飽和環，兩個氮相對；piperidine 只有一個氮。',caption:'藍色 N 表示氮；先看環的形狀，再數環內的氮。圖中省略氫與藥物其他取代基。'},
    'alpha1-half-life':{title:'把半衰期放在一起看',width:680,height:390,alt:'仿單代表性消除半衰期：prazosin 2–3 小時、alfuzosin 緩釋約 10 小時、terazosin 約 12 小時、doxazosin 約 22 小時。',caption:'這是指定藥物與劑型的代表值；半衰期不等於起效時間，也不是服藥間隔。'},
    'statin-rings':{title:'分別檢查環型與酸基',width:680,height:470,alt:'Atorvastatin 的吡咯是五元芳香環，含一個氮；rosuvastatin 的嘧啶是六元芳香環，含兩個氮。Atorvastatin 另有開鏈羧酸部分，羧酸基為 C(=O)OH，成鹽時可寫成 COO 負離子。',caption:'這裡只畫要辨認的結構片段，並非完整藥物；環的大小、N 的位置與雙鍵要一起看。'},
    'liposome':{title:'把微脂粒剖開來看',width:680,height:440,alt:'微脂粒的磷脂雙層包住水性核心。兩排親水頭分別朝向內、外水相，疏水尾部相向。親水藥可在水性核心，親脂藥可在膜內；實際分布依配方而異。',caption:'單一雙層膜的剖面概念圖；多層微脂粒可以有多圈雙層膜。'},
    'infusion-area':{title:'先分前段與尾段，再算 AUC',width:680,height:460,alt:'以每小時 180 mg 輸注 4 小時，共 720 mg。清除率每小時 12 L，所以總 AUC 為 60 mg·h/L。前 4 小時面積約 45，停輸後到無限遠的尾段約 15。',caption:'本題採一室、一階模型與近穩態近似；由零開始的精確面積為前段 45.275、尾段 14.725 mg·h/L。'},
    'chromatography-resolution':{title:'解析度要同時看峰距與峰寬',width:680,height:455,alt:'每個峰頂對應保留時間 tR。由峰兩側切線延伸到基線的截點，量出各峰基線寬 WA 和 WB。Rs 等於兩倍保留時間差，除以兩個基線寬的和。',caption:'概念圖未按任何一題的數值比例繪製。此公式用基線寬，半高寬有另一種公式。'},
    'glycoside-links':{title:'C 與 O 指連接的原子',width:680,height:410,alt:'O-糖苷以糖的異頭碳連氧再連到苷元；C-糖苷以糖的異頭碳直接連到苷元的碳。兩種連接能在同一分子中出現，並不是指碳氧雙鍵。',caption:'圖中僅顯示連接方式，省略其他原子和鍵；C 是碳，O 是氧。'}
  };
  function get(id){return typeof id==='string'&&Object.hasOwn(catalogue,id)?{id,src:'./assets/lessons/'+id+'.svg',...catalogue[id]}:null;}
  return {get,ids:()=>Object.keys(catalogue)};
});
