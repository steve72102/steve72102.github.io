#!/usr/bin/env python3
"""Encode small world-actor sheets from reviewed native atlases; no new art.

Stage3 doctor's existing files are deliberately left untouched. Independent
views/poses are retained; no mirroring, interpolation between poses or redraw.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--character',action='append',required=True)
    args=p.parse_args();root=args.repo.resolve();records=[]
    for character in args.character:
        if character=='doctor' or not all(c in 'abcdefghijklmnopqrstuvwxyz-' for c in character):
            raise ValueError('Use an explicit non-Stage3 scholar id.')
        folder=root/'game/assets/native-avatar'/('pineapple-'+character)
        planned=[]
        for view in ['down','up','left','right']:
            for action in ['run','actions']:
                source=folder/(view+'-'+action+'.webp');data=source.read_bytes()
                image=Image.open(io.BytesIO(data)).convert('RGBA')
                if image.size!=(1024,768):raise ValueError('Unexpected reviewed atlas size: '+str(source))
                small=image.resize((384,288),Image.Resampling.LANCZOS)
                # Cell padding is inherited from the reviewed atlas. Fail rather
                # than hide a clipped source drawing with a new opaque border.
                for row in range(2):
                    for col in range(4):
                        a=small.crop((col*96,row*144,(col+1)*96,(row+1)*144)).getchannel('A')
                        if any(a.crop(box).getextrema()[1]>16 for box in [(0,0,96,1),(0,143,96,144),(0,0,1,144),(95,0,96,144)]):
                            raise ValueError('Visible silhouette touches compact cell edge: '+str(source))
                buffer=io.BytesIO();small.save(buffer,'WEBP',quality=94,method=6)
                encoded=buffer.getvalue();destination=folder/('actor-'+source.name)
                planned.append((destination,encoded,{'source':source.name,'sourceSHA256':sha(data),'file':destination.name,'bytes':len(encoded),'sha256':sha(encoded),'width':384,'height':288}))
        for path,data,record in planned:
            temp=path.with_suffix('.stage4.tmp');temp.write_bytes(data);temp.replace(path)
        record={'schemaVersion':1,'character':character,'atlas':{'columns':4,'rows':2,'frameWidth':96,'frameHeight':144,'anchorX':48,'anchorY':139.5},'processing':'Uniform 0.375 LANCZOS reduction of reviewed native atlas; WebP quality 94 method 6. No pose synthesis, mirroring or repainted pixels. High resolution previews retain original 1024x768 sheets.','assets':[r for _,_,r in planned]}
        (folder/'COMPACT.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
        records.append({'character':character,'sheets':len(planned),'bytes':sum(len(d) for _,d,_ in planned)})
    print(json.dumps(records))
if __name__=='__main__':main()
