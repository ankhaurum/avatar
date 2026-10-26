from pathlib import Path
from psd_tools import PSDImage
from PIL import Image
import hashlib,json,numpy as np
r=Path(r'C:/Users/ANKHAURUM/.codex/visualizations/2026/10/25/01a1725e-2612-73e2-a619-c149eab775cc')
def signature(p):
 d={}
 def walk(g,path=''):
  for l in g:
   key=path+'/'+l.name
   if l.is_group():walk(l,key)
   elif any(t in l.name for t in ('FACE','EYE','BROW','MOUTH','NOSE','HAIR','EAR')):
    assert key not in d,key
    d[key]=hashlib.sha256(l.topil(apply_icc=False).tobytes()).hexdigest()
 walk(p);return d
old=signature(PSDImage.open(r/'hibiki-independent-parts-assembled-review.psd'))
new=signature(PSDImage.open(r/'hibiki-bust-import-parts.psd'))
assert old==new
report={'unchanged_source_head_layers':len(old),'all_path_keyed_hashes_match':True,'source_head_hashes':old,'native_photoshop_reopen':'UNVERIFIED','cubism_motion':'UNVERIFIED'}
(r/'arm-parts-integrity.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('Preserved head layer channels:',len(old))
