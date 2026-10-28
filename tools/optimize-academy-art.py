from pathlib import Path
from PIL import Image
import json,hashlib
root=Path(__file__).resolve().parents[1]/'game/assets/academy'
names=['campus-taiwan','hall-ntu','hall-nthu','hall-ncku','doctor-inspired','professor-inspired','graduate-inspired','researcher-inspired','beaker','flask','cylinder','mortar']
report=[]
for name in names:
    src=root/(name+'.png');dest=root/(name+'.webp');im=Image.open(src).convert('RGBA')
    before=dest.stat().st_size
    # Re-encode only: no pixel dimensions, composition or alpha are changed.
    im.save(dest,'WEBP',quality=90,method=6,alpha_quality=100,exact=True)
    actual=Image.open(dest).convert('RGBA')
    assert actual.size==im.size
    assert actual.getchannel('A').tobytes()==im.getchannel('A').tobytes()
    report.append(dict(file=dest.name,width=im.width,height=im.height,sourceBytes=src.stat().st_size,priorWebpBytes=before,webpBytes=dest.stat().st_size,alphaPreserved=True,sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
(root/'runtime-assets.json').write_text(json.dumps({'encoding':'WebP quality 90, original dimensions, lossless alpha; PNG masters retained locally','assets':report},indent=2),encoding='utf-8')
print('Runtime art:',sum(r['priorWebpBytes'] for r in report),'->',sum(r['webpBytes'] for r in report),'bytes')
