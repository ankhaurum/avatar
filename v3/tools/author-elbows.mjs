import fs from 'node:fs';import path from 'node:path';
import {addRig,arms} from './rig-layout.mjs';
import {compile,evaluate,point} from '../runtime/evaluate.mjs';
import {landmarkWarp,inverseSkin,invertedTriangles} from './landmark-warp.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Input/output model required');if(fs.existsSync(output))throw Error('Output already contains author data');
const raw=JSON.parse(fs.readFileSync(input,'utf8')),contours=JSON.parse(fs.readFileSync(new URL('../source/hand-contours.json',import.meta.url)));
for(const mesh of raw.meshes.filter(x=>/^arm\.[rl]\.upper$/.test(x.id))){
 const a=contours[mesh.id];if(!a)throw Error('Missing upper sleeve contour '+mesh.id);const [x0,y0]=mesh.authoring.sourceBounds,c=10,r=28;
 mesh.rest=[];mesh.uv=[];mesh.triangles=[];
 for(let row=0;row<=r;row++){const y=1+(a.height-3)*row/r,[left,right]=a.rows[Math.round(y)];for(let col=0;col<=c;col++){const x=left+(right-left)*col/c;mesh.rest.push(x0+x,y0+y);mesh.uv.push((x+.5)/a.width,(y+.5)/a.height);}}
 for(let y=0;y<r;y++)for(let x=0;x<c;x++){const i=y*(c+1)+x;mesh.triangles.push(i,i+1,i+c+1,i+1,i+c+2,i+c+1);}
 mesh.authoring={...mesh.authoring,columns:c,rows:r};
}
const model=addRig(raw),compiled=compile(structuredClone(model));
const clamp=x=>Math.max(0,Math.min(1,x)),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const restRight=[[445,965],[620,965],[445,1150],[610,1150],[445,1305],[590,1305],[440,1450],[585,1450],[435,1620],[560,1620]];
// The pairs below are traced from source/sleeve-poses.png. The first two
// shoulder points stay pinned to the original shoulder seam. No Cubism data.
const guides=[
 {id:'medium',shoulder:[200,180],elbow:[365,650],wrist:[850,430],contour:[[320,160],[70,160],[360,400],[160,400],[435,530],[365,780],[615,445],[575,690],[760,365],[900,510]]},
 {id:'deep',shoulder:[1200,170],elbow:[1420,650],wrist:[1750,230],contour:[[1300,180],[1100,180],[1375,380],[1190,420],[1435,445],[1420,710],[1560,330],[1550,590],[1680,170],[1800,260]]}
];
const records=[];
for(const [side,arm]of Object.entries(arms)){
 const reflect=side==='r'?-1:1,restUpper=Math.atan2(arm.elbow[1]-arm.shoulder[1],arm.elbow[0]-arm.shoulder[0]),restFore=Math.atan2(arm.cuff[1]-arm.elbow[1],arm.cuff[0]-arm.elbow[0]);
 const sumX=y=>y<=1305?1880+5*clamp((y-975)/330):1885-10*clamp((y-1305)/335);
 const rest=restRight.map(([x,y])=>side==='r'?[x,y]:[sumX(y)-x,y]);
 const defaultReflect=reflect;
 const poses=guides.flatMap(guide=>[defaultReflect,-defaultReflect].map(reflect=>{
  const u=[reflect*(guide.elbow[0]-guide.shoulder[0]),guide.elbow[1]-guide.shoulder[1]],f=[reflect*(guide.wrist[0]-guide.elbow[0]),guide.wrist[1]-guide.elbow[1]];
  const angle=wrap(Math.atan2(f[1],f[0])-Math.atan2(u[1],u[0])-(restFore-restUpper));
  const scale=Math.hypot(arm.elbow[0]-arm.shoulder[0],arm.elbow[1]-arm.shoulder[1])/Math.hypot(...u),rotation=restUpper-Math.atan2(u[1],u[0]),c=Math.cos(rotation),s=Math.sin(rotation);
  const map=p=>{const x=reflect*(p[0]-guide.elbow[0])*scale,y=(p[1]-guide.elbow[1])*scale;return [arm.elbow[0]+x*c-y*s,arm.elbow[1]+x*s+y*c];};
  const frame=evaluate(compiled,{['arm.'+side+'.elbow']:angle}),fore=frame.matrices.get('fore.'+side),upper=frame.matrices.get('upper.'+side),wrist=point(fore,...arm.cuff),refWrist=map(guide.wrist),correction=[wrist[0]-refWrist[0],wrist[1]-refWrist[1]];
  const source=rest.map(([x,y])=>{const t=clamp((y-(arm.elbow[1]-65))/130),a=point(upper,x,y),b=point(fore,x,y);return [a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t];});
  const target=guide.contour.map((point,i)=>{if(i<2)return rest[i];const p=guide.contour[reflect===defaultReflect?i:(i^1)],q=map(p),dx=reflect*(p[0]-guide.elbow[0]),dy=p[1]-guide.elbow[1],t=clamp((dx*f[0]+dy*f[1])/(f[0]*f[0]+f[1]*f[1]));return [q[0]+correction[0]*t,q[1]+correction[1]*t];});
  for(const [x,y]of [[440,880],[630,880]]){const p=side==='r'?[x,y]:[sumX(y)-x,y];source.push(p);target.push(p);}
  // Preserve the traced cloth cross-sections instead of extrapolating an RBF
  // through a folded, already-skinned domain at the inner elbow.
  const stations=[880,965,1150,1305,1450,1620];
  const sourcePairs=[[source[10],source[11]],...Array.from({length:5},(_,i)=>rest.slice(i*2,i*2+2))];
  sourcePairs[0]=side==='r'?[[440,880],[630,880]]:[[sumX(880)-440,880],[sumX(880)-630,880]];
  const targetPairs=[[target[10],target[11]],...Array.from({length:5},(_,i)=>target.slice(i*2,i*2+2))];
  const warp=(x,y)=>{
   let row=0;while(row<stations.length-2&&y>stations[row+1])row++;
   const t=(y-stations[row])/(stations[row+1]-stations[row]);
   const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
   const a=lerp(sourcePairs[row][0],sourcePairs[row+1][0],t),b=lerp(sourcePairs[row][1],sourcePairs[row+1][1],t);
   return lerp(lerp(targetPairs[row][0],targetPairs[row+1][0],t),lerp(targetPairs[row][1],targetPairs[row+1][1],t),(x-a[0])/(b[0]-a[0]));
  };
  return {guide:guide.id+(reflect===defaultReflect?'-outward':'-inward'),angle,frame,source,target,warp};
 }));
 const parameter=model.parameters.find(p=>p.id==='arm.'+side+'.elbow');parameter.min=Math.min(0,...poses.map(p=>p.angle));parameter.max=Math.max(0,...poses.map(p=>p.angle));
 for(const mesh of model.meshes.filter(m=>m.id.startsWith('arm.'+side+'.'))){
  const keys=[{at:[0],delta:mesh.rest.map(()=>0)}];
  for(const pose of poses){
   const positions=pose.frame.positions.get(mesh.id),delta=[];
   for(let i=0;i<positions.length;i+=2){const target=pose.warp(mesh.rest[i],mesh.rest[i+1]),local=inverseSkin(mesh,pose.frame.matrices,i/2,...target);delta.push(local[0]-mesh.rest[i],local[1]-mesh.rest[i+1]);}
   keys.push({at:[pose.angle],delta});
  }
  keys.sort((a,b)=>a.at[0]-b.at[0]);mesh.shapes=[{id:'elbow-cloth',axes:[{parameter:'arm.'+side+'.elbow',keys:keys.map(k=>k.at[0])}],keys}];
 }
 records.push({side,sourceFile:'source/sleeve-poses.png',restLandmarks:rest,poses:poses.map(p=>({guide:p.guide,angle:p.angle,evaluatedSource:p.source,authoredTarget:p.target}))});
}
const authored=compile(model),checks=[];
for(const side of ['r','l']){
 const keys=model.meshes.find(m=>m.id==='arm.'+side+'.fore').shapes[0].axes[0].keys;
 const values=[...keys,...keys.slice(1).map((v,i)=>(v+keys[i])/2)];
 for(const value of values){const frame=evaluate(authored,{['arm.'+side+'.elbow']:value});for(const mesh of model.meshes.filter(m=>m.id.startsWith('arm.'+side+'.'))){const inverted=invertedTriangles(mesh.rest,frame.positions.get(mesh.id),mesh.triangles);checks.push({mesh:mesh.id,value,invertedTriangles:inverted});}}
}
model.authoringStatus='袖の原画参照から肘キーを制作中。反転・接合・途中姿勢は実描画で調整中。';
fs.writeFileSync(output,JSON.stringify(model,null,2)+'\n');
fs.writeFileSync(path.join(path.dirname(output),'source','elbow-authoring.json'),JSON.stringify({method:'artist-traced cloth cross-sections with inverse skinning; not reconstructed Cubism forms',records,checks},null,2)+'\n');
console.log(JSON.stringify({output,checks:checks.length,invertedChecks:checks.filter(c=>c.invertedTriangles.length).map(c=>({mesh:c.mesh,value:c.value,count:c.invertedTriangles.length}))}));
