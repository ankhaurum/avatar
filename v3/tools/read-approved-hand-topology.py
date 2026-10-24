"""Read retained original hand alpha; output geometry only, never modify images."""
from pathlib import Path
import json,hashlib,math,sys
import numpy as np
from PIL import Image
B=Path('v3/artwork/split-e')
if (B/'rig-hand-topology.json').exists() and '--replace' not in sys.argv:raise ValueError('Preserve saved hand topology; --replace is required for deliberate source re-registration')
meta=json.loads((B/'rig-leaves.json').read_text(encoding='utf-8-sig'));layers={l['id']:l for l in meta['layers']};out={}
for side,names in [('r',['BODY_hand_viewer_left','BODY_hand_viewer_left_edge_recovered_motion']),('l',['BODY_hand_viewer_right'])]:
 parts=[layers[n] for n in names];x0=min(p['bounds'][0] for p in parts);y0=min(p['bounds'][1] for p in parts);x1=max(p['bounds'][2] for p in parts);y1=max(p['bounds'][3] for p in parts);alpha=np.zeros((y1-y0,x1-x0),dtype=float)
 for p in parts:
  a=np.asarray(Image.open(B/p['file']).convert('RGBA'))[:,:,3];x,y=p['bounds'][0]-x0,p['bounds'][1]-y0;alpha[y:y+a.shape[0],x:x+a.shape[1]]=np.maximum(alpha[y:y+a.shape[0],x:x+a.shape[1]],a)
 def sample(x,y):
  x-=x0+.5;y-=y0+.5;ix=math.floor(x);iy=math.floor(y);tx=x-ix;ty=y-iy
  def a(i,j):return alpha[j,i] if 0<=i<alpha.shape[1] and 0<=j<alpha.shape[0] else 0
  return a(ix,iy)*(1-tx)*(1-ty)+a(ix+1,iy)*tx*(1-ty)+a(ix,iy+1)*(1-tx)*ty+a(ix+1,iy+1)*tx*ty
 verts=[];triangles=[];lookup={};threshold=200
 def index(p):
  key=(round(float(p[0]),6),round(float(p[1]),6))
  if key not in lookup:lookup[key]=len(verts);verts.append(key)
  return lookup[key]
 def clip(tri):
  poly=[]
  for i,b in enumerate(tri):
   a=tri[i-1];sa=sample(*a)-threshold;sb=sample(*b)-threshold
   if (sa>=0)!=(sb>=0):t=sa/(sa-sb);poly.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
   if sb>=0:poly.append(b)
  for i in range(1,len(poly)-1):
   a,b,c=poly[0],poly[i],poly[i+1]
   if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>1e-7:triangles.extend([index(a),index(b),index(c)])
 for y in range(y0-2,y1+2,2):
  for x in range(x0-2,x1+2,2):
   for tri in [[(x,y),(x+2,y),(x,y+2)],[(x+2,y),(x+2,y+2),(x,y+2)]]:
    values=[sample(*p)>=threshold for p in tri];center=(sum(p[0] for p in tri)/3,sum(p[1] for p in tri)/3)
    if len(set(values))==1 and (sample(*center)>=threshold)!=values[0]:
     for i in range(3):clip([tri[i],tri[(i+1)%3],center])
    else:clip(tri)
 edges={}
 for i in range(0,len(triangles),3):
  tri=triangles[i:i+3]
  for a,b in zip(tri,tri[1:]+tri[:1]):key=tuple(sorted((a,b)));edges.setdefault(key,[]).append([a,b])
 assert all(len(e)<=2 for e in edges.values());boundary=[e[0] for e in edges.values() if len(e)==1];points=np.asarray(verts);a=points[np.array(boundary)[:,0]];delta=points[np.array(boundary)[:,1]]-a;den=(delta*delta).sum(axis=1);distance=[]
 for start in range(0,len(points),128):
  d=points[start:start+128,None,:]-a[None,:,:];t=np.clip((d*delta[None,:,:]).sum(axis=2)/den[None,:],0,1);dist=np.sqrt(((d-t[:,:,None]*delta[None,:,:])**2).sum(axis=2));distance.extend(dist.min(axis=1))
 depth=(1.5+np.minimum(8,np.asarray(distance)*.6)).tolist();out[side]={'rest':[v for p in verts for v in p],'triangles':triangles,'depth':depth,'boundaryEdges':boundary,'source':[{'file':p['file'],'sha256':hashlib.sha256((B/p['file']).read_bytes()).hexdigest()} for p in parts],'alphaThreshold':threshold,'gridStep':2,'note':'Geometry traced from retained original hand photos, including internal gaps; no image edits or silhouette scaling'}
(B/'rig-hand-topology.json').write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n');print({s:{'vertices':len(v['depth']),'boundaryEdges':len(v['boundaryEdges'])} for s,v in out.items()})
