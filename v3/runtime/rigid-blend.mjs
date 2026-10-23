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
export function rigidBlendPoint(weights,matrices,x,y,z){
 const blends=matrices.rigidBlends??=new Map(),key=matrices.weightKeys?.get(weights)??weights.map(w=>w.node+':'+w.weight).join('|');let blend=blends.get(key);
 if(!blend){
 const cache=matrices.rigidPairs??=new Map(),a=[0,0,0,0],b=[0,0,0,0];let reference;
 for(const w of weights){if(!w.weight)continue;let pair=cache.get(w.node);if(!pair){pair=rigidPair(matrices.get(w.node));cache.set(w.node,pair);}reference??=pair[0];const k=w.weight*(dot(reference,pair[0])<0?-1:1);for(let i=0;i<4;i++){a[i]+=pair[0][i]*k;b[i]+=pair[1][i]*k;}}
 const n=Math.hypot(...a);if(n<1e-10)throw Error('Degenerate rigid blend');
 const q=a.map(v=>v/n),raw=b.map(v=>v/n),parallel=dot(q,raw),d=raw.map((v,i)=>v-q[i]*parallel),qi=conj(q),t=mul(d,qi);blend={q,t};blends.set(key,blend);
 }
 const {q,t}=blend,ux=2*(q[2]*z-q[3]*y),uy=2*(q[3]*x-q[1]*z),uz=2*(q[1]*y-q[2]*x);
 return [x+q[0]*ux+q[2]*uz-q[3]*uy+2*t[1],y+q[0]*uy+q[3]*ux-q[1]*uz+2*t[2],z+q[0]*uz+q[1]*uy-q[2]*ux+2*t[3]];
}
