// Deterministic local asset authoring. No Adobe, external service or source writes.
export const WIDTH=1122,HEIGHT=1402;
export const eyes=[{x0:438,y0:480,x1:545,y1:486,up:25,down:9,cx:497,cy:474,radius:19.6},{x0:644,y0:486,x1:746,y1:466,up:24,down:9,cx:680,cy:468,radius:19.6}];
const closedTrace=[[[438,483],[448,486],[458,489],[468,492],[478,494],[488,494],[498,494],[508,493],[518,491],[528,489],[538,487],[545,487]],[[644,484],[654,484],[664,485],[674,486],[684,487],[694,486],[704,485],[714,482],[724,478],[734,474],[746,469]]];
function traceAt(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}return points.at(-1)[1];}
export const seam=x=>{const t=Math.max(0,Math.min(1,(x-522)/144));return 646-8*t+7*Math.sin(Math.PI*t);};
export function canvas(w=WIDTH,h=HEIGHT){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
async function load(url){const i=new Image();i.src=url;await i.decode();return i;}
export function eyeBounds(x,e,open=1){const t=Math.max(0,Math.min(1,(x-e.x0)/(e.x1-e.x0))),s=Math.sin(Math.PI*t),mid=e.y0+(e.y1-e.y0)*t,close=mid+8*s;return [close+(mid-e.up*s-close)*open,close+(mid+e.down*s-close)*open];}
function eyePath(ctx,e,open=1){ctx.beginPath();for(let i=0;i<=32;i++){const x=e.x0+(e.x1-e.x0)*i/32,y=eyeBounds(x,e,open)[0]+2; i?ctx.lineTo(x,y):ctx.moveTo(x,y);}for(let i=32;i>=0;i--){const x=e.x0+(e.x1-e.x0)*i/32;ctx.lineTo(x,eyeBounds(x,e,open)[1]-.5);}ctx.closePath();}
export async function authorMaterials(){
 const original=await load('../../assets/approved-front.png'),white=await load('../../assets/rig2/sclera-left.png'),whiteR=await load('../../assets/rig2/sclera-right.png');
 const base=canvas(),ctx=base.getContext('2d');ctx.drawImage(original,0,0);
 // Author a white underlay exactly within each aperture; lids and skin remain source pixels.
 for(const [i,e]of eyes.entries()){ctx.save();eyePath(ctx,e);ctx.clip();const image=i?whiteR:white;ctx.drawImage(image,i?632:426,i?446:452);ctx.restore();}
 ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();for(let i=0;i<=48;i++){let x=522+144*i/48,w=Math.sin(Math.PI*i/48);i?ctx.lineTo(x,seam(x)-.45*w):ctx.moveTo(x,seam(x));}for(let i=48;i>=0;i--){let x=522+144*i/48;ctx.lineTo(x,seam(x)+.45*Math.sin(Math.PI*i/48));}ctx.closePath();ctx.fill();ctx.restore();
 const irises=await Promise.all(['left','right'].map(async(side,i)=>{
  const c=canvas(),g=c.getContext('2d'),im=await load('../../assets/rig2/iris-'+side+'.png'),e=eyes[i],ox=i?657:474,oy=i?445:451;
  const patch=canvas(im.width,im.height),pg=patch.getContext('2d');pg.drawImage(im,0,0);const data=pg.getImageData(0,0,im.width,im.height),src=new Uint8ClampedArray(data.data);
  // Restore the iris behind the upper lid from its own visible lower iris, rather than moving baked lashes.
  for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(y+oy<eyeBounds(x+ox,e)[0]+2.5){const sy=Math.max(0,Math.min(im.height-1,Math.round(2*e.cy-y-2*oy))),k=(y*im.width+x)*4,s=(sy*im.width+x)*4;for(let ch=0;ch<3;ch++)data.data[k+ch]=src[s+ch];}
  pg.putImageData(data,0,0);g.drawImage(patch,ox,oy);return c;
 }));
 // The interior is extended beneath both lips; the mesh aperture supplies its moving occlusion.
 const cavity=canvas(),c=cavity.getContext('2d');let gradient=c.createLinearGradient(0,640,0,680);gradient.addColorStop(0,'#381c23');gradient.addColorStop(.75,'#6f343c');gradient.addColorStop(1,'#a35c62');c.fillStyle=gradient;c.beginPath();c.ellipse(594,654,80,30,0,0,Math.PI*2);c.fill();
 const teeth=await load('../../assets/rig2/teeth.png');c.globalAlpha=.65;c.drawImage(teeth,522,640);c.globalAlpha=1;
 const neutral=canvas(),n=neutral.getContext('2d');n.drawImage(cavity,0,0);n.drawImage(base,0,0);for(const iris of irises)n.drawImage(iris,0,0);
 const ref=canvas();ref.getContext('2d').drawImage(original,0,0);
 if(!globalThis.authorClosedReference)throw Error('閉眼補正の制作には既存の許可済み閉眼参照が必要です');
 const closedRef=await load(globalThis.authorClosedReference),closed=canvas();closed.getContext('2d').drawImage(closedRef,0,0,WIDTH,HEIGHT);const pixels=closed.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data,{localShape}=await import('./rig.js');
 const closedEyes=eyes.map((e,i)=>{
  const c=canvas(),g=c.getContext('2d'),image=g.createImageData(WIDTH,HEIGHT),x0=e.x0-18,x1=e.x1+18,y0=430,y1=519;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const q=localShape(x,y,{['eye'+i]:0}),line=eyeBounds(x,e,0)[0],registration=(traceAt(closedTrace[i],x)-line)*Math.max(0,1-Math.abs(q[1]-line)/35),sx=Math.max(0,Math.min(WIDTH-2,q[0])),sy=Math.max(0,Math.min(HEIGHT-2,q[1]+registration)),ix=Math.floor(sx),iy=Math.floor(sy),u=sx-ix,v=sy-iy,k=(y*WIDTH+x)*4;
   for(let ch=0;ch<3;ch++)image.data[k+ch]=pixels[(iy*WIDTH+ix)*4+ch]*(1-u)*(1-v)+pixels[(iy*WIDTH+ix+1)*4+ch]*u*(1-v)+pixels[((iy+1)*WIDTH+ix)*4+ch]*(1-u)*v+pixels[((iy+1)*WIDTH+ix+1)*4+ch]*u*v;
   image.data[k+3]=255*Math.min(1,(x-x0)/12,(x1-x)/12,(y-y0)/12,(y1-y)/12);
  }g.putImageData(image,0,0);return c;
 });
 const layers=[{name:'Approved source - hidden reference',canvas:ref,hidden:true},{name:'Mouth interior extension - occluded by surface',canvas:cavity},{name:'Continuous skin hair neck suit surface',canvas:base},{name:'Iris left - aperture mask at runtime',canvas:irises[0]},{name:'Iris right - aperture mask at runtime',canvas:irises[1]},...closedEyes.map((c,i)=>({name:'Closed eyelid corrective '+i+' - rest UV / hidden at neutral',canvas:c,hidden:true}))];
 return {base,irises,cavity,closedEyes,neutral,layers,original:ref};
}
export function exportPSD(materials){return agPsd.writePsdUint8Array({width:WIDTH,height:HEIGHT,canvas:materials.neutral,children:[...materials.layers].reverse()},{generateThumbnail:false});}
export async function readMaterials(){
 const names=['surface','iris-left','iris-right','mouth-underlay','closed-left','closed-right'];const images=await Promise.all(names.map(n=>load('materials/'+n+'.png')));
 return {base:images[0],irises:images.slice(1,3),cavity:images[3],closedEyes:images.slice(4,6),source:'saved PNG layers'};
}
