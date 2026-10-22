import {speechShape} from './presence.js?v=affect-20261022';
// V2 input translation is separate from V3 expression, speech and secondary motion.
export const STATES = ['idle','attention','thinking','speaking','happy','notify','concern','error','sleep','wake'];
export const EMOTIONS = {
  neutral: {},
  gentle: {smile:.32, cheek:.18, eyeOpen:.98, eyeSmile:.18},
  smile: {smile:.68, cheek:.5, eyeOpen:.96, eyeSmile:.65},
  joy: {smile:.95, cheek:.8, eyeOpen:.94, eyeSmile:1, browRaise:.18, roll:.12, shoulder:.12},
  surprise: {browRaise:.95, round:.85, mouth:.32, pitch:-.12, shoulder:.2},
  concern: {browInner:.8, frown:.55, eyeOpen:.92, roll:-.18, shoulder:-.12},
  sadness: {browInner:.9, frown:.85, eyeOpen:.85, gazeY:.15, pitch:.14, shoulder:-.24},
  thinking: {browInner:.3, browLower:.16, frown:.12, eyeOpen:.92, gazeX:.55, gazeY:-.35, roll:.18},
  shy: {smile:.4, cheek:.35, blush:.85, eyeOpen:.86, gazeX:-.2, gazeY:.2, pitch:.15, roll:-.16},
  anger: {browLower:.8, frown:.4, eyeOpen:.86, shoulder:.08}
};
const aliases = {happy:'joy',confusion:'concern',sad:'sadness',blushing:'shy'};
const stateEmotion = {idle:'neutral',attention:'gentle',thinking:'thinking',speaking:'neutral',happy:'joy',notify:'surprise',concern:'concern',error:'concern',sleep:'neutral',wake:'gentle'};
const durations = {attention:920,happy:1100,notify:1500,error:2300,wake:760};
const finite = v => typeof v==='number' && Number.isFinite(v);
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
export class PerformanceController {
  constructor(now=()=>performance.now()) {
    this.now=now; this.state='idle'; this.phase='normal'; this.started=now();
    this.deadline=0; this.calmAt=0; this.next='idle'; this.emotion=null; this.intensity=1;
    this.inputs={}; this.strength=1; this.speech=null; this.volume=0; this.volumeAt=-Infinity;this.emotionStarted=now();
  }
  setState(state,options={},at=this.now()) {
    if(!STATES.includes(state)||!options||typeof options!=='object')return false;
    if(options.next!==undefined&&!STATES.includes(options.next))return false;
    if(options.duration!==undefined&&(!finite(options.duration)||options.duration<0))return false;
    if(!this.emotion&&stateEmotion[state]!==stateEmotion[this.state])this.emotionStarted=at;
    this.state=state; this.phase=typeof options.phase==='string'?options.phase:'normal'; this.started=at;
    const duration=options.duration??durations[state]??0;
    this.deadline=duration>0?this.started+duration:0;this.next=options.next||'idle';
    this.calmAt=state==='speaking'&&options.calm!==false?this.started+1800:0;
    this.speech=null;
    // V2 thinking gaze is a cue, not an override of subsequent pointer input.
    if(state==='thinking'){this.inputs.gazeX=.55*.34;this.inputs.gazeY=-.35*.34;this.inputs.yaw=.55*.34*.65;}
    else if(state==='sleep')for(const k of ['gazeX','gazeY','yaw','pitch'])delete this.inputs[k];
    return true;
  }
  setEmotion(name,intensity=1) {
    if(name===null||name==='auto'){if(this.emotion!==null)this.emotionStarted=this.now();this.emotion=null;return true;}
    name=aliases[name]||name;
    if(!Object.hasOwn(EMOTIONS,name)||!finite(intensity))return false;
    if(this.emotion!==name)this.emotionStarted=this.now();this.emotion=name;this.intensity=clamp(intensity);return true;
  }
  setPose(input={}) {
    if(!input||typeof input!=='object')return {applied:[],unsupported:[]};
    const limits={yaw:[-1,1],pitch:[-1,1],roll:[-1,1],gazeX:[-1,1],gazeY:[-1,1],mouth:[0,1],smile:[0,1],body:[-1,1],shoulder:[-1,1],shoulderL:[-1,1],shoulderR:[-1,1],browRaise:[0,1],browInner:[0,1],browLower:[0,1],cheek:[0,1],frown:[0,1],round:[0,1],blush:[0,1],eye0:[0,1],eye1:[0,1]};
    const alias={eyeL:'eye0',eyeR:'eye1',bodyTurn:'body',leanX:'body'};
    const result={applied:[],unsupported:[]};
    for(const [key,value] of Object.entries(input)) {
      const k=alias[key]||key;
      if(k==='intensity'&&finite(value)){this.intensity=clamp(value);result.applied.push(key);}
      else if(limits[k]&&finite(value)){this.inputs[k]=clamp(value,...limits[k]);result.applied.push(key);}
      else result.unsupported.push(key);
    }
    return result;
  }
  setInputs(input={}) {
    if(!input||typeof input!=='object')return false;
    if(input.state!==undefined&&!STATES.includes(input.state))return false;
    if(input.state&&input.state!==this.state)this.setState(input.state);
    this.strength=finite(input.strength)?clamp(input.strength):1;
    if(typeof input.speaking==='boolean')this.speech=input.speaking;
    for(const k of ['gazeX','gazeY'])if(finite(input[k]))this.inputs[k]=clamp(input[k],-1,1)*this.strength;
    if(finite(input.gazeX))this.inputs.yaw=clamp(input.gazeX,-1,1)*this.strength*.65;
    if(finite(input.gazeY))this.inputs.pitch=clamp(input.gazeY,-1,1)*this.strength*.25;
    if(finite(input.mouth))this.inputs.mouth=clamp(input.mouth);
    return true;
  }
  setVolume(value) {if(!finite(value))return false;this.volume=clamp(value);this.volumeAt=this.now();return true;}
  reset() {this.inputs={};this.emotion=null;this.intensity=1;this.volume=0;this.volumeAt=-Infinity;this.setState('idle',{duration:0});}
  tick() {
    const now=this.now();
    if(this.calmAt&&now>=this.calmAt){this.calmAt=0;this.phase='calm';this.deadline=this.started+5000;this.next='happy';}
    // Catch up after a hidden tab without replaying an already elapsed transient state.
    for(let i=0;i<3&&this.deadline&&now>=this.deadline;i++){const due=this.deadline;this.setState(this.next,{},due);}
    return this.state;
  }
  sample(t,blink=0,audio=0,audioActive=false) {
    this.tick();
    const name=this.emotion||stateEmotion[this.state],e=EMOTIONS[name],a=this.intensity;
    const out={smile:0,cheek:0,browRaise:0,browInner:0,browLower:0,frown:0,round:0,blush:0,eyeSmile:0,shoulder:0,mouth:0,roll:0,pitch:0,gazeX:0,gazeY:0};
    for(const k of Object.keys(out))out[k]=(e[k]||0)*a;
    const eye=1+((e.eyeOpen??1)-1)*a;
    out.breathGain=this.state==='sleep'?.4:({thinking:.45,joy:1.05,concern:.75,sadness:.65,surprise:.6,shy:.75}[name]??1);
    out.eye0=out.eye1=eye*(1-blink);
    const age=(this.now()-this.started)/1000,pulse=Math.sin(Math.min(age/1.05,1)*Math.PI);
    if(this.state==='attention'){out.pitch-=pulse*.12;out.shoulder+=pulse*.15;}
    if(this.state==='notify')out.shoulder+=pulse*.2;
    if(this.state==='sleep'){out.eye0=out.eye1=0;out.pitch=.18;out.shoulder=-.1;}
    if(this.state==='wake'){const w=clamp(age/.76);out.eye0=out.eye1=w*(1-blink);}
    const speaking=this.speech??(this.state==='speaking');
    const external=this.now()-this.volumeAt<300?this.volume:0;
    const speech=speaking&&!audioActive&&this.now()-this.volumeAt>=300?speechShape(t):{open:0,round:0};
    out.mouth=Math.max(out.mouth,audio,external,speech.open);out.round=Math.max(out.round,speech.round);
    for(const [k,v]of Object.entries(this.inputs))if(k!=='mouth'&&k!=='eye0'&&k!=='eye1')out[k]=v;
    out.mouth=Math.max(out.mouth,this.inputs.mouth||0);
    for(const k of ['eye0','eye1'])if(this.inputs[k]!==undefined)out[k]*=this.inputs[k];
    return out;
  }
  snapshot(){return {state:this.state,phase:this.phase,emotion:this.emotion||stateEmotion[this.state],emotionOverride:this.emotion,intensity:this.intensity,inputs:{...this.inputs},speaking:this.speech??this.state==='speaking'};}
}

// Authored emotion beats are independent of application-state transitions.
export const DEMO_BEATS=[
 ['gentle','目が合う・小さく挨拶',false,6.4,{yaw:.12,gazeX:0}],
 ['thinking','少し視線を外して考える',false,4.6,{yaw:-.45,gazeX:-.55,gazeY:-.2}],
 ['smile','相手を見て微笑みながら話す',true,5.2,{yaw:.06,gazeX:0}],
 ['joy','嬉しそうに話す',true,4,{yaw:.24,gazeX:.05}],
 ['surprise','気づく・驚く',false,2.2,{yaw:.3,gazeX:.3}],
 ['gentle','驚きから落ち着く',false,3,{yaw:0,gazeX:0}],
 ['concern','少し考え込む',false,3.6,{yaw:-.22,gazeX:-.2,gazeY:.1}],
 ['sadness','寄り添う',false,3.4,{yaw:.05,gazeY:.15}],
 ['shy','照れた微笑みと発話',true,3.6,{yaw:.2,gazeX:-.15}],
 ['neutral','相手へ視線を戻す',false,4,{yaw:0,gazeX:0}]
];
export function emotionDemo(t){
 const duration=DEMO_BEATS.reduce((n,b)=>n+b[3],0),clock=((t%duration)+duration)%duration;let start=0;
 for(let index=0;index<DEMO_BEATS.length;index++){const [emotion,label,speaking,length,pose]=DEMO_BEATS[index];if(clock<start+length)return {emotion,label,speaking,index,duration,pose,age:clock-start};start+=length;}
}
