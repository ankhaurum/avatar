from PIL import Image, ImageDraw
from pathlib import Path
import json
b=Path(r'C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e')
r=Path(r'C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork')
def grey(im):
 im=im.convert('RGBA'); bg=Image.new('RGBA',im.size,(100,100,100,255));bg.alpha_composite(im);return bg.convert('RGB')
parts=json.loads((b/'material-i-eye-left-exports.json').read_text())['layers']
sheet=Image.new('RGB',(1200,800),(100,100,100));draw=ImageDraw.Draw(sheet)
for j,p in enumerate(parts):
 im=grey(Image.open(r/'split-e'/'parts'/('i-'+p['name']+'.png')))
 im=im.resize((im.width*8,im.height*8),Image.Resampling.NEAREST);im.thumbnail((380,300))
 x=j%3*400;y=j//3*400;sheet.paste(im,(x+10,y+55));draw.text((x+8,y+8),p['name'],fill='white');draw.text((x+8,y+25),str(p['bounds']),fill='white')
sheet.save(b/'material-i-eye-left-parts-review.jpg',quality=98)
source=Image.open(r/'hibiki-static-a.png').convert('RGBA').crop((545,230,610,275))
candidate=Image.open(b/'material-i-eye-left-neutral.png').convert('RGBA')
combined=source.copy();combined.alpha_composite(candidate)
sheet=Image.new('RGB',(1184,720),(100,100,100));draw=ImageDraw.Draw(sheet)
for j,(label,im) in enumerate([('Approved A',source),('Parts only',candidate),('Parts over A - inspection only',combined)]):
 im=grey(im).resize((592,328),Image.Resampling.NEAREST)
 x=j%2*592;y=j//2*360;sheet.paste(im,(x,y+25));draw.text((x+8,y+5),label,fill='white')
sheet.save(b/'material-i-eye-left-assembly-review.jpg',quality=98)
print(json.dumps({'partCount':len(parts),'review':'material-i-eye-left-assembly-review.jpg'}))
