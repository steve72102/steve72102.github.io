#!/usr/bin/env python3
"""Pack eight authored RGBA sheets as one Stage3-compatible cardinal character.

This extracts already-painted individual silhouettes. It does not synthesize
poses, mirror, rotate, warp, recolor, replace alpha, or draw missing pixels.
ImageGen can put two pose bounding rectangles a few pixels across one another;
eight distinct opaque-alpha components must exist. Every source-alpha pixel in
the explicit crop is assigned to its nearest opaque component, keeping its own
RGBA exactly. Visible component contacts, source-edge clipping and missing
figures reject the sheet and require new original art. Raw masters are retained.

Build dependency: Pillow, numpy, scipy. Runtime dependency: none.
"""
import argparse, hashlib, json, math, io
from pathlib import Path
import numpy as np
from scipy.ndimage import label, find_objects, distance_transform_edt
from PIL import Image, features

VIEWS=('down','up','left','right')
KINDS=('run','actions')
ACTIONS=('idle','start','stop','turn','rise','apex','fall','land')
CELL=(256,384); SIZE=(1024,768); ANCHOR=(128,372)
BODY_HEIGHT={'doctor':450,'professor':450,'graduate':432,'researcher':420,'cedar-dean':458,'herbal-mentor':409,'lab-engineer':452,'balance-analyst':443,'dawn-intern':405,'river-fellow':457}
def sha(b): return hashlib.sha256(b).hexdigest()
def atomic_webp(image,path):
 buffer=io.BytesIO();image.save(buffer,'WEBP',lossless=True,exact=True,quality=100,method=6)
 temporary=path.with_suffix(path.suffix+'.stage4.tmp');temporary.write_bytes(buffer.getvalue());temporary.replace(path)

def extract(path):
 im=Image.open(path);im.load()
 if im.mode!='RGBA': raise ValueError(f'{path}: source is not RGBA')
 rgba=np.asarray(im); alpha=rgba[:,:,3]
 labels,n=label(alpha>16)
 counts=np.bincount(labels.ravel());objects=find_objects(labels)
 major=[(i+1,obj) for i,obj in enumerate(objects) if counts[i+1]>3000]
 if len(major)!=8: raise ValueError(f'{path}: expected eight disconnected opaque figures, got {len(major)}; redraw spacing')
 def bbox(obj): return [obj[1].start,obj[0].start,obj[1].stop,obj[0].stop]
 boxes={i:bbox(obj) for i,obj in major}
 by_y=sorted(major,key=lambda t:(boxes[t[0]][1]+boxes[t[0]][3])/2)
 ordered=sorted(by_y[:4],key=lambda t:boxes[t[0]][0])+sorted(by_y[4:],key=lambda t:boxes[t[0]][0])
 seeds=np.zeros(alpha.shape,dtype=np.uint8)
 for index,(i,obj) in enumerate(ordered):seeds[labels==i]=index+1
 nearest=distance_transform_edt(seeds==0,return_distances=False,return_indices=True)
 owner=seeds[tuple(nearest)]
 results=[]
 for index,(i,obj) in enumerate(ordered):
  x0,y0,x1,y1=boxes[i]
  if x0<2 or y0<2 or x1>im.width-2 or y1>im.height-2:
   raise ValueError(f'{path} frame {index}: visible original art contacts canvas edge {boxes[i]}; redraw')
  crop=(max(0,x0-6),max(0,y0-6),min(im.width,x1+6),min(im.height,y1+6))
  x,y,r,b=crop
  part=rgba[y:b,x:r].copy();belongs=owner[y:b,x:r]==index+1
  foreign=int(np.count_nonzero((part[:,:,3]>0)&~belongs))
  part[~belongs]=[0,0,0,0]
  own=(part[:,:,3]>0)
  if not np.array_equal(part[own],rgba[y:b,x:r][own]):raise AssertionError('Own pixels changed')
  results.append(dict(index=index,rgba=Image.fromarray(part),crop=crop,visibleBox=boxes[i],foreignSourcePixelsExcluded=foreign,extractedRGBASha256=sha(part.tobytes())))
 return im,results

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--character',required=True)
 ap.add_argument('--source-dir',type=Path,required=True,help='Contains masters/<direction>-<run|actions>.png')
 ap.add_argument('--output',type=Path,required=True)
 ap.add_argument('--scale',type=float,default=None,help='Optional common downscale override; default calibrates down-idle to Stage3 doctor 295px × body-height ratio')
 ap.add_argument('--density-calibration',type=Path,help='Explicit whole-sheet pixel-density calibration for independently redrawn lab-engineer correction sheets only')
 a=ap.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 density_doc=json.loads(a.density_calibration.read_text()) if a.density_calibration else None
 if density_doc and (a.character!='lab-engineer' or density_doc.get('character')!=a.character):raise ValueError('Density corrections are scoped to documented lab-engineer masters')
 density_sheets=density_doc.get('sheets',{}) if density_doc else {}
 if a.scale is not None and not 0<a.scale<=1:raise ValueError('Scale must be isotropic downscale in (0,1]')
 prepared=[];scale=1.0 if a.scale is None else a.scale
 desired_height=295*BODY_HEIGHT.get(a.character,450)/450
 for view in VIEWS:
  for kind in KINDS:
   p=a.source_dir/'masters'/f'{view}-{kind}.png'
   im,frames=extract(p)
   correction=density_sheets.get(view+'-'+kind)
   density=correction['factor'] if correction else 1.0
   if not math.isfinite(density) or density<=0:raise ValueError('Invalid source pixel density')
   if correction and correction['finalSourcePngSha256']!=sha(p.read_bytes()):raise ValueError('Corrected master differs from measured density reference')
   prepared.append((view,kind,p,im,frames,density,correction))
   if a.scale is None and view=='down' and kind=='actions':
    bb=frames[0]['visibleBox'];scale=min(scale,desired_height/(bb[3]-bb[1]))
   for f in frames:scale=min(scale,252/(f['rgba'].width*density),348/(f['rgba'].height*density),1/density)
 scale=math.floor(scale*10000)/10000
 sheets=[]
 inspect=a.source_dir/'inspection';inspect.mkdir(exist_ok=True)
 for view,kind,p,im,frames,density,correction in prepared:
  sheet_scale=scale*density
  atlas=Image.new('RGBA',SIZE);entries=[]
  row_ground=[max(f['visibleBox'][3] for f in frames[row*4:row*4+4]) for row in range(2)]
  for f in frames:
   i=f['index'];x,y,r,b=f['crop'];bb=f['visibleBox']
   ax=(bb[0]+bb[2])/2
   airborne=(kind=='actions' and i in (4,5,6)) or (kind=='run' and i in (3,7))
   ay=row_ground[i//4] if airborne else bb[3]
   part=f['rgba'].resize((round((r-x)*sheet_scale),round((b-y)*sheet_scale)),Image.Resampling.LANCZOS)
   ox=round(ANCHOR[0]+(x-ax)*sheet_scale);oy=round(ANCHOR[1]+(y-ay)*sheet_scale)
   if ox<1 or oy<1 or ox+part.width>255 or oy+part.height>383:raise ValueError(f'{p} frame {i}: output clipping at {ox,oy,part.size}')
   cell=Image.new('RGBA',CELL);cell.alpha_composite(part,(ox,oy))
   ab=cell.getchannel('A').getbbox();vb=cell.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox()
   if ab[0]<1 or ab[1]<1 or ab[2]>255 or ab[3]>383:raise ValueError('Output alpha touches border')
   atlas.alpha_composite(cell,((i%4)*256,(i//4)*384))
   entries.append({k:v for k,v in f.items() if k!='rgba'}|dict(pose='run' if kind=='run' else ACTIONS[i],sourceAnchor=[ax,ay],anchorMethod='shared source row ground for drawn airborne/tucked poses' if airborne else 'lowest opaque supporting sole',outputOffset=[ox,oy],isotropicScale=sheet_scale,sourceDensityFactor=density,alphaBounds=list(ab),visibleBoundsAlpha16=list(vb),rgbaSha256=sha(cell.tobytes()),alphaSha256=sha(cell.getchannel('A').tobytes()),sourceCanvasVisibleEdgeContact=[]))
  target=a.output/f'{view}-{kind}.webp';atomic_webp(atlas,target)
  decoded=Image.open(target).convert('RGBA')
  if not np.array_equal(np.asarray(atlas),np.asarray(decoded)):raise AssertionError('Lossless runtime pixels changed')
  bg=Image.new('RGBA',SIZE,'#edf0eb');bg.alpha_composite(atlas);bg.convert('RGB').save(inspect/f'{view}-{kind}.png')
  master_webp=p.with_suffix('.webp')
  master_valid=master_webp.exists() and Image.open(master_webp).convert('RGBA').tobytes()==im.tobytes()
  if not master_valid:atomic_webp(im,master_webp)
  if Image.open(master_webp).convert('RGBA').tobytes()!=im.tobytes():raise AssertionError('Lossless master pixels changed')
  sheets.append(dict(sourceDensityCalibration=correction,path=f'./assets/native-avatar/pineapple-{a.character}/{target.name}',direction=view,actionSet=kind,sourceMethod='authored-frame',source=f'masters/{p.name}',sourceSha256=sha(p.read_bytes()),sourceBytes=p.stat().st_size,sourceDimensions=list(im.size),masterWebp=f'masters/{master_webp.name}',masterWebpSha256=sha(master_webp.read_bytes()),masterWebpBytes=master_webp.stat().st_size,decodedRGBASha256=sha(im.tobytes()),runtimeBytes=target.stat().st_size,runtimeSha256=sha(target.read_bytes()),runtimeDimensions=list(SIZE),frames=entries))
 idle=[s for s in sheets if s['direction']=='down' and s['actionSet']=='actions'][0]['frames'][0]
 ib=idle['visibleBoundsAlpha16'];pw=ib[2]-ib[0];ph=ib[3]-ib[1]
 preview=[max(0,ib[0]-8),max(0,ib[1]-8),min(256,pw+16),min(384,ph+16)]
 portrait=[max(0,round((ib[0]+ib[2])/2-pw*.31)),max(0,ib[1]-3),max(64,round(pw*.62)),max(92,round(ph*.36))]
 result=dict(sourceDensityCalibration=density_doc,previewBox=preview,portraitBox=portrait,bodyHeightCalibration=dict(doctorReferenceVisibleHeight=295,doctorBodyHeight=450,characterBodyHeight=BODY_HEIGHT.get(a.character,450),desiredIdleHeight=desired_height,actualIdleHeight=ph,commonScale=scale),schemaVersion=1,assetId='pineapple-'+a.character,character=a.character,requiredLoadout={s:'fruit-pineapple-'+s for s in ['jacket','cape','shirt','pants','shoes','hat','accessory','handheld']},scope=f'{a.character} wearing all eight pineapple pieces',completeCardinalSet=True,authoredFrameCount=64,layout=dict(columns=4,rows=2,frameWidth=256,frameHeight=384,anchor=list(ANCHOR)),pipeline=dict(operations=['original alpha-component attribution','explicit cropped region extraction retaining own RGBA','isotropic Lanczos downscale','integer translation','transparent atlas packing','lossless WebP'],noMirroring=True,noWarp=True,noSynthesisedPoses=True,pillowVersion=Image.__version__,webpVersion=features.version('webp'),extractionDisclosure='Eight disconnected source alpha>16 silhouettes define ownership; other-pose pixels within overlapping bounding rectangles are excluded by nearest-silhouette assignment. Own RGBA pixels are retained exactly before resampling. Original PNG/WebP masters retain every source pixel.'),sheets=sheets,notes=['Every run direction has eight distinct authored stride drawings.','Each action direction currently has one drawing per idle/start/stop/turn/rise/apex/fall/land.','Alpha segmentation and unique frame hashes supplement visual inspection; they do not prove animation quality.'])
 (a.output/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 (a.source_dir/'packing-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'character':a.character,'frames':64,'scale':scale,'runtimeBytes':sum(s['runtimeBytes'] for s in sheets),'output':str(a.output)}))

if __name__=='__main__':main()
