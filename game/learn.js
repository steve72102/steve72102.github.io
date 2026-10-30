(function(){
  'use strict';
  const questions=window.MIND_BANK.questions,byId=new Map(questions.map(q=>[q.id,q]));
  const names={pharmacology:'藥理與藥化',pharmaceutics:'藥劑與生物藥劑',herbal:'藥物分析與生藥學'};
  const host=document.getElementById('library'),search=document.getElementById('lesson-search'),subject=document.getElementById('lesson-subject');
  const searchText=new Map(questions.map(q=>[q.id,[q.id,q.title,q.question,...q.options,q.explanation,q.memory].join(' ').toLocaleLowerCase()]));
  const SIZE=20;let page=0,timer;
  function el(tag,attrs={},...children){const element=document.createElement(tag);for(const [k,v]of Object.entries(attrs)){if(k.startsWith('on'))element.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='disabled')element.disabled=!!v;else element.setAttribute(k,v);}for(const child of children.flat(Infinity)){if(child!==null&&child!==undefined)element.append(child instanceof Node?child:document.createTextNode(String(child)));}return element;}
  function button(label,action,disabled=false){return el('button',{type:'button',class:'button secondary small',onclick:action,disabled},label);}
  function label(q){return names[q.subject]+' · '+q.exam+' · 第 '+q.number+' 題';}
  function filters(){const query=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return questions.filter(q=>(subject.value==='all'||subject.value===q.subject)&&query.every(term=>searchText.get(q.id).includes(term)));}
  function route(id,replace=false){const url=new URL(location.href);if(location.protocol==='file:'){url.hash=id?'q='+encodeURIComponent(id):'';}else{if(id)url.searchParams.set('q',id);else url.searchParams.delete('q');}history[replace?'replaceState':'pushState'](null,'',url);}
  function select(id){route(id);render();if(id)host.querySelector('h2')?.focus();}
  function list(){
    const found=filters();page=Math.min(page,Math.max(0,Math.ceil(found.length/SIZE)-1));
    const count=el('p',{class:'library-count'},'找到 '+found.length.toLocaleString()+' 題。待複核題目仍可對照閱讀，但不加入新開關卡。');
    const items=el('ul',{class:'library-list'},found.slice(page*SIZE,(page+1)*SIZE).map(q=>el('li',{},el('a',{class:'library-result',href:(location.protocol==='file:'?'#q=':'?q=')+encodeURIComponent(q.id),onclick:e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();select(q.id);}}},el('small',{},label(q)+(q.needsReview?' · 待複核':'')),el('strong',{},q.title),el('p',{},q.question)))));
    const change=n=>{page+=n;render();host.scrollIntoView({block:'start'});};
    return [count,found.length?items:el('p',{class:'library-empty'},'找不到相符題目。試試較短的藥名，或切換成全部學科。'),el('nav',{class:'library-nav','aria-label':'搜尋結果分頁'},button('← 上一頁',()=>change(-1),!page),el('span',{},'第 '+(page+1)+' / '+Math.max(1,Math.ceil(found.length/SIZE))+' 頁'),button('下一頁 →',()=>change(1),(page+1)*SIZE>=found.length))];
  }
  function render(){
    const id=(location.protocol==='file:'?new URLSearchParams(location.hash.slice(1)):new URL(location.href).searchParams).get('q'),q=byId.get(id);host.replaceChildren();
    if(id&&!q){host.append(el('div',{class:'notice'},'這個題目連結不存在，請重新搜尋。'),...list());return;}
    if(!q){document.title='詳解查閱 · 思維冒險';host.append(...list());return;}
    document.title=q.title+' · 思維冒險';
    const heading=el('h2',{tabindex:'-1'},q.title);
    const article=el('article',{class:'panel library-detail'},el('p',{class:'eyebrow'},label(q)),heading,el('p',{},q.question),el('ol',{class:'library-options',type:'A'},q.options.map(option=>el('li',{},option))),window.MindLesson.render(q,el),el('p',{class:'library-count'},'題目編號：'+q.id));
    host.append(el('div',{class:'library-nav'},button('← 返回搜尋結果',()=>select(null)),el('a',{class:'quiet-link',href:'./index.html'},'回學院繼續冒險 ↗')),article);
  }
  function update(){page=0;route(null,true);render();}
  search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,150);});subject.addEventListener('change',update);window.addEventListener('popstate',render);render();
})();
