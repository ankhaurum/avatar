from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib
B=Path(__file__).parent
R=Path('C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/split-e')
files=sorted((R/'parts').glob('j-export-J_HAND_*_palmar.png'))
sheet=Image.new('RGB',(1500,1000),'#d7d7d7');draw=ImageDraw.Draw(sheet)
for i,p in enumerate(files):
 im=Image.open(p).convert('RGBA');im=im.resize((im.width*4,im.height*4),Image.Resampling.NEAREST);im.thumbnail((240,440));bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);x=(i%6)*250;y=(i//6)*500;sheet.paste(bg.convert('RGB'),(x,y+45));draw.text((x+3,y+5),p.stem.replace('j-export-J_HAND_',''),fill='black')
sheet.save(B/'j-hand-component-review.jpg')
if (R/'material-j-manifest.json').exists():
 m=json.loads((R/'material-j-manifest.json').read_text(encoding='utf-8-sig'));checks=[]
 for p in m['parts']:
  f=R/p['file'];im=Image.open(f).convert('RGBA');a=im.getchannel('A');checks.append({'name':p['name'],'size':list(im.size),'expectedSize':[p['bounds'][2]-p['bounds'][0],p['bounds'][3]-p['bounds'][1]],'alpha':a.getextrema(),'nonempty':a.getbbox() is not None,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 (B/'j-export-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
 print('export checks',len(checks),'empty',sum(not x['nonempty'] for x in checks),'sizeMismatch',sum(x['size']!=x['expectedSize'] for x in checks))
print('hand previews',len(files))
