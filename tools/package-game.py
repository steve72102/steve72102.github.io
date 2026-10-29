from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
out=root/'downloads'
out.mkdir(exist_ok=True)
files=['index.html','style.css','app.js','engine.js','combat.js','combat-ui.js','combat.css','bank.js','icon.svg','manifest.webmanifest','sw.js','README.md','duel.js','duel-network.js','duel-ui.js','duel.css','vendor/peerjs.min.js','vendor/peerjs-LICENSE','academy.js','academy-ui.js','academy.css','daylight.css','lesson.js','journey.js','journey.css','cloud.js','firebase-config.js','account-ui.js']
files += ['assets/academy/'+name+'.webp' for name in ['campus-taiwan','hall-ntu','hall-nthu','hall-ncku','doctor-portrait','professor-portrait','graduate-portrait','researcher-portrait','cedar-dean-portrait','herbal-mentor-portrait','lab-engineer-portrait','balance-analyst-portrait','dawn-intern-portrait','river-fellow-portrait','beaker','flask','cylinder','mortar']]
with zipfile.ZipFile(out/'mind-quest-offline.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name in files:
        data=(root/'game'/name).read_bytes()
        if name=='index.html':
            data=data.replace(b'href="../"',b'href="https://steve72102.github.io/"')
        archive.writestr(name,data)
    archive.writestr('開始遊玩.txt','思維冒險\n\n請先完整解壓縮本 ZIP，再使用 Edge、Chrome 或 Firefox 開啟 index.html。\n單人遊戲不需要 ChatGPT、訂閱、帳號或網路。雙人對戰請開啟網站版，並保持連網。\n獨立離線版的進度只存在此瀏覽器；Google 跨裝置存檔請開啟網站版登入。請定期在「存檔與說明」匯出 JSON 備份。\n不同瀏覽器或移動資料夾後可能需要重新匯入存檔。\n手機建議使用 https://steve72102.github.io/game/ 並等待離線快取完成。\n'.encode('utf-8'))
print('Offline archive:',(out/'mind-quest-offline.zip').stat().st_size,'bytes')
