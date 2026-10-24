// Source-A relaxed digit registration; geometry is still limited by painted material.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const joints=['mcp','pip','dip'];
export function registerFingerRig(model,side,landmarks){
 for(const [finger,points]of Object.entries(landmarks))for(let j=0;j<3;j++){
  const p=points[j],end=points[j+1],dx=end[0]-p[0],dy=end[1]-p[1],length=Math.hypot(dx,dy);if(length<1)throw Error('Degenerate authored digit '+side+finger);
  model.surfaceNodes.push({id:`digit.${side}.${finger}.${joints[j]}`,parent:j?`digit.${side}.${finger}.${joints[j-1]}`:`handBend.${side}`,pivot:[...p,0],axis:[-dy/length,dx/length,0],bindings:{x:[{parameter:`finger.${side}.${finger}.${joints[j]}`,factor:1}]}});
 }
}
export function fingerSurfaceWeights(side,landmarks,x,y){
 const candidates=[];
 for(const [finger,points]of Object.entries(landmarks)){
  let closest;
  for(let j=0;j<3;j++){const a=points[j],b=points[j+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))),distance=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(!closest||distance<closest.distance)closest={j,t,distance};}
  const {j,t,distance}=closest,radius=finger==='thumb'?12:8,weight=Math.exp(-((distance/radius)**2))*smooth(points[0][1]-4,points[0][1]+17,y);if(weight<.001)continue;
  const mix=j<2?smooth(.65,1,t):0;for(const [index,w]of [[j,1-mix],[Math.min(2,j+1),mix]])if(w)candidates.push({node:`digit.${side}.${finger}.${joints[index]}`,weight:weight*w});
 }
 const total=candidates.reduce((s,w)=>s+w.weight,0),scale=total>.96?.96/total:1,rows=new Map();rows.set(`handBend.${side}`,Math.max(0,1-total*scale));for(const c of candidates)rows.set(c.node,(rows.get(c.node)||0)+c.weight*scale);return [...rows].filter(([,w])=>w>1e-8).map(([node,weight])=>({node,weight}));
}
