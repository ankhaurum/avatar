import json,sys
from pathlib import Path
from PIL import Image
model_path=Path(sys.argv[1]);root=model_path.parent
output=Path(sys.argv[2])
if output.exists(): raise ValueError('Contour output already exists; use a new revision')
model=json.loads(model_path.read_text(encoding='utf-8'));result={}
for mesh in model['meshes']:
    if not (mesh['id'].startswith('hand.') or mesh['id'].startswith('arm.') and mesh['id'].split('.')[-1] in ['upper','fore','cuff']): continue
    texture=next(t for t in model['textures'] if t['id']==mesh['texture'])
    im=Image.open(root/texture['file']).convert('RGBA');alpha=im.getchannel('A');rows=[]
    for y in range(im.height):
        xs=[x for x in range(im.width) if alpha.getpixel((x,y))>=128]
        # Detached antialias/fringe pixels are not a contour bridge. Use the
        # principal connected span of each already separated anatomical part.
        runs=[]
        for x in xs:
            if not runs or x>runs[-1][1]+1: runs.append([x,x])
            else: runs[-1][1]=x
        rows.append(max(runs,key=lambda r:r[1]-r[0]) if runs else None)
    valid=[i for i,r in enumerate(rows) if r]
    if not valid: raise ValueError('Empty hand contour '+mesh['id'])
    sample_rows=list(range(im.height))
    for i,r in enumerate(rows):
        if r is None:
            j=min(valid,key=lambda j:abs(j-i));rows[i]=rows[j];sample_rows[i]=j
    result[mesh['id']]={'width':im.width,'height':im.height,'rows':rows,'sampleRows':sample_rows,'firstOpaqueRow':valid[0]}
output.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({'parts':len(result),'source':'PSD exported alpha silhouette, no image editing'}))
