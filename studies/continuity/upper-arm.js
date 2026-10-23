import {skin} from './rig.js?v=hand-cage-20261023';
import {ARM,armChain} from './arm-rig.js?v=hand-cage-20261023';
import {armFrame,armPoint} from './arm-space.js';
// Source-space jacket sleeve/chest seam, authored from Hibiki's own image.
export const SEAM=[[930,90],[980,101],[1040,119],[1100,139],[1160,160],[1220,176],[1300,180],[1402,190]];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export class UpperArm {
 constructor({MeshSimple,Graphics,world,main,side='right'}){
  this.main=main;this.side=side;this.rest=[];const uv=[],indices=[],cols=8;
  // Two source pixels of underlap prevent a raster crack at the chest mask.
  for(const [y,right] of SEAM)for(let i=0;i<=cols;i++){const x=(right+2)*i/cols;this.rest.push(x,y);uv.push(x/1122,y/1402);}
  for(let r=0;r<SEAM.length-1;r++)for(let i=0;i<cols;i++){const a=r*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  this.mesh=new MeshSimple({texture:main.texture,vertices:new Float32Array(this.rest),uvs:new Float32Array(uv),indices:new Uint16Array(indices)});
  this.mesh.visible=false;world.addChildAt(this.mesh,world.getChildIndex(main));
  // A genuine inner cloth surface, joined to both moving edges. It sits
  // behind sleeve and torso, and opens only as the two boundaries separate.
  // UVs sample unlined jacket cloth beside the seam, not transparent pixels.
  const liningUV=[],liningIndices=[];
  for(const [y,x] of SEAM)for(const offset of [8,32])liningUV.push((x+offset)/1122,y/1402);
  for(let r=0;r<SEAM.length-1;r++){const a=r*2;liningIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
  this.lining=new MeshSimple({texture:main.texture,vertices:new Float32Array(SEAM.length*4),uvs:new Float32Array(liningUV),indices:new Uint16Array(liningIndices)});
  this.lining.visible=false;world.addChildAt(this.lining,world.getChildIndex(this.mesh));
  this.mask=new Graphics();world.addChild(this.mask);this.mask.visible=false;
 }
 draw(active,p,chain){
  this.mesh.visible=active;this.mask.visible=active;this.lining.visible=active;
  if(!active){this.main.mask=null;return;}
  const seam=SEAM.map(([y,x])=>armPoint(x,y,this.side));
  const points=this.side==='right'?[[0,0],[1122,0],[1122,1402],...seam.toReversed(),[0,930]]:[[0,0],[1122,0],[1122,930],...seam,[0,1402]];
  this.mask.clear().poly(points.flatMap(([x,y])=>skin(x,y,p))).fill(0xffffff);this.main.mask=this.mask;
  const parent=armFrame(p,this.side),rest=armChain(0),a=chain.upperAngle-rest.upperAngle,c=Math.cos(a),s=Math.sin(a),[sx,sy]=ARM.shoulder,v=this.mesh.vertices;
  for(let i=0;i<this.rest.length;i+=2){const x=this.rest[i],y=this.rest[i+1],base=skin(...armPoint(x,y,this.side),p),dx=x-sx,dy=y-sy;
   const moved=parent.point(sx+c*dx-s*dy,sy+s*dx+c*dy),neutral=parent.point(x,y),w=smooth((y-960)/210);
   v[i]=base[0]+w*(moved[0]-neutral[0]);v[i+1]=base[1]+w*(moved[1]-neutral[1]);
  }
  const lining=this.lining.vertices;this.joins=[];
  for(let r=0;r<SEAM.length;r++){
   const [y,x]=SEAM[r],body=skin(...armPoint(x+2,y,this.side),p),i=(r*9+8)*2,sleeve=[v[i],v[i+1]];
   // The sleeve end is copied from the final buffer, not recomputed with a
   // subtly different transform. The body end uses the exact mask mapping.
   lining.set(sleeve,r*4);lining.set(body,r*4+2);this.joins.push({body,sleeve});
  }
  this.lining.geometry.getBuffer('aPosition').update();
  this.mesh.geometry.getBuffer('aPosition').update();
 }
}
