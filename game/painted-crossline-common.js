/* Crossline COMMON doctor art pilot. No player or economy writes. */
(function(root){
  'use strict';
  const P=root.MindPaintedAvatar;
  if(!P){root.MindCrosslineReady=Promise.resolve(false);return;}
  const base='doctor-v1',directions=['down','left','right','up'];
  const jacket='style-fusion-academy-crossline-common-jacket';
  const warmups=new Map();
  root.MindCrosslineWarmup=state=>{
    if(state?.appearance?.character!=='doctor'||state?.rpg?.loadout?.jacket!==jacket)return Promise.resolve(false);
    const key=JSON.stringify(state.rpg.loadout);
    if(warmups.has(key))return warmups.get(key);
    const job=(async()=>{
      await root.MindCrosslineReady;
      for(const direction of directions)for(const sheet of ['actions','run'])for(let frame=0;frame<8;frame++){
        const handle=await P.acquire(state,direction,sheet,{frame,tier:'scene'});
        handle.release();
      }
      return true;
    })().catch(error=>{warmups.delete(key);root.console?.warn?.('交線學院跑步格預載失敗，保留原遊戲回退。',error);return false;});
    warmups.set(key,job);
    return job;
  };
  const read=async id=>{
    const response=await fetch(`./assets/painted-avatar/${id}/manifest.json`,{credentials:'same-origin'});
    if(!response.ok)throw Error(`Crossline manifest ${id}: HTTP ${response.status}`);
    const manifest=await response.json();
    if(manifest.id!==id)throw Error(`Crossline manifest id mismatch: ${id}`);
    return manifest;
  };
  root.MindCrosslineReady=(async()=>{
    P.registerManifest({...await read(base),outfitOnly:true});
    for(const d of directions)P.registerFrameManifest(await read(`doctor-${d}-v1`));
    P.registerOutfitManifest(await read('doctor-crossline-common-idle-v1'));
    P.registerOutfitManifest(await read('doctor-crossline-common-motion-v1'));
    return true;
  })().catch(error=>{root.console?.error?.('交線學院博士外套素材未載入；原遊戲外觀維持可用。',error);return false;});
})(typeof window==='object'?window:globalThis);
