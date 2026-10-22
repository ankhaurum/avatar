// Shoulder -> upper arm -> elbow -> forearm -> wrist. Character right, screen left.
import {BUST_HIERARCHY} from './bust-rig.js?v=affect-20261022';
const clamp=v=>Math.max(0,Math.min(1,v));
export const ARM={shoulder:BUST_HIERARCHY.shoulderRight.pivot,upper:460,forearm:Math.hypot(165,300)*.9,sourceWrist:[285,1160],sourceElbow:[120,1460],scale:.9};
export function armChain(lift=0,upperLift=lift){
 const g=clamp(lift),[sx,sy]=ARM.shoulder;
 // A wrist path is authored in the character frame, then solved shoulder -> elbow.
 // This preserves both bone lengths; it is not a rotated / vertically scaled hand.
 const restElbow=[sx+Math.cos(1.75)*ARM.upper,sy+Math.sin(1.75)*ARM.upper];
 const rest=[restElbow[0]+Math.cos(1.36)*ARM.forearm,restElbow[1]+Math.sin(1.36)*ARM.forearm];
 const u=1-g,point=[u*u*u*rest[0]+3*u*u*g*160+3*u*g*g*155+g*g*g*220,u*u*u*rest[1]+3*u*u*g*1660+3*u*g*g*1250+g*g*g*1165];
 point[1]-=5*Math.sin(Math.PI*clamp(upperLift));
 const dx=point[0]-sx,dy=point[1]-sy,d=Math.max(Math.abs(ARM.upper-ARM.forearm)+.01,Math.min(ARM.upper+ARM.forearm-.01,Math.hypot(dx,dy)));
 const desired=Math.atan2(dy,dx)+Math.acos(Math.max(-1,Math.min(1,(d*d+ARM.upper**2-ARM.forearm**2)/(2*d*ARM.upper))));
 // Soft anatomical/artwork limit: avoid folding a frontal jacket into an absent side view.
 const upperAngle=1.75+.28*Math.tanh((desired-1.75)/.28);
 const elbow=[sx+Math.cos(upperAngle)*ARM.upper,sy+Math.sin(upperAngle)*ARM.upper];
 const forearmAngle=Math.atan2(point[1]-elbow[1],point[0]-elbow[0]);
 const wrist=[elbow[0]+Math.cos(forearmAngle)*ARM.forearm,elbow[1]+Math.sin(forearmAngle)*ARM.forearm];
 return {shoulder:[sx,sy],elbow,wrist,upperAngle,forearmAngle};
}
export const ARM_REST=armChain(0);
export function upperArmSkin(lift,upperLift=lift){
 const [cx,cy]=ARM.shoulder,a=armChain(lift,upperLift).upperAngle-ARM_REST.upperAngle,c=Math.cos(a),s=Math.sin(a);return (x,y)=>{const dx=x-cx,dy=y-cy;
 return [cx+c*dx-s*dy,cy+s*dx+c*dy];};
}
