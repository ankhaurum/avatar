from PIL import Image,ImageDraw
from pathlib import Path
import json
b=Path(r'C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e')
r=Path(r'C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/split-e')
def grey(im):
 bg=Image.new('RGBA',im.size,(100,100,100,255));bg.alpha_composite(im.convert('RGBA'));return bg.convert('RGB')
sheet=Image.new('RGB',(1500,800),(100,100,100));draw=ImageDraw.Draw(sheet)
for j,name in enumerate(['material-i-shirt-neutral','material-i-shirt-tie','material-i-jacket-neutral']):
 im=grey(Image.open(b/(name+'.png')));im.thumbnail((500,750));sheet.paste(im,(j*500,40));draw.text((j*500+5,8),name,fill='white')
sheet.save(b/'material-i-three-assemblies-review.jpg',quality=95)
parts=json.loads((b/'material-i-garment-hand-exports.json').read_text())['layers']
sheet=Image.new('RGB',(1200,2000),(85,85,85));draw=ImageDraw.Draw(sheet)
for j,part in enumerate(parts):
 im=grey(Image.open(r/'parts'/('i-'+part['name']+'.png')));im.thumbnail((380,340));x=j%3*400;y=j//3*400;sheet.paste(im,(x+(400-im.width)//2,y+45));draw.text((x+6,y+6),part['name'],fill='white');draw.text((x+6,y+22),str(part['bounds']),fill='white')
sheet.save(b/'material-i-parts-review.jpg',quality=95)
