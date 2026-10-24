"""Read-only RGBA analysis. Does not create or alter bitmap assets."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[2]
d=root/'v3/artwork/split-d'
source=root/'v3/artwork/hibiki-static-a.png'
a=np.asarray(Image.open(source).convert('RGBA'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)=='a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf'
results={}
for name in ['recomposed','reopened']:
 b=np.asarray(Image.open(d/(name+'.png')).convert('RGBA'))
 assert a.shape==b.shape
 visible=(a[:,:,3]>0)|(b[:,:,3]>0)
 alpha=int(np.count_nonzero(a[:,:,3]!=b[:,:,3]))
 rgb=int(np.count_nonzero(np.any(a[:,:,:3]!=b[:,:,:3],axis=2)&visible))
 results[name]={'alphaDifferentPixels':alpha,'visibleRGBDifferentPixels':rgb}
 assert alpha==0 and rgb==0,(name,results[name])
coverage=np.zeros(a.shape[:2],dtype=np.uint16)
parts=[]
for p in sorted((d/'parts').glob('*.png')):
 b=np.asarray(Image.open(p).convert('RGBA'))
 visible=b[:,:,3]>0
 assert b.shape==a.shape
 assert np.all(b[visible]==a[visible]),p.name
 coverage+=visible
 parts.append({'file':'parts/'+p.name,'sha256':sha(p),'nonzeroAlphaPixels':int(visible.sum()),'opaqueLikePixels':int((b[:,:,3]>=128).sum())})
assert np.array_equal(coverage,(a[:,:,3]>0).astype(np.uint16)), 'overlap or missing source pixels'
assert next(p for p in parts if p['file'].endswith('BODY_face.png'))['opaqueLikePixels']>0
result={'sourceSHA256':sha(source),'psdSHA256':sha(d/'hibiki-v3-approved-split-d.psd'),'canvas':[1024,1536],'comparisons':results,'coverage':'Every nontransparent source pixel belongs to exactly one part','parts':parts,'limitations':['Visible source separation; hidden body/garment surfaces are not complete','No garment-swap or animation acceptance','Transparent RGB values are ignored only where both alpha values are zero']}
(d/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
