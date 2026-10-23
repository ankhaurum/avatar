export class Spring {
 constructor(value=0){this.value=value;this.velocity=0;}
 step(target,dt,omega){const d=this.value-target,k=this.velocity+omega*d,e=Math.exp(-omega*dt);this.value=target+(d+k*dt)*e;this.velocity=(this.velocity-omega*k*dt)*e;return this.value;}
}
export class MotionController{
 constructor(model,motion,random=Math.random){this.model=model;this.motion=motion;this.random=random;this.springs=new Map(model.parameters.map(p=>[p.id,new Spring(p.default)]));this.state='idle';this.expression='auto';this.time=0;this.stateAt=0;this.nextBlink=2;this.blinkAt=-10;this.manual={};this.secondary={hair:new Spring(),cloth:new Spring()};}
 setState(id){if(!this.motion.states[id])throw Error('Unknown conversation state');this.state=id;this.stateAt=this.time;}
 setExpression(id){if(id!=='auto'&&!this.motion.expressions[id])throw Error('Unknown expression');this.expression=id;}
 hold(values){for(const [id,value]of Object.entries(values)){if(!this.springs.has(id)||!Number.isFinite(value))throw Error('Invalid manual pose');this.manual[id]=value;}}
 release(){this.manual={};}
 step(dt,speech={mode:'none',value:0},animate=true){
  dt=Math.max(0,Math.min(.1,dt));this.time+=dt;const t=this.time,clip=this.motion.states[this.state],pose={...clip.pose};
  const emotion=this.motion.expressions[this.expression==='auto'?clip.expression:this.expression];Object.assign(pose,emotion);
  if(animate){
   pose['body.x']=(pose['body.x']||0)+3*Math.sin(t*.73)+1.5*Math.sin(t*.31);
   pose['body.breath']=(1-Math.cos(t*1.43))*.5;
   pose['head.yaw']=(pose['head.yaw']||0)+.035*Math.sin(t*.67);
   if(t>=this.nextBlink){this.blinkAt=t;this.nextBlink=t+2.8+this.random()*2.7;}
   const blinkAge=t-this.blinkAt,blink=blinkAge>=0&&blinkAge<.26?Math.sin(Math.PI*blinkAge/.26)**2:0;
   for(const side of ['r','l'])pose['eye.'+side+'.blink']=Math.max(pose['eye.'+side+'.blink']||0,blink);
   if(this.state==='nod'){const age=t-this.stateAt;pose['head.pitch']=age<1.2?.7*Math.sin(Math.PI*age/1.2)**2:0;}
   if(this.state==='explain'||this.state==='speaking'){
    pose['arm.r.elbow']=(pose['arm.r.elbow']||0)+.08*Math.sin(t*2.1);
    pose['arm.l.elbow']=(pose['arm.l.elbow']||0)-.07*Math.sin(t*1.7+.8);
   }
  }
  const actual=speech.mode!=='none',synthetic=this.state==='speaking'&&!actual;
  pose['mouth.open']=Math.max(pose['mouth.open']||0,actual?speech.value:synthetic&&animate?Math.max(0,Math.sin(t*9.4))*.55:0);
  Object.assign(pose,this.manual);
  const result={};for(const p of this.model.parameters){const target=Math.max(p.min,Math.min(p.max,pose[p.id]??p.default));result[p.id]=this.springs.get(p.id).step(target,dt,p.id.includes('blink')?48:p.id==='mouth.open'?26:7);}
  const headV=this.springs.get('head.tilt')?.velocity||0,bodyV=this.springs.get('body.lean')?.velocity||0,yawV=this.springs.get('head.yaw')?.velocity||0;
  const limit=x=>Math.max(-1,Math.min(1,x));
  if(animate){result['hair.sway']=this.secondary.hair.step(limit(-headV*1.8-yawV*.4-bodyV),dt,7);result['cloth.sway']=this.secondary.cloth.step(limit(-bodyV*3),dt,5);}
  this.last=result;this.speechMode=actual?speech.mode:synthetic?'synthetic':'none';return result;
 }
}
