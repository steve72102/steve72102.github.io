/* Load the original game after the optional painted outfit manifests settle. */
(() => {
  'use strict';
  const start=()=>{
    const script=document.createElement('script');
    script.src='./app.js?v=20261116-doctor-common';
    script.async=false;
    script.onerror=()=>{const view=document.getElementById('view');if(view)view.textContent='遊戲程式未載入，請重新整理。'};
    document.head.append(script);
  };
  const ready=window.MindCrosslineReady;
  if(!ready){start();return;}
  let timer;
  Promise.race([ready,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),8000)})])
    .catch(()=>false).then(()=>{clearTimeout(timer);start()});
})();
