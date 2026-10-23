import fs from 'node:fs';import path from 'node:path';import {fingers} from './rig-layout.mjs';import {compile} from '../runtime/evaluate.mjs';
const [input,contourFile,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Refusing to overwrite authored model');
const model=JSON.parse(fs.readFileSync(input)),contours=JSON.parse(fs.readFileSync(contourFile));model.surfaceNodes=[];
const param=(id,min,max)=>{if(!model.parameters.some(p=>p.id===id))model.parameters.push({id,min,max,default:0});};
const node=(id,parent,pivot,bindings)=>model.surfaceNodes.push({id,parent,pivot,bindings});
const b=(parameter,factor=1)=>[{parameter,factor}],clamp=x=>Math.max(0,Math.min(1,x));
for(const side of ['r','l']){
 const wrist=model.rig.arms[side].wrist,root='hand-volume.'+side,flex='hand-flex.'+side;
 param('forearm.'+side+'.twist',-Math.PI,Math.PI);param('wrist.'+side+'.flex',-.9,.9);
 node(root,null,[...wrist,0],{y:b('forearm.'+side+'.twist')});node(flex,root,[...wrist,0],{x:b('wrist.'+side+'.flex')});
 for(const [digit,points]of Object.entries(fingers)){
  let parent=flex;
  for(let j=0;j<3;j++){const name='finger.'+side+'.'+digit+'.'+(digit==='thumb'?['cmc','mcp','ip']:['mcp','pip','dip'])[j],p=points[j],pivot=[side==='r'?p[0]:1877.5-p[0],p[1],0];param(name,-.15,1.4);const bindings={x:b(name,-1)};if(!j)bindings.z=b('finger.'+side+'.'+digit+'.spread');node(name,parent,pivot,bindings);parent=name;}
 }
 const weights=(digit,y)=>{
  if(digit==='palm'){const t=clamp((y-wrist[1]+18)/36);return [{node:root,weight:1-t},{node:flex,weight:t}];}
  const js=fingers[digit],names=[flex,...(digit==='thumb'?['cmc','mcp','ip']:['mcp','pip','dip']).map(j=>'finger.'+side+'.'+digit+'.'+j)];
  for(let j=0;j<3;j++)if(y<js[j][1]+6){const t=clamp((y-js[j][1]+6)/12);return [{node:names[j],weight:1-t},{node:names[j+1],weight:t}];}
  return [{node:names[3],weight:1}];
 };
 for(const digit of ['palm',...Object.keys(fingers)]){
  const front=model.meshes.find(m=>m.id==='hand.'+side+'.'+digit),back=model.meshes.find(m=>m.id==='hand.'+side+'.volar'+(digit==='palm'?'':'.'+digit)),fc=contours[front.id],bc=contours[back.id],edge=model.meshes.find(m=>m.id==='hand.'+side+'.edge.ulnar'),ec=contours[edge.id];
  const [x0,y0]=front.authoring.sourceBounds,ys=new Set([1,fc.height-2]);if(digit==='palm'){ys.add(-30);ys.add(-15);}for(let y=1;y<fc.height-1;y+=9)ys.add(y);
  if(digit!=='palm')for(const p of fingers[digit])for(const d of [-6,0,6])if(p[1]+d>y0&&p[1]+d<y0+fc.height)ys.add(p[1]+d-y0);
  const rows=[...ys].sort((a,b)=>a-b),columns=10;
  for(const [mesh,isBack]of [[front,false],[back,true]]){
   const rest=[],uv=[],depth=[],skin=[],triangles=[];
   for(const y of rows){const fy=fc.sampleRows[Math.max(digit==='palm'?fc.firstOpaqueRow+6:0,Math.min(fc.height-1,Math.round(y)))],[left,right]=fc.rows[fy],by=bc.sampleRows[Math.max(digit==='palm'?bc.firstOpaqueRow+6:0,Math.min(bc.height-1,Math.round(y/(fc.height-1)*(bc.height-1))))],br=bc.rows[by];
    for(let c=0;c<=columns;c++){const t=c/columns,x=left+(right-left)*t,worldY=y0+y;
     // Register the hidden forearm section to the sleeve opening, while leaving
     // the measured wrist and visible palm unchanged.
     const arm=model.rig.arms[side],axisX=arm.elbow[0]+(wrist[0]-arm.elbow[0])*(worldY-arm.elbow[1])/(wrist[1]-arm.elbow[1]);
     const centreShift=digit==='palm'?(axisX-x0-(left+right)/2)*clamp((wrist[1]-worldY)/(wrist[1]-1680)):0;
     rest.push(x0+x+centreShift,worldY);uv.push(isBack?(br[1]-(br[1]-br[0])*t+.5)/bc.width:(x+.5)/fc.width,isBack?(by+.5)/bc.height:(fy+.5)/fc.height);
     const ey=Math.max(0,Math.min(ec.height-1,Math.round(worldY-edge.authoring.sourceBounds[1]))),edgeSpan=ec.rows[ey][1]-ec.rows[ey][0];
     // Palm depth is fitted to the registered side original. Finger cross-
     // sections remain editable round-volume drafts until their folds are sculpted.
     const halfThickness=digit==='palm'?edgeSpan/2:(right-left)*.43;
     depth.push((isBack?-1:1)*halfThickness*Math.sqrt(Math.max(0,1-(2*t-1)**2)));skin.push(weights(digit,worldY));
    }
   }
   for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,d=a+columns+2,tri=[a,a+1,a+columns+1,a+1,d,a+columns+1];for(let i=0;i<6;i+=3)triangles.push(...(isBack?[tri[i],tri[i+2],tri[i+1]]:tri.slice(i,i+3)));}
   Object.assign(mesh,{rest,uv,triangles,node:'wrist.'+side,shapes:[],visible:true,surface:{group:'hand.'+side,depth,weights:skin},authoring:{...mesh.authoring,kind:'traced-hand-surface',digit,face:isBack?'volar':'dorsal'}});delete mesh.weights;
   if(digit==='palm')mesh.weights=Array.from({length:rest.length/2},(_,i)=>{const t=clamp((rest[i*2+1]-wrist[1]+18)/36);return [{node:'fore.'+side,weight:1-t},{node:'wrist.'+side,weight:t}];});
  }
 }
 model.meshes.find(m=>m.id==='arm.'+side+'.cuff').order=Math.max(...model.meshes.filter(m=>m.surface?.group==='hand.'+side).map(m=>m.order))+.1;
}
model.authoringStatus='手の厚み・指節・甲掌の制作候補。側面の陰影、接合、手首と前腕のねじれは実描画で調整中。';
compile(model);fs.writeFileSync(output,JSON.stringify(model,null,2)+'\n');console.log(JSON.stringify({output,surfaces:model.meshes.filter(m=>m.surface).length,joints:model.surfaceNodes.length}));
