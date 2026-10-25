from pathlib import Path
import json,hashlib,sys
import numpy as np
from PIL import Image
base=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent
original=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).resolve().parents[2]/"artwork"/"hibiki-static-a.png"
psd=base/"hibiki-head-materials-review.psd"
if not psd.exists(): psd=original.parent/"split-e"/"hibiki-head-materials-review.psd"
def rgba(p): return np.asarray(Image.open(p).convert("RGBA"))
def diff(a,b):
    x,y=rgba(a),rgba(b)
    return {"changed_pixels":int(np.any(x!=y,axis=2).sum()),"max_channel_delta":int(np.abs(x.astype(int)-y.astype(int)).max())}
parts={}
for p in sorted(base.glob("head-check-0-*.png")):
    name=p.name.removeprefix("head-check-0-")
    parts[name]=diff(p,base/("head-check-1-"+name))
report={"original_sha256":hashlib.sha256(original.read_bytes()).hexdigest(),"protected_parts":parts,
"cleanup":diff(base/"head-materials-before-cleanup.png",base/"head-materials-before-reopen.png"),
"reopen":diff(base/"head-materials-before-reopen.png",base/"head-materials-after-reopen.png")}
im=rgba(base/"head-materials-after-reopen.png")
report["visible_pixels_below_y550"]=int((im[550:,:,3]>0).sum())
report["size"]=list(im.shape[:2][::-1])
source=rgba(base/"face-ear-proof-0.png")[:,:,:3].astype(float)
before=rgba(base/"face-ear-proof-1.png")[:,:,:3].astype(float)
after=rgba(base/"face-ear-proof-2.png")[:,:,:3].astype(float)
rois={"forehead":[440,170,607,250],"ear_R":[381,240,434,324],"ear_L":[612,260,637,315],"central_face":[450,260,600,370]}
report["roi_rgb_mean_absolute_error_not_acceptance"]={}
for name,(x,y,u,v) in rois.items():
    sl=np.s_[(y-150)*3:(v-150)*3,(x-375)*3:(u-375)*3,:]
    report["roi_rgb_mean_absolute_error_not_acceptance"][name]={"source_bounds":[x,y,u,v],"before":round(float(np.abs(source[sl]-before[sl]).mean()),4),"after":round(float(np.abs(source[sl]-after[sl]).mean()),4)}
report["psd_sha256"]=hashlib.sha256(psd.read_bytes()).hexdigest()
report["limitations"]=["13 source parts unchanged does not prove full face Identity or expression quality","ROI error is a diagnostic, not an acceptance criterion","fringe and brow transition remain unfinished","No Cubism import, deformation or publication"]
report["ear_hair_alpha_preservation"]={}
for side in ("r","l"):
    before_alpha=rgba(base/f"head-component-hair-ear-{side}-alpha-baseline.png")[:,:,3]
    after_alpha=rgba(base/f"head-component-hair-ear-{side}.png")[:,:,3]
    report["ear_hair_alpha_preservation"][side]={"changed_pixels":int((before_alpha!=after_alpha).sum()),"max_delta":int(np.abs(before_alpha.astype(int)-after_alpha.astype(int)).max())}
print(json.dumps(report,ensure_ascii=False,indent=2))
assert len(parts)==13 and all(v["changed_pixels"]==0 for v in parts.values())
assert report["cleanup"]["changed_pixels"]==0 and report["reopen"]["changed_pixels"]==0
assert report["visible_pixels_below_y550"]==0
assert all(x["changed_pixels"]==0 for x in report["ear_hair_alpha_preservation"].values())
assert report["original_sha256"]=="a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf"
