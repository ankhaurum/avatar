// Shoulder -> upper arm -> elbow -> forearm -> wrist. Character right, screen left.
const clamp=v=>Math.max(0,Math.min(1,v));
export const ARM={shoulder:[150,1000],upper:460,forearm:Math.hypot(165,300)*.9,sourceWrist:[285,1160],sourceElbow:[120,1460],scale:.9};
export function armChain(lift=0){
 const g=clamp(lift),[sx,sy]=ARM.shoulder;
 // Small upper-arm abduction and elbow flexion are independent joint tracks.
 const upperAngle=1.75+.08*Math.sin(Math.PI*g)+.02*g;
 const forearmAngle=1.36-2.42*g;
 const elbow=[sx+Math.cos(upperAngle)*ARM.upper,sy+Math.sin(upperAngle)*ARM.upper];
 const wrist=[elbow[0]+Math.cos(forearmAngle)*ARM.forearm,elbow[1]+Math.sin(forearmAngle)*ARM.forearm];
 return {shoulder:[sx,sy],elbow,wrist,upperAngle,forearmAngle};
}
export const ARM_REST=armChain(0);
export function upperArmSkin(lift){
 const a=armChain(lift).upperAngle-ARM_REST.upperAngle,c=Math.cos(a),s=Math.sin(a);return (x,y)=>{const dx=x-150,dy=y-1000;
 return [150+c*dx-s*dy,1000+s*dx+c*dy];};
}
