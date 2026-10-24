// Keep the source-A jaw cut attached to the head, blending into the collar below.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2)),round=x=>Math.round(x*1e6)/1e6;
export function refineNeckJoin(model){
 for(const mesh of model.meshes.filter(m=>m.id==='BODY_neck'||m.id==='BODY_neck_collar_underlap')){
  if(mesh.authoring.jawJoin==='shared-head-to-collar-1')continue;
  const head=y=>1-smooth(420,525,y);
  // Match the face grid through the jaw; the previous 37px neck cell interpolated
  // head and chest motion across the cut even when its endpoints were correct.
  const [x0,y0,x1,y1]=mesh.authoring.bounds,ox=mesh.authoring.xRows,oy=mesh.authoring.yRows;
  const face=model.meshes.find(m=>m.id==='BODY_face');
  const xs=[...new Set([x0,x1,...face.authoring.xRows.filter(x=>x>x0&&x<x1)])].sort((a,b)=>a-b);
  const ys=[...new Set([...oy,420,...face.authoring.yRows.filter(y=>y>y0&&y<y1)])].sort((a,b)=>a-b);
  const sample=(d,x,y)=>{let i=0,j=0;while(i<ox.length-2&&ox[i+1]<x)i++;while(j<oy.length-2&&oy[j+1]<y)j++;const u=(x-ox[i])/(ox[i+1]-ox[i]),v=(y-oy[j])/(oy[j+1]-oy[j]),a=j*ox.length+i,b=a+1,c=a+ox.length,e=c+1;return [0,1].map(k=>u+v<=1?d[a*2+k]*(1-u-v)+d[b*2+k]*u+d[c*2+k]*v:d[b*2+k]*(1-v)+d[e*2+k]*(u+v-1)+d[c*2+k]*(1-u));};
  const rest=[],uv=[],triangles=[];for(const y of ys)for(const x of xs){rest.push(x,y);uv.push((x-x0)/(x1-x0),(y-y0)/(y1-y0));}
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){const a=j*xs.length+i,b=a+1,c=a+xs.length;triangles.push(a,b,c,b,c+1,c);}
  for(const shape of mesh.shapes)for(const key of shape.keys)key.delta=rest.flatMap((_,i)=>i%2?[]:sample(key.delta,rest[i],rest[i+1]));
  Object.assign(mesh,{rest,uv,triangles});mesh.authoring.xRows=xs;mesh.authoring.yRows=ys;
  mesh.weights=mesh.rest.flatMap((_,i)=>i%2?[]:[[{node:'head',weight:head(mesh.rest[i+1])},{node:'chest',weight:1-head(mesh.rest[i+1])}].filter(w=>w.weight>1e-8)]);
  for(const shape of mesh.shapes)if(shape.axes.length===1&&['chest.turn','body.breath'].includes(shape.axes[0].parameter))for(const key of shape.keys)for(let i=0;i<key.delta.length;i++)key.delta[i]=round(key.delta[i]*(1-head(mesh.rest[i-i%2+1])));
  const shape=(id,keys,fn)=>mesh.shapes.push({axes:[{parameter:id,keys}],keys:keys.map(k=>({at:[k],delta:mesh.rest.flatMap((_,i)=>i%2?[]:fn(mesh.rest[i],mesh.rest[i+1],k).map(v=>round(v*head(mesh.rest[i+1]))))}))});
  shape('head.yaw',[-.2,0,.2],(x,y,k)=>{const f=gauss(y,305,150);return[(x-525)*(-Math.abs(k)*.09)*f+k*9*f,k*(x-525)*.015*f];});
  shape('head.pitch',[-.3,0,.3],(x,y,k)=>[0,k*8*gauss(y,320,150)]);
  shape('mouth.open',[0,.5,1],(x,y,k)=>[0,k*(y<348?-3:8)*Math.max(0,1-((x-526)/44)**2)**2*gauss(y,348,y<348?24:42)]);
  shape('mouth.smile',[0,1],(x,y,k)=>[(x-526)*.035*k*gauss(x,526,45)*gauss(y,349,15),-k*1.8*gauss(y,347,13)*(gauss(x,492,13)+gauss(x,561,13))]);
  mesh.authoring.jawJoin='shared-head-to-collar-1';
 }
}
