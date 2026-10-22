import {seam} from './materials.js';
import {localShape,createSkin} from './rig.js?v=smile-20261022';
// Original Canvas-authored oral tissues. No second face or mouth photograph.
export function authorOralMaterials(){
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const cavity=canvas(180,100),c=cavity.getContext('2d'),shade=c.createLinearGradient(0,14,0,78);
 shade.addColorStop(0,'#46242d');shade.addColorStop(.5,'#81434b');shade.addColorStop(1,'#b97d81');c.fillStyle=shade;c.fillRect(0,0,180,100);
 const bounce=c.createRadialGradient(90,63,1,90,63,43);bounce.addColorStop(0,'rgba(213,142,144,.6)');bounce.addColorStop(1,'rgba(163,94,103,0)');c.fillStyle=bounce;c.fillRect(0,0,180,100);
 // Separate rounded crowns, shallow separators and recessed lateral teeth.
 const teeth=canvas(288,48),t=teeth.getContext('2d');
 const widths=[20,24,30,34,36,36,34,30,24,20];let left=(288-widths.reduce((a,b)=>a+b,0))/2;
 for(const width of widths){
  const center=left+width/2,bottom=44-17*Math.pow(Math.abs(center-144)/144,1.5),radius=5;
  t.beginPath();t.moveTo(left+.4,0);t.lineTo(left+width-.4,0);t.lineTo(left+width-.4,bottom-radius);
  t.quadraticCurveTo(left+width-.4,bottom,left+width-radius,bottom);
  t.quadraticCurveTo(center,bottom+1,left+radius,bottom);
  t.quadraticCurveTo(left+.4,bottom,left+.4,bottom-radius);t.closePath();
  const ivory=t.createLinearGradient(0,0,0,bottom);ivory.addColorStop(0,'#b89a8d');ivory.addColorStop(.28,'#e7d7c7');ivory.addColorStop(.7,'#f4eadc');ivory.addColorStop(1,'#dacbbb');t.fillStyle=ivory;t.fill();
  t.save();t.clip();const side=t.createLinearGradient(left,0,left+width,0);side.addColorStop(0,'rgba(112,79,69,.15)');side.addColorStop(.2,'rgba(255,255,255,.07)');side.addColorStop(.8,'rgba(255,255,255,0)');side.addColorStop(1,'rgba(112,79,69,.15)');t.fillStyle=side;t.fillRect(left,0,width,48);t.restore();left+=width;
 }
 const tongue=canvas(176,32),q=tongue.getContext('2d'),pink=q.createRadialGradient(88,21,4,88,21,85);
 pink.addColorStop(0,'rgba(200,125,133,.95)');pink.addColorStop(.65,'rgba(168,86,101,.72)');pink.addColorStop(1,'rgba(130,61,78,0)');q.fillStyle=pink;q.beginPath();q.ellipse(88,24,88,24,0,0,Math.PI*2);q.fill();
 return {cavity,teeth,tongue};
}
export async function readOralMaterials(){
 const load=async name=>{const i=new Image();i.src='materials/'+name+'.png?v=smile-20261022';await i.decode();return i;};
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
  const q=localShape(x,edge,p),offset=kind==='teeth'?.65*w+row*10.5:-6+row*5;
  out.set(project(q[0],q[1]+offset),i);
 }
 return out;
}
