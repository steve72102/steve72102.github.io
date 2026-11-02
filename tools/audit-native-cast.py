#!/usr/bin/env python3
"""Validate real native pixels and the recorded pose/anchor contract.

This cannot judge anatomy, style, age fidelity or natural-looking motion. Those
remain explicit visual reviews, and real network/mobile performance is separate.
"""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--expected-characters',type=int,default=10);p.add_argument('--report',type=Path);a=p.parse_args();records=[]
    for manifest_path in sorted((a.repo/'game/assets/native-avatar').glob('pineapple-*/manifest.json')):
        spec=json.loads(manifest_path.read_text());assert spec['completeCardinalSet'] and spec['authoredFrameCount']==64
        assert spec['layout']=={'columns':4,'rows':2,'frameWidth':256,'frameHeight':384,'anchor':[128,372]}
        assert len(spec['sheets'])==8;directions=set();hashes=[];scales=set();master_pixels=0
        calibration=spec.get('sourceDensityCalibration');calibrated=calibration.get('sheets',{}) if calibration else {}
        if calibration:assert spec['character']=='lab-engineer' and calibration['character']=='lab-engineer'
        common_scale=spec.get('bodyHeightCalibration',{}).get('commonScale')
        for sheet in spec['sheets']:
            source=a.repo/'game'/sheet['path'].removeprefix('./');data=source.read_bytes();assert len(data)==sheet['runtimeBytes'] and sha(data)==sheet['runtimeSha256'],str(source)
            im=Image.open(source).convert('RGBA');assert im.size==(1024,768);assert len(sheet['frames'])==8
            directions.add((sheet['direction'],sheet['actionSet']));frame_hashes=[];sheet_scales=set()
            key=sheet['direction']+'-'+sheet['actionSet'];density=calibrated.get(key,{}).get('factor',1)
            if key in calibrated:
                record=calibrated[key]
                assert record==sheet['sourceDensityCalibration'] and record['finalSourcePngSha256']==sheet['sourceSha256']
                assert .65<density<1.5 and math.isclose(density,record['referenceContactPoseHeight']/record['finalContactPoseHeight'],rel_tol=1e-10)
            for frame in sheet['frames']:
                i=frame['index'];cell=im.crop((i%4*256,i//4*384,(i%4+1)*256,(i//4+1)*384));alpha=cell.getchannel('A');bb=alpha.getbbox();bounds=alpha.point(lambda v:255 if v>16 else 0).getbbox()
                assert bb and 0<bb[0]<bb[2]<256 and 0<bb[1]<bb[3]<384,(source,i,'transparent edge')
                assert list(bb)==frame['alphaBounds'] and list(bounds)==frame['visibleBoundsAlpha16']
                digest=sha(cell.tobytes());assert sha(alpha.tobytes())==frame['alphaSha256']
                # The preserved Stage3 encoder did not set WebP exact=True;
                # fully transparent RGB is discarded there. Its file SHA and
                # every alpha hash are verified above, not misreported as a
                # byte-identical pre-encoding RGBA frame. All new cast is exact.
                if spec['assetId']!='pineapple-doctor':assert digest==frame['rgbaSha256']
                assert not frame.get('sourceCanvasVisibleEdgeContact',frame.get('sourceCanvasEdgeContact',[])),(source,i,'clipped original')
                assert frame['pose']==('run' if sheet['actionSet']=='run' else ['idle','start','stop','turn','rise','apex','fall','land'][i])
                frame_hashes.append(digest);scales.add(frame['isotropicScale']);sheet_scales.add(frame['isotropicScale'])
                if calibration:
                    assert frame.get('sourceDensityFactor',1)==density
                    assert math.isclose(frame['isotropicScale'],common_scale*density,rel_tol=1e-10)
            if spec['assetId']!='pineapple-doctor':assert len(sheet_scales)==1,(source,'per-pose rescaling is forbidden')
            assert len(set(frame_hashes))==8,(source,'duplicate pose cells');hashes+=frame_hashes
        assert len(directions)==8 and len(set(hashes))==64
        if spec['assetId']!='pineapple-doctor' and not calibration:assert len(scales)==1
        if calibration:assert set(calibrated).issubset({s['direction']+'-'+s['actionSet'] for s in spec['sheets']})
        compact=manifest_path.with_name('COMPACT.json');compact_bytes=0
        if spec['assetId']!='pineapple-doctor':
            c=json.loads(compact.read_text());assert len(c['assets'])==8
            for row in c['assets']:
                f=manifest_path.parent/row['file'];data=f.read_bytes();assert len(data)==row['bytes'] and sha(data)==row['sha256'];im=Image.open(f).convert('RGBA');assert im.size==(384,288)
                for i in range(8):
                    alpha=im.crop((i%4*96,i//4*144,(i%4+1)*96,(i//4+1)*144)).getchannel('A');bounds=alpha.point(lambda v:255 if v>16 else 0).getbbox();assert bounds and 0<bounds[0]<bounds[2]<96 and 0<bounds[1]<bounds[3]<144
                compact_bytes+=len(data)
        records.append({'character':spec.get('character','doctor'),'authoredFrames':64,'independentDirections':4,'isotropicScales':sorted(scales),'sourcePageDensityCalibration':calibration or None,'runtimeFileSHA256':'PASS','alphaHashes':'PASS','preEncodingFrameRGBA':'PASS' if compact_bytes else 'Stage3 transparent RGB was not preserved by its encoder; file bytes and alpha verified','nativeTransparentOuterEdge':'PASS','compactVisibleAlpha16OuterEdge':'PASS' if compact_bytes else 'preserved Stage3','compactBytes':compact_bytes})
    assert len(records)==a.expected_characters,(len(records),a.expected_characters)
    report={'schemaVersion':1,'characters':records,'totalAuthoredFrames':len(records)*64,'pass':True,'notProvenByAutomation':['anatomical correctness','natural-looking gait','real multiplayer','physical-device performance']}
    if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'pass':True,'characters':len(records),'frames':len(records)*64}))
if __name__=='__main__':main()
