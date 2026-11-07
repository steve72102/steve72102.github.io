(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.MindEngine,typeof module==='object'&&module.exports?require('./wish.js'):root.MindWish,typeof module==='object'&&module.exports?require('./social-economy.js'):root.MindEconomy);if(typeof module==='object'&&module.exports)module.exports=api;else root.MindAdventure=api;})(typeof window==='object'?window:globalThis,function(E,F,P){
  'use strict';
  const MAX=100000000,SLOTS={jacket:'外套',cape:'披風',shirt:'上衣',pants:'褲子',shoes:'鞋子',hat:'帽子',accessory:'配戴物',handheld:'手持物'};
  const STYLE_SLOTS=Object.keys(SLOTS);
  const STYLE_SETS=[
{"level":10,"key":"prism","name":"虹彩啟程","color":"prism","names":["虹彩燕尾短外套","七色扇形肩披","珊瑚立領衫","寶藍束腳褲","金邊步行鞋","稜光貝雷帽","虹晶胸章","彩頁觀察冊"],"text":"洋紅燕尾、青綠扇披與金色稜線，八欄可獨立混搭。","music":"原創彩色學院"},
{"level":20,"key":"solar","name":"晴橙學院","color":"solar","names":["晴橙雙排外套","藍綠斜裁肩披","檸黃格線衫","紫藍闊腿褲","橙白高幫鞋","晴空報童帽","日輪筆記徽","晴空研習板"],"text":"晴橙雙排與不對稱肩披，搭配紫藍闊腿和明黃格線。","music":"原創彩色學院"},
    {level:30,key:'bach',name:'單線行旅',music:'巴哈｜無伴奏大提琴組曲第一號〈前奏曲〉',image:'./assets/equipment/level30-bach.webp',castImage:'./assets/equipment/level30-bach-cast.webp',color:'brown',names:['行旅採樣外套','墨綠短肩披','米白棉襯衣','耐磨收納褲','低筒步行鞋','軟質野外帽','單線研究別針','採樣筆記本'],text:'一條連續細線穿過現代野外採樣服。'},
    {level:40,key:'schumann',name:'記憶書房',music:'舒曼｜〈夢幻曲〉',image:'./assets/equipment/level40-schumann.webp',castImage:'./assets/equipment/level40-schumann-cast.webp',color:'lilac',names:['霧紫圓角外套','淺紫短圍肩','燕麥棉襯衣','暖灰直筒褲','淺色低跟便鞋','針織軟帽','折頁書籤別針','回想手札'],text:'柔和的回折與留白，像安靜整理一頁筆記。'},
    {level:50,key:'mozart',name:'幾何序曲',music:'莫札特｜《魔笛》序曲',image:'./assets/equipment/level50-mozart.webp',castImage:'./assets/equipment/level50-mozart-cast.webp',color:'cobalt',names:['交疊裁片外套','藍白平整披片','奶油白高領衣','炭灰俐落長褲','藍灰簡線低鞋','分片布帽','幾何量測徽記','折頁學習圖冊'],text:'交錯幾何裁片與清楚的現代線條。'},
    {level:60,key:'haydn',name:'四線晴空',music:'海頓｜《雲雀》弦樂四重奏第一樂章',image:'./assets/equipment/level60-haydn.webp',castImage:'./assets/equipment/level60-haydn-cast.webp',color:'sage',names:['可修復拉鍊外套','四線圓弧肩披','雲白針織上衣','寬鬆活動工作褲','可修補綁帶鞋','軟質帆布帽','四線交會徽記','分層研習冊'],text:'四條布料通道交織成輕量、可修復的學習衣著。'},
    {level:70,key:'requiem',name:'餘光檔案',music:'莫札特｜《安魂曲》〈落淚之日〉',image:'./assets/equipment/level70-requiem.webp',color:'ink',names:['墨藍側衩長外套','骨白獨立肩披','織紋立領長上衣','炭灰寬直筒褲','骨白耐走低鞋','低檐織紋布帽','摺頁花瓣胸針','檔案研習冊'],text:'層疊的合唱感化為披搭與長衣；融入印度服裝剪裁，保留原創、實用的學院造型。'},
    {level:80,key:'letter',name:'每日來信',music:'張雨生｜〈天天想你〉',image:'./assets/equipment/level80-letter.webp',color:'dusk',names:['暮藍寬鬆短外套','摺信短肩披片','米白細條針織衫','石墨灰直筒褲','米白帆布步行鞋','柔軟暮藍漁夫帽','雙弧書籤胸針','往返研習冊'],text:'反覆弧線和暖色信紙感，搭配英國九〇年代的寬鬆日常剪裁。'},
    {level:90,key:'tide',name:'海風切拍',music:'ATEEZ｜〈BAD〉',image:'./assets/equipment/level90-tide.webp',color:'teal',names:['海藍綠開領薄外套','波浪邊遮陽肩披','骨白透氣棉上衣','石墨沙色亞麻長褲','海藍綠帆布低鞋','柔軟編織遮陽帽','潮汐書頁胸針','海岸觀察筆記'],text:'錯位波浪線與透氣的 aloha 服裝語彙，創作清爽的海岸學習裝。'}
  ];
  // Fruit collections are ordinary coin purchases. Their silhouettes and colour
  // stories are independent of rarity, character choice and combat progression.
  const FRUIT_SETS=[
    {key:'citrus',season:'2026Q4',music:'Afrobeat',musicKey:'afrobeat',name:'柑橘航海',color:'citrus',mood:'橙黃 × 深海藍 × 奶油白',names:['橙帆雙排短外套','浪花水手領肩披','奶油條紋棉衫','深海摺線長褲','橙邊帆布步行鞋','象牙航海軟帽','柑橘切片胸針','橙帆觀察手札'],text:'俐落雙排短外套配水手領，橙黃滾邊、海藍條紋與柑橘切片扣飾，穿出明亮的航海學院風；Afrobeat 的交錯節奏轉成雙排扣與橙瓣波紋。',pieces:['合身雙排剪裁留出抬手空間，橙黃色翻領與海藍袖口相互呼應。','奶油白水手領落在肩線內，外緣繡上雙層海藍波紋。','柔軟棉衫以細條紋和小面積橙色領口提亮層次。','深海藍直筒褲沿腿線收整，褲腳保留一圈橙色細滾邊。','奶油白帆布鞋配橙色包邊與海藍鞋帶，輪廓輕巧耐走。','低帽頂軟帽搭配海藍帽帶，果瓣刺繡留在側邊。','小巧柑橘切片以金色外框固定，不遮住衣服的剪裁。','海藍布面手札包上橙色書角，書帶末端綴著小葉片。']},
    {key:'berry',season:'2026Q4',music:'藍草音樂',musicKey:'bluegrass',name:'莓果禮裝',color:'berry',mood:'莓紅 × 玫瑰粉 × 象牙白',names:['莓紅燕尾禮服外套','玫瑰花瓣短肩披','象牙細褶襯衫','莓紫修身禮服褲','玫瑰扣帶低鞋','莓紅柔軟貝蕾帽','金枝莓果胸針','玫瑰緞面研習冊'],text:'以收腰燕尾、細褶與花瓣邊肩披構成典雅禮裝；莓果珠飾點綴玫瑰粉與象牙白，華麗而輕盈；藍草音樂的弦線節奏轉成細褶、交織滾邊與莓果花枝。',pieces:['莓紅燕尾外套順著肩寬和腰線收束，玫瑰粉翻領帶出明亮層次。','花瓣形肩披輕覆上臂，象牙滾邊與細金線勾勒弧度。','象牙白立領襯衫以細褶排列，領口只留一枚小莓紅扣。','莓紫長褲沿膝線微收，穿搭禮服也能自在走動。','低跟扣帶鞋使用玫瑰粉鞋面，莓紅鞋尖與細金扣呼應禮裝。','柔軟莓紅貝蕾帽偏側配戴，以小葉形刺繡收尾。','金色枝葉托住三枚莓果珠飾，大小配合角色胸前比例。','玫瑰緞面封皮搭配莓紅書脊，書角壓上細小葉紋。']},
    {key:'pomelo',season:'2026Q4',music:'Ambient 環境音樂',musicKey:'ambient',name:'青柚東方',color:'pomelo',mood:'玉青 × 柚黃 × 月白',names:['玉青斜襟長外套','月白雲弧肩披','柚白立領上衣','墨綠側摺長褲','玉青織邊平底鞋','柚葉摺檐軟帽','青柚葉環胸針','月白採葉圖冊'],text:'斜襟、立領和側衩組成現代東方剪裁；玉青與月白之間加上一點柚黃，果葉紋樣沿著衣緣舒展；Ambient 的緩慢層次化為柔和葉脈與雲弧披搭。',pieces:['玉青長外套以斜襟收攏，側衩保留步幅，細柚黃線條延伸身形。','月白短肩披以雲弧裁邊連接肩線，葉脈細繡集中在衣緣。','月白立領上衣採平整前襟，柚黃色盤形小扣作為點綴。','墨綠直筒長褲加入側摺，轉身與跨步仍保有俐落線條。','低筒平底鞋以玉青鞋面和月白織邊搭配，鞋頭飾一筆葉脈。','低檐軟帽沿帽邊作斜摺，柚葉刺繡與衣襟方向呼應。','青柚圓環與兩片細葉相扣，月白中心提亮胸前。','月白圖冊以玉青書脊包覆，柚黃頁籤標記植物觀察。']},
    {key:'pineapple',season:'2026Q4',music:'Funk',musicKey:'funk',name:'鳳梨工裝',color:'pineapple',mood:'鳳梨黃 × 森林綠 × 奶白',names:['金格短版工作外套','葉綠工具肩披','奶白機能棉上衣','森林綠收納工作褲','金黃拼片工作鞋','葉冠軟質工作帽','鳳梨菱格徽章','金格採樣記錄冊'],text:'短版工裝、立體口袋與菱格壓線搭配鳳梨黃和森林綠；葉冠元素縮成俐落徽記，實用又有活力；Funk 的切分感化為錯落口袋線與菱格節奏。',pieces:['金黃短版外套沿肩線拼接森林綠，菱格壓線集中於口袋，不堆疊厚重裝飾。','葉綠短肩披以分片接縫呈現工具收納感，奶白滾邊提亮輪廓。','奶白棉上衣配金黃領口與小型綠色織標，作為明亮內搭。','森林綠工裝褲在大腿外側設平貼口袋，膝部留活動餘量。','金黃與奶白拼片的低筒工作鞋，深綠鞋底呼應褲色。','柔軟工作帽以葉形分片收束帽頂，保留低帽型。','菱格果身與小片葉冠組成金綠徽章，尺寸不超過胸前配戴區。','金格封面的採樣冊加上森林綠束帶，頁邊用奶白小標籤分區。']},
    {key:'cherry',season:'2026Q4',music:'Disco',musicKey:'disco',name:'櫻桃街頭',color:'cherry',mood:'櫻桃紅 × 墨黑 × 冰藍',names:['櫻紅拼袖短夾克','冰藍連帽短肩披','奶白櫻桃印花衫','墨黑束口機能褲','櫻紅撞色運動鞋','墨黑彎檐棒球帽','雙櫻桃琺瑯別針','冰藍貼布隨行冊'],text:'短夾克、拼色袖口與束口褲走輕快街頭路線；櫻桃紅、墨黑和冰藍形成鮮明對比，雙櫻桃只作精緻點題；Disco 的舞步節拍化為亮色拼袖與點狀反光縫線。',pieces:['櫻紅短夾克配冰藍拼袖，羅紋下襬收在腰線，兼顧動作空間。','冰藍連帽肩披採短版裁法，櫻紅抽繩點亮頸側。','奶白內搭只在胸口印小型雙櫻桃，讓夾克的撞色成為主角。','墨黑機能褲沿腿部略收，冰藍側條與束口褲腳增加節奏。','櫻紅運動鞋搭奶白鞋底與冰藍鞋帶，鞋面分片貼合腳形。','墨黑彎檐帽以櫻紅帽緣和一枚雙果刺繡點綴。','紅色雙櫻桃與綠葉以細金框相連，配在領口下方。','冰藍布面手冊以櫻紅貼布與黑色束帶呈現街頭隨行感。']},
    {key:'grape',season:'2026Q4',music:'Synth-pop',musicKey:'synth-pop',name:'葡萄星象',color:'grape',mood:'星紫 × 薄荷青 × 淺金',names:['星紫弧領長外套','薄荷星軌長肩披','月白微光高領衫','夜紫直線長褲','星紫金邊低鞋','薄荷星紋軟帽','葡萄星群胸針','星軌觀測圖冊'],text:'弧領長外套和垂墜肩披結合星軌刺繡；星紫、薄荷青與淺金交錯，葡萄珠飾化為細小星群；Synth-pop 的合成器波形轉成星軌細線與果珠串。',pieces:['星紫長外套以弧領和不對稱衣緣拉長線條，淺金滾邊沿著剪裁延伸。','薄荷青肩披自然垂落，疏落星點與金色弧線沿下襬排列。','月白高領內搭保留乾淨中線，星紫領緣襯出臉部。','夜紫直筒長褲用細金側線連接上下身，膝下輪廓保持輕巧。','星紫低鞋配月白鞋底，薄荷青鞋帶與金邊呼應星軌。','薄荷青軟帽以小型紫色葡萄星群刺繡點綴，帽簷不遮眼。','幾枚紫色葡萄珠飾沿金色星軌排列，葉片化成小月牙。','深紫觀測冊包上薄荷書脊，淺金星軌連接封面上的細小果實。']}
  ];
  const FRUIT_PRICES=[240,180,160,160,120,140,100,180];
  const SHOP_SEASONS=[{id:'2026Q4',name:'果園即興',label:'2026 第四季',startsOn:'2026-10-01',endsBefore:'2027-01-01',theme:'音樂 × 水果'}];
  function shopSeasonStatus(id,day=E.today()){
    const season=SHOP_SEASONS.find(value=>value.id===id);
    if(!season)throw Error('找不到商城季度。');
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw Error('商城日期不正確。');
    return day<season.startsOn?'upcoming':day<season.endsBefore?'active':'archive';
  }
  const canonicalSlot=g=>g.slot==='boots'?'shoes':g.slot==='badge'?'accessory':g.slot==='coat'?(/披風|披肩/.test(g.name)?'cape':'jacket'):g.slot;
  const GEAR=[
    {id:'coat-dawn',name:'晨光短披風',slot:'coat',tier:0,price:80,attack:2,hp:8,guard:1,color:'mint',text:'輕裝出發，把未知留給今天。'},
    {id:'coat-herb',name:'藥圃旅行披風',slot:'coat',tier:1,price:240,attack:4,hp:18,guard:2,color:'leaf',text:'葉紋記下每一段觀察與驗證。'},
    {id:'coat-star',name:'星紋長披風',slot:'coat',tier:2,price:600,attack:7,hp:30,guard:3,color:'violet',text:'把零散的知識，織成一片星空。'},
    {id:'boots-dawn',name:'晨露輕靴',slot:'boots',tier:0,price:60,attack:1,hp:4,guard:0,color:'mint',text:'從第一步，到第一個懂了。'},
    {id:'boots-path',name:'尋跡旅行靴',slot:'boots',tier:1,price:180,attack:3,hp:8,guard:1,color:'leaf',text:'耐心循著證據，找到下一個線索。'},
    {id:'boots-star',name:'星路遠征靴',slot:'boots',tier:2,price:480,attack:6,hp:14,guard:2,color:'violet',text:'跨過迷霧，也記得回頭驗算。'},
    {id:'badge-seed',name:'萌芽研究章',slot:'badge',tier:0,price:100,attack:2,hp:5,guard:0,color:'mint',text:'每個好問題，都是一顆種子。'},
    {id:'badge-prism',name:'稜光分析章',slot:'badge',tier:1,price:260,attack:5,hp:10,guard:1,color:'leaf',text:'從不同角度，檢查同一份證據。'},
    {id:'badge-sage',name:'賢者知識章',slot:'badge',tier:3,price:900,attack:9,hp:20,guard:3,color:'gold',text:'真正的力量，是願意一直學習。'}
  ];
  GEAR.push(...F.GEAR);
  for(let i=0;i<GEAR.length;i++)GEAR[i]={...GEAR[i],slot:canonicalSlot(GEAR[i])};
  for(const set of STYLE_SETS)for(let i=0;i<STYLE_SLOTS.length;i++)GEAR.push({id:'style-'+set.key+'-'+STYLE_SLOTS[i],name:set.names[i],slot:STYLE_SLOTS[i],tier:0,level:set.level,source:'milestone',style:set.key,color:set.color,price:null,attack:[2,1,0,0,1,1,2,0][i],hp:[6,4,4,4,2,2,0,0][i],guard:[1,1,0,0,0,0,0,0][i],text:set.text});
  for(const set of FRUIT_SETS)for(let i=0;i<STYLE_SLOTS.length;i++)GEAR.push({id:'fruit-'+set.key+'-'+STYLE_SLOTS[i],name:set.names[i],slot:STYLE_SLOTS[i],tier:0,source:'fruit',season:set.season,style:set.key,color:set.color,price:FRUIT_PRICES[i],attack:[2,1,0,0,1,1,2,0][i],hp:[6,4,4,4,2,2,0,0][i],guard:[1,1,0,0,0,0,0,0][i],text:set.pieces[i]});
  function setIds(value){const key=typeof value==='string'?value:value?.key,prefix=FRUIT_SETS.some(set=>set.key===key)?'fruit':STYLE_SETS.some(set=>set.key===key)?'style':null;return prefix?STYLE_SLOTS.map(slot=>prefix+'-'+key+'-'+slot):[];}
  const QUESTS=[
    {id:'arrival',chapter:'序章',name:'把學院走成自己的地圖',guide:'苔光教授',story:'新同學，先不用急著比誰答得快。沿著步道，看看三座學科樓各自在研究什麼。',goal:'走進藥劑樓、藥理樓與生藥樓',coins:50,item:'coat-dawn',route:'home'},
    {id:'first-light',chapter:'第一章',name:'讓第一盞知識燈亮起',guide:'星序博士',story:'一個答案不只是一個字母。讀完每日知識卡，再用自己的理解答對五道不同的題目。',goal:'領取每日補給，並累積答對 5 道不同題目',coins:80,item:'boots-dawn',route:'practice'},
    {id:'paper-guard',chapter:'第二章',name:'紙頁間的守門人',guide:'璃砂研究員',story:'散落的筆記捲成了紙頁小怪。穿上裝備，透過兩回合答題，把混亂的概念重新理順。',goal:'擊敗紙頁小怪 1 次',coins:100,item:'badge-seed',route:'arena'},
    {id:'prepared',chapter:'第三章',name:'為下一次遠行整裝',guide:'砥石技師',story:'好的裝備是幫手，理解才是方向。去整理背包，選兩件適合今天的衣著，再繼續出發。',goal:'同時穿戴 2 種衣著裝備',coins:100,item:'coat-herb',route:'bag'},
    {id:'runes',chapter:'第四章',name:'讀懂符文留下的理由',guide:'沐衡分析師',story:'長得相似的選項，往往只差一個條件。累積二十道理解，再向符文守衛說明你的答案。',goal:'累積答對 20 道不同題目，並擊敗符文守衛',coins:180,item:'boots-path',route:'arena'},
    {id:'clear-sky',chapter:'第五章',name:'把迷霧讀成晴天',guide:'杉庭院士',story:'不要把熟悉當成理解。帶著四十道不同題目的經驗，再去面對迷霧術士，完成第一段學院主線。',goal:'累積答對 40 道不同題目，並擊敗迷霧術士',coins:300,item:'coat-star',route:'arena'}
  ];
  const places=['pharmaceutics','pharmacology','herbal','battle','life'],enemies=['bronze','silver','gold','diamond'];
  const gear=id=>GEAR.find(g=>g.id===id)||null;
  function fresh(){return {version:2,capacity:50,items:{},pending:{},loadout:Object.fromEntries(STYLE_SLOTS.map(k=>[k,null])),training:{},equipmentLevels:{},notes:0,notesDay:'',notedIds:[],noteCounts:{},quest:0,visited:[],defeated:[],lootDays:{},socialId:null,friends:[]};}
  function loadout(raw){const out=fresh().loadout;if(raw===undefined)return out;if(!raw||Array.isArray(raw)||typeof raw!=='object')throw Error('衣著資料不正確');for(const [legacy,target] of [['coat',null],['boots','shoes'],['badge','accessory']])if(raw[legacy]!=null){const id=raw[legacy],g=gear(id),slot=target||g?.slot;if(!g||g.slot!==slot||legacy==='coat'&&!['jacket','cape'].includes(slot)||out[slot])throw Error('衣著欄位不正確');out[slot]=id;}for(const k of STYLE_SLOTS){const id=raw[k]===undefined?null:raw[k];if(id!==null&&!(k==='handheld'?(E.ITEMS.some(g=>g.id===id)||gear(id)?.slot==='handheld'):gear(id)?.slot===k))throw Error('衣著欄位不正確');if(id!==null)out[k]=id;}return out;}
  function bonus(raw,level=Infinity,training={}){return Object.values(loadout(raw)).reduce((s,id)=>{const g=gear(id),baseLevel=g?.level||1,stage=level>=baseLevel?Math.min(3,training?.[id]||0,Math.floor((level-baseLevel)/10)+1):0;if(g&&level>=baseLevel){s.attack+=g.attack;s.hp+=g.hp;s.guard+=g.guard;}s.attack+=stage;s.hp+=stage*2;return s;},{attack:0,hp:0,guard:0});}
  function count(s){return Object.values(s.inventory).reduce((n,v)=>n+v,0);}
  function wardrobeCount(s){return Object.values(s.rpg?.items||{}).reduce((n,v)=>n+v,0);}
  function canStore(s,id){const g=gear(id),n=s.rpg?.items?.[id]||0;return !!g&&g.source!=='milestone'&&Number.isSafeInteger(n)&&n>=0&&n<MAX;}
  function room(s,n=1){return count(s)+n<=(s.rpg?.capacity||50);}
  function grant(s,id){if(!canStore(s,id))return false;s.rpg.items[id]=(s.rpg.items[id]||0)+1;return true;}
  function buy(s,id,day=E.today()){const g=gear(id);if(!g||g.source==='fountain'||g.source==='milestone'||g.source==='fruit'&&shopSeasonStatus(g.season,day)==='upcoming'||s.arena.coins<g.price||!grant(s,id))return false;s.arena.coins-=g.price;return true;}
  function equip(s,id){const g=gear(id),knowledge=E.ITEMS.find(i=>i.id===id),level=Math.floor(s.xp/100)+1;if(knowledge){if(!s.inventory[id])return false;s.equipped=id;s.rpg.loadout.handheld=id;return true;}if(!g||level<(g.level||1)||g.source!=='milestone'&&!s.rpg.items[id])return false;s.rpg.loadout[g.slot]=id;if(g.slot==='handheld')s.equipped=null;return true;}
  // Validate every piece before replacing any slot: failed set wear is a no-op.
  function equipSet(s,ids){
    if(!Array.isArray(ids)||!ids.length||ids.length>STYLE_SLOTS.length)return false;
    const level=Math.floor(s.xp/100)+1,slots=new Set(),pieces=[];
    for(const id of ids){const g=gear(id),knowledge=g?null:E.ITEMS.find(item=>item.id===id),slot=g?.slot||(knowledge?'handheld':null);if(!slot||slots.has(slot)||g&&(level<(g.level||1)||g.source!=='milestone'&&!s.rpg.items[id])||knowledge&&!s.inventory[id])return false;slots.add(slot);pieces.push({id,slot,knowledge:!!knowledge});}
    const next={...s.rpg.loadout};let equipped=s.equipped;
    for(const item of pieces){next[item.slot]=item.id;if(item.slot==='handheld')equipped=item.knowledge?item.id:null;}
    s.rpg.loadout=next;s.equipped=equipped;return true;
  }
  function unequip(s,slot){if(!Object.hasOwn(SLOTS,slot))return false;s.rpg.loadout[slot]=null;if(slot==='handheld')s.equipped=null;return true;}
  function earnNote(s,id,correct,day=E.today()){
    if(!correct)return 0;
    if(typeof id!=='string'||!id.length||id.length>100||['__proto__','constructor','prototype'].includes(id))throw Error('題目識別碼不正確');
    const r=s.rpg;if(r.notesDay!==day){r.notesDay=day;r.notedIds=[];r.noteCounts={};}
    r.noteCounts??={};const count=Object.hasOwn(r.noteCounts,id)?r.noteCounts[id]:r.notedIds.includes(id)?1:0;
    const gained=Math.min(count===0?2:count===1?1:0,MAX-r.notes);if(!gained)return 0;
    if(!r.notedIds.includes(id))r.notedIds.push(id);
    r.noteCounts[id]=count+1;r.notes+=gained;return gained;
  }
  // Keep the original three combat milestones. Equipment levels are separate
  // from a garment's character-level unlock requirement and do not inflate PvP.
  const MAX_EQUIPMENT_LEVEL=90;
  const equipmentLevel=(r,id)=>r.equipmentLevels?.[id]??Math.max(1,(r.training?.[id]||0)*30);
  const equipmentStage=level=>Math.min(3,Math.floor(level/30));
  function trainCost(stage){return [5,15,35][stage]??Infinity;}
  function trainingRequirement(id,nextLevel){return (gear(id)?.level||1)+Math.max(0,equipmentStage(nextLevel)-1)*10;}
  function train(s,id){
    const g=gear(id),knowledge=E.ITEMS.find(i=>i.id===id),level=Math.floor(s.xp/100)+1,owned=g?.source==='milestone'?level>=g.level:g?!!s.rpg.items[id]:!!s.inventory[id];
    const current=equipmentLevel(s.rpg,id),stage=equipmentStage(current),cost=trainCost(stage);
    if(!(g||knowledge)||!owned||current>=MAX_EQUIPMENT_LEVEL||level<trainingRequirement(id,current+1)||s.rpg.notes<cost)return false;
    s.rpg.notes-=cost;s.rpg.equipmentLevels??={};s.rpg.equipmentLevels[id]=current+1;
    const nextStage=equipmentStage(current+1);if(nextStage)s.rpg.training[id]=nextStage;
    return true;
  }
  function training(raw){if(raw===undefined)return {};if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>GEAR.length+E.ITEMS.length)throw Error('研習資料不正確');const out={};for(const [id,n] of Object.entries(raw)){if(!(gear(id)||E.ITEMS.some(g=>g.id===id))||!Number.isInteger(n)||n<1||n>3)throw Error('研習資料不正確');out[id]=n;}return out;}
  function sell(s,id){const g=gear(id)||E.ITEMS.find(i=>i.id===id),items=gear(id)?s.rpg.items:s.inventory;if(!g||g.source==='milestone'||!items[id])return false;if(items[id]===1&&(s.equipped===id||Object.values(s.rpg.loadout).includes(id)))return false;items[id]--;if(!items[id])delete items[id];P.award(s.arena,(g.sellValue||Math.max(5,Math.floor((g.price||[40,80,160,320][g.tier])/4))));return true;}
  function expandPrice(s){return 300+(s.rpg.capacity-50)*20;}
  function expand(s){const price=expandPrice(s);if(s.rpg.capacity>=100||s.arena.coins<price)return false;s.arena.coins-=price;s.rpg.capacity+=10;return true;}
  function visit(s,id){if(!places.includes(id)||s.rpg.visited.includes(id))return false;s.rpg.visited.push(id);return true;}
  function progress(s){const r=s.rpg,q=QUESTS[r.quest];if(!q)return {done:true,current:1,total:1};const data=[
    [r.visited.filter(x=>places.slice(0,3).includes(x)).length,3],
    [Math.min(5,s.mastered.length)+(s.claimed?1:0),6],
    [Number(r.defeated.includes('bronze')),1],
    [Math.min(2,Object.values(r.loadout).filter(Boolean).length),2],
    [Math.min(20,s.mastered.length)+Number(r.defeated.includes('silver')),21],
    [Math.min(40,s.mastered.length)+Number(r.defeated.includes('gold')),41]
  ][r.quest];return {current:data[0],total:data[1],done:data[0]>=data[1]};}
  function claimQuest(s){const q=QUESTS[s.rpg.quest];if(!q||!progress(s).done||!grant(s,q.item))return null;P.award(s.arena,q.coins);s.rpg.quest++;return q;}
  function recordBattle(s){const b=s.arena.battle,r=s.rpg;if(!r||!b||b.phase!=='done'||!b.result?.win)return null;let changed=false;if(!r.defeated.includes(b.enemyId)){r.defeated.push(b.enemyId);changed=true;}if(!b.result.eligible||b.day<=(r.lootDays[b.enemyId]||''))return changed?{recorded:true}:null;
    const pools={bronze:['coat-dawn','boots-dawn','badge-seed'],silver:['coat-herb','boots-path','badge-prism'],gold:['coat-star','boots-star','badge-prism'],diamond:['badge-sage','coat-star','boots-star']};
    const seed=Array.from(b.day+b.enemyId+b.subject).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7),pool=pools[b.enemyId],id=pool[seed%pool.length];r.lootDays[b.enemyId]=b.day;r.pending[id]=Math.min(MAX,(r.pending[id]||0)+1);return {id,recorded:true};
  }
  function collect(s,id){if(!s.rpg.pending[id]||!grant(s,id))return false;s.rpg.pending[id]--;if(!s.rpg.pending[id])delete s.rpg.pending[id];return true;}
  function restore(raw){if(raw===undefined)return fresh();const bad=()=>{throw Error('主線或背包存檔不正確');};if(!raw||![1,2].includes(raw.version)||!Number.isInteger(raw.capacity)||raw.capacity<50||raw.capacity>100||raw.capacity%10||!Number.isInteger(raw.quest)||raw.quest<0||raw.quest>QUESTS.length)bad();const r=fresh();r.capacity=raw.capacity;r.quest=raw.quest;r.loadout=loadout(raw.loadout);
    for(const key of ['items','pending']){const obj=raw[key];if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length>GEAR.length)bad();for(const [id,n] of Object.entries(obj)){if(!gear(id)||!Number.isInteger(n)||n<1||n>MAX)bad();r[key][id]=n;}}
    for(const id of Object.values(r.loadout)){const g=gear(id);if(id&&g?.source!=='milestone'&&g&&!r.items[id])bad();}
    if(raw.training!==undefined)r.training=training(raw.training);
    if(raw.equipmentLevels!==undefined){
      if(!raw.equipmentLevels||typeof raw.equipmentLevels!=='object'||Array.isArray(raw.equipmentLevels)||Object.keys(raw.equipmentLevels).length>GEAR.length+E.ITEMS.length)bad();
      for(const [id,n] of Object.entries(raw.equipmentLevels)){
        if(!(gear(id)||E.ITEMS.some(g=>g.id===id))||!Number.isInteger(n)||n<1||n>MAX_EQUIPMENT_LEVEL||equipmentStage(n)!==(r.training[id]||0))bad();
        r.equipmentLevels[id]=n;
      }
    }
    // Saves predating equipment levels retain every already-earned stat bonus.
    for(const [id,stage] of Object.entries(r.training))if(!Object.hasOwn(r.equipmentLevels,id))r.equipmentLevels[id]=stage*30;
    if(raw.notes!==undefined){if(!Number.isInteger(raw.notes)||raw.notes<0||raw.notes>MAX)bad();r.notes=raw.notes;}
    if(raw.notesDay!==undefined){if(raw.notesDay!==''&&(typeof raw.notesDay!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw.notesDay)))bad();r.notesDay=raw.notesDay;}
    if(raw.notedIds!==undefined){if(!Array.isArray(raw.notedIds)||raw.notedIds.length>5000||new Set(raw.notedIds).size!==raw.notedIds.length||raw.notedIds.some(id=>typeof id!=='string'||id.length>100))bad();r.notedIds=raw.notedIds.slice();}
    if(raw.noteCounts!==undefined){
      if(!raw.noteCounts||typeof raw.noteCounts!=='object'||Array.isArray(raw.noteCounts)||Object.keys(raw.noteCounts).length>5000)bad();
      for(const [id,n] of Object.entries(raw.noteCounts)){if(!r.notedIds.includes(id)||!Number.isInteger(n)||n<1||n>2||['__proto__','constructor','prototype'].includes(id))bad();r.noteCounts[id]=n;}
    }
    for(const id of r.notedIds){if(!id.length||['__proto__','constructor','prototype'].includes(id))bad();if(!Object.hasOwn(r.noteCounts,id))r.noteCounts[id]=1;}
    for(const [key,allowed] of [['visited',places],['defeated',enemies]]){const a=raw[key];if(!Array.isArray(a)||a.length>allowed.length||new Set(a).size!==a.length||a.some(x=>!allowed.includes(x)))bad();r[key]=a.slice();}
    if(!raw.lootDays||typeof raw.lootDays!=='object'||Array.isArray(raw.lootDays)||Object.keys(raw.lootDays).length>4)bad();for(const [id,day] of Object.entries(raw.lootDays)){if(!enemies.includes(id)||typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)bad();r.lootDays[id]=day;}
    if(raw.socialId!==undefined&&raw.socialId!==null&&!/^[a-f0-9]{32}$/.test(raw.socialId))bad();r.socialId=raw.socialId||null;if(raw.friends!==undefined){if(!Array.isArray(raw.friends)||raw.friends.length>100)bad();for(const f of raw.friends){if(!f||!/^[a-f0-9]{32}$/.test(f.id)||typeof f.name!=='string'||!/^[\p{L}\p{N} _-]{1,16}$/u.test(f.name)||r.friends.some(x=>x.id===f.id))bad();r.friends.push({id:f.id,name:f.name});}}return r;
  }
  return {GEAR,SLOTS,STYLE_SETS,FRUIT_SETS,SHOP_SEASONS,QUESTS,MAX_EQUIPMENT_LEVEL,fresh,gear,setIds,shopSeasonStatus,loadout,bonus,count,wardrobeCount,canStore,room,grant,buy,equip,equipSet,unequip,earnNote,equipmentLevel,equipmentStage,trainingRequirement,trainCost,train,training,sell,expand,expandPrice,visit,progress,claimQuest,recordBattle,collect,restore};
});
