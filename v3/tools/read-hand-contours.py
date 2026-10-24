import json,sys,re,math
from pathlib import Path
from PIL import Image
model_path=Path(sys.argv[1]);root=model_path.parent
output=Path(sys.argv[2])
if output.exists() and '--replace' not in sys.argv[3:]: raise ValueError('Contour output already exists; use a new revision')
approved_sleeves='--approved-sleeves' in sys.argv[3:]
approved_hands='--approved-hands' in sys.argv[3:]
approved_shirt='--approved-shirt' in sys.argv[3:]
shirt_paths={}
if approved_shirt:
 text=(Path(__file__).parent/'paint-wardrobe-surfaces.jsx').read_text(encoding='utf-8-sig')
 for key in ['torso','larm','rarm']:
  points=json.loads(re.search(r'var '+key+r'=(\[.*?\]);',text,re.S).group(1));polygon=[]
  for i,a in enumerate(points):
   b=points[(i+1)%len(points)];c=a[4:6] if len(a)>=6 else a[:2];d=b[2:4] if len(b)>=6 else b[:2]
   for j in range(24):
    t=j/24;u=1-t;polygon.append([u**3*a[k]+3*u*u*t*c[k]+3*u*t*t*d[k]+t**3*b[k] for k in range(2)])
  shirt_paths[key]=polygon

def span(polygon,y):
 xs=[]
 for i,a in enumerate(polygon):
  b=polygon[(i+1)%len(polygon)]
  if min(a[1],b[1])<=y<max(a[1],b[1]):xs.append(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]))
 return [min(xs),max(xs)] if xs else None
model=json.loads(model_path.read_text(encoding='utf-8-sig'));result={}
if 'layers' in model and 'meshes' not in model:
    layers=model['layers'];model={'textures':layers,'meshes':[{'id':l['id'],'texture':l['id'],'authoring':{'bounds':l['bounds']}} for l in layers]}
for mesh in model['meshes']:
    if approved_shirt and mesh.get('authoring',{}).get('role') not in ['shirt-torso','shirt-sleeve']:continue
    if approved_hands and not (mesh['id'].startswith('BODY_wrist_underlap') or mesh['id'].startswith('HAND_volar') or mesh['id'].startswith('HAND_front_viewer_') or mesh['id']=='BODY_hand_viewer_right'):continue
    if approved_sleeves and not mesh['id'].startswith('WARDROBE_jacket_sleeve'): continue
    if not approved_sleeves and not approved_hands and not approved_shirt and not (mesh['id'].startswith('hand.') or mesh['id'].startswith('arm.') and mesh['id'].split('.')[-1] in ['upper','fore','cuff']): continue
    texture=next(t for t in model['textures'] if t['id']==mesh['texture'])
    im=Image.open(root/texture['file']).convert('RGBA');alpha=im.getchannel('A');rows=[];critical_rows=[];previous_separation=(False,False)
    for y in range(im.height):
        xs=[x for x in range(im.width) if alpha.getpixel((x,y))>=(20 if approved_hands else 3 if approved_sleeves or approved_shirt else 128)]
        # Detached antialias/fringe pixels are not a contour bridge. Use the
        # principal connected span of each already separated anatomical part.
        runs=[]
        for x in xs:
            if not runs or x>runs[-1][1]+1: runs.append([x,x])
            else: runs[-1][1]=x
        if approved_shirt:
            x0,y0=mesh['authoring']['bounds'][:2];wy=y0+y+.5;torso=span(shirt_paths['torso'],wy);la=span(shirt_paths['larm'],wy);ra=span(shirt_paths['rarm'],wy);left=(la[1]+2 if la else 341);right=(ra[0]-2 if ra else 683)
            if wy<568:left=max(left,341);right=min(right,683)
            # Below the armpit the atlas already has separate opaque sleeve runs.
            left_separated=False;right_separated=False
            if wy>780 and runs:

                if (runs[0][0]+runs[0][1])/2+x0<400:left=x0+runs[0][1]+1;left_separated=True
                if (runs[-1][0]+runs[-1][1])/2+x0>624:right=x0+runs[-1][0];right_separated=True
            separation=(left_separated,right_separated)
            if separation!=previous_separation:critical_rows.extend([y0+y-1,y0+y,y0+y+1]);previous_separation=separation
            role=mesh['authoring']['role'];side=mesh['authoring'].get('side');xs=[x for x in xs if (((left<=x+x0<right or torso and torso[0]<=x+x0<=torso[1]) and (not left_separated or x+x0>=left) and (not right_separated or x+x0<right)) if role=='shirt-torso' else x+x0<left if side=='r' else x+x0>=right)]
            runs=[]
            for x in xs:
                if not runs or x>runs[-1][1]+1:runs.append([x,x])
                else:runs[-1][1]=x
        rows.append(([runs[0][0],runs[-1][1]] if approved_hands or approved_shirt else max(runs,key=lambda r:r[1]-r[0])) if runs else None)
    valid=[i for i,r in enumerate(rows) if r]
    if not valid: raise ValueError('Empty hand contour '+mesh['id'])
    sample_rows=list(range(im.height))
    for i,r in enumerate(rows):
        if r is None:
            j=min(valid,key=lambda j:abs(j-i));rows[i]=rows[j];sample_rows[i]=j
    result[mesh['id']]={'width':im.width,'height':im.height,'rows':rows,'sampleRows':sample_rows,'firstOpaqueRow':valid[0],'lastOpaqueRow':valid[-1],'criticalRows':sorted(set(critical_rows)),'bounds':mesh.get('authoring',{}).get('bounds')}
output.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'parts':len(result),'source':'PSD exported alpha silhouette, no image editing'}))
