(function(root,factory){const common=typeof module==='object'&&module.exports;const C=common?require('./combat.js'):root.MindCombat,D=common?require('./lesson-diagrams.js'):root.MindLessonDiagrams;const api=factory(C,D);if(common)module.exports=api;else root.MindLesson=api;})(typeof window==='object'?window:globalThis,function(C,D){
  'use strict';
  function paragraphs(text){
    const lines=String(text||'').replace(/AI\s*新擬\s*[：:]/g,'記憶比喻：').replace(/\s*([①②③④⑤⑥])/g,'\n$1').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    return lines.flatMap(line=>{
      if(line.length<150)return [line];
      const sentences=line.match(/[^。！？]+[。！？]?/g)||[line],out=[];let part='';
      for(const sentence of sentences){if(part.length+sentence.length>160&&part){out.push(part);part='';}part+=sentence;}
      if(part)out.push(part);return out;
    });
  }
  function card(q){
    const c=C.studyCard(q),negative=/不正確|不適當|不屬於|不屬|錯誤|何者非|何者不是|何者不|不是/.test(q.question);
    let officialKey=null;
    if(q.officialKey&&Number.isInteger(q.officialKey.answer)&&q.officialKey.answer===q.answer&&typeof q.officialKey.url==='string'){
      try{const url=new URL(q.officialKey.url);if(url.origin==='https://wwwq.moex.gov.tw'&&url.pathname==='/exam/wHandExamQandA_File.ashx'&&['S','M'].includes(url.searchParams.get('t'))){const questionUrl=new URL(url);questionUrl.searchParams.set('t','Q');officialKey={url:url.href,questionUrl:questionUrl.href,amended:url.searchParams.get('t')==='M'};}}catch{}
    }
    return {...c,focus:q.focus||q.title,paragraphs:paragraphs(c.explanation),memory:paragraphs(c.memory).join(' '),pitfall:q.pitfall||(negative?'這題是在找不符合題意的選項；被選中的敘述，不一定是正確的知識。':''),negative,needsReview:!!q.needsReview,officialKey,diagrams:Array.isArray(q.diagrams)?[...new Set(q.diagrams)].slice(0,3).map(id=>D?.get(id)).filter(Boolean):[],sources:Array.isArray(q.reviewSources)?q.reviewSources.filter(s=>typeof s==='string'&&/^https:\/\//.test(s)):[]};
  }
  function render(q,node,{question=false}={}){
    const c=card(q);
    return node('div',{class:'lesson-guide'},
      question?node('section',{class:'lesson-question'},node('h4',{},'先看題目'),node('p',{},c.question)):null,
      c.needsReview?node('div',{class:'notice danger'},c.officialKey?'這題的正式答案已核對，但題意或詳解仍有疑義，暫不加入新開關卡。':'這題仍待複核。下列保留原題答案供對照，暫不加入新開關卡。'):null,
      node('section',{class:'lesson-focus'},node('h4',{},'這題在問什麼'),node('p',{},c.focus)),
      node('section',{class:'lesson-answer'},node('h4',{},c.needsReview?(c.officialKey?'正式答案（疑義待釐清）':'原筆記選項（尚待確認）'):c.negative?'本題要選出的內容（注意否定題意）':'本題答案'),node('p',{},c.answer)),
      c.officialKey?node('details',{class:'lesson-sources'},node('summary',{},'查看本題原卷與正式答案'),node('p',{},'已核對本題的答案選項。閱讀時也請留意題幹條件、否定語句與下方的疑義說明。'),node('a',{href:c.officialKey.questionUrl,target:'_blank',rel:'noopener noreferrer'},'考選部原始試題 ↗'),node('a',{href:c.officialKey.url,target:'_blank',rel:'noopener noreferrer'},c.officialKey.amended?'考選部更正答案（請連同備註閱讀） ↗':'考選部標準答案 ↗')):null,
      node('section',{class:'lesson-reason'},node('h4',{},'一步一步想'),c.paragraphs.map(p=>node('p',{},p))),
      c.diagrams.map(d=>node('figure',{class:'lesson-figure'},node('h4',{},d.title),node('img',{src:d.src,alt:d.alt,width:d.width,height:d.height,loading:'lazy',decoding:'async'}),node('figcaption',{},d.caption),node('details',{class:'lesson-zoom'},node('summary',{},'展開大圖（可左右滑動）'),node('div',{class:'lesson-zoom-scroll',tabindex:'0','aria-label':'放大的'+d.title},node('img',{src:d.src,alt:d.alt,width:d.width,height:d.height,loading:'lazy',decoding:'async'}))),node('a',{href:d.src,target:'_blank',rel:'noopener'},'單獨開啟圖片 ↗'),node('details',{},node('summary',{},'閱讀圖片文字說明'),node('p',{},d.alt)))),
      c.pitfall?node('section',{class:'lesson-pitfall'},node('h4',{},'容易混淆的地方'),node('p',{},c.pitfall)):null,
      node('section',{class:'memory'},node('h4',{},c.needsReview?'先保留疑問，暫時不要背成定論':'帶走這個重點'),node('p',{},c.needsReview?'先對照本題的疑義說明與參考來源。完成核對前，原筆記的答案只作對照，不當作確定知識。':c.memory)),
      c.sources.length?node('details',{class:'lesson-sources'},node('summary',{},'查看複核參考資料'),c.sources.map((url,i)=>node('a',{href:url,target:'_blank',rel:'noopener noreferrer'},'參考資料 '+(i+1)+' ↗'))):null);
  }
  return {paragraphs,card,render};
});
