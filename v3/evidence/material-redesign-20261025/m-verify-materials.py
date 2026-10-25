from pathlib import Path
from PIL import Image
import numpy as np
import hashlib, json
b=Path(__file__).parent
r=Path('C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
a=r/'v3/artwork/hibiki-static-a.png'
j=r/'v3/artwork/split-e/hibiki-v3-parts-j.psd'
previous=json.loads((r/'v3/evidence/material-redesign-20261025/j-deliverable-hashes.json').read_text(encoding='utf-8-sig'))
expected=next(x['sha256'] for x in previous if x['path'].endswith('/hibiki-v3-parts-j.psd'))
checks={'approvedAUnchanged':sha(a)=='a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf','jUnchanged':sha(j)==expected,'reopenedCompositeIdentical':np.array_equal(np.array(Image.open(b/'m-hair-independent-assembly.png')),np.array(Image.open(b/'m-hair-disk-reopen.png'))),'parts':[],'limits':['Three hair material candidates, not completed hair assembly or avatar.','White/dark native Photoshop previews inspected; Cubism deformation not tested.','A and J source hashes are preservation evidence, not proof of new assembled identity.','Generated front candidate rejected for silhouette; first left candidate rejected for diffuse halo.']}
for name in ['m-HAIR_back_complete.png','m-HAIR_side_R_complete.png','m-HAIR_side_L_complete.png']:
    p=b/name; im=Image.open(p); ar=np.array(im); alpha=ar[:,:,3];checks['parts'].append({'file':name,'size':list(im.size),'mode':im.mode,'alphaMin':int(alpha.min()),'alphaMax':int(alpha.max()),'alphaNonzeroPixels':int((alpha>0).sum()),'sha256':sha(p)})
assert checks['approvedAUnchanged'] and checks['jUnchanged'] and checks['reopenedCompositeIdentical']
assert all(x['mode']=='RGBA' and x['alphaMin']==0 and x['alphaMax']>=250 and x['alphaNonzeroPixels']>0 for x in checks['parts'])
(b/'m-material-verification.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(checks,ensure_ascii=False))
