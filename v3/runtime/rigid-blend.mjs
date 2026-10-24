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
