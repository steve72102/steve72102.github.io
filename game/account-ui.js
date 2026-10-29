window.MindAccountUI=function(ctx){
  'use strict';
  const {node,btn,note,title,getState,save,go,toast,account,exportSave}=ctx,A=window.MindAcademy,J=window.MindJourney;
  let draft='',look='graduate',identity=undefined;
  const art=c=>node('img',{src:'./assets/academy/'+c.image,alt:c.name,width:220,height:270});
  function page(){
    const s=getState(),a=account(),status=a.snapshot(),key=(status.uid||'guest')+':'+s.profile.enrolled;
    if(identity!==key){identity=key;draft=s.profile.name;look=s.appearance.character;}
    title(s.profile.enrolled?'你的學院通行證':'歡迎入學，知識旅人。','YOUR NAME. YOUR JOURNEY.');
    const intro=node('section',{class:'enroll-intro'},node('p',{class:'eyebrow'},'MIND QUEST · ACADEMY'),node('h2',{},s.profile.enrolled?'每一份理解，都跟著你走。':'先取個名字，再展開你的冒險。'),note('選擇喜歡的人物外觀，用知識累積裝備與成長。小小器皿夥伴，會在完成新手任務後與你相遇。'));
    const cloud=node('section',{class:'panel account-card'},node('span',{class:'step-number'},'01'),node('h3',{},'保存你的旅程'),node('p',{class:'sync-message',role:'status'},status.message),status.uid?node('p',{class:'account-email'},status.label||'Google 帳號旅程'):null,
      status.uid?node('div',{class:'modal-actions'},btn('立即同步',()=>a.sync(),'secondary',status.phase==='connecting'),status.phase==='error'?btn('重新 Google 登入',()=>a.login(),'secondary'):null,btn('登出 Google',()=>{
        ctx.openModal(node('h2',{},'登出這個 Google 帳號？'),note(status.phase==='synced'?'雲端進度已保存。此裝置會回到原本的訪客旅程。':'本機可能還有未同步的更新。登出後仍保留此帳號的本機備份，下次登入同帳號可接續。'),btn('先匯出備份',exportSave,'secondary'),btn('確定登出',async()=>{try{await a.logout();ctx.closeModal();go('account');}catch(e){toast(e.message);}}));
      },'secondary')):node('div',{class:'modal-actions'},btn('使用 Google 登入',()=>a.login(),'google-login',!status.ready||location.protocol==='file:'||status.phase==='signing-in'),node('span',{class:'note'},'也可先以訪客遊玩')),
      note('Google 登入後，自動接續最近更新的進度，舊版會保留救援備份。換裝置前，請確認顯示「雲端已保存」或「雲端進度已同步」。'),note('訪客與離線模式只存在此瀏覽器；兩者都能匯出備份，也都不需要 ChatGPT 訂閱。'),btn('匯出目前存檔',exportSave,'secondary'),!status.ready?note('雲端設定進行中；目前請先以訪客遊玩並匯出備份。'):null);
    const name=node('input',{id:'player-nickname',type:'text',maxlength:16,autocomplete:'off',value:draft,placeholder:'你想在學院被怎麼稱呼？',onInput:e=>{draft=e.target.value;}});
    const gallery=node('div',{class:'enroll-characters',role:'group','aria-label':'選擇人物外觀'},A.CHARACTERS.map(c=>node('button',{type:'button',class:'enroll-character'+(look===c.id?' selected':''),'aria-pressed':String(look===c.id),onClick:()=>{look=c.id;gallery.querySelectorAll('button').forEach(b=>{const selected=b.dataset.character===look;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});},'data-character':c.id},art(c),node('strong',{},c.name),node('small',{class:'character-traits'},c.traits))));
    const form=node('form',{class:'panel enroll-form',onSubmit:e=>{
      e.preventDefault();try{const name=J.nickname(draft);s.profile={version:1,name,enrolled:true};s.appearance.character=look;save();go('home');toast('歡迎回到學院，'+name+'！');}catch(err){toast(err.message);name.focus();}
    }},node('span',{class:'step-number'},'02'),node('h3',{},'寫下你的名字'),node('label',{for:'player-nickname'},'學院暱稱'),name,note('1–16 字。暱稱會顯示於個人資料與雙人對戰；不必使用真實姓名。'),node('span',{class:'step-number'},'03'),node('h3',{},'選擇你的樣子'),note(A.CHARACTERS.length+' 位學院人物，從年輕學者到銀髮導師，每張面孔都有自己的故事。'),gallery,note('全部角色免費開放。年齡、職稱與臉型只影響外觀，能力一樣；之後也能自由更換。'),node('div',{class:'pet-invitation'},node('span',{'aria-hidden':'true'},'✧'),node('div',{},node('strong',{},'你的第一位夥伴，正在等你'),node('p',{},'領取每日補給＋答對 5 道不同題目，即可領養器皿寵物。'))),node('button',{type:'submit',class:'button gold',disabled:status.phase==='connecting'||status.locked},s.profile.enrolled?'儲存通行證 →':'完成入學，走進學院 →'));
    return [intro,cloud,form];
  }
  return {page};
};
