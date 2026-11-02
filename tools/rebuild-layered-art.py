#!/usr/bin/env python3
"""Rebuild original component atlases from the supplied lossless masters.

Reads only explicit local artwork and a reviewed provenance manifest. Default
mode verifies in memory. --write writes only the manifest's avatar-raster paths,
after all masters and output bytes have passed. No image API or game save I/O.
"""
import argparse,hashlib,io,json
from pathlib import Path
from PIL import Image,features,__version__ as pillow_version
def sha(data):return hashlib.sha256(data).hexdigest()
def safe(root,name):
    p=Path(name)
    if p.is_absolute() or '..' in p.parts:raise ValueError('Unsafe relative path: '+name)
    target=(root/p).resolve()
    if not target.is_relative_to(root.resolve()):raise ValueError('Path escapes supplied root: '+name)
    return target
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',required=True,type=Path);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--write',action='store_true');p.add_argument('--report',type=Path);a=p.parse_args()
    spec=json.loads((a.source/'PROVENANCE.json').read_text());planned=[];records=[]
    for r in spec['assets']:
        source=safe(a.source,r['master']);data=source.read_bytes()
        if len(data)!=r['masterBytes'] or sha(data)!=r['masterSHA256']:raise ValueError('Master bytes differ: '+r['master'])
        image=Image.open(io.BytesIO(data)).convert('RGBA')
        if list(image.size)!=r['dimensions'] or sha(image.tobytes())!=r['rgbaSHA256']:raise ValueError('Master RGBA differs: '+r['master'])
        buffer=io.BytesIO();image.save(buffer,'WEBP',**r['encoding']);encoded=buffer.getvalue()
        if len(encoded)!=r['runtimeBytes'] or sha(encoded)!=r['runtimeSHA256']:raise ValueError('Runtime encoding differs for '+r['key']+'; use recorded Pillow/libwebp versions, do not silently accept a new hash.')
        if not r['runtime'].startswith('game/assets/avatar-raster/') or not r['runtime'].endswith('.webp'):raise ValueError('Unexpected output path')
        output=safe(a.repo,r['runtime'])
        if output.exists() and output.read_bytes()!=encoded:raise ValueError('Current runtime differs; refusing to replace local art: '+r['runtime'])
        planned.append((output,encoded));records.append({'file':r['runtime'],'bytes':len(encoded),'sha256':sha(encoded),'byteIdentical':True,'currentRuntimeMatches':output.exists()})
    if a.write:
        for target,data in planned:
            target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_suffix('.stage4.tmp');temp.write_bytes(data);temp.replace(target)
    report={'schemaVersion':1,'mode':'write' if a.write else 'verify-only','pillowVersion':pillow_version,'webpVersion':features.version('webp'),'files':records,'pass':True}
    if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'pass':True,'atlases':len(records),'mode':report['mode']}))
if __name__=='__main__':main()
