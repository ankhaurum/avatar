// Shoulder -> upper arm -> elbow -> forearm -> wrist. Character right, screen left.
import {BUST_HIERARCHY} from './bust-rig.js?v=presence-shapes-20261023';
const clamp=v=>Math.max(0,Math.min(1,v));
export const ARM={shoulder:BUST_HIERARCHY.shoulderRight.pivot,upper:460,forearm:Math.hypot(165,300)*.9,sourceWrist:[285,1160],sourceElbow:[120,1460],scale:.9};
export function armChain(lift=0,upperLift=lift){
 const g=clamp(lift),[sx,sy]=ARM.shoulder;
 // Independent authored joint poses, not IK followed by a conflicting shoulder clamp.
 // The latter sent the elbow outside the portrait and back during one raise.
 // These angles belong to Hibiki's artwork; no sample-model geometry is reused.
 const u=clamp(upperLift),upperAngle=1.75-.125*u+.055*Math.sin(Math.PI*u);
 const elbow=[sx+Math.cos(upperAngle)*ARM.upper,sy+Math.sin(upperAngle)*ARM.upper];
 // Unwrapped angle chooses the outside arc: enter from screen left, then settle
 // beside the chest. It avoids sweeping the palm backwards across the tie.
 const forearmProgress=1-(1-g)*(1-g);
 const forearmAngle=1.36+(Math.PI*2-1.2589-1.36)*forearmProgress;
 const wrist=[elbow[0]+Math.cos(forearmAngle)*ARM.forearm,elbow[1]+Math.sin(forearmAngle)*ARM.forearm];
 return {shoulder:[sx,sy],elbow,wrist,upperAngle,forearmAngle};
}
export const ARM_REST=armChain(0);
export function upperArmSkin(lift,upperLift=lift){
 const [cx,cy]=ARM.shoulder,a=armChain(lift,upperLift).upperAngle-ARM_REST.upperAngle,c=Math.cos(a),s=Math.sin(a);return (x,y)=>{const dx=x-cx,dy=y-cy;
 return [cx+c*dx-s*dy,cy+s*dx+c*dy];};
}
