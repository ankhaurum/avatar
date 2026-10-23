import {RightGreeting} from './greeting.js';
import {composeBustIntent} from './bust-rig.js';
// Both arms share one torso cutout; neither can restore the other's sleeve.
export class BilateralArms{
 constructor(options){
  this.arms={right:new RightGreeting({...options,side:'right'}),left:new RightGreeting({...options,side:'left'})};
  this.started=null;this.mode='right-greeting';this.pose={active:false};
 }
 play(clock,mode='right-greeting'){if(this.started!==null)return false;this.mode=mode;this.started=clock;return true;}
 update(clock){return this.previewAt(this.started===null?-1:clock-this.started);}
 previewAt(t){
  const left=this.mode==='left-greeting'||this.mode==='thinking-hand',both=this.mode==='both-hands'||this.mode==='conversation-hands';
  for(const a of Object.values(this.arms))a.intent={target:both?[300,1190]:this.mode==='thinking-hand'?[350,1160]:[220,1165],curl:this.mode==='thinking-hand'?.8:both?.25:0};
  this.arms.right.preview(left?-1:t);this.arms.left.preview(left?t:both?t-.32:-1);
  this.pose={active:Object.values(this.arms).some(a=>a.pose.active),phase:t<1.7?'raise':t<4.5?'wave':'lower',side:both?'both':left?'left':'right'};
  if(t>=6.4+(both?.32:0))this.started=null;return this.pose;
 }
 preview(t,mode=this.mode){this.started=null;this.mode=mode;this.previewAt(t);return this;}
 stop(){this.started=null;Object.values(this.arms).forEach(a=>a.stop());this.pose={active:false};}
 intent(p){let q={...p};for(const a of Object.values(this.arms))if(a.pose.active)q=composeBustIntent(q,a.pose);return q;}
 draw(p){for(const a of Object.values(this.arms))a.draw({...p,armLift:a.pose.lift,armUpper:a.pose.upperLift});}
 stats(){return {active:this.pose.active,mode:this.mode,arms:Object.fromEntries(Object.entries(this.arms).map(([k,a])=>[k,a.stats()])),textureBytes:Object.values(this.arms).reduce((n,a)=>n+a.stats().textureBytes,0)};}
}
