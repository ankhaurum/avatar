from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from psd_tools import PSDImage

ROOT=Path(__file__).resolve().parent
SIZE=(1024,1280)
def polygon(size, points):
    s=3
    im=Image.new('L',(size[0]*s,size[1]*s))
    ImageDraw.Draw(im).polygon([(round(x*s),round(y*s)) for x,y in points],fill=255)
    return im.resize(size,Image.Resampling.LANCZOS)
def masked(im, mask):
    im=im.convert('RGBA').copy()
    a=np.array(im.getchannel('A'),dtype=np.uint16)
    b=np.array(mask,dtype=np.uint16)
    im.putalpha(Image.fromarray(((a*b+127)//255).astype('uint8')))
    return im
def positioned(im, xy):
    out=Image.new('RGBA',SIZE)
    out.alpha_composite(im,xy)
    return out
def add(parent,name,im):
    box=im.getbbox()
    if box is None: raise ValueError(name)
    return parent.create_pixel_layer(im.crop(box),name=name,left=box[0],top=box[1])
def full_layer(layer):
    out=Image.new('RGBA',SIZE)
    out.alpha_composite(layer.topil(apply_icc=False).convert('RGBA'),(layer.left,layer.top))
    return out
def fingerprint(psd):
    result={}
    for l in psd.descendants():
        if l.kind=='pixel' and any(t in l.name for t in ('FACE','EYE','BROW','MOUTH','NOSE','HAIR','EAR')):
            key=l.name
            parent=l.parent
            while parent is not None and parent is not psd:
                key=parent.name+'/'+key
                parent=parent.parent
            result[key]=hashlib.sha256(l.topil(apply_icc=False).tobytes()).hexdigest()
    return result

src=PSDImage.open(ROOT/'hibiki-independent-parts-assembled-review.psd')
before=fingerprint(src)
parts=next(l for l in src if l.name=='PARTS_bust_master__IN_PROGRESS')
left=next(l for l in parts if l.name=='CLOTHING_L_SHARED_v1')
right=next(l for l in parts if l.name=='CLOTHING_R_MIRRORED_v1')
cloth=Image.alpha_composite(full_layer(left),full_layer(right))
atlas=Image.open(ROOT/'garment-underlay-production-source.png').convert('RGBA')

# Painted continuous torso, including the surfaces beneath cape, collar and sleeves.
torso_points=[(235,85),(350,48),(382,24),(441,52),(528,68),(625,62),(709,24),(740,47),(858,83),(870,167),(880,256),(916,345),(887,419),(870,489),(831,585),(817,682),(837,764),(873,839),(914,901),(916,915),(854,958),(738,991),(559,1001),(370,993),(240,955),(182,914),(184,900),(227,817),(260,741),(278,668),(269,588),(234,502),(211,427),(182,346),(207,267),(220,178)]
torso=masked(atlas,polygon(atlas.size,torso_points)).crop((178,20,920,1005))
torso=torso.resize((620,820),Image.Resampling.LANCZOS)
body=positioned(torso,(226,770))
# Retain visible accepted lower blouse pixels; new continuous material supplies concealed areas.
visible_body=polygon(SIZE,[(229,1050),(282,1050),(333,1032),(374,992),(422,917),(487,849),(536,836),(585,849),(650,917),(698,992),(739,1032),(790,1050),(843,1050),(826,1280),(246,1280)])
body=Image.alpha_composite(body,masked(cloth,visible_body))

sleeve_points=[(1116,522),(1117,480),(1080,408),(1073,332),(1085,257),(1115,184),(1156,117),(1196,85),(1231,80),(1266,90),(1310,129),(1348,190),(1380,263),(1404,347),(1429,442),(1438,477),(1409,494),(1358,510),(1281,522),(1198,529)]
sleeve=masked(atlas,polygon(atlas.size,sleeve_points)).crop((1070,77,1440,533))
sleeve_source=Image.open(ROOT/'long-sleeve-production-source.png').convert('RGBA')
sleeve_boundary=[(350,371),(351,313),(365,254),(387,205),(418,163),(455,141),(485,130),(526,129),(563,136),(593,153),(622,180),(647,215),(665,264),(677,317),(681,365),(677,412),(665,456),(649,504),(638,548),(639,584),(633,628),(632,680),(632,724),(623,764),(623,803),(614,855),(619,903),(625,957),(631,1017),(636,1075),(638,1140),(636,1197),(621,1253),(604,1287),(599,1318),(597,1371),(596,1422),(579,1432),(542,1437),(497,1435),(464,1429),(447,1420),(445,1373),(443,1323),(437,1310),(419,1274),(408,1219),(404,1165),(402,1098),(404,1044),(406,1000),(410,962),(422,916),(428,875),(431,830),(428,794),(420,752),(423,707),(418,660),(416,614),(407,572),(405,537),(402,502),(380,453),(361,410)]
sleeve=masked(sleeve_source,polygon(sleeve_source.size,sleeve_boundary)).crop((349,128,682,1439))
sleeve=sleeve.resize((224,900),Image.Resampling.LANCZOS)
sleeve_l=positioned(sleeve,(55,824))
sleeve_r=positioned(ImageOps.mirror(sleeve),(793,824))

arm=Image.open(ROOT/'arm-shared-production-source.png').convert('RGBA')
# Remove low-alpha generation fringe; source RGB is preserved.
a=arm.getchannel('A').point(lambda v:255 if v>=220 else 0).filter(ImageFilter.MinFilter(3))
arm.putalpha(a)
arm=arm.crop(arm.getbbox())
arm=arm.resize((round(arm.width*1350/arm.height),1350),Image.Resampling.LANCZOS)
arm_l=positioned(arm,(90,930))
arm_r=positioned(ImageOps.mirror(arm),(1072-90-arm.width,930))

cape_l_points=[(153,830),(272,795),(390,774),(423,803),(492,832),(453,897),(414,955),(373,1009),(337,1032),(300,1045),(264,1045),(227,1031),(201,1007),(182,1024),(141,1038),(103,1038),(70,1027),(56,1016),(75,951),(103,882)]
cape_l=masked(cloth,polygon(SIZE,cape_l_points))
cape_r=masked(cloth,polygon(SIZE,[(1072-x,y) for x,y in cape_l_points]))
collar_mask=polygon(SIZE,[(386,698),(686,698),(685,783),(655,803),(621,819),(580,838),(536,850),(492,838),(451,819),(417,803),(387,783)])
collar=masked(cloth,collar_mask)

insert_at=parts.index(right)
parts.remove(left);parts.remove(right)
new=[]
for name,im in [('ARM_L_complete_under_sleeve',arm_l),('ARM_R_complete_under_sleeve',arm_r),('SLEEVE_L_complete_cap',sleeve_l),('SLEEVE_R_complete_cap',sleeve_r),('BLOUSE_complete_under_cape',body),('CAPE_L_shoulder_yoke',cape_l),('CAPE_R_shoulder_yoke',cape_r),('COLLAR_stand_complete',collar)]:
    
    if name.startswith('SLEEVE_'):
        full=sleeve if '_L_' in name else ImageOps.mirror(sleeve)
        l=parts.create_pixel_layer(full,name=name,left=55 if '_L_' in name else 793,top=824)
    else:l=add(parts,name,im)
    parts.remove(l);new.append(l)
for i,l in enumerate(new):
    parts.insert(insert_at+i,l)
    if l.name.startswith('ARM_'):l.visible=False
assert before==fingerprint(src),'Original facial/hair channels changed'
src.save(ROOT/'hibiki-bust-import-parts.psd')
src.composite(force=True,apply_icc=False).save(ROOT/'hibiki-bust-import-parts-assembled.png')
(ROOT/'arm-parts-integrity.json').write_text(json.dumps({'source_head_layer_hashes_unchanged':True,'new_parts':[l.name for l in new],'canvas':SIZE,'note':'Bust framing; arms continue through lower canvas edge. Native Photoshop reopen remains pending.'},indent=2),encoding='utf8')
print('Saved actual layered PSD and composite',flush=True)

