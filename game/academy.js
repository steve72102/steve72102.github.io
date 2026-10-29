(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindAcademy=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const CHARACTERS=[
    {id:'doctor',name:'星序博士',role:'博士',traits:'青年・略長臉',color:'mint',image:'doctor-portrait.webp',line:'把每一個問號，整理成新的星座。',story:'喜歡帶著一本空白筆記出門，把今天學會的事畫成星圖。青綠披肩與方框眼鏡，是他的學院日常。'},
    {id:'professor',name:'苔光教授',role:'教授',traits:'青年・長橢圓臉',color:'violet',image:'professor-portrait.webp',line:'理解慢慢長，也會成為一座森林。',story:'深色長髮輕輕束起，露出額頭與親切笑容，隨身帶著植物筆記。她總會留一頁空白，給尚未想明白的好問題。'},
    {id:'graduate',name:'流墨研究生',role:'研究生',traits:'青年・圓潤臉',color:'gold',image:'graduate-portrait.webp',line:'帶著好奇心，把今天的未知讀懂。',story:'黑色側瀏海、暖黃帽衫、短實驗袍和裝滿筆記的斜背包。研究途中最喜歡的瞬間，是終於能用自己的話解釋答案。'},
    {id:'researcher',name:'璃砂研究員',role:'研究員',traits:'青年・寬圓臉',color:'rose',image:'researcher-portrait.webp',line:'每一次觀察，都值得認真記下。',story:'護目鏡停在額前，標本盒收得整整齊齊。她喜歡用細小的發現，拼出完整的知識地圖。'},
    {id:'cedar-dean',name:'杉庭院士',role:'院士',traits:'長者・修長臉',color:'mint',image:'cedar-dean-portrait.webp',line:'懂得越多，越願意從頭問起。',story:'銀色短髮、方框眼鏡與眼角笑紋，陪他走過許多研究季節。偏襟白袍搭著青綠針織背心；他的筆記總先寫下「為什麼」。'},
    {id:'herbal-mentor',name:'藥圃導師',role:'導師',traits:'長者・圓弧臉',color:'gold',image:'herbal-mentor-portrait.webp',line:'先好好觀察，再慢慢下結論。',story:'酒紅針織帽下露出銀髮，笑起來眼角彎彎的。鼠尾草綠圍裙裝著小工具，她把薄荷盆栽當成每天的觀察練習。'},
    {id:'lab-engineer',name:'砥石技師',role:'技師',traits:'中年・寬闊臉',color:'mint',image:'lab-engineer-portrait.webp',line:'把誤差找出來，也是一次進步。',story:'寬闊臉龐、爽朗笑容、灰黑短髮與穩穩的肩膀。靛藍拼肩工作外套有大小不同的口袋，他習慣量兩次，再記下一次。'},
    {id:'balance-analyst',name:'沐衡分析師',role:'分析師',traits:'中年・長形臉',color:'violet',image:'balance-analyst-portrait.webp',line:'讓證據，替每個推測說話。',story:'深色側瀏海間有一縷銀色，長臉上帶著溫暖笑意。淺藍翻袖白袍配著簡單背心，她愛把相似的現象放在一起比較。'},
    {id:'dawn-intern',name:'晨芽實習生',role:'實習生',traits:'青年・短圓臉',color:'rose',image:'dawn-intern-portrait.webp',line:'不怕問得簡單，只怕沒問明白。',story:'齊瀏海黑色短髮、薄荷髮夾和開朗的笑容。珊瑚色拼接短外套配著卡片冊，她會把新名詞改寫成生活裡聽得懂的話。'},
    {id:'river-fellow',name:'溯溪學者',role:'訪問學者',traits:'青年・收窄下顎',color:'mint',image:'river-fellow-portrait.webp',line:'換個角度，也許就看見答案。',story:'微微豎起的黑色短髮、修長臉型與明亮笑容。淡藍襯衫外搭圓袋短白袍，他把不同學科的線索收進同一本資料夾。'}
  ];
  const PETS=[
    {id:'beaker',name:'泡泡燒杯',vessel:'燒杯',image:'beaker.webp',line:'把好奇心裝到八分滿。',fact:'燒杯適合盛裝、混合液體；杯身刻度主要供估算，不能取代精密量器。'},
    {id:'flask',name:'旋旋錐瓶',vessel:'錐形瓶',image:'flask.webp',line:'晃一晃，靈感就醒來了。',fact:'錐形瓶的窄口與寬底，方便旋轉混合液體；常見於滴定實驗中承接待測液。'},
    {id:'cylinder',name:'刻刻量筒',vessel:'量筒',image:'cylinder.webp',line:'把進步，一格一格記下。',fact:'讀取透明水溶液的體積時，視線應與凹液面最低處同高，避免視差。'},
    {id:'mortar',name:'咕嚕研缽',vessel:'研缽與研杵',image:'mortar.webp',line:'大問題，也能慢慢磨成小片段。',fact:'研缽搭配研杵，用來研碎固體或混合粉末；使用前後應清潔，避免交叉污染。'}
  ];
  const BUILDINGS=[
    {id:'pharmaceutics',school:'臺大',hall:'hall-ntu.webp',name:'藥劑樓',subtitle:'藥劑 · 生物藥劑',number:'01',color:'mint',description:'從劑型、溶離到體內旅程，讓抽象概念變得看得見。'},
    {id:'pharmacology',school:'清大',hall:'hall-nthu.webp',name:'藥理樓',subtitle:'藥理 · 藥物化學',number:'02',color:'violet',description:'循著受體、訊號與結構，找到藥物作用的關鍵。'},
    {id:'herbal',school:'成大',hall:'hall-ncku.webp',name:'生藥樓',subtitle:'藥物分析 · 生藥',number:'03',color:'leaf',description:'走進溫室與分析實驗室，讀懂植物和分子的線索。'},
    {id:'battle',school:'清大',hall:'hall-battle.webp',name:'對戰樓',subtitle:'怪物試煉 · 雙人競技',number:'04',color:'rose',description:'把讀懂的知識化成攻擊。單人打怪、雙人交鋒，都從這裡出發。'},
    {id:'life',school:'成大',hall:'hall-life.webp',name:'生活工坊',subtitle:'補給 · 星願 · 造型',number:'05',color:'gold',description:'備好下一場冒險的補給，換上喜歡的造型，和器皿夥伴一起出發。'}
  ];
  const FLOORS={
    study:[{id:'practice',level:'1F',name:'知識教室',description:'隨機 5 題，從今天的一點理解開始。'},{id:'calculation',level:'2F',name:'計算研究室',description:'練習題庫中與計算相關的題目。'},{id:'exam',level:'3F',name:'歷屆試煉室',description:'選一份歷屆試題，逐步讀懂每個觀念。'}],
    battle:[{id:'arena',level:'1F',name:'怪物試煉場',description:'兩回合打怪，累積個人每週銅、銀、金、鑽石積分。'},{id:'duel',level:'2F',name:'雙人競技場',description:'自動配對或房號邀請，和真人進行兩回合知識友誼賽。'}],
    life:[{id:'shop',level:'1F',name:'補給商店',description:'用金幣購買回合前知識補給券。'},{id:'draw',level:'2F',name:'星願工坊',description:'用答題取得的星願券，抽取戰鬥裝備。'},{id:'wardrobe',level:'3F',name:'造型研究室',description:'自由更換人物外觀；完成新手任務後，與器皿夥伴一起成長。'}]
  };
  function fresh(){return {version:1,character:'graduate',pet:null};}
  function restore(raw){
    if(raw===undefined)return fresh();
    if(!raw||Array.isArray(raw)||typeof raw!=='object'||raw.version!==1||!CHARACTERS.some(c=>c.id===raw.character)||(raw.pet!==null&&!PETS.some(p=>p.id===raw.pet)))throw Error('人物或夥伴的外觀資料不正確。');
    return {version:1,character:raw.character,pet:raw.pet};
  }
  function character(id){return CHARACTERS.find(c=>c.id===id)||CHARACTERS[2];}
  function pet(id){return PETS.find(p=>p.id===id)||null;}
  function choose(state,kind,id){
    if(kind==='character'&&CHARACTERS.some(c=>c.id===id)){state.appearance.character=id;return true;}
    if(kind==='pet'&&(id===null||PETS.some(p=>p.id===id))&&(id===null||state.companion?.unlocked)){state.appearance.pet=id;return true;}
    return false;
  }
  function floors(id){return FLOORS[id]||FLOORS.study;}
  function pool(questions,subject,floor,exam){
    if(!BUILDINGS.slice(0,3).some(b=>b.id===subject)||!FLOORS.study.some(f=>f.id===floor))return [];
    return questions.filter(q=>!q.needsReview&&q.subject===subject&&(floor!=='calculation'||q.calculation)&&(floor!=='exam'||q.exam===exam));
  }
  return {CHARACTERS,PETS,BUILDINGS,FLOORS,fresh,restore,character,pet,choose,floors,pool};
});
