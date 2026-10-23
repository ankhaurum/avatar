import fs from 'node:fs';
import {compile} from '../runtime/evaluate.mjs';
const [input,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Refusing to overwrite authored model');
const m=JSON.parse(fs.readFileSync(input));
const clamp=x=>Math.max(0,Math.min(1,x));
const curve=(points,x)=>{if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+t*(b[1]-a[1]);}return points.at(-1)[1];};
function grid(mesh,c,r){const [x0,y0,x1,y1]=mesh.authoring.sourceBounds;mesh.rest=[];mesh.uv=[];mesh.triangles=[];for(let y=0;y<=r;y++)for(let x=0;x<=c;x++){mesh.rest.push(x0+(x1-x0)*x/c,y0+(y1-y0)*y/r);mesh.uv.push(x/c,y/r);}for(let y=0;y<r;y++)for(let x=0;x<c;x++){const a=y*(c+1)+x;mesh.triangles.push(a,a+1,a+c+1,a+1,a+c+2,a+c+1);}mesh.authoring={...mesh.authoring,columns:c,rows:r};}
function key(mesh,id,values,warp){mesh.shapes.push({id,axes:[{parameter:id,keys:values}],keys:values.map(value=>({at:[value],delta:mesh.rest.flatMap((x,i)=>i%2?[]:(()=>{const y=mesh.rest[i+1],p=warp(x,y,value);return [p[0]-x,p[1]-y];})())}))});}
const eye={
r:{upper:[[788,483],[800,469],[819,459],[841,455],[863,459],[882,470],[895,486]],lower:[[788,483],[798,487],[813,489],[837,493],[859,492],[878,488],[895,486]],closed:[[788,483],[800,485],[819,487],[841,489],[863,489],[882,487],[895,486]]},
l:{upper:[[994,484],[1002,468],[1019,456],[1040,449],[1063,450],[1084,457],[1096,468]],lower:[[994,484],[1012,488],[1034,489],[1058,486],[1080,480],[1096,468]],closed:[[994,484],[1002,485],[1019,486],[1040,485],[1063,482],[1084,476],[1096,468]]}
};
for(const side of ['r','l']){
 const e=eye[side],id='eye.'+side+'.blink';m.parameters.push({id,min:0,max:1,default:0});
 for(const part of ['upper','lower','white']){
  const mesh=m.meshes.find(v=>v.id==='eye.'+side+'.'+part);grid(mesh,24,12);
  key(mesh,id,[0,.5,1],(x,y,t)=>{
   const a=curve(e.upper,x),b=curve(e.lower,x),closed=curve(e.closed,x);
   // Explicit intermediate upper/lower trajectories; endpoints remain pinned.
   const upper=a+(closed-a)*(t===.5?.62:t),lower=b+(closed-b)*(t===.5?.3:t);
   let yy;
   if(part==='white')yy=upper+(y-a)/Math.max(.01,b-a)*(lower-upper);
   else if(y<=a)yy=y+(upper-a)*clamp((y-420)/(a-420));
   else if(y>=b)yy=y+(lower-b)*clamp((530-y)/(530-b));
   else yy=upper+(y-a)/Math.max(.01,b-a)*(lower-upper);
   return [x,yy];
  });
 }
 const iris=m.meshes.find(v=>v.id==='eye.'+side+'.iris');const n='gaze.'+side;
 m.nodes.push({id:n,parent:'head',pivot:[0,0],bindings:{x:[{parameter:'gaze.x',factor:8}],y:[{parameter:'gaze.y',factor:5}]}});
 iris.node=n;
}
m.parameters.push({id:'gaze.x',min:-1,max:1,default:0},{id:'gaze.y',min:-1,max:1,default:0});
m.authoringStatus='両腕・指節・手首・まばたきの制作候補。顔方向・口形・肩補正・会話統合は未完成。';
m.authoredEyeContours=eye;compile(m);fs.writeFileSync(output,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({output,parameters:m.parameters.length}));
