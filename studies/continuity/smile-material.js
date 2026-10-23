import {createSkin,clamp,smooth} from './rig.js?v=hand-cage-20261023';
import {expressionWeights} from './shape-constraints.js';
// Landmarks traced on the registered smile material, not an equal-tooth template.
const upper=[[514,638],[530,640],[550,642],[575,642],[594,642],[615,640],[638,636],[659,631],[674,627]];
const lower=[[514,638],[530,648],[550,656],[575,661],[594,662],[615,659],[638,651],[659,639],[674,627]];
function at(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}return points.at(-1)[1];}
export const smileBounds=x=>[at(upper,x),at(lower,x)];
const xs=Array.from({length:53},(_,i)=>490+i*4),bands=[0,1,2,3,4,5];
export async function makeSmileMaterial({MeshSimple,Texture,Graphics,world}){
 const image=new Image();image.src='materials/smile-local.png?v=hand-cage-20261023';await image.decode();
 const rest=[],uv=[],indices=[];
 for(const band of bands)for(const x of xs){const [a,b]=smileBounds(x),y=[600,615,a,b,689,720][band];rest.push(x,y);uv.push((x-490)/208,(y-600+(band===2?-1.4:band===3?1.4:0))/120);}
 for(let row=0;row<5;row++)for(let j=0;j<52;j++){if(row===2&&xs[j]>=514&&xs[j+1]<=674)continue;const i=row*53+j;indices.push(i,i+53,i+1,i+1,i+53,i+54);}
 const texture=Texture.from(image),interior=new MeshSimple({texture,vertices:new Float32Array([490,600,698,600,698,720,490,720]),uvs:new Float32Array([0,0,1,0,1,1,0,1]),indices:new Uint16Array([0,1,2,0,2,3])});
 const lips=new MeshSimple({texture,vertices:new Float32Array(rest),uvs:new Float32Array(uv),indices:new Uint16Array(indices)}),mask=new Graphics();
 world.addChild(interior,mask,lips);interior.mask=mask;
 return {textureBytes:image.width*image.height*4,draw(p){
  const weights=expressionWeights(p),alpha=smooth(.04,.18,weights.smile);lips.alpha=interior.alpha=alpha;lips.visible=interior.visible=alpha>.001;if(alpha<=.001)return;
  const project=createSkin(p),open=clamp((p.mouth||0)/.72),vertices=lips.vertices;interior.visible=open>.025;
  // Spoken rounding narrows the lips and their aperture together. The dental
  // arch stays on the upper jaw instead of stretching each tooth with the lips.
  // The registered resting smile is unchanged (round=0, frown=0).
  const lipPoint=(x,y)=>{
   const support=smooth(600,630,y)*(1-smooth(685,720,y));
   const edge=1-smooth(74,104,Math.abs(x-594));
   const corner=Math.sin(Math.PI*clamp((x-490)/208));
   return project(x-(x-594)*weights.round*.23*support*edge,y+weights.frown*2.5*corner*support);
  };
  const bounds=x=>{const [a,b]=smileBounds(x),contact=a+(b-a)*.28;return [contact+(a-contact)*open,contact+(b-contact)*open];};
  for(let i=0;i<rest.length;i+=2){const x=rest[i],y=rest[i+1],[a,b]=smileBounds(x),[ta,tb]=bounds(x);let yy=y;
   if(y<=a)yy=y+(ta-a)*smooth(600,a,y);else if(y>=b)yy=y+(tb-b)*(1-smooth(b,720,y));
   vertices.set(lipPoint(x,yy),i);
  }
  lips.geometry.getBuffer('aPosition').update();
  const quad=[490,600,698,600,698,720,490,720];for(let i=0;i<8;i+=2)interior.vertices.set(project(quad[i],quad[i+1]),i);interior.geometry.getBuffer('aPosition').update();
  const points=[];for(let x=514;x<=674;x+=4)points.push(...lipPoint(x,bounds(x)[0]));for(let x=674;x>=514;x-=4)points.push(...lipPoint(x,bounds(x)[1]));mask.clear().poly(points).fill(0xffffff);
 }};
}
