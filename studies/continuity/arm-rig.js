// Shoulder -> upper arm -> elbow -> forearm -> wrist. Character right, screen left.
import {BUST_HIERARCHY} from './bust-rig.js?v=arm-socket-20261023';
const clamp=v=>Math.max(0,Math.min(1,v));
export const ARM={shoulder:BUST_HIERARCHY.shoulderRight.pivot,upper:460,forearm:Math.hypot(165,300)*.9,sourceWrist:[285,1160],sourceElbow:[120,1460],scale:.9};
export function armChain(lift=0,upperLift=lift){
 const g=clamp(lift),[sx,sy]=ARM.shoulder,t=g,a=1-t;
 // Author the reach in screen space: below the crop -> beside the chest.
 // Solve both joints together; never rotate a fixed-radius wrist around a
 // stationary elbow or clamp one joint after solving the other.
 const wrist=[a*a*a*160+3*a*a*t*420+3*a*t*t*400+t*t*t*220,
              a*a*a*1760+3*a*a*t*1540+3*a*t*t*1300+t*t*t*1165];
 const dx=wrist[0]-sx,dy=wrist[1]-sy,d=Math.hypot(dx,dy);
 const along=(ARM.upper**2-ARM.forearm**2+d*d)/(2*d);
 const height=Math.sqrt(Math.max(0,ARM.upper**2-along*along));
 const elbow=[sx+along*dx/d-height*dy/d,sy+along*dy/d+height*dx/d];
 const upperAngle=Math.atan2(elbow[1]-sy,elbow[0]-sx);
 const forearmAngle=Math.atan2(wrist[1]-elbow[1],wrist[0]-elbow[0]);
 return {shoulder:[sx,sy],elbow,wrist,upperAngle,forearmAngle};
}
