from pathlib import Path
from PIL import Image
import numpy as np, subprocess, io, json, hashlib
B=Path('v3/artwork/split-e')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def compare(a,b):
 a=np.array(a.convert('RGBA'));b=np.array(b.convert('RGBA'));v=(a[:,:,3]>0)|(b[:,:,3]>0)
 return {'alphaChangedPixels':int(np.count_nonzero(a[:,:,3]!=b[:,:,3])),'visibleRGBChangedPixels':int(np.count_nonzero(np.any(a[:,:,:3]!=b[:,:,:3],axis=2)&v)),'maximumRGBDifference':int(np.abs(a[:,:,:3].astype(int)-b[:,:,:3].astype(int)).max())}
r={'baseline':'c3abb6a','sideMaterials':{},'wardrobe':{}}
for side in ['left','right']:
 p=B/('parts/rig-HAND_side_skin_viewer_'+side+'.png');old=Image.open(io.BytesIO(subprocess.check_output(['git','show','c3abb6a:'+p.as_posix()])))
 r['sideMaterials'][side]=compare(Image.open(p),old)
 assert r['sideMaterials'][side]['alphaChangedPixels']==0
for mode in ['approved-neutral','shirt-with-tie','shirt-without-tie','jacket-without-tie','lower-material-exchange']:
 p=B/('motion-f-'+mode+'.png');old=Image.open(io.BytesIO(subprocess.check_output(['git','show','c3abb6a:'+p.as_posix()])))
 r['wardrobe'][mode]=compare(Image.open(p),old)
 assert r['wardrobe'][mode]['alphaChangedPixels']==r['wardrobe'][mode]['visibleRGBChangedPixels']==0
r['original']=compare(Image.open(B/'motion-f-approved-neutral.png'),Image.open('v3/artwork/hibiki-static-a.png'))
assert r['original']['alphaChangedPixels']==r['original']['visibleRGBChangedPixels']==0
r['sourcePSD']=sha(B/'hibiki-v3-motion-f.psd');r['approvedArtwork']=sha('v3/artwork/hibiki-static-a.png')
r['limits']='Side creases only. Does not complete large digit opening, hidden finger art or high-angle joints.'
Path('v3/evidence/approved-a-side-crease-recovery.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8')
print(json.dumps(r))
