import {seam} from './materials.js';
import {localShape,createSkin} from './rig.js?v=hand-cage-20261023';
// Original Canvas-authored oral tissues. No second face or mouth photograph.
export function authorOralMaterials(){
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const cavity=canvas(180,100),c=cavity.getContext('2d'),shade=c.createLinearGradient(0,14,0,78);
 shade.addColorStop(0,'#46242d');shade.addColorStop(.5,'#81434b');shade.addColorStop(1,'#b97d81');c.fillStyle=shade;c.fillRect(0,0,180,100);
 const bounce=c.createRadialGradient(90,63,1,90,63,43);bounce.addColorStop(0,'rgba(213,142,144,.6)');bounce.addColorStop(1,'rgba(163,94,103,0)');c.fillStyle=bounce;c.fillRect(0,0,180,100);
 // A continuous dental arch with softly overlapping crowns, not dark vertical gaps.
 const teeth=canvas(288,64),t=teeth.getContext('2d');
 const widths=[16,22,29,34,43,43,34,29,22,16];let left=(288-widths.reduce((a,b)=>a+b,0))/2;
 for(const [i,width] of widths.entries()){
  const center=left+width/2,side=Math.min(1,Math.abs(center-144)/144);
  const bottom=51-18*side*side+([0,-1,1,-2,0,.5,-1,1,-1,0][i]);
  t.beginPath();t.moveTo(left-.3,0);t.lineTo(left+width+.3,0);t.lineTo(left+width+.3,bottom-9);
  t.bezierCurveTo(left+width,bottom-3,left+width-3,bottom-1,center+width*.19,bottom);
  t.quadraticCurveTo(center,bottom+1,left+width*.22,bottom-.8);
  t.bezierCurveTo(left+2,bottom-2,left,bottom-5,left-.3,bottom-10);t.closePath();
  const ivory=t.createLinearGradient(0,0,0,bottom);ivory.addColorStop(0,'#a98a80');ivory.addColorStop(.3,'#d5c0ae');ivory.addColorStop(.68,'#eee0ce');ivory.addColorStop(1,'#d4c4b5');t.fillStyle=ivory;t.fill();
  t.save();t.clip();const crown=t.createLinearGradient(left,0,left+width,0);crown.addColorStop(0,'rgba(120,90,78,.09)');crown.addColorStop(.35,'rgba(255,255,255,.1)');crown.addColorStop(1,'rgba(120,90,78,.07)');t.fillStyle=crown;t.fillRect(left,0,width,64);
  t.fillStyle='rgba(92,61,57,'+(side*side*.38)+')';t.fillRect(left,0,width,64);t.restore();left+=width;
 }
 const tongue=canvas(176,32),q=tongue.getContext('2d'),pink=q.createRadialGradient(88,21,4,88,21,85);
 pink.addColorStop(0,'rgba(200,125,133,.95)');pink.addColorStop(.65,'rgba(168,86,101,.72)');pink.addColorStop(1,'rgba(130,61,78,0)');q.fillStyle=pink;q.beginPath();q.ellipse(88,24,88,24,0,0,Math.PI*2);q.fill();
 return {cavity,teeth,tongue};
}
export async function readOralMaterials(){
 const load=async name=>{const i=new Image();i.src='materials/'+name+'.png?v=hand-cage-20261023';await i.decode();return i;};
 const [cavity,teeth,tongue]=await Promise.all(['oral-cavity','upper-dental','tongue'].map(load));return {cavity,teeth,tongue};
}
export function oralStrip(kind){
 const rest=[],uvs=[],indices=[];
 for(let row=0;row<2;row++)for(let j=0;j<=32;j++){rest.push(kind==='teeth'?542+j*104/32:550+j*88/32,row);uvs.push(j/32,row);}
 for(let j=0;j<32;j++)indices.push(j,j+33,j+1,j+1,j+33,j+34);
 return {rest,uvs,indices};
}
export function oralVertices(kind,geometry,p){
 const out=new Float32Array(geometry.rest.length),project=createSkin(p);
 for(let i=0;i<out.length;i+=2){
  const x=geometry.rest[i],row=geometry.rest[i+1],w=Math.sin(Math.PI*Math.max(0,Math.min(1,(x-522)/144)));
  const edge=kind==='teeth'?seam(x)-.45*w:seam(x)+.45*w;
  const q=localShape(x,edge,p),offset=kind==='teeth'?.65*w+row*12:-6+row*5;
  // The dental arch belongs to the upper jaw, not to each moving lip vertex.
  if(kind==='teeth'){const u=(x-594)/52;q[1]=641.5-2.9*u+2.2*u*u;q[0]=x+(q[0]-x)*.2;}
  out.set(project(q[0],q[1]+offset),i);
 }
 return out;
}
