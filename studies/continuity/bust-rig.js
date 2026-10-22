// Independent character rig. No Cubism data or SDK code.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const BUST_HIERARCHY={
 root:{parent:null,pivot:[583,1250]},thorax:{parent:'root'},
 shoulderRight:{parent:'thorax',pivot:[150,1000]},shoulderLeft:{parent:'thorax',pivot:[1016,1000]},
 neck:{parent:'thorax',pivot:[583,930]},head:{parent:'neck',pivot:[583,790]},
 eyes:{parent:'head'},mouth:{parent:'head'},hair:{parent:'head',secondary:true},
 upperArmRight:{parent:'shoulderRight'},forearmRight:{parent:'upperArmRight'},handRight:{parent:'forearmRight'}
};
// Authored scapular corrective cage: neutral -> supported shoulder. Boundaries stay pinned.
export const SCAPULA_KEY={xs:[0,90,180,285,350],ys:[900,980,1060,1170,1290],deltas:[
 [[0,0],[0,0],[0,0],[0,0],[0,0]],
 [[0,-1],[-1,-3],[0,-3],[0,-1],[0,0]],
 [[-1,0],[-2,-2],[-1,-2],[0,0],[0,0]],
 [[0,0],[-1,0],[0,0],[0,0],[0,0]],
 [[0,0],[0,0],[0,0],[0,0],[0,0]]
]};
export function scapulaOffset(x,y,p){
 const mirror=x>583,sx=mirror?1166-x:x,amount=clamp(mirror?p.scapulaR||0:p.scapulaL||0);
 const {xs,ys,deltas}=SCAPULA_KEY;if(!amount||sx<xs[0]||sx>xs.at(-1)||y<ys[0]||y>ys.at(-1))return [0,0];
 const i=Math.min(xs.length-2,xs.findIndex(v=>v>=sx)-1),j=Math.min(ys.length-2,ys.findIndex(v=>v>=y)-1);
 const ix=Math.max(0,i),iy=Math.max(0,j),u=clamp((sx-xs[ix])/(xs[ix+1]-xs[ix])),v=clamp((y-ys[iy])/(ys[iy+1]-ys[iy]));
 return [0,1].map(k=>((1-u)*(1-v)*deltas[iy][ix][k]+u*(1-v)*deltas[iy][ix+1][k]+(1-u)*v*deltas[iy+1][ix][k]+u*v*deltas[iy+1][ix+1][k])*amount*(mirror&&k===0?-1:1));
}
export function chestFrame(p){
 const [cx,cy]=BUST_HIERARCHY.root.pivot,angle=(p.body||0)*.012+(p.postureRoll||0),c=Math.cos(angle),s=Math.sin(angle);
 return {angle,vector:(x,y)=>[c*x-s*y,s*x+c*y],point:(x,y)=>[cx+c*(x-cx)-s*(y-cy)+(p.postureX||0),cy+s*(x-cx)+c*(y-cy)-(p.breath||0)*1.7+(p.postureY||0)]};
}
export function thoraxOffset(x,y,p){
 const breath=p.breath||0,torso=smooth(810,1010,y)*(1-smooth(1170,1390,y));
 const shoulder=Math.exp(-(((y-1015)/145)**2))*(1-Math.exp(-(((x-583)/175)**2)));
 const cue=(p.shoulder||0)+(x<583?(p.shoulderL||0):(p.shoulderR||0)),q=scapulaOffset(x,y,p);
 return [(x-583)*.017*breath*torso+q[0],-breath*(3.2*torso+5.8*shoulder)-cue*9*shoulder*smooth(900,990,y)+q[1]];
}
export function shoulderFrame(p,side='right'){
 const anchor=BUST_HIERARCHY[side==='right'?'shoulderRight':'shoulderLeft'].pivot,frame=chestFrame(p),q=frame.point(...anchor),offset=frame.vector(...thoraxOffset(...anchor,p));
 return {angle:frame.angle,point:(x,y)=>{const d=frame.vector(x-anchor[0],y-anchor[1]);return [q[0]+offset[0]+d[0],q[1]+offset[1]+d[1]];}};
}
export function composeBustIntent(p,g={active:false,lift:0,prepare:0}){
 const out={...p},lift=g.active?g.lift:0,prepare=g.active?g.prepare||0:0,supportPose=g.active?g.support??lift:0;
 // A small support/anticipation pose is shared by spine, collar, neck and arm.
 const support=clamp((p.shoulder||0)*.4);
 out.armLift=lift;out.armUpper=g.active?g.upperLift??lift:0;out.scapulaL=support+.8*supportPose+.18*prepare;out.scapulaR=support;
 out.postureX=(out.postureX||0)-4.5*supportPose-1.5*prepare;
 out.postureY=(out.postureY||0)+1.2*prepare-(p.shoulder||0)*2.5;
 out.postureRoll=(out.postureRoll||0)-.009*supportPose+.003*prepare;
 out.shoulderL=(out.shoulderL||0)+.22*supportPose+.12*prepare;
 out.roll=(out.roll||0)+.07*lift;
 return out;
}
// Bounded fixed-step secondary motion, driven by head AND chest changes.
export class BustDynamics{
 constructor(){this.reset();}
 reset(){this.x=0;this.y=0;this.vx=0;this.vy=0;this.last=null;}
 apply(p,dt){
  const hx=(p.yaw||0)*.6+(p.roll||0)*.25+(p.body||0)*.35+(p.postureRoll||0)*12;
  const hy=(p.pitch||0)*.45+(p.postureY||0)*.03;
  if(!this.last||dt>.2){this.last=[hx,hy];this.x=this.y=this.vx=this.vy=0;}
  const safe=Math.max(.001,dt),tx=clamp(-(hx-this.last[0])/safe*.65,-1,1),ty=clamp(-(hy-this.last[1])/safe*.35,-1,1);this.last=[hx,hy];
  const steps=Math.max(1,Math.ceil(Math.min(.1,safe)*120)),h=Math.min(.1,safe)/steps;
  for(let i=0;i<steps;i++){this.vx+=((tx-this.x)*85-this.vx*17)*h;this.x+=this.vx*h;this.vy+=((ty-this.y)*70-this.vy*16)*h;this.y+=this.vy*h;}
  return {...p,hair:clamp((p.hair||0)+this.x,-1,1),hairY:clamp((p.hairY||0)+this.y,-1,1)};
 }
}
