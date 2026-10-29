(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MindQuestDownload=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const hash=async(data,crypto)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');
  async function assemble(manifest,load,progress=()=>{},crypto=globalThis.crypto){
    const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
    if(manifest?.version!==1||manifest.filename!=='mind-quest-offline.zip'||!Number.isSafeInteger(manifest.size)||manifest.size<1||manifest.size>32000000||!validHash(manifest.sha256)||!Array.isArray(manifest.parts)||!manifest.parts.length||manifest.parts.length>16)throw Error('下載清單尚未準備完成，請稍後再試。');
    const names=new Set();let total=0;
    for(const part of manifest.parts){if(!/^mind-quest-[a-f0-9]{12}-\d{2}\.part$/.test(part.file)||names.has(part.file)||!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>3000000||!validHash(part.sha256))throw Error('下載清單不完整，請重新整理。');names.add(part.file);total+=part.bytes;}
    if(total!==manifest.size)throw Error('下載大小不一致，請稍後再試。');
    const result=new Uint8Array(total);let offset=0;
    for(const part of manifest.parts){const data=await load(part.file);if(data.byteLength!==part.bytes||await hash(data,crypto)!==part.sha256)throw Error('檔案未完整下載，請重新準備。');result.set(new Uint8Array(data),offset);offset+=data.byteLength;progress(offset/total);}
    if(await hash(result,crypto)!==manifest.sha256)throw Error('檔案校驗未完成，請重新準備。');
    return result;
  }
  if(typeof document==='object'){
    const prepare=document.getElementById('prepare-download'),save=document.getElementById('save-download'),status=document.getElementById('download-status'),progress=document.getElementById('download-progress');let url=null;
    prepare.addEventListener('click',async()=>{
      prepare.disabled=true;progress.hidden=false;progress.value=0;save.hidden=true;status.textContent='正在準備完整離線版…';if(url){URL.revokeObjectURL(url);url=null;}
      try{
        const response=await fetch('./mind-quest-offline.manifest.json',{cache:'no-store'});if(!response.ok)throw Error('目前無法下載，請稍後再試。');const manifest=await response.json();
        const bytes=await assemble(manifest,async file=>{const response=await fetch('./'+file,{cache:'no-store'});if(!response.ok)throw Error('下載暫時中斷，請再試一次。');return response.arrayBuffer();},n=>{progress.value=n;status.textContent='正在準備離線版 · '+Math.round(n*100)+'%';});
        url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));save.href=url;save.hidden=false;prepare.hidden=true;progress.hidden=true;status.textContent='完整檔案已備妥（'+(bytes.length/1000000).toFixed(1)+' MB），請儲存 ZIP。';save.focus();
      }catch(error){status.textContent=error instanceof TypeError?'連線中斷，請檢查網路後再試。':error.message;prepare.disabled=false;prepare.textContent='重新準備下載';progress.hidden=true;}
    });
    window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
  }
  return {assemble};
});
