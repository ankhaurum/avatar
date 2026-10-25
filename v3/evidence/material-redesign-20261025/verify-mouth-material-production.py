from pathlib import Path
from collections import deque
import hashlib, json, sys
import numpy as np
from PIL import Image
base=Path(sys.argv[1]); target=Path(sys.argv[2])
def rgba(name): return np.array(Image.open(base/name).convert("RGBA"))
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
pairs=[("neutral_reopen","mouth-production-neutral-before.png","mouth-production-neutral-reopened.png"),("upper_preserved","mouth-source-upper-current.png","mouth-production-UPPER_original_A_visible.png"),("lower_preserved","mouth-source-lower-current.png","mouth-production-LOWER_original_A_visible.png")]
result={"scope":"Material integrity only; not open-mouth quality, whole-face Identity, Cubism verification or Human Acceptance","comparisons":{},"painted_parts":{}}
for label,a,b in pairs:
    aa,bb=rgba(a),rgba(b)
    result["comparisons"][label]={"changed_rgba_pixels":int(np.any(aa!=bb,axis=2).sum())}
def flood(mask):
    seen=np.zeros(mask.shape,bool); sizes=[]
    for y,x in zip(*np.where(mask)):
        if seen[y,x]: continue
        q=deque([(y,x)]); seen[y,x]=True; size=0
        while q:
            yy,xx=q.popleft();size+=1
            for ny,nx in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
                if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;q.append((ny,nx))
        sizes.append(size)
    return sizes
for name in ["MOUTH_cavity_continuous_painted","MOUTH_inner_wall_L_painted","MOUTH_inner_wall_R_painted"]:
    path=base/("mouth-production-"+name+".png"); a=rgba(path.name)[:,:,3]; ys,xs=np.where(a>0)
    box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
    solid=a[box[1]:box[3],box[0]:box[2]]>=16
    components=flood(solid); void=np.pad(~solid,1,constant_values=True); holes=max(0,len(flood(void))-1)
    result["painted_parts"][name]={"sha256":digest(path),"bbox":box,"alpha_range":[int(a.min()),int(a.max())],"components_at_alpha16":len(components),"interior_holes_at_alpha16":holes}
result["psd_sha256"]=digest(Path(sys.argv[3]) if len(sys.argv)>3 else base/"hibiki-mouth-material-production.psd")
result["inner_alpha_changed"]={str(i):int(np.sum(rgba("mouth-inner-source-"+str(i)+".png")[:,:,3]!=rgba("mouth-inner-refined-"+str(i)+".png")[:,:,3])) for i in range(2)}
result["passed_integrity"]=all(v==0 for v in result["inner_alpha_changed"].values()) and all(v["changed_rgba_pixels"]==0 for v in result["comparisons"].values()) and all(v["components_at_alpha16"]==1 and v["interior_holes_at_alpha16"]==0 for v in result["painted_parts"].values())
target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,ensure_ascii=False))
if not result["passed_integrity"]: sys.exit(1)
