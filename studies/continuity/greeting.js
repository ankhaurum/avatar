import {HandTurn} from './hand-turn.js';
import {track} from './presence.js?v=bilateral-20261023';
import {ARM,armChain} from './arm-rig.js?v=bilateral-20261023';
import {armFrame} from './arm-space.js';
import {Sleeve} from './sleeve.js';
import {UpperArm} from './upper-arm.js';
// Character's RIGHT hand = screen left. Forearm/elbow stay separate from the face rig.
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
export const GREETING_DURATION=6.4;
export function greetingPose(seconds,side='right'){
 if(seconds<0||seconds>=GREETING_DURATION)return {active:false,lift:0,wrist:0,phase:'rest',side};
 const lift=track([[0,0],[.22,0],[1.65,.985],[2.05,1],[4.4,1],[4.65,.98],[6.4,0]],seconds);
 const upperLift=track([[0,0],[.12,0],[1.25,1],[4.7,1],[6.4,0]],seconds);
 const support=track([[0,0],[.5,.24],[1.65,1],[4.75,1],[6.4,0]],seconds);
 const wrist=track([[0,0],[1.3,.018],[1.75,0],[2.15,-.026],[2.72,.035],[3.28,-.018],[3.95,.012],[4.5,0],[5.25,-.012],[6.4,0]],seconds); const prepare=seconds<1.2?ease(seconds/.38)*(1-ease((seconds-.35)/.85)):0;
 const turn=track([[0,0],[.08,0],[.18,.5],[.32,1],[6.05,1],[6.2,.5],[6.35,0],[6.4,0]],seconds);
 return {active:true,lift,upperLift,support,wrist,turn,prepare,side,phase:seconds<1.7?'raise':seconds<4.5?'wave':'lower'};
}
export class RightGreeting {
 constructor({MeshSimple,Texture,Graphics,world,image,sleeveImage,handTurnImage,main,side='right'}){
  this.started=null;this.pose=greetingPose(-1,side);this.side=side;this.intent={};
  this.upperArm=new UpperArm({MeshSimple,Graphics,world,main,side});
  this.sleeve=new Sleeve({MeshSimple,Texture,world,image:sleeveImage});
  const cols=12,rows=24,rest=[],uvs=[],indices=[],ys=[...new Set([...Array.from({length:25},(_,j)=>740+j/24*662).filter(y=>y<1240),1120,1160,1200,1240])].sort((a,b)=>a-b);
  for(const y of ys)for(let i=0;i<=cols;i++){rest.push(i/cols*430,y);uvs.push(i/cols,(y-740)/662);}
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1;indices.push(a,c,b,b,c,c+1);}
  this.rest=new Float32Array(rest);this.indices=new Uint16Array(indices);
  const cuff=document.createElement('canvas');cuff.width=image.width;cuff.height=image.height;const cc=cuff.getContext('2d');cc.drawImage(image,0,0);const pixels=cc.getImageData(0,0,cuff.width,cuff.height);
  // Retain the blue cuff/cloth from our original material, remove the old
  // warm skin above it so the new wrist can pass behind the cuff opening.
  for(let y=0;y<Math.min(295,cuff.height);y++)for(let x=0;x<cuff.width;x++){const i=(y*cuff.width+x)*4,d=pixels.data;if(d[i]-d[i+2]>7&&d[i]-d[i+1]>4)d[i+3]=0;}cc.putImageData(pixels,0,0);
  const texture=Texture.from(cuff),hand=[],forearm=[];
  for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),maxY=Math.max(...tri.map(k=>rest[k*2+1]));(maxY<=1120?hand:forearm).push(...tri);}
  this.meshes=[forearm,hand].map(ids=>{const mesh=new MeshSimple({texture,vertices:new Float32Array(rest),uvs:new Float32Array(uvs),indices:new Uint16Array(ids)});mesh.visible=false;mesh.autoUpdate=true;world.addChild(mesh);return mesh;});
  this.mesh=this.meshes[0];this.handTurn=handTurnImage?new HandTurn({MeshSimple,Texture,world,image:handTurnImage}):null;
  if(this.handTurn)for(const part of this.handTurn.parts)for(const mesh of part.meshes)world.setChildIndex(mesh,world.getChildIndex(this.sleeve.meshes[0]));
 }
 play(clock){if(this.started!==null)return false;this.started=clock;return true;}
 update(clock){this.pose=this.started===null?greetingPose(-1,this.side):greetingPose(clock-this.started,this.side);if(!this.pose.active)this.started=null;return this.pose;}
 preview(seconds){this.started=null;this.pose=greetingPose(seconds,this.side);return this.pose;}
 stop(){this.started=null;this.pose=greetingPose(-1,this.side);this.meshes.forEach(m=>m.visible=false);this.sleeve.draw(false);this.upperArm.draw(false);this.handTurn?.draw(false);}
 draw(p){
  const g=this.pose;for(const m of this.meshes){m.alpha=1;m.visible=g.active;}if(!g.active){this.sleeve.draw(false);this.upperArm.draw(false,p);this.handTurn?.draw(false);return;}
  const chain=armChain(p.armLift??g.lift,p.armUpper??g.upperLift,this.intent),parent=armFrame(p,this.side),wrist=parent.point(...chain.wrist);
  this.upperArm.draw(true,p,chain);
  const angle=chain.forearmAngle-Math.atan2(ARM.sourceWrist[1]-ARM.sourceElbow[1],ARM.sourceWrist[0]-ARM.sourceElbow[0]);
  const c=Math.cos(angle),s=Math.sin(angle),wc=Math.cos(g.wrist),ws=Math.sin(g.wrist),v=this.mesh.vertices;
  this.sleeve.draw(true,ease(g.lift), (x,y)=>{const dx=(x-ARM.sourceWrist[0])*ARM.scale,dy=(y-ARM.sourceWrist[1])*ARM.scale;return parent.point(chain.wrist[0]+c*dx-s*dy,chain.wrist[1]+s*dx+c*dy);});
  for(let i=0;i<this.rest.length;i+=2){
   const x=this.rest[i],y=this.rest[i+1],dx=x-ARM.sourceWrist[0],dy=y-ARM.sourceWrist[1];
   // Shared wrist support between two draw regions; the contact ring cannot separate.
   const w=1-ease((y-1120)/80),lx=(dx+w*(wc*dx-ws*dy-dx))*ARM.scale,ly=(dy+w*(ws*dx+wc*dy-dy))*ARM.scale;
   v.set(parent.point(chain.wrist[0]+c*lx-s*ly,chain.wrist[1]+s*lx+c*ly),i);
  }
  for(const m of this.meshes){if(m!==this.mesh)m.vertices.set(v);m.geometry.getBuffer('aPosition').update();}
  if(this.handTurn){this.meshes[1].visible=false;this.handTurn.draw(true,g.turn,(x,y)=>{const dx=(x-ARM.sourceWrist[0])*.85,dy=(y-ARM.sourceWrist[1])*.85,w=1-ease((y-1120)/80),lx=(dx+w*(wc*dx-ws*dy-dx))*ARM.scale,ly=(dy+w*(ws*dx+wc*dy-dy))*ARM.scale;return parent.point(chain.wrist[0]+c*lx-s*ly,chain.wrist[1]+s*lx+c*ly);},this.intent.curl||0);}
  this.chain={...chain,shoulder:parent.point(...chain.shoulder),elbow:parent.point(...chain.elbow),wrist,parentAngle:parent.angle};
 }
 stats(){return {side:this.side==='right'?'character-right/screen-left':'character-left/screen-right',...this.pose,opacity:this.mesh.alpha,handTurnViews:this.handTurn?3:1,handTurnMethod:this.handTurn?'continuous-open-hand; orientation-switch-below-crop':'palm-only',upperSleeveVisible:this.upperArm.mesh.visible,socketJoints:this.upperArm.joins||[],torsoMaskActive:this.upperArm.main.mask===this.upperArm.mask,entry:'articulated shoulder upper-arm forearm hand; hierarchical joint tracks',chain:['chest',this.side+'-shoulder',this.side+'-upper-arm',this.side+'-elbow',this.side+'-forearm',this.side+'-wrist',this.side+'-hand'],joints:this.chain,drawRegions:['chest-supported-body','independent-upper-sleeve','inner-sleeve-attachment','elbow-sleeve','cuff','hand'],sleeveKeys:['extended','mid-bend','bent'],vertices:this.rest.length/2+162+72+16+(this.handTurn?this.handTurn.points.length:0),triangles:this.indices.length/3+256+112+14+(this.handTurn?this.handTurn.triangles.length:0),textureBytes:this.mesh.texture.width*this.mesh.texture.height*4+256*256*4+(this.handTurn?768*448*4:0)};}
}
