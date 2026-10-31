from pathlib import Path
import zipfile
import hashlib
import json
root=Path(__file__).resolve().parents[1]
out=root/'downloads'
out.mkdir(exist_ok=True)
files=["rankings.js","rankings-cloud.js","rankings-ui.js","rankings.css","social-economy.js","social-cloud.js","social-ui.js","social.css","classroom.js"]+["assets/academy/classroom-"+id+".webp" for id in ["pharmaceutics","pharmacology","herbal","battle"]]+["wish.js","wish-cloud.js","wish-ui.js","wish.css","assets/academy/hall-nthu-interactive.webp","assets/academy/lab-glassware-hq.webp","assets/academy/campus-south.webp","assets/academy/campus-west-garden.webp","assets/academy/campus-east-river.webp","world-layout.js","scene-play.js","scene-play-ui.js","scene-play.css","scene-ambient.js","scene-ambient.css","assets/academy/campus-plaza-motion-base.webp","assets/academy/campus-birds.webp","assets/academy/district-pharmaceutics.webp","assets/academy/district-pharmacology.webp","assets/academy/district-herbal.webp","assets/academy/district-battle.webp","assets/academy/district-life.webp","assets/academy/hall-battle.webp","assets/academy/hall-life.webp","assets/academy/study-table.webp","assets/academy/study-chair.webp","assets/academy/glass-cup.webp"]+['adventure.js', 'cast-outfit.js', 'adventure-ui.js', 'adventure.css', 'lobby.js', 'lobby-network.js', 'lobby-ui.js']+['index.html','style.css','app.js','engine.js','combat.js','combat-ui.js','combat.css','bank.js','icon.svg','manifest.webmanifest','sw.js','README.md','duel.js','duel-network.js','duel-ui.js','duel.css','vendor/peerjs.min.js','vendor/peerjs-LICENSE','campus-walk.js','campus-walk-ui.js','campus-walk.css','academy.js','academy-ui.js','academy.css','daylight.css','lesson.js','journey.js','journey.css','cloud.js','firebase-config.js','account-ui.js']
files += ['assets/academy/'+name+'.webp' for name in ['campus-taiwan','hall-ntu','hall-ncku','doctor-portrait','professor-portrait','graduate-portrait','researcher-portrait','cedar-dean-portrait','herbal-mentor-portrait','lab-engineer-portrait','balance-analyst-portrait','dawn-intern-portrait','river-fellow-portrait','beaker','flask','cylinder','mortar']]
files += ['assets/academy/doctor-run.webp', 'assets/academy/professor-run.webp', 'assets/academy/graduate-run.webp', 'assets/academy/researcher-run.webp', 'assets/academy/cedar-dean-run.webp', 'assets/academy/herbal-mentor-run.webp', 'assets/academy/lab-engineer-run.webp', 'assets/academy/balance-analyst-run.webp', 'assets/academy/dawn-intern-run.webp', 'assets/academy/river-fellow-run.webp', 'assets/academy/living-trees.webp']
files += ['assets/equipment/'+name+'.webp' for name in ['level30-bach','level40-schumann','level50-mozart','level60-haydn','level30-bach-cast','level40-schumann-cast','level50-mozart-cast','level60-haydn-cast','level70-requiem','level80-letter','level90-tide']]
files += ['learn.html','learn.js','lesson.css','lesson-diagrams.js'] + ['assets/lessons/'+p.name for p in sorted((root/'game/assets/lessons').glob('*.svg'))]
with zipfile.ZipFile(out/'mind-quest-offline.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for name in files:
        data=(root/'game'/name).read_bytes()
        if name=='index.html':
            data=data.replace(b'href="../"',b'href="https://steve72102.github.io/"')
        archive.writestr(name,data)
    archive.writestr('開始遊玩.txt','思維冒險\n\n請先完整解壓縮本 ZIP，再使用 Edge、Chrome 或 Firefox 開啟 index.html。\n單人遊戲不需要 ChatGPT、訂閱、帳號或網路。雙人對戰請開啟網站版，並保持連網。\n獨立離線版的進度只存在此瀏覽器；Google 跨裝置存檔請開啟網站版登入。請定期在「存檔與說明」匯出 JSON 備份。\n不同瀏覽器或移動資料夾後可能需要重新匯入存檔。\n手機建議使用 https://steve72102.github.io/game/ 並等待離線快取完成。\n'.encode('utf-8'))
print('Offline archive:',(out/'mind-quest-offline.zip').stat().st_size,'bytes')
# Static hosting can assemble an identical ZIP from bounded, verified downloads.
data=(out/'mind-quest-offline.zip').read_bytes()
digest=hashlib.sha256(data).hexdigest()
parts=[]
for index,start in enumerate(range(0,len(data),3000000),1):
    chunk=data[start:start+3000000]
    name=f'mind-quest-{digest[:12]}-{index:02d}.part'
    (out/name).write_bytes(chunk)
    parts.append({'file':name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
manifest={'version':1,'filename':'mind-quest-offline.zip','size':len(data),'sha256':digest,'parts':parts}
(out/'mind-quest-offline.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Verified download parts:',len(parts))
