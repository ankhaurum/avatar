"""Read-only material QA: source identity, PSD round trip and exported-component assembly."""
import hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[2];art=root/'v3/artwork';out=art/'split-e'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):
 im=Image.open(p);im.load();assert im.size==(1024,1536),(p,im.size)
 return np.asarray(im.convert('RGBA'))
def diff(a,b,mask=None):
 visible=(a[:,:,3]>0)|(b[:,:,3]>0)
 if mask is not None:visible &= mask
 delta=np.abs(a.astype(np.int16)-b.astype(np.int16))
 return {'visibleRGBDifferentPixels':int(np.count_nonzero(np.any(delta[:,:,:3]>0,axis=2)&visible)),'alphaDifferentPixels':int(np.count_nonzero((delta[:,:,3]>0)&(mask if mask is not None else np.ones(visible.shape,bool)))),'maximumVisibleRGBDifference':int(delta[:,:,:3][visible].max()) if visible.any() else 0}
source=art/'hibiki-static-a.png';assert sha(source)=='a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf'
a=read(source);old=json.loads((art/'split-d/verification.json').read_text(encoding='utf-8-sig'))
for p in old['parts']:assert sha(art/'split-d'/p['file'])==p['sha256'],p['file']
assert sha(art/'split-d/hibiki-v3-approved-split-d.psd')==old['psdSHA256']
materials=[]
for p in sorted((out/'parts').glob('*.png')):
 b=read(p);assert np.count_nonzero(b[:,:,3])>0,p
 materials.append({'id':p.stem,'file':'parts/'+p.name,'sha256':sha(p),'nonzeroAlphaPixels':int(np.count_nonzero(b[:,:,3])),'bounds':list(Image.open(p).getbbox())})
states={
 'approved-neutral':['jacket-approved','shirt-approved-visible','tie-approved','lower-approved-visible','body-visible'],
 'shirt-with-tie':['shirt-complete','lower-complete','shirt-cuffs','tie-approved','body-visible'],
 'shirt-without-tie':['shirt-complete','lower-complete','shirt-cuffs','body-visible'],
 'jacket-without-tie':['shirt-complete','jacket-approved','shirt-cuffs','lower-approved-visible','body-visible'],
 'lower-material-exchange':['lower-complete','jacket-approved','shirt-approved-visible','tie-approved','body-visible']}
protected={}
protected['head_hair']=np.zeros(a.shape[:2],bool);protected['head_hair'][:430,:]=a[:430,:,3]>=128
for side,name in [('left','BODY_hand_viewer_left'),('right','BODY_hand_viewer_right')]:
 p=read(out/'parts'/(name+'.png')); old_part=read(art/'split-d/parts'/(name+'.png')); removed=(old_part[:,:,3]>=128)&(p[:,:,3]==0); protected_source_skin=(a[:,:,0].astype(int)-a[:,:,2].astype(int)>10); assert not np.any(removed&protected_source_skin), ('lost source skin',name); mask=p[:,:,3]>=128;mask[:1320,:]=False;protected['hand_'+side]=mask
results={}
for name,assembly in states.items():
 b=read(out/(name+'.png'));r=read(out/('reopened-'+name+'.png'));c=read(out/('recomposed-'+name+'.png'))
 rr=diff(b,r);cc=diff(b,c);assert not rr['visibleRGBDifferentPixels'] and not rr['alphaDifferentPixels'],(name,'PSD roundtrip',rr)
 # Component composites can quantize premultiplied edge colors by one level; report the actual value.
 assert cc['maximumVisibleRGBDifference']<=1 and cc['alphaDifferentPixels']==0,(name,'PNG assembly',cc)
 identity={k:diff(a,b,m) for k,m in protected.items()}
 for k,v in identity.items():assert not v['visibleRGBDifferentPixels'] and not v['alphaDifferentPixels'],(name,k,v)
 results[name]={'file':name+'.png','sha256':sha(out/(name+'.png')),'assembly':assembly,'roundTrip':rr,'componentAssembly':cc,'protectedIdentity':identity}
neutral=diff(a,read(out/'approved-neutral.png'));assert not neutral['visibleRGBDifferentPixels'] and not neutral['alphaDifferentPixels'],neutral
result={'source':{'file':'../hibiki-static-a.png','commit':'d8e3a9c','sha256':sha(source)},'baselinePreserved':{'commit':'17c3f54','psd':old['psdSHA256'],'partCount':len(old['parts'])},'canvas':[1024,1536],'psd':{'file':'hibiki-v3-wardrobe-e.psd','sha256':sha(out/'hibiki-v3-wardrobe-e.psd')},'method':'Photoshop 2018 painting, content-aware fabric repair and garment-only color curves; no image generation, runtime warp or silhouette mask hiding missing cloth','neutralComparison':neutral,'materials':materials,'states':results,'limits':['Protected identity comparisons cover the head/hair above y430 and visible hands below y1320; clothing-adjacent alpha edges are reviewed visually','Static approved garments with jacket/tie on/off; arbitrary new outfits and moving-pose acceptance are not proven','Human Acceptance remains with the user']}
(out/'material-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'neutral':neutral,'materials':len(materials),'states':{k:{'roundTrip':v['roundTrip'],'componentAssembly':v['componentAssembly'],'protectedIdentity':v['protectedIdentity']} for k,v in results.items()}},ensure_ascii=False))
