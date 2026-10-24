import {rigidBlendPoint} from './rigid-blend.mjs?scalar=1';
// Local volume deformation for authored hand surfaces. The surrounding avatar
// remains a 2D layered mesh; these coordinates supply foreshortening and occlusion.
const unit=()=>[1,0,0,0,0,1,0,0,0,0,1,0];
export function compose(a,b){const m=new Array(12).fill(0);for(let r=0;r<3;r++){for(let c=0;c<3;c++)for(let k=0;k<3;k++)m[r*4+c]+=a[r*4+k]*b[k*4+c];m[r*4+3]=a[r*4+3];for(let k=0;k<3;k++)m[r*4+3]+=a[r*4+k]*b[k*4+3];}return m;}
export function transform(m,x,y,z){return [m[0]*x+m[1]*y+m[2]*z+m[3],m[4]*x+m[5]*y+m[6]*z+m[7],m[8]*x+m[9]*y+m[10]*z+m[11]];}
export function compileSurfaces(model,parameters){
 const nodes=new Map(),order=[],active=new Set(),done=new Set();
 for(const n of model.surfaceNodes||[]){if(nodes.has(n.id)||!Array.isArray(n.pivot)||n.pivot.length!==3||!n.pivot.every(Number.isFinite))throw Error('Invalid surface node '+n.id);if(n.axis&&(!Array.isArray(n.axis)||n.axis.length!==3||!n.axis.every(Number.isFinite)||Math.abs(Math.hypot(...n.axis)-1)>1e-6))throw Error('Surface axis must be unit length');nodes.set(n.id,n);for(const [axis,terms]of Object.entries(n.bindings||{})){if(!['x','y','z'].includes(axis)||!terms.every(t=>parameters.has(t.parameter)&&Number.isFinite(t.factor)))throw Error('Invalid surface binding '+n.id);}}
 function visit(id){if(done.has(id))return;if(active.has(id)||!nodes.has(id))throw Error('Missing/cyclic surface node '+id);active.add(id);const n=nodes.get(id);if(n.parent)visit(n.parent);active.delete(id);done.add(id);order.push(n);}
 for(const id of nodes.keys())visit(id);
 for(const m of model.meshes){const s=m.surface;if(!s)continue;if(s.blend&&!['linear','dual-quaternion'].includes(s.blend))throw Error('Invalid surface blend');if(!s.group||s.depth?.length!==m.rest.length/2||!s.depth.every(Number.isFinite)||s.weights?.length!==s.depth.length)throw Error('Invalid surface topology '+m.id);for(const row of s.weights)if(!row.length||!row.every(w=>nodes.has(w.node)&&Number.isFinite(w.weight)&&w.weight>=0)||Math.abs(row.reduce((v,w)=>v+w.weight,0)-1)>1e-6)throw Error('Invalid surface weights '+m.id);}
 order.weightKeys=new WeakMap();for(const mesh of model.meshes)if(mesh.surface?.blend==='dual-quaternion')for(const row of mesh.surface.weights)order.weightKeys.set(row,row.map(w=>w.node+':'+w.weight).join('|'));
 return order;
}
export function surfaceMatrices(order,state){
 const angles=order.map(n=>['x','y','z'].map(k=>(n.bindings?.[k]||[]).reduce((s,t)=>s+state[t.parameter]*t.factor,0))),signature=order.flatMap((n,i)=>[...angles[i],...n.pivot,...(n.axis||[1,0,0])]);
 if(order.lastSurfaceSignature?.length===signature.length&&signature.every((v,i)=>v===order.lastSurfaceSignature[i]))return order.lastSurfaceMatrices;
 const matrices=new Map();matrices.weightKeys=order.weightKeys;let index=0;for(const n of order){const [x,y,z]=angles[index++],cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 const [ax,ay,az]=n.axis||[1,0,0],t=1-cx,rx=[cx+ax*ax*t,ax*ay*t-az*sx,ax*az*t+ay*sx,0,ay*ax*t+az*sx,cx+ay*ay*t,ay*az*t-ax*sx,0,az*ax*t-ay*sx,az*ay*t+ax*sx,cx+az*az*t,0],ry=[cy,0,sy,0,0,1,0,0,-sy,0,cy,0],rz=[cz,-sz,0,0,sz,cz,0,0,0,0,1,0],local=compose(rz,compose(ry,rx)),p=transform(local,...n.pivot);for(let i=0;i<3;i++)local[i*4+3]=n.pivot[i]-p[i];matrices.set(n.id,compose(n.parent?matrices.get(n.parent):unit(),local));}order.lastSurfaceSignature=signature;order.lastSurfaceMatrices=matrices;return matrices;}
export function surfacePoint(surface,matrices,vertex,x,y,z=surface.depth[vertex],out=[0,0,0]){if(surface.blend==='dual-quaternion')return rigidBlendPoint(surface.weights[vertex],matrices,x,y,z,out);out[0]=0;out[1]=0;out[2]=0;for(const w of surface.weights[vertex]){const m=matrices.get(w.node);out[0]+=(m[0]*x+m[1]*y+m[2]*z+m[3])*w.weight;out[1]+=(m[4]*x+m[5]*y+m[6]*z+m[7])*w.weight;out[2]+=(m[8]*x+m[9]*y+m[10]*z+m[11])*w.weight;}return out;}
