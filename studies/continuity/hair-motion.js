// Hibiki's own bounded strand response. Root motion and tip inertia are separate.
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export class HairMotion {
 constructor(){this.reset();}
 reset(){this.time=0;this.last=null;this.nodes=Object.fromEntries(['front','left','right','tipLeft','tipRight'].map(k=>[k,{x:0,v:0}]));}
 apply(p,dt){
  const drive=(p.yaw||0)*.6+(p.roll||0)*.25+(p.body||0)*.35+(p.postureRoll||0)*12+(p.shoulderL||0)*.12;
  if(!Number.isFinite(dt)||dt<0||dt>.5){this.reset();this.last=drive;return {...p,hairFront:0,hairTipLeft:0,hairTipRight:0};}
  this.time+=dt;const impulse=this.last===null||!dt?0:clamp(-(drive-this.last)/dt*.5);this.last=drive;
  const breeze=(p.wind??1)*(.20*Math.sin(this.time*.73)+.09*Math.sin(this.time*1.31+.8))*smooth(0,2,this.time);
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps,n=this.nodes;
  const spring=(k,target,stiffness,damping)=>{const a=n[k];a.v+=((target-a.x)*stiffness-a.v*damping)*h;a.x=clamp(a.x+a.v*h);};
  for(let i=0;i<steps;i++){
   spring('front',impulse*.35+breeze*.55,105,18);
   spring('left',impulse+breeze,65,13);
   spring('right',impulse*.86+breeze*.72,81,15);
   spring('tipLeft',n.left.x+breeze*.5,43,10);
   spring('tipRight',n.right.x+breeze*.3,58,12);
  }
  return {...p,hairFront:n.front.x,hairLeft:(p.hair||0)+n.left.x,hairRight:(p.hair||0)+n.right.x,hairTipLeft:n.tipLeft.x,hairTipRight:n.tipRight.x};
 }
}
// Continuous fields on the shared surface: roots, face and collar remain pinned.
export function hairOffset(x,y,p){
 const side=(1-smooth(385,455,x))+smooth(745,810,x),length=smooth(390,800,y)*(1-smooth(850,895,y));
 const isLeft=x<583,main=isLeft?p.hairLeft??p.hair??0:p.hairRight??p.hair??0;
 const tip=isLeft?p.hairTipLeft||0:p.hairTipRight||0;
 const ends=smooth(650,820,y)*(1-smooth(855,895,y));
 const fringe=smooth(370,450,x)*(1-smooth(700,770,x))*smooth(170,350,y)*(1-smooth(385,420,y));
 return [side*(main*length*4.5+tip*ends*3.2)+(p.hairFront||0)*fringe*2.2,
  side*((p.hairY||0)*length*3+tip*ends*(isLeft?1.2:-.9))];
}
