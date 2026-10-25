import pathlib,json
from PIL import Image,ImageDraw
B=pathlib.Path(__file__).parent
data=json.loads((B/'j-hair-authoring-inputs.json').read_text(encoding='utf8'))
sheet=Image.new('RGB',(1400,800),'#e0e0e0');draw=ImageDraw.Draw(sheet)
for i,s in enumerate(data['specs']):
 im=Image.open(s['source']).convert('RGBA');a=im.getchannel('A');s['sourceCrop']=list(a.point(lambda x:255 if x>=16 else 0).getbbox());s['alphaExtrema']=list(a.getextrema())
 preview=Image.new('RGBA',im.size,'white');preview.alpha_composite(im);preview.thumbnail((190,650));sheet.paste(preview.convert('RGB'),(i*200,40));draw.text((i*200+4,10),s['name'].replace('HAIR_',''),fill='black')
(B/'j-hair-authoring-measured.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
sheet.save(B/'j-hair-seven-source-review.jpg')
print(json.dumps([{k:s[k] for k in ['name','sourceCrop','alphaExtrema']} for s in data['specs']]))
