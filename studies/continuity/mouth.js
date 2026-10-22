import {WIDTH,HEIGHT,seam} from './materials.js';
import {localShape,createSkin,clamp} from './rig.js?v=presence-20261022';

// Independently authored tissue shading; no second mouth photograph behind the lips.
export function mouthBackground(){
 const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
 const c=canvas.getContext('2d'),shade=c.createLinearGradient(0,636,0,679);
 shade.addColorStop(0,'#66353d');shade.addColorStop(.45,'#85454e');shade.addColorStop(1,'#b5767b');
 c.fillStyle=shade;c.beginPath();c.ellipse(594,654,80,31,0,0,Math.PI*2);c.fill();
 const tissue=c.createRadialGradient(594,670,2,594,670,35);
 tissue.addColorStop(0,'rgba(202,126,135,.75)');tissue.addColorStop(1,'rgba(179,100,112,0)');
 c.fillStyle=tissue;c.fillRect(544,644,100,41);return canvas;
}

// The upper dental arch stays attached to the upper lip, independently of the lower jaw.
// The continuous face surface occludes it at closed lips and around the mouth corners.
export function drawUpperTeeth(graphics,p){
 graphics.clear();const project=createSkin(p),depth=3.3+clamp(p.smile||0);
 for(const [top,bottom,color] of [[0,.2,0xb6a59d],[.2,.82,0xdfd4c6],[.82,1,0xc3b1a5]]){
  const points=[];
  for(const [start,end,step,offset]of [[0,32,1,top],[32,0,-1,bottom]])for(let j=start;step>0?j<=end:j>=end;j+=step){
   const x=538+112*j/32,w=Math.sin(Math.PI*(x-522)/144),arch=Math.sin(Math.PI*j/32),q=localShape(x,seam(x)-.45*w,p);
   points.push(...project(q[0],q[1]+.85*w+offset*depth*arch));
  }
  graphics.poly(points).fill(color);
 }
}
