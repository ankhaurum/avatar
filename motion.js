// Independent, character-neutral cue sampling. No third-party motion data.
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;
export const DEMO_DURATION=24;
// time, yaw, pitch, roll, gazeX, gazeY, smile, bodyLean, shoulderL, shoulderR, speaking
const cues=[
 [0,0,0,0,0,0,0,0,0,0,0],
 [2,.65,-.08,-.12,.85,-.05,.12,.26,.18,-.06,0],
 [5,-.68,.12,.12,-.85,.15,.2,-.3,-.06,.22,0],
 [7.5,0,-.5,0,.1,-.65,.1,0,.15,.15,0],
 [9.5,.12,.38,-.12,-.25,.4,.2,.15,-.1,-.1,0],
 [11.5,0,0,.08,.05,0,.9,-.2,.24,.24,1],
 [15,.3,-.08,-.12,-.2,-.1,.8,.35,.3,.1,1],
 [17,0,.12,0,0,.05,.45,0,-.15,-.15,0],
 [20,0,0,0,0,0,.55,-.5,.35,-.08,0],
 [22,0,0,0,0,0,.25,.25,-.08,.22,0],
 [24,0,0,0,0,0,0,0,0,0,0]
];
const names=['yaw','pitch','roll','gazeX','gazeY','smile','bodyLean','shoulderL','shoulderR','speaking'];
export function sampleAutoDemo(seconds){
 const t=((seconds%DEMO_DURATION)+DEMO_DURATION)%DEMO_DURATION;
 let i=0;while(i<cues.length-2&&t>cues[i+1][0])i++;
 const a=cues[i],b=cues[i+1],w=ease((t-a[0])/(b[0]-a[0]));
 const p=Object.fromEntries(names.map((name,j)=>[name,mix(a[j+1],b[j+1],w)]));
 const syllable=Math.max(0,Math.sin((t-10.2)*11)+.28*Math.sin(t*19));
 p.mouth=p.speaking*Math.min(.95,syllable)*(.8+.15*Math.sin(t*2.7));
 p.blink=[3.3,8.6,12.8,18.4,22.8].reduce((v,c)=>{const d=t-c;return Math.max(v,d<0||d>.33?0:d<.09?ease(d/.09):d<.13?1:1-ease((d-.13)/.2));},0);
 // Body direction is authored separately from the face, with shoulder-led turns.
 const body=[0,.42,-.44,0,.08,-.12,.28,0,-.55,.3,0];
 p.bodyYaw=mix(body[i],body[i+1],w);
 p.phase=t<6?'左右を見る':t<10?'上下と視線':t<16?'笑顔と無音の発話':t<17?'姿勢を整える':t<23?'顔を正面に保ち、身体と衣装を確認':'正面へ戻る';
 p.progress=t/DEMO_DURATION;p.cycle=Math.floor(seconds/DEMO_DURATION);
 return p;
}
