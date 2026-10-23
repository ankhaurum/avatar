import fs from 'node:fs';
import {compile} from '../runtime/evaluate.mjs';
const [input,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Output exists');
const m=JSON.parse(fs.readFileSync(input)),clamp=x=>Math.max(0,Math.min(1,x));
const curve=(p,x)=>{if(x<=p[0][0])return p[0][1];for(let i=1;i<p.length;i++)if(x<=p[i][0]){const a=p[i-1],b=p[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return p.at(-1)[1];};
const line=[[870,645],[900,650],[940,651],[980,644],[1019,635]];
const upper=[[870,645],[900,645],[940,644],[980,640],[1019,635]];
const lower=[[870,645],[900,676],[940,682],[980,671],[1019,635]];
function grid(mesh,c,r){const [x0,y0,x1,y1]=mesh.authoring.sourceBounds;mesh.rest=[];mesh.uv=[];mesh.triangles=[];for(let y=0;y<=r;y++)for(let x=0;x<=c;x++){mesh.rest.push(x0+(x1-x0)*x/c,y0+(y1-y0)*y/r);mesh.uv.push(x/c,y/r);}for(let y=0;y<r;y++)for(let x=0;x<c;x++){const a=y*(c+1)+x;mesh.triangles.push(a,a+1,a+c+1,a+1,a+c+2,a+c+1);}mesh.authoring={...mesh.authoring,columns:c,rows:r};}
const formPoint=(x,y,form,weight=1)=>{const u=(x-944.5)/74.5;return [x+(x-944.5)*(form<0?.28*form:.055*form)*weight,y-7*form*clamp(Math.abs(u))*weight];};
function shapes(mesh,warp){mesh.shapes.push({id:'mouth-open-form',axes:[{parameter:'mouth.open',keys:[0,.5,1]},{parameter:'mouth.form',keys:[-1,0,1]}],keys:[0,.5,1].flatMap(open=>[-1,0,1].map(form=>({at:[open,form],delta:mesh.rest.flatMap((x,i)=>{if(i%2)return [];const y=mesh.rest[i+1],p=warp(x,y,open,form,i/2);return [p[0]-x,p[1]-y];})})))});}
m.parameters.push({id:'mouth.open',min:0,max:1,default:0},{id:'mouth.form',min:-1,max:1,default:0});
for(const part of ['upper','lower']){
 const mesh=m.meshes.find(x=>x.id==='mouth.'+part);grid(mesh,24,12);
 shapes(mesh,(x,y,open,form)=>{const baseline=curve(line,x),near=part==='upper'?clamp((y-590)/(baseline-590)):clamp((770-y)/(770-baseline)),vertical=(curve(part==='upper'?upper:lower,x)-baseline)*open*near;return formPoint(x,y+vertical,form,near);});
}
const cavity=m.meshes.find(x=>x.id==='mouth.cavity');grid(cavity,24,6);cavity.visible=true;
shapes(cavity,(x,y,open,form,vertex)=>{const u=cavity.uv[vertex*2],v=cavity.uv[vertex*2+1],xx=870+149*u,baseline=curve(line,xx),a=baseline+(curve(upper,xx)-baseline)*open,b=baseline+(curve(lower,xx)-baseline)*open;return formPoint(xx,a+(b-a)*v,form);});
for(const id of ['mouth.teeth','mouth.tongue']){
 const mesh=m.meshes.find(x=>x.id===id);mesh.visible=true;mesh.masks=['mouth.cavity'];grid(mesh,16,4);
 shapes(mesh,(x,y,open,form)=>formPoint(x,y+(id==='mouth.teeth'?-4:7)*open,form));
}
const face=m.meshes.find(x=>x.id==='face.skin');grid(face,24,28);
shapes(face,(x,y,open,form)=>{const local=clamp((x-740)/100)*clamp((1130-x)/100),dy=curve([[325,0],[615,0],[650,14],[680,24],[720,18],[769,12]],y)*open*local;return formPoint(x,y+dy,form,clamp((y-600)/45)*clamp((780-y)/90)*local);});
m.authoredMouth={reference:'source/expression-guide.png',neutralLine:line,openUpper:upper,openLower:lower,note:'Contour registration and oral material only; generated face pixels do not replace official face.'};
m.authoringStatus='両腕・指節・まばたき・開口と口形の制作候補。まぶた縁、口周辺、肩、会話統合は検証・修正中。';
compile(m);fs.writeFileSync(output,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({output,mouthForms:9}));
