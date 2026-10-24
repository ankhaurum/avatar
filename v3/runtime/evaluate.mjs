import {rigidBlendPoint} from './rigid-blend.mjs?scalar=2';
import {compileFields,sampleField} from './projection-field.mjs';
// Original author-data evaluator. No Cubism runtime or legacy V3 imports.
import {compileSurfaces,surfaceMatrices,surfacePoint} from './surface.mjs?axis=7';
const identity=()=>[1,0,0,1,0,0];
export function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const check=(ok,message)=>{if(!ok)throw Error(message);};
const array=(v,n,label)=>check(Array.isArray(v)&&v.length===n&&v.every(finite),label);
export function compile(model){
 check(model.format==='hibiki-model'&&model.version===1,'Unsupported model format');
 check(finite(model.width)&&model.width>0&&finite(model.height)&&model.height>0,'Invalid canvas');
 const params=new Map(),nodes=new Map(),meshes=new Map(),order=[],shapeIndexes=new WeakMap(),weightKeys=new WeakMap();
 for(const p of model.parameters){check(p.id&&!params.has(p.id),'Duplicate parameter');check([p.min,p.max,p.default].every(finite)&&p.min<=p.default&&p.default<=p.max,'Invalid parameter '+p.id);params.set(p.id,p);}
 for(const n of model.nodes){check(n.id&&!nodes.has(n.id),'Duplicate node');array(n.pivot,2,'Node pivot '+n.id);for(const [k,v]of Object.entries(n.base||{}))check(['x','y','rotation','scaleX','scaleY'].includes(k)&&finite(v),'Invalid node base');for(const k of Object.keys(n.bindings||{}))check(['x','y','rotation','scaleX','scaleY'].includes(k),'Invalid node channel');nodes.set(n.id,n);}
 const visiting=new Set(),visited=new Set();
 function visit(id){check(nodes.has(id),'Missing node '+id);if(visited.has(id))return;check(!visiting.has(id),'Node cycle '+id);visiting.add(id);const n=nodes.get(id);if(n.parent)visit(n.parent);for(const terms of Object.values(n.bindings||{}))for(const t of terms){check(params.has(t.parameter)&&finite(t.factor),'Invalid binding '+id);}visiting.delete(id);visited.add(id);order.push(n);}
 for(const id of nodes.keys())visit(id);
 for(const m of model.meshes){
  check(m.id&&!meshes.has(m.id),'Duplicate mesh');check(nodes.has(m.node),'Missing mesh parent '+m.id);
  check(Array.isArray(m.rest)&&m.rest.length>=6&&m.rest.length%2===0&&m.rest.every(finite),'Rest vertices '+m.id);
  array(m.uv,m.rest.length,'UV '+m.id);check(m.uv.every(x=>x>=0&&x<=1),'UV range '+m.id);
  check(m.triangles.length%3===0&&m.triangles.every(i=>Number.isInteger(i)&&i>=0&&i<m.rest.length/2),'Triangle indices '+m.id);
  check(finite(m.order),'Draw order '+m.id);
  if(m.blend!==undefined)check(m.blend==='dual-quaternion','Unknown planar skin blend '+m.id);
  if(m.weights){check(m.weights.length===m.rest.length/2,'Weight count '+m.id);for(const row of m.weights){check(row.length&&row.every(w=>nodes.has(w.node)&&finite(w.weight)&&w.weight>=0),'Skin weights '+m.id);check(Math.abs(row.reduce((s,w)=>s+w.weight,0)-1)<1e-6,'Weights must sum to one '+m.id);}}
  for(const shape of m.shapes||[]){
   check(shape.axes?.length>0&&shape.axes.length<=3,'Shape axes '+m.id);
   const keys=new Set();let count=1;
   for(const a of shape.axes){check(params.has(a.parameter)&&a.keys?.length>=1&&a.keys.every(finite)&&a.keys.every((v,i)=>!i||v>a.keys[i-1]),'Shape axis '+m.id);count*=a.keys.length;}
   for(const key of shape.keys){array(key.at,shape.axes.length,'Key coordinate');array(key.delta,m.rest.length,'Key topology '+m.id);if(key.depthDelta!==undefined){check(!!m.surface,'Depth key requires surface '+m.id);array(key.depthDelta,m.rest.length/2,'Depth key topology '+m.id);}check(key.at.every((v,i)=>shape.axes[i].keys.includes(v)),'Unknown key coordinate');const name=key.at.join('|');check(!keys.has(name),'Duplicate shape key');keys.add(name);}
   check(keys.size===count,'Missing authored key: '+m.id);shapeIndexes.set(shape,new Map(shape.keys.map(k=>[k.at.join('|'),k])));
  }
  if(m.blend==='dual-quaternion')for(const row of m.weights||[])weightKeys.set(row,row.map(w=>w.node+':'+w.weight).join('|'));
  meshes.set(m.id,m);
 }
 for(const m of meshes.values())for(const id of m.masks||[])check(meshes.has(id)&&id!==m.id&&!meshes.get(id).masks?.length,'Missing, self or nested mask '+m.id);
 const bound=new Set();
 for(const seam of model.seams||[]){check(seam.vertices?.length>=2,'Seam needs counterparts');for(const v of seam.vertices){const m=meshes.get(v.mesh);check(m&&Number.isInteger(v.vertex)&&v.vertex>=0&&v.vertex<m.rest.length/2,'Seam vertex');const id=v.mesh+':'+v.vertex;check(!bound.has(id),'Vertex belongs to multiple seam groups');bound.add(id);}if(seam.parameter)check(params.has(seam.parameter),'Seam parameter');}
 return {model,params,nodes,meshes,order,shapeIndexes,weightKeys,surfaceOrder:compileSurfaces(model,params),projectionFields:compileFields(model)};
}
function bracket(keys,x){if(x<=keys[0])return [[keys[0],1]];if(x>=keys.at(-1))return [[keys.at(-1),1]];for(let i=1;i<keys.length;i++)if(x<=keys[i]){const t=(x-keys[i-1])/(keys[i]-keys[i-1]);return [[keys[i-1],1-t],[keys[i],t]];}}
export function evaluate(compiled,input={}){
 const {model,params,order,shapeIndexes}=compiled,state={},matrices=new Map(),positions=new Map(),depths=new Map();
 for(const [id,p]of params){const v=input[id]??p.default;check(finite(v),'Non-finite input '+id);state[id]=Math.max(p.min,Math.min(p.max,v));}
 for(const n of order){
  const value=(key,base=0)=>(n.base?.[key]??base)+(n.bindings?.[key]||[]).reduce((s,t)=>s+state[t.parameter]*t.factor,0);
  const rotation=value('rotation'),sx=value('scaleX',1),sy=value('scaleY',1),x=value('x'),y=value('y'),[px,py]=n.pivot,c=Math.cos(rotation),s=Math.sin(rotation);
  const local=[c*sx,s*sx,-s*sy,c*sy,x+px-c*sx*px+s*sy*py,y+py-s*sx*px-c*sy*py];
  matrices.set(n.id,multiply(n.parent?matrices.get(n.parent):identity(),local));
 }
  const surfaceTransforms=surfaceMatrices(compiled.surfaceOrder,state);
 const rigidMatrices=new Map();rigidMatrices.weightKeys=compiled.weightKeys;if(model.meshes.some(m=>m.blend==='dual-quaternion'))for(const [id,a]of matrices)rigidMatrices.set(id,[a[0],a[2],0,a[4],a[1],a[3],0,a[5],0,0,1,0]);
 for(const mesh of model.meshes){
  const local=Float64Array.from(mesh.rest),scratch=new Float64Array(3);let localDepth=null;
  for(const shape of mesh.shapes||[]){
   let corners=[{at:[],weight:1}];
   for(const a of shape.axes)corners=corners.flatMap(c=>bracket(a.keys,state[a.parameter]).map(([v,w])=>({at:[...c.at,v],weight:c.weight*w})));
   for(const c of corners){if(c.weight===0)continue;const key=shapeIndexes.get(shape).get(c.at.join('|'));for(let i=0;i<local.length;i++)local[i]+=key.delta[i]*c.weight;if(key.depthDelta){localDepth??=new Float64Array(local.length/2);for(let i=0;i<localDepth.length;i++)localDepth[i]+=key.depthDelta[i]*c.weight;}}
  }
  const out=new Float32Array(local.length),matrix=matrices.get(mesh.node),depth=new Float32Array(local.length/2);
  if(mesh.surface)for(let i=0;i<local.length;i+=2){const p=surfacePoint(mesh.surface,surfaceTransforms,i/2,local[i],local[i+1],(mesh.surface.depthField?sampleField(compiled.projectionFields.get(mesh.surface.depthField),local[i],local[i+1]):mesh.surface.depth[i/2])+(localDepth?.[i/2]??0),scratch);local[i]=p[0];local[i+1]=p[1];depth[i/2]=p[2];}
  for(let i=0;i<local.length;i+=2){
   if(mesh.weights&&mesh.blend==='dual-quaternion'){const p=rigidBlendPoint(mesh.weights[i/2],rigidMatrices,local[i],local[i+1],0,scratch);out[i]=p[0];out[i+1]=p[1];}
   else if(mesh.weights){for(const w of mesh.weights[i/2]){const a=matrices.get(w.node),x=local[i],y=local[i+1];out[i]+=(a[0]*x+a[2]*y+a[4])*w.weight;out[i+1]+=(a[1]*x+a[3]*y+a[5])*w.weight;}}
   else {const x=local[i],y=local[i+1];out[i]=matrix[0]*x+matrix[2]*y+matrix[4];out[i+1]=matrix[1]*x+matrix[3]*y+matrix[5];}
  }
  positions.set(mesh.id,out);depths.set(mesh.id,depth);
 }
 // Compute each target from the untouched evaluated endpoints before applying any glue.
 const updates=[];
 for(const seam of model.seams||[]){
  let x=0,y=0;for(const v of seam.vertices){const p=positions.get(v.mesh);x+=p[v.vertex*2];y+=p[v.vertex*2+1];}x/=seam.vertices.length;y/=seam.vertices.length;
  const strength=seam.parameter?Math.max(0,Math.min(1,state[seam.parameter])):1;
  for(const v of seam.vertices)updates.push({...v,x,y,strength});
 }
 for(const v of updates){const p=positions.get(v.mesh),i=v.vertex*2;p[i]+=(v.x-p[i])*v.strength;p[i+1]+=(v.y-p[i+1])*v.strength;}
 return {positions,matrices,state,depths};
}
