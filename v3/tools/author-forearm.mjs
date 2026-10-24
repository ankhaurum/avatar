import fs from 'node:fs';import {compile} from '../runtime/evaluate.mjs';
const [input,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Output already exists');const m=JSON.parse(fs.readFileSync(input)),contours=JSON.parse(fs.readFileSync(new URL('../source/hand-contours.json',import.meta.url)));
const clamp=x=>Math.max(0,Math.min(1,x));
function refine(mesh){
 const contour=contours[mesh.id];
 const oc=mesh.authoring.columns,or=mesh.authoring.rows,c=oc*3,r=or*3;
 const interpolate=(values,stride,x,y)=>{const py=1+y/r*(contour.height-3),[left,right]=contour.rows[Math.round(py)],fx=(left+(right-left)*x/c+.5)/contour.width*oc,fy=py/contour.height*or,ix=Math.min(oc-1,Math.floor(fx)),iy=Math.min(or-1,Math.floor(fy)),tx=fx-ix,ty=fy-iy,indices=[iy*(oc+1)+ix,iy*(oc+1)+ix+1,(iy+1)*(oc+1)+ix,(iy+1)*(oc+1)+ix+1],weights=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];return Array.from({length:stride},(_,k)=>indices.reduce((v,i,j)=>v+values[i*stride+k]*weights[j],0));};
 const expand=(values,stride)=>{const out=[];for(let y=0;y<=r;y++)for(let x=0;x<=c;x++)out.push(...interpolate(values,stride,x,y));return out;};
 const ids=[...new Set(mesh.weights.flatMap(row=>row.map(w=>w.node)))],w=mesh.weights.flatMap(row=>ids.map(id=>row.find(w=>w.node===id)?.weight||0)),newWeights=expand(w,ids.length);
 mesh.rest=expand(mesh.rest,2);mesh.uv=expand(mesh.uv,2);mesh.weights=Array.from({length:mesh.rest.length/2},(_,i)=>ids.map((node,j)=>({node,weight:newWeights[i*ids.length+j]})));
 for(const s of mesh.shapes)for(const k of s.keys)k.delta=expand(k.delta,2);
 mesh.triangles=[];for(let y=0;y<r;y++)for(let x=0;x<c;x++){const a=y*(c+1)+x;mesh.triangles.push(a,a+1,a+c+1,a+1,a+c+2,a+c+1);}
 mesh.authoring={...mesh.authoring,columns:c,rows:r};
}
for(const side of ['r','l']){
 const arm=m.rig.arms[side],dx=arm.wrist[0]-arm.elbow[0],dy=arm.wrist[1]-arm.elbow[1],len=Math.hypot(dx,dy),axis=[dx/len,dy/len,0],parameter='forearm.'+side+'.twist',hand=m.surfaceNodes.find(n=>n.id==='hand-volume.'+side);
 hand.axis=axis;hand.bindings={x:[{parameter,factor:1}]};
 for(const part of ['fore','cuff']){
  const mesh=m.meshes.find(x=>x.id==='arm.'+side+'.'+part);refine(mesh);const depth=[],weights=[],{columns,rows}=mesh.authoring;
  for(let row=0;row<=rows;row++){
   const y=mesh.rest[row*(columns+1)*2+1],factor=clamp((y-arm.elbow[1])/(arm.wrist[1]-arm.elbow[1])),id='sleeve-volume.'+side+'.'+part+'.'+row;
   // A loose sleeve follows the underlying forearm partially; rotating its
   // photographed opening rigidly with the skin produced a twisted cloth tube.
   m.surfaceNodes.push({id,pivot:[...arm.elbow,0],axis,bindings:{x:[{parameter,factor:factor*.35}]}});
   const x0=mesh.rest[row*(columns+1)*2],x1=mesh.rest[(row*(columns+1)+columns)*2],radius=(x1-x0)/2;
   for(let col=0;col<=columns;col++){const t=col/columns;depth.push(radius*(part==='cuff'?1:.62)*Math.sqrt(Math.max(0,1-(2*t-1)**2)));weights.push([{node:id,weight:1}]);}
  }
  mesh.surface={group:'hand.'+side,depth,weights};
  const back=structuredClone(mesh);back.id=mesh.id+'.back';back.order=mesh.order-.01;back.surface.depth=back.surface.depth.map(v=>-v);for(let row=0;row<=rows;row++){const base=row*(columns+1)*2,sum=mesh.uv[base]+mesh.uv[base+columns*2];for(let col=0;col<=columns;col++)back.uv[base+col*2]=sum-mesh.uv[base+col*2];}for(let i=0;i<back.triangles.length;i+=3)[back.triangles[i+1],back.triangles[i+2]]=[back.triangles[i+2],back.triangles[i+1]];back.authoring.surfaceSource='same sleeve texture, backside shading is a draft';m.meshes.push(back);
 }
}
m.authoringStatus='前腕ひねり→袖口→手→指節の連動を制作中。袖裏の陰影・手の接合・肩・表情は未完成。';compile(m);fs.writeFileSync(output,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({output,surfaces:m.meshes.filter(x=>x.surface).length}));
