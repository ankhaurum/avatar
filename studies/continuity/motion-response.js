// Independent critically damped response. No model data or SDK implementation.
// Eyes acquire a target first; head follows; ribcage and support settle last.
const rates={gazeX:24,gazeY:24,yaw:11,pitch:10,roll:8,body:4.8,postureX:6,postureY:6,postureRoll:5.5,shoulder:8,shoulderL:8,shoulderR:8,scapulaL:8,scapulaR:8};
export class MotionResponse{
 constructor(){this.velocity={};}
 reset(){this.velocity={};}
 step(current,target,dt){
  const h=Math.max(0,Math.min(.1,dt));
  for(const key of Object.keys(current)){
   const goal=Number.isFinite(target[key])?target[key]:0;
   // Eyelids and phonation retain the authored closures rather than spring overshoot.
   if(!Object.hasOwn(rates,key)){const speed=(key==='eye0'||key==='eye1')?100:key==='mouth'?24:key==='eyeSmile'?8:10;current[key]+=(goal-current[key])*(-Math.expm1(-speed*h));continue;}
   const w=rates[key],offset=current[key]-goal,v=this.velocity[key]||0,j=v+w*offset,e=Math.exp(-w*h);
   current[key]=goal+(offset+j*h)*e;this.velocity[key]=(v-w*j*h)*e;
  }
  return current;
 }
}
