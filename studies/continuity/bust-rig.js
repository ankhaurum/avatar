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
 const turn=thoraxTurn(x,y,p.body||0);
 return [(x-583)*.017*breath*torso+q[0]+turn[0],-breath*(3.2*torso+5.8*shoulder)-cue*9*shoulder*smooth(900,990,y)+q[1]+turn[1]];
}
// Independently authored collar/sternum/shoulder landmarks. Waist and neck boundary pinned.
const TURN_X=[0,150,350,583,810,1016,1122],TURN_Y=[810,900,980,1100,1260,1402];
const TURN_ROWS=[
 [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],
 [[0,0],[0,0],[1,0],[3,0],[1,0],[0,0],[0,0]],
 [[0,0],[9,2],[14,1],[16,0],[3,-1],[-9,-2],[0,0]],
 [[0,0],[6,1],[12,1],[13,0],[2,-1],[-7,-1],[0,0]],
 [[0,0],[1,0],[3,0],[5,0],[1,0],[-2,0],[0,0]],
 [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]
];
export function thoraxTurn(x,y,value){
 const weight=Math.min(1,Math.abs(value));if(!weight||x<0||x>1122||y<810||y>1402)return [0,0];
 const mirror=value<0,sx=mirror?1122-x:x,ix=Math.min(TURN_X.length-2,Math.max(0,TURN_X.findIndex(a=>a>=sx)-1)),iy=Math.min(TURN_Y.length-2,Math.max(0,TURN_Y.findIndex(a=>a>=y)-1));
 const u=clamp((sx-TURN_X[ix])/(TURN_X[ix+1]-TURN_X[ix])),v=clamp((y-TURN_Y[iy])/(TURN_Y[iy+1]-TURN_Y[iy]));
 return [0,1].map(k=>((1-u)*(1-v)*TURN_ROWS[iy][ix][k]+u*(1-v)*TURN_ROWS[iy][ix+1][k]+(1-u)*v*TURN_ROWS[iy+1][ix][k]+u*v*TURN_ROWS[iy+1][ix+1][k])*weight*(mirror&&k===0?-1:1));
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
// Bounded substeps (at most 1/120 s), driven by head AND chest changes.
export class BustDynamics{
 constructor(){this.reset();}
 reset(){this.x=0;this.y=0;this.vx=0;this.vy=0;this.side={left:0,right:0,vl:0,vr:0};this.last=null;}
 apply(p,dt){
  const hx=(p.yaw||0)*.6+(p.roll||0)*.25+(p.body||0)*.35+(p.postureRoll||0)*12;
  const hy=(p.pitch||0)*.45+(p.postureY||0)*.03;
  // A short slow frame is elapsed simulation time, not a reason to erase inertia.
  // Discontinuities (resume/debug pause) rebase instead of producing a velocity kick.
  if(!this.last||!Number.isFinite(dt)||dt>.5){this.last=[hx,hy];this.x=this.y=this.vx=this.vy=0;this.side={left:0,right:0,vl:0,vr:0};}
  const safe=Number.isFinite(dt)?Math.max(0,Math.min(.5,dt)):0;
  const tx=safe?clamp(-(hx-this.last[0])/safe*.65,-1,1):0,ty=safe?clamp(-(hy-this.last[1])/safe*.35,-1,1):0;
  if(safe)this.last=[hx,hy];
  const steps=Math.max(1,Math.ceil(safe*120)),h=safe/steps;
  for(let i=0;i<steps;i++){this.vx+=((tx-this.x)*85-this.vx*17)*h;this.x+=this.vx*h;this.vy+=((ty-this.y)*70-this.vy*16)*h;this.y+=this.vy*h;
   this.side.vl+=((this.x-this.side.left)*62-this.side.vl*12)*h;this.side.left+=this.side.vl*h;
   this.side.vr+=((this.x-this.side.right)*88-this.side.vr*15)*h;this.side.right+=this.side.vr*h;
  }
  return {...p,hair:clamp((p.hair||0)+this.x,-1,1),hairLeft:clamp((p.hair||0)+this.side.left,-1,1),hairRight:clamp((p.hair||0)+this.side.right,-1,1),hairY:clamp((p.hairY||0)+this.y,-1,1)};
 }
}
