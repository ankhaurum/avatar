"""Focused source/geometry checks for approved-A motion, not visual acceptance."""
import json,hashlib,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
B=Path('v3/artwork/split-e');model=json.loads((B/'model-approved-a.json').read_text(encoding='utf-8-sig'))
active={}
for m in model['meshes']:
 t=next(t for t in model['textures'] if t['id']==m['texture']);a=np.array(Image.open(B/t['file']).convert('RGBA'))[:,:,3];uv=np.array(m['uv']).reshape(-1,2);tri=np.array(m['triangles']).reshape(-1,3);probes=np.concatenate([uv[tri],uv[tri].mean(axis=1)[:,None,:]],axis=1);x=np.clip((probes[:,:,0]*(a.shape[1]-1)).astype(int),0,a.shape[1]-1);y=np.clip((probes[:,:,1]*(a.shape[0]-1)).astype(int),0,a.shape[0]-1);active[m['id']]=np.flatnonzero(a[y,x].max(axis=1)>20).tolist()
js="""
import fs from 'node:fs';import {compile,evaluate} from './v3/runtime/evaluate.mjs';import {applyApprovedAppearance} from './v3/runtime/approved-appearance.mjs';
const active=JSON.parse(fs.readFileSync(0,'utf8')),m=JSON.parse(fs.readFileSync('v3/artwork/split-e/model-approved-a.json')),c=compile(m),motion=JSON.parse(fs.readFileSync('v3/motion-approved-a.json')),report={neutralMaximumVertexError:0,neutralVisibleMaximumVertexError:0,poses:{},independentParameters:{},limits:{}};
const zero=evaluate(c);for(const mesh of m.meshes)for(let i=0;i<mesh.rest.length;i++){const error=Math.abs(mesh.rest[i]-zero.positions.get(mesh.id)[i]);report.neutralMaximumVertexError=Math.max(report.neutralMaximumVertexError,error);if(mesh.visible)report.neutralVisibleMaximumVertexError=Math.max(report.neutralVisibleMaximumVertexError,error);}
function geometry(pose,wardrobe='approved-neutral'){const f=evaluate(c,pose);applyApprovedAppearance(m,f.state,wardrobe);let flips=0,allFlips=0,min=1;const locations={},reversed=[];for(const mesh of m.meshes){if(!mesh.visible||mesh.surface&&!mesh.surface.projectOnly)continue;const p=f.positions.get(mesh.id),r=mesh.rest,A=new Set(active[mesh.id]);for(let j=0;j<mesh.triangles.length;j+=3){const [a,b,d]=mesh.triangles.slice(j,j+3).map(x=>x*2),area=x=>(x[b]-x[a])*(x[d+1]-x[a+1])-(x[b+1]-x[a+1])*(x[d]-x[a]),ratio=area(p)/area(r);if(ratio<0)allFlips++;if(A.has(j/3)){min=Math.min(min,ratio);if(ratio<0){flips++;locations[mesh.id]=(locations[mesh.id]||0)+1;reversed.push({mesh:mesh.id,triangle:j/3,restCentroid:[(r[a]+r[b]+r[d])/3,(r[a+1]+r[b+1]+r[d+1])/3],ratio});}}}}return{activeTriangleFlips:flips,allTriangleFlips:allFlips,minActiveAreaRatio:min,locations,reversed};}
for(const [id,clip]of Object.entries(motion.states))report.poses[id]=[0,.25,.5,.75,1].map(k=>({progress:k,...geometry(Object.fromEntries(Object.entries(clip.pose).map(([id,v])=>[id,k*v])))}));
report.wardrobeMotion={};for(const id of ['explain','thinking'])report.wardrobeMotion[id]=[.5,1].map(k=>geometry(Object.fromEntries(Object.entries(motion.states[id].pose).map(([id,v])=>[id,k*v])),'shirt-without-tie'));
for(const p of m.parameters){const f=evaluate(c,{[p.id]:p.max});let movement=0;for(const mesh of m.meshes){const a=f.positions.get(mesh.id),b=zero.positions.get(mesh.id);for(let i=0;i<a.length;i++)movement=Math.max(movement,Math.abs(a[i]-b[i]));}report.independentParameters[p.id]={maximumVertexChange:movement};}
for(const side of ['r','l'])report.limits[side]=geometry({['arm.'+side+'.upper']:side==='r'?1.1:-1.1,['arm.'+side+'.elbow']:side==='r'?1.8:-1.8});console.log(JSON.stringify(report));
"""
node='C:/Users/ANKHAURUM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
r=subprocess.run([node,'--input-type=module','-e',js],input=json.dumps(active),capture_output=True,text=True,check=True);report=json.loads(r.stdout)
def compare(a,b):
 a=np.array(Image.open(a).convert('RGBA'));b=np.array(Image.open(b).convert('RGBA'));v=(a[:,:,3]>0)|(b[:,:,3]>0);return {'alphaDifferentPixels':int((a[:,:,3]!=b[:,:,3]).sum()),'visibleRGBDifferentPixels':int((np.any(a[:,:,:3]!=b[:,:,:3],axis=2)&v).sum())}
report['staticPsdRoundTrip']={}
for state in ['approved-neutral','shirt-with-tie','shirt-without-tie','jacket-without-tie','lower-material-exchange']:
 f=B/('motion-f-'+state+'.png')
 if f.exists():report['staticPsdRoundTrip'][state]=compare(f,B/(state+'.png'))
report['sourceChecks']={'approvedArtwork':hashlib.sha256(Path('v3/artwork/hibiki-static-a.png').read_bytes()).hexdigest(),'wardrobeE':hashlib.sha256((B/'hibiki-v3-wardrobe-e.psd').read_bytes()).hexdigest(),'motionF':hashlib.sha256((B/'hibiki-v3-motion-f.psd').read_bytes()).hexdigest()}
baseline=json.loads(Path('v3/artwork/split-d/verification.json').read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert report['sourceChecks']['approvedArtwork']=='a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf'
assert report['sourceChecks']['wardrobeE']=='8a0be1398fec67b90cadee5d00bdcc1ed4e75458933400f05b71872eee869f99'
assert sha('v3/artwork/split-d/hibiki-v3-approved-split-d.psd')==baseline['psdSHA256']
for part in baseline['parts']:assert sha(Path('v3/artwork/split-d')/part['file'])==part['sha256'],part['file']
report['sourceChecks']['splitDAll14PartsAndPsdUnchanged']=True
report['wardrobeOwnershipRepair']={}
master=np.array(Image.open('v3/artwork/hibiki-static-a.png').convert('RGBA'))
for state in ['shirt-with-tie','shirt-without-tie']:
 new=np.array(Image.open(B/('motion-f-'+state+'.png')).convert('RGBA'));old=np.array(Image.open(B/(state+'.png')).convert('RGBA'));visible=(new[:,:,3]>0)|(old[:,:,3]>0);mask=np.any(new!=old,axis=2)&visible
 report['wardrobeOwnershipRepair'][state]={'repairedVisiblePixels':int(mask.sum()),'changedPixelsEqualApprovedMaster':bool((new[mask]==master[mask]).all())}
 assert report['wardrobeOwnershipRepair'][state]['changedPixelsEqualApprovedMaster']
assert report['staticPsdRoundTrip']['approved-neutral']=={'alphaDifferentPixels':0,'visibleRGBDifferentPixels':0}
report['note']='Hidden mouth aperture collapses at rest (not rendered); visible neutral vertices preserve coordinates. Planar triangle probes exclude curved depth-tested hand faces (which intentionally turn away and are culled); they use texture alpha>20 at vertices/centroid; misses subpixel slivers and does not establish seam or visual quality. Limits may remain unresolved.'
(B/'motion-geometry-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'neutralVisible':report['neutralVisibleMaximumVertexError'],'poses':{k:max(x['activeTriangleFlips'] for x in v) for k,v in report['poses'].items()},'locations':{k:v[-1]['reversed'] for k,v in report['poses'].items()},'limits':report['limits'],'static':report['staticPsdRoundTrip'],'shirtMotion':report['wardrobeMotion']},ensure_ascii=False))

assert all(x['activeTriangleFlips']==0 for v in report['poses'].values() for x in v)
assert all(v['activeTriangleFlips']==0 for v in report['limits'].values())

assert all(v['activeTriangleFlips']==0 for rows in report['wardrobeMotion'].values() for v in rows)
