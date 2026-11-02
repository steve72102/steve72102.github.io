#!/usr/bin/env python3
"""Rebuild added native characters from lossless original masters + measured manifest.

Only authoring-time RGBA extraction/packing is performed. No new poses, mirrored
views, generated art, game account, save access or network call. Default verifies
all encoded bytes in memory. --write writes only verified native atlas files.
"""
import argparse,hashlib,importlib.util,io,json
from pathlib import Path
from PIL import Image
def sha(data):return hashlib.sha256(data).hexdigest()
def safe(root,name):
    target=(root/name).resolve()
    if Path(name).is_absolute() or '..' in Path(name).parts or not target.is_relative_to(root.resolve()):raise ValueError('Unsafe asset path: '+name)
    return target
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True,help='Directory of pineapple-<character>/masters/ WebP originals');p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--character',action='append',required=True);p.add_argument('--write',action='store_true');p.add_argument('--report',type=Path);a=p.parse_args()
    module_spec=importlib.util.spec_from_file_location('native_extract',Path(__file__).with_name('pack-native-character.py'));extractor=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(extractor);planned=[];records=[]
    for character in a.character:
        if character=='doctor' or not all(c in 'abcdefghijklmnopqrstuvwxyz-' for c in character):raise ValueError('Use an explicit new scholar id; Stage3 stays unchanged.')
        name='pineapple-'+character;folder=a.repo/'game/assets/native-avatar'/name;manifest=json.loads((folder/'manifest.json').read_text());source_folder=a.source/name
        if not source_folder.exists():source_folder=a.source/character
        for sheet in manifest['sheets']:
            master=safe(source_folder,sheet['masterWebp']);data=master.read_bytes()
            if len(data)!=sheet['masterWebpBytes'] or sha(data)!=sheet['masterWebpSha256']:raise ValueError('Master differs: '+str(master))
            image,parts=extractor.extract(master)
            if sha(image.tobytes())!=sheet['decodedRGBASha256']:raise ValueError('Original RGBA differs')
            atlas=Image.new('RGBA',(1024,768))
            for frame,part in zip(sheet['frames'],parts):
                if list(part['crop'])!=frame['crop'] or part['extractedRGBASha256']!=frame['extractedRGBASha256']:raise ValueError('Measured original extraction differs')
                scale=frame['isotropicScale'];im=part['rgba'].resize((round(part['rgba'].width*scale),round(part['rgba'].height*scale)),Image.Resampling.LANCZOS);cell=Image.new('RGBA',(256,384));cell.alpha_composite(im,tuple(frame['outputOffset']))
                if sha(cell.tobytes())!=frame['rgbaSha256']:raise ValueError('Packed frame RGBA differs')
                i=frame['index'];atlas.alpha_composite(cell,(i%4*256,i//4*384))
            buffer=io.BytesIO();atlas.save(buffer,'WEBP',lossless=True,exact=True,quality=100,method=6);encoded=buffer.getvalue()
            if len(encoded)!=sheet['runtimeBytes'] or sha(encoded)!=sheet['runtimeSha256']:raise ValueError('Encoded bytes differ; use the recorded Pillow/libwebp versions.')
            target=safe(a.repo/'game',sheet['path'].removeprefix('./'))
            if target.exists() and target.read_bytes()!=encoded:raise ValueError('Current runtime differs; refusing to replace local art: '+sheet['path'])
            planned.append((target,encoded));records.append({'file':sheet['path'],'bytes':len(encoded),'sha256':sha(encoded),'allFrameRGBAEqual':True,'currentRuntimeMatches':target.exists()})
    if a.write:
        for target,data in planned:temp=target.with_suffix('.stage4.tmp');temp.write_bytes(data);temp.replace(target)
    report={'schemaVersion':1,'pass':True,'mode':'write' if a.write else 'verify-only','characters':a.character,'files':records}
    if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'pass':True,'atlases':len(records),'mode':report['mode']}))
if __name__=='__main__':main()
