(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./duel.js'):root.MindDuel);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MindDuelBots=api;
})(typeof window==='object'?window:globalThis,function(D){
  'use strict';
  const TIERS=Object.freeze([
    {id:'beginner',name:'初階機器人',stage:1,accuracy:.42,passChance:.12,passLimit:1,character:'graduate'},
    {id:'intermediate',name:'中階機器人',stage:2,accuracy:.68,passChance:.38,passLimit:2,character:'researcher'},
    {id:'advanced',name:'高階機器人',stage:3,accuracy:.88,passChance:.68,passLimit:3,character:'professor'}
  ]);
  const unlocked=(wins,tier)=>Number.isInteger(wins)&&wins>=0&&wins<=3&&tier.stage<=wins+1;
  function create({questions,random=Math.random,onChange=()=>{},onAnswer=()=>{},onWin=()=>{},onNotice=()=>{},useTicket=()=>false,getWins=()=>0,schedule=setTimeout,cancel=clearTimeout}){
    const byId=new Map(questions.map(q=>[q.id,q]));
    let data={status:'idle',mode:'bot',game:null},timers=new Set(),epoch=0,submissions=[null,null],finished=false;
    const notify=()=>onChange(data),active=()=>data.status==='connected';
    function clean(){epoch++;for(const id of timers)cancel(id);timers.clear();}
    function later(fn,delay){const token=epoch;let id;id=schedule(()=>{timers.delete(id);if(token===epoch&&active())fn();},delay);timers.add(id);}
    function leave(){clean();data={status:'idle',mode:'bot',game:null};notify();}
    function settle(){
      const s=data.game;if(!s.commits.every(Boolean))return;
      for(let side=0;side<2;side++)D.reveal(s,side,submissions[side],s.index);
      const q=byId.get(s.ids[s.index]);
      if(D.settleQuestion(s,q)){
        clean();const a=s.answers[0][s.index],actual=a.actual??[a.choice];
        if(actual.length)onAnswer(q,actual.some(n=>n===q.answer));
        D.next(s,1);notify();
      }
    }
    function submit(side,choice){
      const s=data.game,list=Array.isArray(choice)?choice:[choice];
      if(!active()||s.phase!=='question'||s.commits[side]||list.length!==D.taskCount(s,side)||list.some(n=>!Number.isInteger(n)||n<0||n>3))return false;
      submissions[side]=list.slice();D.commit(s,side,(side?'b':'a').repeat(64),s.index);settle();notify();return true;
    }
    function botAnswer(){
      const s=data.game;if(!active()||s.phase!=='question'||s.commits[1])return;
      const q=byId.get(s.ids[s.index]),choices=Array.from({length:D.taskCount(s,1)},()=>random()<data.tier.accuracy?q.answer:(q.answer+1+Math.floor(random()*3))%4);
      submit(1,choices);
    }
    function question(){
      clean();submissions=[null,null];const s=data.game;
      // Decide independently of the player's answer; the bot never reads a draft.
      const pass=random()<data.tier.passChance;
      later(()=>{
        if(pass&&s.passUsed[1]<data.tier.passLimit&&D.canPass(s,1)){
          D.pass(s,1,random()<.5?0:1);submissions=[null,null];submit(1,[]);notify();
        }
      },650);
      later(botAnswer,4500+Math.floor(random()*2500));
    }
    function start({tierId,subject,profile}){
      if(active())return false;
      try{
        const tier=TIERS.find(t=>t.id===tierId);
        if(!tier||!unlocked(getWins(),tier))throw Error('請先打敗前一階機器人。');
        const mine=D.profile(profile),levels=[Math.max(1,Math.floor(mine.level*.65)),Math.max(4,Math.ceil(mine.level*.85)),Math.max(8,mine.level)];
        const other={name:tier.name,level:levels[tier.stage-1],gearId:null,appearance:{...mine.appearance,character:tier.character,pet:null},loadout:{},training:{},shirkTickets:tier.passLimit*2,diligenceTickets:0};
        clean();finished=false;const game=D.fresh(D.create(subject,questions,random),mine,other);D.ready(game,1);
        data={status:'connected',mode:'bot',tier,subject,profile:mine,game,passPending:false};notify();return true;
      }catch(e){data={status:'error',mode:'bot',game:null,message:e.message};notify();return false;}
    }
    function ready(){const s=data.game;if(active()&&D.ready(s,0)){if(s.phase==='question')question();notify();}}
    function requestPass(){
      const s=data.game;if(!active()||!D.canPass(s,0)||!useTicket('shirkTickets'))return false;
      D.pass(s,0,random()<.5?0:1);submissions=[null,null];submit(0,[]);notify();return true;
    }
    function diligence(){const s=data.game;if(!active()||!D.canDiligence(s,0)||!useTicket('diligenceTickets'))return false;D.activateDiligence(s,0);notify();return true;}
    function next(){
      const s=data.game;if(!active()||!D.next(s,0))return;
      if(s.phase==='done'){
        clean();data.status='done';if(!finished){finished=true;if(D.winner(s)===0)onWin(data.tier.stage);}notify();return;
      }
      if(s.phase==='prep')D.ready(s,1);else if(s.phase==='question')question();notify();
    }
    return {start,leave,ready,answer:choice=>submit(0,choice),requestPass,diligence,next,active,snapshot:()=>data,remaining:()=>0};
  }
  return Object.freeze({TIERS,unlocked,create});
});
