// Character's RIGHT hand = screen left. Forearm/elbow stay separate from the face rig.
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
export const GREETING_DURATION=6.4;
export function greetingPose(seconds){
 if(seconds<0||seconds>=GREETING_DURATION)return {active:false,lift:0,wrist:0,phase:'rest'};
 const lift=seconds<1.7?ease(seconds/1.7):seconds<4.5?1:1-ease((seconds-4.5)/1.9);
 const t=clamp((seconds-1.7)/2.8);
 const wrist=seconds>=1.7&&seconds<=4.5?Math.sin(t*Math.PI*4)*Math.sin(t*Math.PI)*.045:Math.sin(lift*Math.PI)*.025;
 return {active:true,lift,wrist,phase:seconds<1.7?'raise':seconds<4.5?'wave':'lower'};
}
export class RightGreeting {
 constructor({MeshSimple,Texture,world,image,skin}){
  this.skin=skin;this.started=null;this.pose=greetingPose(-1);
  const cols=12,rows=24,rest=[],uvs=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){rest.push(i/cols*430,740+j/rows*662);uvs.push(i/cols,j/rows);}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1;indices.push(a,c,b,b,c,c+1);}
  this.rest=new Float32Array(rest);this.indices=new Uint16Array(indices);
  this.mesh=new MeshSimple({texture:Texture.from(image),vertices:new Float32Array(rest),uvs:new Float32Array(uvs),indices:this.indices});
  this.mesh.visible=false;this.mesh.autoUpdate=true;world.addChild(this.mesh);
 }
 play(clock){if(this.started!==null)return false;this.started=clock;return true;}
 update(clock){this.pose=this.started===null?greetingPose(-1):greetingPose(clock-this.started);if(!this.pose.active)this.started=null;return this.pose;}
 preview(seconds){this.started=null;this.pose=greetingPose(seconds);return this.pose;}
 stop(){this.started=null;this.pose=greetingPose(-1);this.mesh.visible=false;}
 draw(p){
  const g=this.pose;this.mesh.alpha=1;this.mesh.visible=g.active;if(!this.mesh.visible)return;
  // The elbow remains below the bust crop. Rotate the forearm in from screen left
  // at full opacity; uniform scale preserves palm proportions throughout the arc.
  const shoulder=this.skin(115,1000,p),rootX=shoulder[0]+20,rootY=shoulder[1]+640;
  const angle=-(1-g.lift)*1.35,c=Math.cos(angle),s=Math.sin(angle),scale=.9;
  const wc=Math.cos(g.wrist),ws=Math.sin(g.wrist),v=this.mesh.vertices;
  for(let i=0;i<this.rest.length;i+=2){
   let x=this.rest[i],y=this.rest[i+1];
   // Wrist bends smoothly through the cuff support; no independent skin cut seam.
   const w=1-ease((y-1120)/130),dx=x-285,dy=y-1160;
   x+=w*(wc*dx-ws*dy-dx);y+=w*(ws*dx+wc*dy-dy);
   const lx=(x-135)*scale,ly=(y-1640)*scale;
   v[i]=rootX+c*lx-s*ly;v[i+1]=rootY+s*lx+c*ly;
  }
  this.mesh.geometry.getBuffer('aPosition').update();
 }
 stats(){return {side:'character-right/screen-left',...this.pose,opacity:this.mesh.alpha,entry:'left-to-right elbow arc; opaque uniform palm scale',chain:['chest','right-shoulder','right-elbow','right-wrist'],vertices:this.rest.length/2,triangles:this.indices.length/3,textureBytes:this.mesh.texture.width*this.mesh.texture.height*4};}
}
