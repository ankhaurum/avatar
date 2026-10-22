import {track} from './presence.js?v=emotionfix-20261023';
// Hibiki-authored intentions, evaluated before joint response and secondary physics.
// No Cubism model values, geometry or implementation are used.
const posture={
 neutral:[0,0,0],gentle:[0,-.35,0],smile:[.35,-.65,.0015],
 joy:[.7,-1.1,.003],thinking:[-.8,.5,-.004],surprise:[0,.6,0],
 concern:[-.4,.8,-.002],sadness:[0,1.4,-.003],shy:[.5,.6,.003],anger:[0,-.4,0]
};
export function affectPose(p,t,{emotion='neutral',intensity=1,speaking=false,state='idle',inputs={},age=0}={}){
 const out={...p};if(state==='sleep'||state==='wake')return out;
 const a=Math.max(0,Math.min(1,intensity)),q=posture[emotion]||posture.neutral;
 out.postureX=(out.postureX||0)+q[0]*a;
 out.postureY=(out.postureY||0)+q[1]*a;
 out.postureRoll=(out.postureRoll||0)+q[2]*a;
 // A one-shot recognition/recovery, not a permanently wide-eyed startled pose.
 if(emotion==='surprise'){
  const settle=track([[0,1],[.25,1],[1,.45],[2,.2]],age);
  for(const k of ['browRaise','round'])if(!Object.hasOwn(inputs,k))out[k]=(out[k]||0)*(.55+.45*settle);
  out.postureY+=track([[0,0],[.18,.65],[.6,.3],[1.5,0]],age)*a;
 }
 // Phrase-level emphasis is deliberately slower than individual syllables.
 // Explicit head/shoulder poses retain authority over automatic conversation motion.
 if(speaking){
  const phase=((t%7.4)+7.4)%7.4;
  const nod=track([[0,0],[.3,-.018],[.85,.055],[1.5,0],[3.7,0],[4.15,-.012],[4.65,.038],[5.4,0],[7.4,0]],phase);
  if(!Object.hasOwn(inputs,'pitch'))out.pitch=(out.pitch||0)+nod;
  if(!Object.hasOwn(inputs,'shoulder'))out.shoulder=(out.shoulder||0)+track([[0,0],[.55,.035],[1.55,0],[3.7,0],[4.4,.025],[5.5,0],[7.4,0]],phase);
  out.postureY-=track([[0,0],[.75,.35],[1.8,0],[3.7,0],[4.6,.25],[5.7,0],[7.4,0]],phase);
 }
 return out;
}
export function blinkContext(state,emotion,speaking){
 if(state==='sleep'||state==='wake')return state;
 return emotion==='thinking'?'thinking':speaking?'speaking':state;
}
