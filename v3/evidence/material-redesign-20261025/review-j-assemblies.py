from PIL import Image, ImageDraw
from pathlib import Path
import json
B=Path(__file__).parent
R=Path('C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/split-e')
for source,out,box in [('j-neutral-final-material-review.png','j-head-final-review.jpg',(300,25,725,600)),('j-neutral-final-material-review.png','j-neutral-final-review.jpg',None),('j-open-palms-material-review.png','j-hands-final-review.jpg',(95,1225,940,1510))]:
 im=Image.open(B/source).convert('RGBA'); bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im)
 if box:bg=bg.crop(box)
 bg.convert('RGB').save(B/out,quality=94)
m=json.loads((R/'material-j-manifest.json').read_text(encoding='utf-8-sig'))
for category,predicate in [('face',lambda n:any(k in n for k in ['EYE_','FACE_','MOUTH_','EAR_','BROW_','NOSE_'])),('garment',lambda n:any(k in n for k in ['SHIRT_','JACKET_','LOWER_','BODY_','WARDROBE_'])),('hair',lambda n:'HAIR_' in n)]:
 parts=[p for p in m['parts'] if predicate(p['name'])];sheet=Image.new('RGB',(1200,((len(parts)+3)//4)*320),'#ddd');draw=ImageDraw.Draw(sheet)
 for i,p in enumerate(parts):
  im=Image.open(R/p['file']).convert('RGBA');im.thumbnail((285,265));bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);x=(i%4)*300;y=(i//4)*320;sheet.paste(bg.convert('RGB'),(x,y+45));draw.text((x+3,y+5),p['name'][:35],fill='black')
 sheet.save(B/('j-'+category+'-parts-review.jpg'),quality=94)
print('Reviewed manifest:',len(m['parts']))
