import fs from 'node:fs';import {compile} from '../runtime/evaluate.mjs';import {landmarkWarp} from './landmark-warp.mjs';
const [input,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Output exists');const m=JSON.parse(fs.readFileSync(input)),clamp=x=>Math.max(0,Math.min(1,x));
const knots=[[700,455,0],[735,350,0],[800,370,35],[940,350,55],[1080,370,35],[1140,500,0],[1110,650,0],[1070,720,10],[975,762,30],[940,769,32],[860,747,20],[780,675,5],[755,550,0],[820,550,40],[1070,550,38],[847,475,45],[1035,470,45],[948,500,80],[952,570,105],[928,585,83],[940,640,65],[940,735,45]];
const field=landmarkWarp(knots.map(p=>p.slice(0,2)),knots.map(p=>[p[0],p[2]]));
const projection={id:'face-depth',bounds:[680,240,1170,800],columns:40,rows:48,depth:[]};for(let y=0;y<=projection.rows;y++)for(let x=0;x<=projection.columns;x++)projection.depth.push(Math.max(-20,Math.min(110,field(680+490*x/projection.columns,240+560*y/projection.rows)[1])));m.projectionFields=[projection];
m.parameters.push({id:'head.yaw',min:-1,max:1,default:0},{id:'head.pitch',min:-1,max:1,default:0},{id:'body.breath',min:0,max:1,default:0},{id:'hair.sway',min:-1,max:1,default:0},{id:'cloth.sway',min:-1,max:1,default:0},{id:'brow.raise',min:-1,max:1,default:0},{id:'brow.inner',min:-1,max:1,default:0});
m.surfaceNodes.push({id:'head-volume',pivot:[940,530,0],bindings:{y:[{parameter:'head.yaw',factor:.22}],x:[{parameter:'head.pitch',factor:.15}]}},{id:'neck-volume-fixed',pivot:[940,850,0],bindings:{}});
function shape(mesh,id,values,warp){mesh.shapes.push({id,axes:[{parameter:id,keys:values}],keys:values.map(v=>({at:[v],delta:mesh.rest.flatMap((x,i)=>i%2?[]:warp(x,mesh.rest[i+1],v))}))});}
for(const mesh of m.meshes){
 if(mesh.node==='head'||mesh.node.startsWith('gaze.')||mesh.id==='neck'){
  const depth=[],weights=[];
  for(let i=0;i<mesh.rest.length;i+=2){const x=mesh.rest[i],y=mesh.rest[i+1];let z=Math.max(-20,Math.min(110,field(x,y)[1]));
   if(mesh.id==='hair.back')z=-45;
   else if(mesh.id==='hair.front')z=50+20*clamp((y-80)/300);
   else if(mesh.id==='hair.r'||mesh.id==='hair.l')z=25*clamp((y-250)/300);
   else if(mesh.id==='neck')z=15;
   depth.push(z);
   const t=mesh.id==='neck'?clamp((880-y)/150):1;weights.push([{node:'head-volume',weight:t},{node:'neck-volume-fixed',weight:1-t}]);
  }
  mesh.surface={group:'head',projectOnly:true,depth,weights};if(/^(face\.|eye\.|brow\.|mouth\.)/.test(mesh.id))mesh.surface.depthField='face-depth';
 }
 if(mesh.id.startsWith('hair.')){
  const [x0,y0,x1,y1]=mesh.authoring.sourceBounds,amplitude=mesh.id==='hair.front'?6:mesh.id==='hair.back'?14:18;
  shape(mesh,'hair.sway',[-1,0,1],(x,y,v)=>{const t=clamp((y-y0)/(y1-y0));return [v*amplitude*t*t,Math.abs(v)*2*t];});
 }
 if(mesh.id==='tie.tail'||mesh.id==='body.base'){
  const start=mesh.id==='tie.tail'?1105:1670,end=mesh.authoring.sourceBounds[3];
  shape(mesh,'cloth.sway',[-1,0,1],(x,y,v)=>[v*10*clamp((y-start)/(end-start))**2,0]);
 }
 if(mesh.id.startsWith('brow.')){
  const side=mesh.id.split('.')[1],[x0,y0,x1,y1]=mesh.authoring.sourceBounds;
  shape(mesh,'brow.raise',[-1,0,1],(x,y,v)=>[0,-8*v]);
  shape(mesh,'brow.inner',[-1,0,1],(x,y,v)=>[0,-9*v*(side==='r'?clamp((x-x0)/(x1-x0)):clamp((x1-x)/(x1-x0)))]);
 }
}
const chest=m.nodes.find(n=>n.id==='chest');chest.bindings.y=[{parameter:'body.breath',factor:-3}];
m.headSculpt={method:'author-defined local depth landmarks projected after expression shapes; not recovered Cubism data',knots,note:'Small-angle candidate requiring Identity and silhouette review; layer masks/order retained.'};
m.authoringStatus='連続動作の制作候補。頭部の局所造形・口形・内外肘・肩追従を実描画で調整中。Human Acceptance未実施。';
compile(m);fs.writeFileSync(output,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({output,headParts:m.meshes.filter(x=>x.surface?.projectOnly).length}));
