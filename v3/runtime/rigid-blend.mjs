// Independent implementation of rigid dual-quaternion blending.
// Mathematical reference: Kavan et al., TOG 2008 (no vendor/source code copied).
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),conj=q=>[q[0],-q[1],-q[2],-q[3]];
export function rigidPair(m){
 const tr=m[0]+m[5]+m[10];let q,s;
 if(tr>0){s=2*Math.sqrt(1+tr);q=[s/4,(m[9]-m[6])/s,(m[2]-m[8])/s,(m[4]-m[1])/s];}
 else if(m[0]>m[5]&&m[0]>m[10]){s=2*Math.sqrt(1+m[0]-m[5]-m[10]);q=[(m[9]-m[6])/s,s/4,(m[1]+m[4])/s,(m[2]+m[8])/s];}
 else if(m[5]>m[10]){s=2*Math.sqrt(1+m[5]-m[0]-m[10]);q=[(m[2]-m[8])/s,(m[1]+m[4])/s,s/4,(m[6]+m[9])/s];}
 else{s=2*Math.sqrt(1+m[10]-m[0]-m[5]);q=[(m[4]-m[1])/s,(m[2]+m[8])/s,(m[6]+m[9])/s,s/4];}
 const n=Math.hypot(...q);q=q.map(v=>v/n);
 return [q,mul([0,m[3],m[7],m[11]],q).map(v=>v*.5)];
}
export function rigidBlendPoint(weights,matrices,x,y,z,out=[]){
 // A single rigid influence needs no per-vertex blend. Derive the same rigid
 // transform from its normalized quaternion once; preserve non-rigid input semantics.
 if(weights.length===1&&weights[0].weight>0){
  const cache=matrices.singleRigidTransforms??=new Map(),id=weights[0].node;let a=cache.get(id);
  if(!a){const [q,d]=rigidPair(matrices.get(id)),[w,u,v,t]=q,[dw,dx,dy,dz]=d;
   a=[1-2*(v*v+t*t),2*(u*v-w*t),2*(u*t+w*v),2*(-dw*u+dx*w-dy*t+dz*v),2*(u*v+w*t),1-2*(u*u+t*t),2*(v*t-w*u),2*(-dw*v+dx*t+dy*w-dz*u),2*(u*t-w*v),2*(v*t+w*u),1-2*(u*u+v*v),2*(-dw*t-dx*v+dy*u+dz*w)];cache.set(id,a);}
  out[0]=a[0]*x+a[1]*y+a[2]*z+a[3];out[1]=a[4]*x+a[5]*y+a[6]*z+a[7];out[2]=a[8]*x+a[9]*y+a[10]*z+a[11];return out;
 }

 const blends=matrices.rigidBlends??=new Map(),key=matrices.weightKeys?.get(weights)??weights.map(w=>w.node+':'+w.weight).join('|');let blend=blends.get(key);
 if(!blend){
  const cache=matrices.rigidPairs??=new Map();let aw=0,ax=0,ay=0,az=0,bw=0,bx=0,by=0,bz=0,reference;
  for(const w of weights){if(!w.weight)continue;let pair=cache.get(w.node);if(!pair){pair=rigidPair(matrices.get(w.node));cache.set(w.node,pair);}const q=pair[0],d=pair[1];reference??=q;const k=w.weight*(reference[0]*q[0]+reference[1]*q[1]+reference[2]*q[2]+reference[3]*q[3]<0?-1:1);aw+=q[0]*k;ax+=q[1]*k;ay+=q[2]*k;az+=q[3]*k;bw+=d[0]*k;bx+=d[1]*k;by+=d[2]*k;bz+=d[3]*k;}
  const norm=Math.hypot(aw,ax,ay,az);if(norm<1e-10)throw Error('Degenerate rigid blend');const inverse=1/norm,qw=aw*inverse,qx=ax*inverse,qy=ay*inverse,qz=az*inverse,rw=bw*inverse,rx=bx*inverse,ry=by*inverse,rz=bz*inverse,parallel=qw*rw+qx*rx+qy*ry+qz*rz,dw=rw-qw*parallel,dx=rx-qx*parallel,dy=ry-qy*parallel,dz=rz-qz*parallel;
  blend=new Float64Array([qw,qx,qy,qz,2*(-dw*qx+dx*qw-dy*qz+dz*qy),2*(-dw*qy+dx*qz+dy*qw-dz*qx),2*(-dw*qz-dx*qy+dy*qx+dz*qw)]);blends.set(key,blend);
 }
 const qw=blend[0],qx=blend[1],qy=blend[2],qz=blend[3],ux=2*(qy*z-qz*y),uy=2*(qz*x-qx*z),uz=2*(qx*y-qy*x);
 out[0]=x+qw*ux+qy*uz-qz*uy+blend[4];out[1]=y+qw*uy+qz*ux-qx*uz+blend[5];out[2]=z+qw*uz+qx*uy-qy*ux+blend[6];return out;
}
