from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
from psd_tools import PSDImage
import json,hashlib
R=Path(__file__).resolve().parent
p=PSDImage.open(R/'hibiki-bust-import-parts.psd')
def effective(g):
 for x in g:
  if x.visible:
   yield x
   if x.is_group():yield from effective(x)
ls={x.name:x for x in effective(p)}
items=[
('後ろ髪','HAIR_back_bust_original__MATERIAL'),('首','NECK_bust_visible_and_hidden__IN_PROGRESS'),('襟足','HAIR_neck_full_native_unmixed__REVIEW'),('顔・ほくろ','FACE_bust_original_contour__IN_PROGRESS'),('耳','EARS_bust_source__IN_PROGRESS'),('顎の接続','SHADOW_head_neck_contact__MATERIAL'),
('眉（左右独立）','BROWS_original_bust_visible'),('右目（内部別層）','EYE_R_original_bust'),('左目（内部別層）','EYE_L_original_bust'),('鼻','NOSE_original_bust_visible'),('上唇','MOUTH_upper_lip_bust_original'),('下唇','MOUTH_lower_lip_bust_original'),
('右口角','MOUTH_corner_R_bust_original'),('左口角','MOUTH_corner_L_bust_original'),('前髪','HAIR_fringe_bust_original__MATERIAL'),('右横髪','HAIR_side_R_bust_original__MATERIAL'),('左横髪','HAIR_side_L_bust_original__MATERIAL'),('顎横の髪','HAIR_jaw_native_identity_preserved'),
('こめかみの髪','HAIR_temple_native_boundary__REVIEW'),('前髪境界','HAIR_fringe_native_skin_unmixed__REVIEW'),('長袖 L','SLEEVE_L_complete_cap'),('長袖 R','SLEEVE_R_complete_cap'),('胴体','BLOUSE_complete_under_cape'),('肩飾り L','CAPE_L_shoulder_yoke'),
('肩飾り R','CAPE_R_shoulder_yoke'),('立ち襟','COLLAR_stand_complete'),('リボン輪 L','RIBBON_loop_L_SHARED'),('リボン輪 R','RIBBON_loop_R_MIRRORED'),('リボン垂れ L','RIBBON_tail_L_MIRRORED'),('リボン垂れ R','RIBBON_tail_R_SHARED'),
('リボン結び目','RIBBON_knot'),('右虹彩（独立）','EYE_R_iris_complete__REVIEW'),('左虹彩（独立）','EYE_L_iris_complete__REVIEW'),('右上まぶた','EYE_R_upper_lid_lash_bust_original'),('左上まぶた','EYE_L_upper_lid_lash_bust_original'),('右眼ハイライト','EYE_R_highlight_native__REVIEW')]
fontpath='C:/Windows/Fonts/meiryo.ttc'
f=lambda n:ImageFont.truetype(fontpath,n)
board=Image.new('RGB',(2400,1740),(241,244,250));d=ImageDraw.Draw(board)
d.text((36,24),'響 / 長袖バストアップ — PSD合成と実レイヤー一覧',font=f(33),fill=(30,48,80))
d.text((36,77),'顔は元のレイヤーを維持。右欄は同じPSDのパーツ／グループを個別表示（大きさは一覧用に調整）。',font=f(20),fill=(65,80,102))
assembled=Image.open(R/'hibiki-bust-import-parts-assembled.png').convert('RGB')
assembled.thumbnail((890,1350),Image.Resampling.LANCZOS)
board.paste(assembled,(25,160))
d.text((36,130),'レイヤーを重ねたデザイン',font=f(24),fill=(30,48,80))
d.text((36,1325),'編集用PSD / 静止状態の合成',font=f(23),fill=(30,48,80))
d.text((36,1370),'眼球・まぶた・口・髪・衣装は別レイヤー。',font=f(20),fill=(65,80,102))
d.text((36,1405),'眼の表示マスクと口内候補は調整が残っています。',font=f(20),fill=(65,80,102))
d.text((36,1440),'Cubism取り込み・変形動作は未検証です。',font=f(20),fill=(65,80,102))
manifest=[]
for i,(title,name) in enumerate(items):
 layer=ls[name]; im=layer.composite(force=True,apply_icc=False)
 if im is None: raise ValueError(name)
 im=im.convert('RGBA');box=im.getbbox()
 if box:im=im.crop(box)
 im.thumbnail((213,194),Image.Resampling.LANCZOS)
 col=i%6;row=i//6;x=945+col*239;y=139+row*254
 d.rounded_rectangle((x,y,x+226,y+241),radius=10,fill=(223,229,239))
 board.paste(im,(x+(226-im.width)//2,y+10+(195-im.height)//2),im)
 d.text((x+8,y+208),f'{i+1:02d} '+title,font=f(15),fill=(24,42,69))
 manifest.append({'index':i+1,'title':title,'psd_layer':name,'kind':layer.kind,'bbox':layer.bbox,'descendant_count':len(list(layer.descendants())) if layer.is_group() else 0})
board.save(R/'hibiki-long-sleeve-assembly-and-parts.png')
(R/'hibiki-long-sleeve-parts-index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('Board saved: actual same PSD layer composites; eye detail repeats explicitly identified.')
