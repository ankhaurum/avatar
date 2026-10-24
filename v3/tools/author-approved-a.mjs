import {refineNeckJoin} from './refine-neck-join.mjs';
import {handSectionDepth} from './hand-section-depth.mjs';
import {registerFingerRig,fingerSurfaceWeights} from './approved-finger-rig.mjs';
// Authored A-space registration. Technical evaluator reused; no r33/r34 data.
import {applyApprovedAppearance} from '../runtime/approved-appearance.mjs';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const base='v3/artwork/split-e',read=f=>fs.readFileSync(path.join(base,f)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(path.join(base,'model-approved-a.json'))&&!process.argv.includes('--replace-generated'))throw Error('Preserve authored edits: use --replace-generated only for deliberate script revisions');
const contours=JSON.parse(read('rig-contours.json'));
const source=JSON.parse(read('rig-leaves.json').toString().replace(/^\uFEFF/,''));
const m={format:'hibiki-model',version:1,width:1024,height:1536,authoringStatus:'承認原画Aの可動制作中。表裏の手と袖口を追加。指節の開閉、顔・肩の高角度／複合造形は未完成。',source:{manifest:'rig-export-manifest.json',sha256:''},parameters:[],nodes:[],textures:[],meshes:[],seams:[],surfaceNodes:[],rig:{arms:{},shoulderResponse:[[0,0],[.3,-3],[.7,-12],[1.2,-24]]}};
const param=(id,min,max,def=0)=>m.parameters.push({id,min,max,default:def});
const node=(id,parent,pivot,bindings={})=>m.nodes.push({id,...(parent?{parent}:{}),pivot,bindings});const bind=(parameter,factor=1)=>[{parameter,factor}];
param('body.x',-70,70);param('body.y',-40,40);param('body.lean',-.10,.10);param('body.breath',0,1);param('chest.turn',-1,1);param('head.tilt',-.13,.13);param('head.yaw',-.2,.2);param('head.pitch',-.3,.3);param('hair.sway',-1,1);param('cloth.sway',-1,1);param('mouth.open',0,1);param('mouth.smile',0,1);param('gaze.x',-1,1);param('gaze.y',-1,1);for(const side of ['r','l']){param('eye.'+side+'.blink',0,1);param('brow.'+side+'.raise',-1,1);}
node('canvas',null,[0,0],{x:bind('body.x'),y:bind('body.y')});node('torso','canvas',[516,1120],{rotation:bind('body.lean')});node('chest','torso',[520,760],{});node('neck','chest',[525,510],{});node('head','neck',[525,445],{rotation:bind('head.tilt')});
const arms={r:{shoulder:[281,535],elbow:[247,882],wrist:[173,1288],bend:1},l:{shoulder:[747,535],elbow:[790,882],wrist:[855,1282],bend:-1}};
for(const [s,a]of Object.entries(arms)){m.rig.arms[s]=a;param('shoulder.'+s+'.lift',-28,12);param('arm.'+s+'.upper',-1.1,1.1);param('arm.'+s+'.elbow',-1.8,1.8);param('wrist.'+s+'.rotation',-.45,.45);param('wrist.'+s+'.bend',-.4,.4);param('forearm.'+s+'.twist',-Math.PI,Math.PI);
node('clavicle.'+s,'chest',a.shoulder,{y:bind('shoulder.'+s+'.lift')});node('upper.'+s,'clavicle.'+s,a.shoulder,{rotation:bind('arm.'+s+'.upper')});node('forearm.'+s,'upper.'+s,a.elbow,{rotation:bind('arm.'+s+'.elbow')});node('wrist.'+s,'forearm.'+s,a.wrist,{rotation:bind('wrist.'+s+'.rotation')});
for(const finger of ['thumb','index','middle','ring','little'])for(const joint of ['mcp','pip','dip'])param(`finger.${s}.${finger}.${joint}`,-.15,.55);
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2)),rnd=x=>Math.round(x*1e6)/1e6;
function armWeights(s,y){const a=arms[s],e=smooth(a.elbow[1]-124,a.elbow[1]+126,y),cap=smooth(arms[s].shoulder[1]-18,arms[s].shoulder[1]+172,y);return [{node:'chest',weight:1-cap},{node:'upper.'+s,weight:cap*(1-e)},{node:'forearm.'+s,weight:cap*e}].filter(w=>w.weight>1e-8);}
function weights(o,x,y){const id=o.id,g=o.group;if(/hand_viewer/.test(id))return[{node:'wrist.'+(id.includes('viewer_left')?'r':'l'),weight:1}];if(/hair|BODY_face|FACE_lip|FACE_mouth|FACE_eyelid|FACE_skin/.test(id))return[{node:'head',weight:1}];if(/neck/.test(id)){const h=1-smooth(390,525,y);return[{node:'head',weight:h},{node:'chest',weight:1-h}].filter(w=>w.weight>1e-8);}if(/sleeve_viewer|arm_viewer|cuff_viewer/.test(id))return armWeights(id.includes('left')?'r':'l',y);
if(id==='SHIRT_completed_fabric'){const boundary=315-40*smooth(800,1290,y);if(y>530&&x<boundary)return armWeights('r',y);if(y>530&&x>1024-boundary)return armWeights('l',y);}
const c=1-smooth(680,1160,y);return[{node:'chest',weight:c},{node:'torso',weight:1-c}].filter(w=>w.weight>1e-8);}
function groupVisible(g){return /^(10_BODY|20_WARDROBE|21_WARDROBE|22_WARDROBE|23_WARDROBE)/.test(g);}
const garment=(o)=>!/BODY_hair|BODY_face|BODY_hand|BODY_legs|BODY_leg_edge|FACE_/.test(o.id);
const axis=(lo,hi,step,extra=[])=>[...new Set([lo,hi,...Array.from({length:Math.floor((hi-Math.ceil(lo/step)*step)/step)+1},(_,i)=>Math.ceil(lo/step)*step+i*step),...extra.filter(v=>v>lo&&v<hi)])].sort((a,b)=>a-b);
function shape(mesh,id,keys,fn){const obj={axes:[{parameter:id,keys}],keys:keys.map(k=>({at:[k],delta:mesh.rest.flatMap((_,i)=>i%2?[]:fn(mesh.rest[i],mesh.rest[i+1],k).map(rnd))}))};mesh.shapes.push(obj);}
for(const [index,o]of source.layers.entries()){
const bytes=read(o.file),texture={id:o.id,file:o.file,width:o.width,height:o.height,sha256:hash(bytes)};m.textures.push(texture);
const [x0,y0,x1,y1]=o.bounds,hand=/BODY_hand/.test(o.id),face=o.id==='BODY_face',lip=/FACE_lip/.test(o.id),cavity=o.id==='FACE_mouth_cavity',eyelid=/FACE_eyelid/.test(o.id);
let xs=axis(x0,x1,hand?5:face||lip||cavity||eyelid?6:34,face||lip?[443,457,474,481,490,503,512,526,535,552,570,573,591,607]:[]),ys=axis(y0,y1,hand?5:face||lip||cavity||eyelid?5:42,[430,449,480,517,535,570,620,700,820,855,882,909,948,1120,1258,1282,1288,1315,...(face||lip?[242,250,258,265,273,331,333,340,346,348,352,358,368,373]:[])]);
const contour=contours[o.id];if(contour){xs=[0,.08,.2,.34,.5,.66,.8,.92,1];const start=y0+contour.firstOpaqueRow-1,end=y0+contour.lastOpaqueRow+1;ys.splice(0,ys.length,...axis(Math.max(y0,start),Math.min(y1,end),12,[535,570,620,820,855,882,909,948,1258,1282]));}
const rest=[],uv=[],triangles=[];for(const y of ys)for(const column of xs){let x=column;if(contour){const row=contour.rows[Math.max(0,Math.min(contour.height-1,Math.round(y-y0)))],left=Math.max(x0,x0+row[0]-3),right=Math.min(x1,x0+row[1]+4);x=left+(right-left)*column;}rest.push(x,y);uv.push((x-x0)/(x1-x0),(y-y0)/(y1-y0));}for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++){const a=y*xs.length+x,b=a+1,c=a+xs.length,d=c+1;triangles.push(a,b,c,b,d,c);}
const mesh={id:o.id,texture:o.id,node:'chest',rest,uv,triangles,order:source.layers.length-index,visible:groupVisible(o.group),weights:rest.flatMap((_,i)=>i%2?[]:[weights(o,rest[i],rest[i+1])]),shapes:[],blend:'dual-quaternion',authoring:{baseOrder:source.layers.length-index,sourceLayer:o.path,group:o.group,bounds:o.bounds,xRows:xs,yRows:ys}};
if(/hair|BODY_face|FACE_lip|FACE_mouth|FACE_eyelid|FACE_skin/.test(o.id)){shape(mesh,'head.yaw',[-.2,0,.2],(x,y,k)=>{const f=gauss(y,305,150);return[(x-525)*(-Math.abs(k)*.09)*f+k*9*f, k*(x-525)*.015*f];});shape(mesh,'head.pitch',[-.3,0,.3],(x,y,k)=>[0,k*8*gauss(y,320,150)]);}
if(/hair/.test(o.id))shape(mesh,'hair.sway',[-1,0,1],(x,y,k)=>[k*5*smooth(150,460,y),k*1.3*smooth(250,460,y)*Math.sin((x-320)/130)]);
if(garment(o)&&!lip&&!cavity&&!eyelid){
shape(mesh,'body.breath',[0,1],(x,y,k)=>[k*(x-520)*.003*gauss(y,690,230),-k*2.5*gauss(y,680,240)]);
shape(mesh,'chest.turn',[-1,0,1],(x,y,k)=>[k*7*gauss(y,730,300),k*(x-520)*.009*gauss(y,690,260)]);
if(/jacket|SHIRT_completed/.test(o.id)){shape(mesh,'cloth.sway',[-1,0,1],(x,y,k)=>[k*3*smooth(880,1220,y)*gauss(x,520,310),k*1.5*Math.sin((x-260)/150)*smooth(1020,1240,y)]);}
}
if(/sleeve_viewer|SHIRT_completed_fabric/.test(o.id))for(const s of ['r','l']){if(/viewer_left/.test(o.id)&&s==='l'||/viewer_right/.test(o.id)&&s==='r')continue;const a=arms[s],sign=s==='r'?1:-1;shape(mesh,'arm.'+s+'.elbow',[-1.8,-.9,0,.9,1.8],(x,y,k)=>{const locality=gauss(x,a.elbow[0],72)*gauss(y,a.elbow[1],57),t=Math.abs(k);return[sign*locality*k*4,-locality*t*3.2];});}
if(lip||o.id==='FACE_skin_lip_underlap'){shape(mesh,'mouth.smile',[0,1],(x,y,k)=>[(x-526)*.035*k*gauss(x,526,45)*gauss(y,349,15),-k*1.8*gauss(y,347,13)*(gauss(x,492,13)+gauss(x,561,13))]);}
if(face||lip||o.id==='FACE_skin_lip_underlap'){shape(mesh,'mouth.open',[0,.5,1],(x,y,k)=>[0,k*(o.id==='FACE_lip_upper'||y<348?-3:8)*Math.max(0,1-((x-526)/44)**2)**2*gauss(y,348,y<348?24:42)]);}
if(cavity){shape(mesh,'mouth.open',[0,.5,1],(x,y,k)=>[0,(y-349)*(k-1)]);}
if(face){shape(mesh,'gaze.x',[-1,0,1],(x,y,k)=>[k*1.4*(gauss(x,474,14)*gauss(y,259,8)+gauss(x,579,14)*gauss(y,253,8)),0]);shape(mesh,'gaze.y',[-1,0,1],(x,y,k)=>[0,k*.9*(gauss(x,474,14)*gauss(y,259,8)+gauss(x,579,14)*gauss(y,253,8))]);for(const s of ['r','l']){const cx=s==='r'?474:579,cy=s==='r'?259:253;shape(mesh,'eye.'+s+'.blink',[0,.55,1],(x,y,k)=>{const f=Math.max(0,1-((x-cx)/31)**2)**2*Math.max(0,1-((y-cy)/15)**2)**2;return[0,(cy+2-y)*k*.93*f];});shape(mesh,'brow.'+s+'.raise',[-1,0,1],(x,y,k)=>[0,-k*3*gauss(x,cx,28)*gauss(y,cy-25,9)]);}shape(mesh,'mouth.smile',[0,1],(x,y,k)=>[(x-526)*.035*k*gauss(x,526,45)*gauss(y,349,15),-k*1.8*gauss(y,347,13)*(gauss(x,492,13)+gauss(x,561,13))]);}
if(hand&&o.id.includes('edge_recovered')){mesh.node='wrist.r';delete mesh.weights;mesh.surface={group:'hand.r',projectOnly:true,blend:'dual-quaternion',depth:rest.flatMap((_,i)=>i%2?[]:[9*Math.sqrt(Math.max(0,1-((rest[i]-171)/55)**2))*gauss(rest[i+1],1367,100)]),weights:rest.flatMap((_,i)=>i%2?[]:[[{node:'handBend.r',weight:1}]])};}
if(hand&&!o.id.includes('edge_recovered')){const s=o.id.includes('viewer_left')?'r':'l',a=arms[s];mesh.node='wrist.'+s;delete mesh.weights;
// Current source shows a relaxed, partially occluded hand. Surface topology follows
// visible digits only; it cannot synthesize the unpainted palm/opposite fingers.
const mx=s==='r'?171:857,my=s==='r'?1387:1380;
m.surfaceNodes.push({id:'handTwist.'+s,pivot:[...a.wrist,0],axis:[(a.wrist[0]-a.elbow[0])/Math.hypot(a.wrist[0]-a.elbow[0],a.wrist[1]-a.elbow[1]),(a.wrist[1]-a.elbow[1])/Math.hypot(a.wrist[0]-a.elbow[0],a.wrist[1]-a.elbow[1]),0],bindings:{x:bind('forearm.'+s+'.twist')}});
m.surfaceNodes.push({id:'handBend.'+s,parent:'handTwist.'+s,pivot:[...a.wrist,0],bindings:{x:bind('wrist.'+s+'.bend')}});
const sw=[],depth=[];for(let i=0;i<rest.length;i+=2){const x=rest[i],y=rest[i+1];sw.push([{node:'handBend.'+s,weight:1}]);depth.push(9*Math.sqrt(Math.max(0,1-((x-mx)/55)**2))*gauss(y,my-20,100));}mesh.surface={group:'hand.'+s,projectOnly:true,blend:'dual-quaternion',depth,weights:sw};
// Small independent visible finger posture corrections, authored against relaxed A.
const fingerCentres=s==='r'?[[183,1387],[200,1450],[184,1447],[162,1438],[144,1425]]:[[845,1380],[826,1440],[845,1438],[865,1425],[885,1411]];
for(const [i,f]of ['thumb','index','middle','ring','little'].entries())for(const [j,joint]of ['mcp','pip','dip'].entries()){const [cx,cy]=fingerCentres[i];shape(mesh,`finger.${s}.${f}.${joint}`,[-.15,0,.55],(x,y,k)=>{const w=gauss(x,cx,i===0?13:8)*gauss(y,cy,18-j*3);return[(s==='r'?-1:1)*k*(3-j)*w,-k*(6-j*1.5)*w];});}
}
if(cavity){const cx=axis(482,570,6,[490,503,512,526,535,552]);mesh.rest=[];mesh.uv=[];mesh.triangles=[];mesh.weights=[];mesh.shapes=[];for(const y of [347.99,348.01])for(const x of cx){mesh.rest.push(x,y);mesh.uv.push((x-x0)/(x1-x0),(y-y0)/(y1-y0));mesh.weights.push([{node:'head',weight:1}]);}for(let i=0;i<cx.length-1;i++){const a=i,b=i+1,c=i+cx.length,d=c+1;mesh.triangles.push(a,b,c,b,d,c);}shape(mesh,'mouth.open',[0,.5,1],(x,y,k)=>[0,348-y+k*(y<348?-3:8)*Math.max(0,1-((x-526)/44)**2)**2]);shape(mesh,'head.yaw',[-.2,0,.2],(x,y,k)=>{const f=gauss(y,305,150);return[(x-525)*(-Math.abs(k)*.09)*f+k*9*f,k*(x-525)*.015*f];});shape(mesh,'head.pitch',[-.3,0,.3],(x,y,k)=>[0,k*8*gauss(y,320,150)]);mesh.authoring.kind='oral-aperture-between-authored-lip-boundaries';}
if(o.id==='FACE_mouth_teeth_upper'||o.id==='FACE_mouth_tongue'){
 const teeth=o.id.endsWith('teeth_upper'),columns=axis(x0,x1,4,[503,512,526,535,552]);mesh.rest=[];mesh.uv=[];mesh.triangles=[];mesh.weights=[];mesh.shapes=[];
 for(const row of [0,.5,1])for(const x of columns){mesh.rest.push(x,348+(row-.5)*.02);mesh.uv.push((x-x0)/(x1-x0),row);mesh.weights.push([{node:'head',weight:1}]);}
 for(let row=0;row<2;row++)for(let col=0;col<columns.length-1;col++){const a=row*columns.length+col,b=a+1,c=a+columns.length,d=c+1;mesh.triangles.push(a,b,c,b,d,c);}
 shape(mesh,'mouth.open',[0,.5,1],(x,y,k)=>{const row=(y-347.99)/.02,f=Math.max(0,1-((x-526)/44)**2)**2;return[0,348-y+k*(teeth?-2.8+row*3.4:3.4+row*3.7)*f];});
 shape(mesh,'mouth.smile',[0,1],(x,y,k)=>[(x-526)*.035*k*gauss(x,526,45)*gauss(y,349,15),-k*1.8*gauss(y,347,13)*(gauss(x,492,13)+gauss(x,561,13))]);
 shape(mesh,'head.yaw',[-.2,0,.2],(x,y,k)=>{const f=gauss(y,305,150);return[(x-525)*(-Math.abs(k)*.09)*f+k*9*f,k*(x-525)*.015*f];});shape(mesh,'head.pitch',[-.3,0,.3],(x,y,k)=>[0,k*8*gauss(y,320,150)]);
 mesh.authoring.kind='separate-painted-oral-tissue-within-lip-aperture';
}
if(cavity){for(let i=1;i<mesh.uv.length;i+=2)mesh.uv[i]=mesh.rest[i]<348?0:1;shape(mesh,'mouth.smile',[0,1],(x,y,k)=>[(x-526)*.035*k*gauss(x,526,45)*gauss(y,349,15),-k*1.8*gauss(y,347,13)*(gauss(x,492,13)+gauss(x,561,13))]);}
m.meshes.push(mesh);
}
// Actual original-photo outline topology includes finger gaps, with a closed
// side surface at every exterior and interior boundary. No alpha-only hand holes.
const handContours=JSON.parse(read('rig-hand-contours.json')),handTopology=JSON.parse(read('rig-hand-topology.json')),fingerLandmarks=JSON.parse(read('rig-finger-landmarks.json')),handVolume=JSON.parse(read('rig-hand-volume-profile.json'));
m.rig.fingers=fingerLandmarks.sides;
for(const side of ['r','l'])registerFingerRig(m,side,m.rig.fingers[side]);
for(const s of ['r','l']){
 const suffix=s==='r'?'left':'right',frontId='HAND_front_viewer_'+suffix+'_registered',backId='HAND_volar_viewer_'+suffix,front=m.meshes.find(x=>x.id===frontId),back=m.meshes.find(x=>x.id===backId),topology=handTopology[s],profile=handVolume.sides[s],authoredHandDepth=handSectionDepth(topology,profile,fingerLandmarks.sides[s]);
 for(const [mesh,isBack]of [[front,false],[back,true]]){
  const rest=[...topology.rest],uv=[],t=m.textures.find(t=>t.id===mesh.texture),box=mesh.authoring.bounds;
  for(let i=0;i<rest.length;i+=2)uv.push(Math.max(0,Math.min(1,(rest[i]-box[0])/t.width)),Math.max(0,Math.min(1,(rest[i+1]-box[1])/t.height)));
  const triangles=[...topology.triangles];if(isBack)for(let i=0;i<triangles.length;i+=3)[triangles[i+1],triangles[i+2]]=[triangles[i+2],triangles[i+1]];
  Object.assign(mesh,{rest,uv,triangles,node:'wrist.'+s,shapes:[],visible:true,order:s==='r'?101:102,surface:{group:'hand.'+s,blend:'dual-quaternion',depth:authoredHandDepth.map(d=>isBack?-d:d),weights:rest.flatMap((_,i)=>i%2?[]:[fingerSurfaceWeights(s,m.rig.fingers[s],rest[i],rest[i+1])])}});delete mesh.weights;mesh.authoring={...mesh.authoring,kind:'registered-original-front-and-painted-palm-volume',side:s,face:isBack?'volar':'original',baseOrder:mesh.order,fingerRig:'registered-3d-digits-relaxed-source-pose',topologySource:'rig-hand-topology.json',volumeProfile:'rig-hand-volume-profile.json'};delete mesh.authoring.xRows;delete mesh.authoring.yRows;
 }
 const wallId='HAND_side_skin_viewer_'+suffix,wall=m.meshes.find(x=>x.id===wallId),texture=m.textures.find(x=>x.id===wall.texture),box=wall.authoring.bounds,boundary=[...new Set(topology.boundaryEdges.flat())],rows=new Map(boundary.map((v,i)=>[v,i])),rest=[],uv=[],depth=[],skin=[],triangles=[];
 for(const i of boundary){const x=front.rest[2*i],y=front.rest[2*i+1],d=authoredHandDepth[i];for(const z of [-d,0,d]){rest.push(x,y);uv.push(Math.max(0,Math.min(1,(x-box[0])/texture.width)),Math.max(0,Math.min(1,(y-box[1])/texture.height)));depth.push(z);skin.push(fingerSurfaceWeights(s,m.rig.fingers[s],x,y));}}
 for(const [i,j]of topology.boundaryEdges)for(let z=0;z<2;z++){const a=rows.get(i)*3+z,b=rows.get(j)*3+z,c=a+1,d=b+1;triangles.push(a,b,c,b,d,c);}
 Object.assign(wall,{rest,uv,triangles,node:'wrist.'+s,shapes:[],visible:true,order:s==='r'?101:102,surface:{group:'hand.'+s,blend:'dual-quaternion',depth,weights:skin}});delete wall.weights;wall.authoring={...wall.authoring,kind:'registered-hand-side-wall',side:s,edge:'full-outline-and-finger-gaps',frontBoundaryIndices:boundary,wallColumns:3,baseOrder:wall.order};
}
// Remove the old XY-only finger approximations, including the hidden original helper.
for(const mesh of m.meshes)mesh.shapes=mesh.shapes.filter(shape=>!shape.axes.some(axis=>axis.parameter.startsWith('finger.')));
// Reuse the independently painted torso/arm footprints recorded in the E
// artwork script. One photographic cloth atlas supplies the actual surfaces;
// the body is not dragged by forearm skin weights across the resting armpit.
{
 const baseMesh=m.meshes.find(x=>x.id==='SHIRT_completed_fabric'),original=structuredClone(baseMesh),profiles=JSON.parse(read('rig-shirt-contours.json')),xs=original.authoring.xRows,ys=original.authoring.yRows,[x0,y0,x1,y1]=original.authoring.bounds;
 const interval=(axis,v)=>{let i=0;while(i<axis.length-2&&v>axis[i+1])i++;return [i,Math.max(0,Math.min(1,(v-axis[i])/(axis[i+1]-axis[i])))];};
 const sample=(values,x,y)=>{const [ix,tx]=interval(xs,x),[iy,ty]=interval(ys,y),n=xs.length,ids=[iy*n+ix,iy*n+ix+1,(iy+1)*n+ix,(iy+1)*n+ix+1],w=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];return [0,1].map(k=>rnd(ids.reduce((s,j,i)=>s+values[j*2+k]*w[i],0)));};
 for(const role of ['body','r','l']){const id=role==='body'?original.id:original.id+'.'+role,p=profiles[id];if(!p)throw Error('Missing authored shirt footprint '+id);const mesh=role==='body'?baseMesh:structuredClone(original),columns=role==='body'?16:12,rows=axis(y0+p.firstOpaqueRow,y0+p.lastOpaqueRow+1,8,[500,517,535,570,620,680,735,780,807,820,855,882,909,948,1110,1240,1282,...(p.criticalRows||[])]),rest=[],uv=[],triangles=[];
  for(const y of rows){const r=p.rows[Math.max(0,Math.min(p.height-1,Math.floor(y-y0)))],left=x0+r[0],right=x0+r[1]+1;for(let c=0;c<=columns;c++){const x=left+(right-left)*c/columns;rest.push(x,y);uv.push((x-x0)/(x1-x0),(y-y0)/(y1-y0));}}
  for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,b=a+1,e=a+columns+1,d=e+1;triangles.push(a,b,e,b,d,e);}
  const weights=rest.flatMap((_,i)=>i%2?[]:[role==='body'?(()=>{const v=1-smooth(680,1160,rest[i+1]);return[{node:'chest',weight:v},{node:'torso',weight:1-v}].filter(w=>w.weight>1e-8);})():armWeights(role,rest[i+1])]);
  Object.assign(mesh,{id,rest,uv,triangles,weights,shapes:original.shapes.map(sh=>({...sh,keys:sh.keys.map(k=>({...k,delta:rest.flatMap((_,i)=>i%2?[]:sample(k.delta,rest[i],rest[i+1]))}))}))});delete mesh.authoring.xRows;delete mesh.authoring.yRows;mesh.authoring.role=role==='body'?'shirt-torso':'shirt-sleeve';mesh.authoring.kind='traced-authored-shirt-footprint';mesh.authoring.contourSource='rig-shirt-contours.json';if(role!=='body'){mesh.authoring.side=role;mesh.order+=.01;mesh.authoring.baseOrder=mesh.order;m.meshes.push(mesh);}
 }
}
// Skin shaft under the cuff is real photographic underpaint, with its own
// forearm-to-wrist blend and front/back faces behind the garment draw order.
for(const s of ['r','l']){
 const suffix=s==='r'?'left':'right',id='BODY_wrist_underlap_viewer_'+suffix,mesh=m.meshes.find(x=>x.id===id),contour=handContours[id],frontId=s==='r'?'HAND_front_viewer_left_registered':'HAND_front_viewer_right_registered',hc=handContours[frontId],a=arms[s],tex=m.textures.find(t=>t.id===id),[x0,y0]=contour.bounds,rows=axis(y0+contour.firstOpaqueRow,y0+contour.lastOpaqueRow+1,4,[a.wrist[1]-24,a.wrist[1],a.wrist[1]+12]),columns=12,rest=[],uv=[],depth=[],skin=[],weights=[],triangles=[];
 const cuff=m.meshes.find(x=>x.id==='WARDROBE_shirt_cuff_viewer_'+suffix),order=cuff.authoring.baseOrder-.3;
 for(const y of rows){const r=contour.rows[Math.max(0,Math.min(contour.height-1,Math.floor(y-y0)))],hr=hc.rows[Math.max(0,Math.min(hc.height-1,Math.floor(y-hc.bounds[1])))],join=smooth(a.wrist[1]+12,a.wrist[1]+24,y),left=(x0+r[0])*(1-join)+(hc.bounds[0]+hr[0])*join,right=(x0+r[1]+1)*(1-join)+(hc.bounds[0]+hr[1]+1)*join,t=smooth(a.wrist[1]-24,a.wrist[1]+5,y);for(let c=0;c<=columns;c++){const u=c/columns,x=left+(right-left)*u;rest.push(x,y);uv.push(Math.max(0,Math.min(1,(x-x0)/tex.width)),Math.max(0,Math.min(1,(y-y0)/tex.height)));depth.push((5+7*gauss(y,1367,70))*Math.sqrt(Math.max(0,1-(2*u-1)**2)));skin.push([{node:'handTwist.'+s,weight:1-t},{node:'handBend.'+s,weight:t}]);weights.push([{node:'forearm.'+s,weight:1-t},{node:'wrist.'+s,weight:t}]);}}
 for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,b=a+1,e=a+columns+1,d=e+1;triangles.push(a,b,e,b,d,e);}
 Object.assign(mesh,{rest,uv,triangles,node:'forearm.'+s,weights,shapes:[],blend:'dual-quaternion',order,visible:true,surface:{group:'wrist-underlap.'+s,blend:'dual-quaternion',depth,weights:skin}});mesh.authoring.kind='photographic-wrist-shaft-under-cuff';mesh.authoring.baseOrder=order;mesh.authoring.side=s;mesh.authoring.volumeColumns=columns;mesh.authoring.volumeRows=rows;
 const back=structuredClone(mesh);back.id+='.back';back.order-=.001;back.authoring.baseOrder=back.order;back.surface.depth=back.surface.depth.map(v=>-v);for(let i=0;i<back.triangles.length;i+=3)[back.triangles[i+1],back.triangles[i+2]]=[back.triangles[i+2],back.triangles[i+1]];m.meshes.push(back);
 const facing=m.meshes.find(x=>x.id==='SHIRT_cuff_inner_viewer_'+suffix);facing.node='forearm.'+s;delete facing.weights;facing.shapes=[];facing.order=cuff.authoring.baseOrder-.1;facing.authoring.baseOrder=facing.order;
}
refineNeckJoin(m);
applyApprovedAppearance(m,Object.fromEntries(m.parameters.map(p=>[p.id,p.default])));
const manifest={format:'hibiki-psd-export',version:1,width:1024,height:1536,source:{path:source.source,sha256:hash(read(source.source))},layers:source.layers.map((o,i)=>({...o,...m.textures[i],visible:m.meshes[i].visible}))};
fs.writeFileSync(path.join(base,'rig-export-manifest.json'),JSON.stringify(manifest,null,2)+'\n');m.source.sha256=hash(read('rig-export-manifest.json'));
fs.writeFileSync(path.join(base,'model-approved-a.json'),JSON.stringify(m)+'\n');console.log(JSON.stringify({meshes:m.meshes.length,parameters:m.parameters.length,vertices:m.meshes.reduce((s,x)=>s+x.rest.length/2,0),keys:m.meshes.reduce((s,x)=>s+x.shapes.reduce((a,y)=>a+y.keys.length,0),0)}));
