from pathlib import Path
import json,ctypes,gc,time
from PIL import Image,ImageChops
from psd_tools import PSDImage
from psd_tools.constants import Resource
R=Path(__file__).resolve().parent
ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x00004000)
class Mem(ctypes.Structure):
 _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong),('total',ctypes.c_ulonglong),('available',ctypes.c_ulonglong),('pageTotal',ctypes.c_ulonglong),('pageAvail',ctypes.c_ulonglong),('virtTotal',ctypes.c_ulonglong),('virtAvail',ctypes.c_ulonglong),('extended',ctypes.c_ulonglong)]
def free():
 m=Mem();m.length=ctypes.sizeof(m);ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m));return m.available
if free()<1024**3:raise SystemExit('Deferred: available physical memory below 1 GiB; no PSD opened')
p=PSDImage.open(R/'hibiki-bust-import-parts.psd')
out=PSDImage.new('RGBA',p.size)
if Resource.ICC_PROFILE in p.image_resources:out.image_resources[Resource.ICC_PROFILE]=p.image_resources[Resource.ICC_PROFILE]
merge={'HAIR_back_bust_original__MATERIAL','NECK_bust_visible_and_hidden__IN_PROGRESS','HAIR_neck_full_native_unmixed__REVIEW','EARS_bust_source__IN_PROGRESS','FACE_bust_original_contour__IN_PROGRESS','SHADOW_head_neck_contact__MATERIAL','NOSE_original_bust_visible','EYE_R_iris_complete__REVIEW','EYE_L_iris_complete__REVIEW','HAIR_fringe_bust_original__MATERIAL','HAIR_side_R_bust_original__MATERIAL','HAIR_side_L_bust_original__MATERIAL','HAIR_jaw_native_identity_preserved','HAIR_temple_native_boundary__REVIEW'}
manifest=[]
def emit(l,parents):
 im=l.composite(force=True,apply_icc=False)
 if im is None:return
 im=im.convert('RGBA')
 for parent in parents:
  if not parent.has_mask() or parent.mask.disabled:continue
  mask=parent.mask
  m=Image.new('L',im.size,mask.background_color)
  m.paste(mask.topil(),(mask.left-l.left,mask.top-l.top))
  im.putalpha(ImageChops.multiply(im.getchannel('A'),m))
 box=im.getbbox()
 if box is None:return
 im=im.crop(box);x=l.left+box[0];y=l.top+box[1]
 name=l.name
 out.create_pixel_layer(im,name=name,left=x,top=y)
 manifest.append({'part':name,'source_group':l.is_group(),'source_bbox':l.bbox,'output_bbox':[x,y,x+im.width,y+im.height],'applied_ancestor_masks':[a.name for a in parents if a.has_mask() and not a.mask.disabled]})
 del im;gc.collect()
def walk(g,parents=()):
 for l in g:
  if not l.visible or l.name.startswith(('PRESENTATION','REFERENCE')):continue
  if l.is_group() and l.name not in merge:walk(l,parents+(l,))
  else:emit(l,parents)
walk(p)
assert len(out)<100
assert all(not l.has_mask() for l in out)
out.save(R/'hibiki-cubism-static-import-candidate.psd')
(R/'cubism-static-import-normalization.json').write_text(json.dumps({'status':'STATIC_IMPORT_CANDIDATE_NOT_RIGGED','source':'hibiki-bust-import-parts.psd','parts':len(out),'layer_masks':0,'free_memory_after':free(),'limitations':['Eye aperture masks are baked for neutral display; complete moving iris sources remain in authoring PSD and require Cubism clipping setup before motion validation.','No Cubism import, mesh, keyform or native render validation performed.','Long sleeve textures extend below bust canvas.'],'manifest':manifest},ensure_ascii=False,indent=2),encoding='utf8')
print('Saved static import candidate:',len(out),'parts, 0 layer masks; not motion-ready',flush=True)
del p;gc.collect()
out.composite(force=True,apply_icc=False).save(R/'hibiki-cubism-static-import-candidate.png')
print('Saved neutral candidate render',flush=True)
