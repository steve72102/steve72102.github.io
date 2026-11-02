const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../game/academy.js'),W=require('../game/campus-walk.js'),E=require('../game/engine.js'),C=require('../game/combat.js'),R=require('../game/adventure.js'),J=require('../game/journey.js'),S=require('../game/social-economy.js');
const bankContext={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../game/bank.js'),'utf8'),bankContext);const questions=bankContext.window.MIND_BANK.questions;
class El{constructor(tag,attrs={},children=[]){this.tag=tag;this.attrs=attrs;this.children=children.flat(Infinity).filter(x=>x!=null&&x!==false);this.style={setProperty(){}};this.classList={toggle(){},remove(){}};this.isConnected=true;this.disabled=!!attrs.disabled;}append(...kids){this.children.push(...kids.flat(Infinity).filter(x=>x!=null&&x!==false));}setAttribute(k,v){this.attrs[k]=v;}focus(){}get text(){return this.children.map(c=>c instanceof El?c.text:String(c)).join(' ');}querySelector(selector){return flatten(this).find(n=>selector.startsWith('.')?(n.attrs.class||'').split(' ').includes(selector.slice(1)):false)||null;}}
const flatten=root=>(Array.isArray(root)?root:[root]).flatMap(n=>n instanceof El?[n,...n.children.flatMap(flatten)]:[]);
function fixture(options={}){
 const state={...E.fresh(),arena:C.fresh(),rpg:R.fresh(),profile:{name:'導覽測試'},appearance:A.fresh()};state.companion=J.companion(undefined,state);
 const node=(tag,attrs={},...children)=>new El(tag,attrs,children),btn=(text,onClick,cls='',disabled=false)=>node('button',{onClick,class:'button '+cls,disabled},text),note=text=>node('p',{},text);
 let tree=[],walk,ui,modal=[],started=[],went=[],propScenes=[];
 const window={MindAcademy:A,MindWalk:W,MindEngine:E,MindCombat:C,MindAdventure:R,MindJourney:J,MindEconomy:S,scrollTo(){},MindAvatar:()=>node('div',{class:'walk-actor'}),MindSceneUI:()=>({props:scene=>{propScenes.push(scene.kind);return node('div',{class:'test-props'});},water:()=>null,birds:()=>null}),MindLobbyUI:()=>({button:()=>node('button'),bind(root,id,initial,scene){options.bind?.(id,scene);},move(){},hide(){},disconnect(){},joinClass(){},leaveClass(){}}),MindWalkUI:opts=>{walk=opts;return {destroy(){opts.onPosition(opts.initial);},toward(){},reframe(){}};}};
 const document={body:{classList:{toggle(){},remove(){}}},documentElement:{},querySelector:s=>flatten(tree).find(n=>(n.attrs.class||'').split(' ').includes(s.slice(1))),getElementById:()=>null};
 vm.runInNewContext(fs.readFileSync(require.resolve('../game/academy-ui.js'),'utf8'),{window,document,requestAnimationFrame:()=>{}});
 function render(){tree=ui.home();ui.mount();}
 ui=window.MindAcademyUI({node,btn,note,title(){},go:p=>went.push(p),render,save(){},toast(){},start:(pool,label)=>started.push({pool,label}),questions,getState:()=>state,daily(){},openModal:(...kids)=>modal=kids,closeModal:()=>modal=[],adventure:()=>({questMini:()=>null}),wishing:()=>({badge:()=>null}),economy:()=>({brief:()=>'',classes(){}}),finance:()=>({enter:()=>Promise.resolve()})});render();
 const buttons=()=>flatten(tree).filter(n=>n.tag==='button'),click=text=>{const b=buttons().find(n=>n.text.includes(text));assert(b,'button '+text);assert(!b.disabled,'enabled '+text);b.attrs.onClick();};
 function enter(building){for(const step of W.travelRoute('campus','district:'+building))walk.onPortal(step.portal);click('進入'+A.BUILDINGS.find(b=>b.id===building).name);}
 return {ui,state,buttons,click,enter,started,went,propScenes,get walk(){return walk;},get tree(){return tree;},get modal(){return modal;}};
}
test('each enabled floor button selects the requested floor, starts its real activity and returns to the forecourt',()=>{for(const building of A.BUILDINGS){const f=fixture();f.state.academyProgress={pharmaceutics:3,pharmacology:3,herbal:3};f.enter(building.id);assert.equal(f.ui.currentBuilding(),building.id);for(const floor of A.floors(building.id)){const tab=f.buttons().find(b=>(b.attrs.class||'').includes('floor-tab')&&b.text.includes(floor.name));if(!tab.disabled)tab.attrs.onClick();assert.equal(f.walk.sceneId,'hall:'+building.id+':'+floor.id);const launch=flatten(f.tree).find(n=>n.tag==='button'&&n.text.startsWith('▶ '));if(launch){launch.attrs.onClick();if(E.SUBJECTS[building.id]){const run=f.started.at(-1);assert(run.pool.length);assert(run.pool.every(q=>q.subject===building.id));assert(run.label.includes(floor.name));}else assert.equal(f.went.at(-1),floor.id);}}f.click('離開大樓，回前庭');assert.equal(f.ui.currentBuilding(),null);assert.equal(f.walk.sceneId,'district:'+building.id);}});
test('classrooms render interactive props and direct class start/exit controls perform their labels',()=>{for(const building of Object.keys(W.classrooms)){const f=fixture();f.enter(building);const day=S.day(),room={id:day+'_'+building+'_1',number:1,day};f.state.arena.economy.wallet={rooms:{[building]:room.id}};f.ui.openClass(building,room);assert.equal(f.walk.sceneId,'classroom:'+building);assert(f.propScenes.includes('classroom'));f.click('上課，直接開始答題');assert(f.started.at(-1).pool.length);assert(f.started.at(-1).label.includes('第 1 班'));f.click('離開教室，回樓內大廳');assert(f.walk.sceneId.startsWith('hall:'+building+':'));}});

test('locked floors are disabled until the preceding subject stage is passed',()=>{const f=fixture();f.enter('herbal');const tab=()=>f.buttons().find(b=>(b.attrs.class||'').includes('floor-tab')&&b.text.includes('計算研究室'));assert(tab().disabled);tab().attrs.onClick();assert.equal(f.walk.sceneId,'hall:herbal:practice');f.state.academyProgress.herbal=1;f.ui.home();const tree=f.ui.home();const next=flatten(tree).find(b=>b.tag==='button'&&(b.attrs.class||'').includes('floor-tab')&&b.text.includes('計算研究室'));assert(!next.disabled);next.attrs.onClick();assert.equal(f.walk.sceneId,'hall:herbal:calculation');});


test('changing floors arrives at the destination desk after shared furniture is applied',()=>{
 const f=fixture({bind:(id,scene)=>{if(id==='hall:herbal:calculation'){const table=scene.surfaces.find(s=>s.arrival);table.x+=40;table.y+=15;table.polygon=table.polygon.map(p=>({x:p.x+40,y:p.y+15}));}}});f.state.academyProgress.herbal=3;f.enter('herbal');
 const original=f.walk.initial;f.state.session={ids:['retained-question'],index:0,answers:[],label:'unfinished',course:{subject:'herbal',floor:'practice'}};const before=JSON.stringify(f.state);
 f.click('計算研究室');let scene=f.walk.scene,table=scene.surfaces.find(s=>s.arrival);assert.equal(f.walk.sceneId,'hall:herbal:calculation');assert.notDeepEqual(f.walk.initial,original);assert(W.walkable(scene,f.walk.initial));assert.equal(f.walk.initial.x,table.x);assert(f.walk.initial.y>Math.max(...table.polygon.map(p=>p.y)));assert.equal(W.near(scene,f.walk.initial,45),null);assert.equal(JSON.stringify(f.state),before,'changing floors must leave all saved progress untouched');
 f.click('歷屆試煉室');assert.equal(f.walk.sceneId,'hall:herbal:exam');assert.deepEqual(f.walk.initial,W.deskArrival(f.walk.scene));f.click('知識教室');assert.equal(f.walk.sceneId,'hall:herbal:practice');assert.deepEqual(f.walk.initial,W.deskArrival(f.walk.scene));assert.equal(JSON.stringify(f.state),before);
});

test('the persistent class action works even when the route guide is collapsed',()=>{
 const f=fixture();f.enter('herbal');const action=f.buttons().find(b=>(b.attrs.class||'').split(' ').includes('world-attend-button'));assert(action);action.attrs.onClick();assert(f.started.at(-1).pool.every(q=>q.subject==='herbal'&&!q.calculation));
 const day=S.day(),room={id:day+'_herbal_1',number:1,day};f.state.arena.economy.wallet={rooms:{herbal:room.id}};f.ui.openClass('herbal',room);const classroomAction=f.buttons().find(b=>(b.attrs.class||'').split(' ').includes('world-attend-button'));assert(classroomAction);classroomAction.attrs.onClick();assert(f.started.at(-1).label.includes('第 1 班'));
});

test('hall and classroom views and minimaps use their matching clean background plates',()=>{
 for(const building of A.BUILDINGS){
  const f=fixture();f.enter(building.id);const hall=W.hall('',building.id);assert.match(hall.background,/^\.\/assets\/scene-objects\/hall-/);const image=flatten(f.tree).find(n=>n.tag==='img'&&(n.attrs.class||'').includes('interior-backdrop'));assert.equal(image.attrs.src,hall.background);const minimap=()=>flatten(f.tree).find(n=>n.tag==='button'&&(n.attrs.class||'').includes('world-minimap'));assert.equal(flatten(minimap()).find(n=>n.tag==='img').attrs.src,hall.background);
  if(W.classrooms[building.id]){const day=S.day(),room={id:day+'_'+building.id+'_1',number:1,day};f.state.arena.economy.wallet={rooms:{[building.id]:room.id}};f.ui.openClass(building.id,room);const scene=W.classrooms[building.id];assert.equal(scene.background,building.id==='pharmaceutics'?'./assets/illustrated-scenes/classroom-pharmaceutics.webp':'./assets/scene-objects/classroom-'+building.id+'-clean.webp');const backdrop=flatten(f.tree).find(n=>n.tag==='img'&&(n.attrs.class||'').includes('campus-backdrop'));assert.equal(backdrop.attrs.src,scene.background);assert.equal(flatten(minimap()).find(n=>n.tag==='img').attrs.src,scene.background);}
 }
});

test('reachable fixed fixtures open a read-only material observation without replacing normal entrances',()=>{
 const materials={wood:'木材',stone:'石材',metal:'金屬',glass:'玻璃',ceramic:'陶瓷',paper:'紙材',plant:'植物'};
 for(const building of A.BUILDINGS){
  const f=fixture();f.enter(building.id);
  const check=()=>{
   const scene=f.walk.scene,walk=f.walk,before=JSON.stringify(f.state),portals=JSON.stringify(scene.portals);
   assert(scene.inspections.length>0,'reachable fixtures in '+scene.roomKey);
   for(const item of scene.inspections){
    assert.equal(item.kind,'inspect');assert.equal(item.auto,false);assert(W.walkable(scene,item));assert(W.distance(item,item.fixture)<=160);
    const route=W.route(scene,scene.spawn,item);assert(route.length);assert(W.distance(route.at(-1),item)<=3);
    walk.onPortal(item.id);const text=flatten(f.modal).map(n=>n.text).join(' ');
    assert(text.includes(item.name));assert(text.includes('材質：'+materials[item.fixture.material]));assert(text.includes('固定陳設'));assert(item.fixture.inspectionText?.length>10,'authored observation text');assert(text.includes(item.fixture.inspectionText));
    if(item.fixture.description&&!item.fixture.inspectionText)assert(!text.includes(item.fixture.description),'technical registry notes are not player copy');
    assert.equal(f.walk,walk);assert.equal(JSON.stringify(f.state),before);assert.equal(JSON.stringify(scene.portals),portals);
    const close=flatten(f.modal).find(n=>n.tag==='button'&&n.text==='繼續漫遊');assert(close);close.attrs.onClick();assert.equal(f.modal.length,0);
   }
  };
  check();
  if(W.classrooms[building.id]){const day=S.day(),room={id:day+'_'+building.id+'_1',number:1,day};f.state.arena.economy.wallet={rooms:{[building.id]:room.id}};f.ui.openClass(building.id,room);check();f.walk.onPortal('class-exit');assert(f.walk.sceneId.startsWith('hall:'+building.id+':'));}
 }
});
