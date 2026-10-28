(function(root,factory){const C=typeof module==='object'&&module.exports?require('./combat.js'):root.MindCombat;const api=factory(C);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindLesson=api;})(typeof window==='object'?window:globalThis,function(C){
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
    return {...c,focus:q.focus||q.title,paragraphs:paragraphs(c.explanation),memory:paragraphs(c.memory).join(' '),pitfall:q.pitfall||(negative?'這題是在找不符合題意的選項；被選中的敘述，不一定是正確的知識。':''),negative,needsReview:!!q.needsReview,sources:Array.isArray(q.reviewSources)?q.reviewSources.filter(s=>typeof s==='string'&&/^https:\/\//.test(s)):[]};
  }
  function render(q,node,{question=false}={}){
    const c=card(q);
    return node('div',{class:'lesson-guide'},
      question?node('section',{class:'lesson-question'},node('h4',{},'先看題目'),node('p',{},c.question)):null,
      c.needsReview?node('div',{class:'notice danger'},'這題仍待複核。下列保留原題答案供對照，暫不加入新開關卡。'):null,
      node('section',{class:'lesson-focus'},node('h4',{},'這題在問什麼'),node('p',{},c.focus)),
      node('section',{class:'lesson-answer'},node('h4',{},c.negative?'本題要選出的內容（注意否定題意）':'本題答案'),node('p',{},c.answer)),
      node('section',{class:'lesson-reason'},node('h4',{},'一步一步想'),c.paragraphs.map(p=>node('p',{},p))),
      c.pitfall?node('section',{class:'lesson-pitfall'},node('h4',{},'容易混淆的地方'),node('p',{},c.pitfall)):null,
      node('section',{class:'memory'},node('h4',{},'帶走這個重點'),node('p',{},c.memory)),
      c.sources.length?node('details',{class:'lesson-sources'},node('summary',{},'查看複核參考資料'),c.sources.map((url,i)=>node('a',{href:url,target:'_blank',rel:'noopener noreferrer'},'參考資料 '+(i+1)+' ↗'))):null);
  }
  return {paragraphs,card,render};
});
