from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
out=root/'downloads'
out.mkdir(exist_ok=True)
files=['index.html','style.css','app.js','engine.js','bank.js','icon.svg','manifest.webmanifest','sw.js','README.md']
with zipfile.ZipFile(out/'mind-quest-offline.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name in files:
        data=(root/'game'/name).read_bytes()
        if name=='index.html':
            data=data.replace(b'href="../"',b'href="https://steve72102.github.io/"')
        archive.writestr(name,data)
    archive.writestr('開始遊玩.txt','思維冒險\n\n請先完整解壓縮本 ZIP，再使用 Edge、Chrome 或 Firefox 開啟 index.html。\n遊戲不需要 ChatGPT、訂閱、帳號或網路。\n進度只存在此瀏覽器；請定期在「存檔與說明」匯出 JSON 備份。\n不同瀏覽器或移動資料夾後可能需要重新匯入存檔。\n手機建議使用 https://steve72102.github.io/game/ 並等待離線快取完成。\n'.encode('utf-8'))
print('Offline archive:',(out/'mind-quest-offline.zip').stat().st_size,'bytes')
