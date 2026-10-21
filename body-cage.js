// Hibiki anatomical body cage. Image coordinates belong to this rig only.
// Every overlapping garment samples the same displacement, so seams share it.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const gaussian=(v,c,s)=>Math.exp(-1*((v-c)/s)**2);
export const BODY_CAGE={
 version:'hibiki-body-cage-1',
 x:[0,250,390,583,780,930,1122],
 y:[0,790,870,960,1080,1230,1402],
 neck:[583,870],shoulderL:[250,960],shoulderR:[930,960],waist:[583,1402]
};
export function solveBodyCage(p,rig=BODY_CAGE){
 const chest=p.chest||0,turn=(p.bodyTurn||0)*.4,lean=p.bodyLean||0;
 const cx=rig.waist[0],bottom=rig.waist[1];
 function body(x,y){
  const dx=x-cx,upper=1-smooth(1230,bottom,y),spine=1-smooth(870,bottom,y);
  // Perspective foreshortens the far shoulder and changes the lapel/V silhouette.
  const depth=130*Math.sqrt(Math.max(0,1-(dx/620)**2));
  const rotatedDepth=-dx*Math.sin(turn)+(depth-100)*Math.cos(turn)+100;
  const perspective=(1200-depth)/(1200-rotatedDepth);
  let px=x+upper*((dx*Math.cos(turn)+(depth-100)*Math.sin(turn))*perspective-dx);
  let py=y;
  px+=lean*28*spine*spine;
  py+=dx*lean*.04*spine;
  const ribs=gaussian(y,1080,220);
  px+=dx*chest*.035*ribs;
  py-=chest*(9*gaussian(y,960,150)+3*gaussian(y,1100,160));
  // Clavicle/upper-arm rotations, not a rotation of the whole photograph.
  for(const [joint,q,side]of [[rig.shoulderL,p.shoulderL||0,1],[rig.shoulderR,p.shoulderR||0,-1]]){
   const w=(side===1?1-smooth(250,510,x):smooth(650,930,x))*smooth(870,950,y);
   const a=q*.12*side,rx=x-joint[0],ry=y-joint[1];
   px+=w*(rx*(Math.cos(a)-1)-ry*Math.sin(a));
   py+=w*(rx*Math.sin(a)+ry*(Math.cos(a)-1)-q*14);
  }
  return [px-x,py-y];
 }
 const neck=body(...rig.neck),head=[neck[0]*.35,neck[1]*.25];
 const nodes=rig.y.flatMap(y=>rig.x.flatMap(x=>y<=790?head:body(x,y)));
 return new Float32Array(nodes);
}
export function sampleBodyCage(x,y,nodes,rig=BODY_CAGE){
 let i=0,j=0;while(i<5&&x>rig.x[i+1])i++;while(j<5&&y>rig.y[j+1])j++;
 const u=clamp((x-rig.x[i])/(rig.x[i+1]-rig.x[i])),v=clamp((y-rig.y[j])/(rig.y[j+1]-rig.y[j]));
 const at=(a,b,c)=>nodes[(b*7+a)*2+c];
 return [0,1].map(c=>(at(i,j,c)*(1-u)+at(i+1,j,c)*u)*(1-v)+(at(i,j+1,c)*(1-u)+at(i+1,j+1,c)*u)*v);
}
