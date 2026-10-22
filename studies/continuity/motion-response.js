// Independent critically damped response. No model data or SDK implementation.
// Eyes acquire a target first; head follows; ribcage and support settle last.
const rates={gazeX:24,gazeY:24,yaw:11,pitch:10,roll:8,body:4.8,postureX:6,postureY:6,postureRoll:5.5,shoulder:8,shoulderL:8,shoulderR:8,scapulaL:8,scapulaR:8};
export class MotionResponse{
 constructor(){this.velocity={};}
 reset(){this.velocity={};}
 step(current,target,dt){
  const h=Number.isFinite(dt)?Math.max(0,Math.min(.5,dt)):0;
  for(const key of Object.keys(current)){
   const goal=Number.isFinite(target[key])?target[key]:0;
   // Emotional lid openness follows the face; fast blink closure is composed afterwards.
   if(!Object.hasOwn(rates,key)){const speed=(key==='eye0'||key==='eye1'||key==='eyeSmile')?8:key==='mouth'?24:10;current[key]+=(goal-current[key])*(-Math.expm1(-speed*h));continue;}
   const w=rates[key],offset=current[key]-goal,v=this.velocity[key]||0,j=v+w*offset,e=Math.exp(-w*h);
   current[key]=goal+(offset+j*h)*e;this.velocity[key]=(v-w*j*h)*e;
  }
  return current;
 }
}
// Closure is an independent action, not a new expression target. It must not
// erase the smile, leave a residual slit, or kick the emotional lid on reopening.
export function composeEyeClosure(p,blink=0,wink=0){
 const closed=x=>1-Math.max(0,Math.min(1,x));
 return {...p,eye0:p.eye0*closed(blink)*closed(wink),eye1:p.eye1*closed(blink)};
}
// Preserve the authored contact phase when a slow frame skips across it.
// A long background pause must not replay an old blink on return.
export function crossedBlinkContact(age,dt){
 return dt>0&&dt<=.5&&age>=.09&&age-dt<.12;
}
