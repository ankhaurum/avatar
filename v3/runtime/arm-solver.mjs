// Independent planar IK, evaluated in each clavicle's coordinate frame.
import {point} from './evaluate.mjs';
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function inversePoint(m,p){const [a,b,c,d,x,y]=m,det=a*d-b*c;if(!Number.isFinite(det)||Math.abs(det)<1e-9)throw Error('Singular parent transform');return [(d*(p[0]-x)-c*(p[1]-y))/det,(-b*(p[0]-x)+a*(p[1]-y))/det];}
export function solveArm(arm,target,parent=[1,0,0,1,0,0],limits={}){
 if(target.length!==2||target.some(x=>!Number.isFinite(x)))throw Error('Invalid hand target');
 const q=inversePoint(parent,target),[sx,sy]=arm.shoulder,l1=Math.hypot(arm.elbow[0]-sx,arm.elbow[1]-sy),l2=Math.hypot(arm.wrist[0]-arm.elbow[0],arm.wrist[1]-arm.elbow[1]);
 if(!(l1>0&&l2>0)||![1,-1].includes(arm.bend))throw Error('Invalid arm authoring');
 const dx=q[0]-sx,dy=q[1]-sy,r=Math.hypot(dx,dy),min=Math.abs(l1-l2)+1e-6,max=l1+l2-1e-6,d=Math.max(min,Math.min(max,r));
 const heading=r>1e-8?Math.atan2(dy,dx):Math.atan2(arm.wrist[1]-sy,arm.wrist[0]-sx);
 const elbow=arm.bend*Math.acos(Math.max(-1,Math.min(1,(d*d-l1*l1-l2*l2)/(2*l1*l2))));
 const upper=heading-Math.atan2(l2*Math.sin(elbow),l1+l2*Math.cos(elbow));
 const restUpper=Math.atan2(arm.elbow[1]-sy,arm.elbow[0]-sx),restFore=Math.atan2(arm.wrist[1]-arm.elbow[1],arm.wrist[0]-arm.elbow[0]);
 let relativeUpper=wrap(upper-restUpper),relativeElbow=wrap(elbow-(restFore-restUpper));
 if(Number.isFinite(limits.previousUpper))relativeUpper+=Math.round((limits.previousUpper-relativeUpper)/(2*Math.PI))*2*Math.PI;
 const original=[relativeUpper,relativeElbow];
 if(limits.elbow){
  relativeElbow=Math.max(limits.elbow[0],Math.min(limits.elbow[1],relativeElbow));
  // Constraining elbow changes the radial vector of the chain. Re-aim the
  // upper arm with that constrained angle, otherwise the hand veers sideways.
  const actual=(restFore-restUpper)+relativeElbow;
  relativeUpper=wrap(heading-Math.atan2(l2*Math.sin(actual),l1+l2*Math.cos(actual))-restUpper);
  if(Number.isFinite(limits.previousUpper))relativeUpper+=Math.round((limits.previousUpper-relativeUpper)/(2*Math.PI))*2*Math.PI;
 }
 if(limits.upper)relativeUpper=Math.max(limits.upper[0],Math.min(limits.upper[1],relativeUpper));
 const a=restUpper+relativeUpper,b=a+(restFore-restUpper)+relativeElbow;
 const e=[sx+l1*Math.cos(a),sy+l1*Math.sin(a)],w=[e[0]+l2*Math.cos(b),e[1]+l2*Math.sin(b)];
 return {upper:relativeUpper,elbow:relativeElbow,reached:point(parent,...w),elbowPosition:point(parent,...e),projected:r<min||r>max||relativeUpper!==original[0]||relativeElbow!==original[1]};
}
