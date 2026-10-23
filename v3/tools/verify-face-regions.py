"""Read-only comparison of selected visible RGB regions; not Identity acceptance."""
import json,sys,hashlib
from pathlib import Path
from PIL import Image
r=Path(sys.argv[1]);rev=sys.argv[2];d=r/'v3'/('export-r'+rev)
j=json.loads((d/'layers.json').read_text(encoding='utf-8-sig'))
bounds=next(x['bounds'] for x in j['layers'] if x['id']=='face.skin')
master=Image.open(r/'assets/approved-front.png').convert('RGB')
skin=Image.open(d/'face.skin.png').convert('RGB')
regions={'nose':[910,535,990,610],'mole':[795,515,815,535],'cheek':[820,545,870,600],'chin':[915,720,975,740]};out={}
for name,(x0,y0,x1,y1) in regions.items():
 changed=0;maximum=0
 for y in range(y0,y1):
  for x in range(x0,x1):
   p=master.getpixel((x-350,y));q=skin.getpixel((x-int(bounds[0]),y-int(bounds[1])));delta=max(abs(p[i]-q[i]) for i in range(3));changed+=delta>0;maximum=max(maximum,delta)
 out[name]={'canvasBounds':[x0,y0,x1,y1],'pixels':(x1-x0)*(y1-y0),'changedRGB':changed,'maximumRGBDifference':maximum}
print(json.dumps({'masterSHA256':hashlib.sha256((r/'assets/approved-front.png').read_bytes()).hexdigest(),'candidate':rev,'regions':out,'scope':'Selected visible RGB only; does not prove full-image or moving Identity'},indent=2))
