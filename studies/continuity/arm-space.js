import {BUST_HIERARCHY,shoulderFrame} from './bust-rig.js?v=bilateral-20261023';
// Character right = screen left. Reflect about the rig's thorax axis,
// not the canvas edge (the approved portrait is slightly asymmetric).
export const ARM_MIRROR_X=BUST_HIERARCHY.shoulderRight.pivot[0]+BUST_HIERARCHY.shoulderLeft.pivot[0];
export function armPoint(x,y,side='right'){return [side==='left'?ARM_MIRROR_X-x:x,y];}
export function armFrame(p,side='right'){
 const f=shoulderFrame(p,side);
 return {angle:f.angle,point:(x,y)=>f.point(...armPoint(x,y,side))};
}
export function reflectArmChain(chain,side='right'){
 if(side==='right')return chain;
 return {...chain,shoulder:armPoint(...chain.shoulder,side),elbow:armPoint(...chain.elbow,side),wrist:armPoint(...chain.wrist,side),upperAngle:Math.PI-chain.upperAngle,forearmAngle:Math.PI-chain.forearmAngle};
}
