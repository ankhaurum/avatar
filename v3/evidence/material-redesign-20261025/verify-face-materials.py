from pathlib import Path
from PIL import Image
import numpy as np, hashlib, json
base=Path(__file__).resolve().parent
repo=Path(r"C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication")
if base.name=="material-redesign-20261025":
 repo=base.parents[2]
 psd_dir=repo/"v3/artwork/split-e"
else:
 psd_dir=base
names=["FACE_nose_original","MOUTH_upper_lip_original_visible","MOUTH_lower_lip_original_visible"]+[f"EYE_{s}_{k}" for s in ("R","L") for k in ("highlight_main","highlight_secondary","upper_lid_lash_original_visible","lower_lid_original_visible","lower_skin_original")]
records=[]
for n in names:
 a=np.array(Image.open(base/f"face-check-0-{n}.png").convert("RGBA"))
 b=np.array(Image.open(base/f"face-check-1-{n}.png").convert("RGBA"))
 delta=np.abs(a.astype(int)-b.astype(int))
 records.append(dict(layer=n,rgba_different_pixels=int(np.any(delta,axis=2).sum()),maximum_channel_delta=int(delta.max())))
a=np.array(Image.open(base/"face-eyes-rim-0.png").convert("RGB"),dtype=int)[2::5,2::5]
b=np.array(Image.open(base/"face-eyes-boundary-2.png").convert("RGB"),dtype=int)[2::5,2::5]
delta=np.abs(a-b)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=np.array(Image.open(base/"face-default-before-reopen.png").convert("RGBA"))
after=np.array(Image.open(base/"face-default-after-reopen.png").convert("RGBA"))
reopen_diff=int(np.any(before!=after,axis=2).sum())
assert reopen_diff==0
result=dict(saved_reopened_rgba_different_pixels=reopen_diff,original_sha256=sha(repo/"v3/artwork/hibiki-static-a.png"),face_psd_sha256=sha(psd_dir/"hibiki-face-material-production.psd"),skin_source_psd_sha256=sha(psd_dir/"hibiki-face-skin-source-working.psd"),original_parts=records,eye_comparison=dict(maximum_rgb_delta=int(delta.max()),mean_channel_delta=float(delta.mean()),pixels_over_10=int((delta.max(2)>10).sum()),region=[430,230,618,290],limitation="Comparison over original A backdrop; not independent whole-face identity proof"),status="PARTIAL: forehead, brows, hair fit and complete hidden surfaces not accepted; no Cubism import")
assert result["original_sha256"]=="a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf"
assert all(r["rgba_different_pixels"]==0 for r in records)
(base/"face-material-integrity.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False))
