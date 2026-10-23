import {BUST_HIERARCHY,chestFrame,thoraxOffset} from './bust-rig.js?v=arm-socket-20261023';
import {eyes,eyeBounds,seam,WIDTH,HEIGHT} from './materials.js';
import {expressionWeights} from './shape-constraints.js';
import {hairOffset} from './hair-motion.js';
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
// Piecewise shape profiles are explicit authoring landmarks, separate from bone skinning.
function profile(y,points){if(y<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(y<=points[i][0])return lerp(points[i-1][1],points[i][1],(y-points[i-1][0])/(points[i][0]-points[i-1][0]));return points.at(-1)[1];}
export const boneRig={version:'bust-coordinated-1',hierarchy:BUST_HIERARCHY,bones:[{id:'chest',parent:null,pivot:[583,1150]},{id:'neck',parent:'chest',pivot:[583,930]},{id:'head',parent:'neck',pivot:[583,790]}],motionScope:'small frontal poses',materialSlots:['approved-suit-surface','eye-left','eye-right','mouth-interior'],join:'shared vertices across head neck collar; no feathered alpha seams'};
export function buildSurface(){
 const xs=[...new Set([0,WIDTH,...Array.from({length:58},(_,i)=>i*20),...Array.from({length:31},(_,i)=>420+i*12),522,666,...eyes.flatMap(e=>[e.x0,e.x1,e.cx])].filter(x=>x<=WIDTH))].sort((a,b)=>a-b);
 const ys=[...new Set([0,HEIGHT,...Array.from({length:48},(_,i)=>i*30),...Array.from({length:21},(_,i)=>420+i*5),...Array.from({length:15},(_,i)=>600+i*8),...Array.from({length:18},(_,i)=>740+i*12)].filter(y=>y<640||y>660))].sort((a,b)=>a-b);
 const eyeBands=[0,.25,.5,.75,1].map(t=>({eye:t}));
 const bands=[...ys.filter(y=>y<450),...eyeBands,...ys.filter(y=>y>500&&y<640),{lip:-1},{lip:1},...ys.filter(y=>y>660)],rest=[],indices=[],topIndex=bands.findIndex(x=>x.lip===-1);
 for(const band of bands)for(const x of xs){
  const w=clamp(Math.sin(Math.PI*clamp((x-522)/144)));let y;
  if(typeof band==='number')y=band;
  else if('lip' in band)y=seam(x)+band.lip*.45*w;
  else {y=450+band.eye*50;for(const e of eyes)if(x>=e.x0-12&&x<=e.x1+12){const [a,b]=eyeBounds(x,e),weight=smooth(e.x0-12,e.x0,x)*(1-smooth(e.x1,e.x1+12,x));y=lerp(y,lerp(a,b,band.eye),weight);}}
  rest.push(x,y);
 }
 for(let j=0;j<bands.length-1;j++)for(let i=0;i<xs.length-1;i++){
  if(j===topIndex&&xs[i]>=522&&xs[i+1]<=666)continue;
  const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;indices.push(a,c,b,b,c,d);
 }
 return {rest:new Float32Array(rest),indices:new Uint32Array(indices),uvs:new Float32Array(rest.map((x,i)=>x/(i%2?HEIGHT:WIDTH))),xs,bands,topIndex};
}
export function localShape(x,y,p){
 let yy=y,xx=x;
 for(const [i,e]of eyes.entries())if(x>=e.x0-12&&x<=e.x1+12&&y>425&&y<530){
  const edge=smooth(e.x0-12,e.x0+3,x)*(1-smooth(e.x1-3,e.x1+12,x));
  const [a,b]=eyeBounds(x,e),[ca,cb]=eyeBounds(x,e,Math.max(.005,p['eye'+i]??1));
  yy+=edge*(profile(y,[[425,425],[a,ca],[b,cb],[530,530]])-y);
 }
 const tx=clamp((x-522)/144),w=Math.sin(Math.PI*tx),s=seam(x);
 if(x>=505&&x<=683&&y>605&&y<730){
  const weights=expressionWeights(p),corner=Math.pow(Math.cos(Math.PI*.5*clamp(Math.abs(Math.abs(x-594)-49)/35)),2),smile=weights.smile,o=weights.open;
  // Paired lip contours: the opening flattens before the commissure rather
  // than pulling the contact point into a sharp triangular slit.
  const aperture=Math.pow(w,1.65),upper=.45*w*(1-o)-2.8*o*aperture,lower=-.45*w*(1-o)+(16-1.5*smile)*o*aperture;
  yy+=profile(y,[[605,0],[s-.45*w,upper],[s+.45*w,lower],[730,0]]);
  yy-=smile*2.4*corner*(1-smooth(14,55,Math.abs(y-s)));
  xx+=(x-594)*smile*.006*(1-smooth(12,60,Math.abs(y-s)));
 }
 // Small coupled expression, no global Gaussian warp or artificial face-depth sphere.
 if(y>390&&y<445&&x>420&&x<770)yy-=.8*(p.smile||0)*Math.sin(Math.PI*clamp((y-390)/55));
 const extra=expressionShape(x,y,p);xx+=extra[0];yy+=extra[1];
 return [xx,yy];
}
// Authored local keyforms, anchored at each feature boundary. No whole-face warp.
export const expressionKeys=['browRaise','browInner','browLower','cheek','frown','round'];
export function expressionShape(x,y,p){
 const weights=expressionWeights(p);p={...p,frown:weights.frown,round:weights.round};
 let dx=0,dy=0;
 for(const [i,e]of eyes.entries()){
  const tx=clamp((x-(e.x0-12))/(e.x1-e.x0+24)),side=Math.sin(Math.PI*tx);
  const browY=i?407:413,vertical=profile(y,[[browY-38,0],[browY-8,1],[browY+6,1],[browY+40,0]]);
  const inner=i?1-tx:tx;
  dy+=side*vertical*(-7*(p.browRaise||0)-9*inner*inner*(p.browInner||0)+5*inner*(p.browLower||0));
  const cx=i?704:479,cheekX=profile(x,[[cx-65,0],[cx-20,1],[cx+20,1],[cx+65,0]]);
  const cheekY=profile(y,[[505,0],[548,1],[587,.65],[625,0]]);
  dy-=4.5*(p.cheek||0)*cheekX*cheekY;
 }
 const s=seam(x),lipY=1-smooth(10,50,Math.abs(y-s));
 const corner=Math.pow(Math.cos(Math.PI*.5*clamp(Math.abs(Math.abs(x-594)-49)/35)),2);
 if(x>505&&x<683){
  // A separately authored downturned contact curve, preserving the surrounding lip volume.
  const worried=profile(x,[[505,seam(505)],[522,654],[550,650],[594,646],[638,647],[666,650],[683,seam(683)]]);
  const support=profile(y,[[605,0],[s-10,.8],[s,1],[s+16,.9],[730,0]]);
  dy+=(p.frown||0)*(worried-s)*support;
 }
 dy-=(p.cheek||0)*4*corner*lipY;
 dx+=(x<594?-1:1)*(p.cheek||0)*2.5*corner*lipY;
 const roundY=profile(y,[[605,0],[s-2,.5],[s+10,1],[710,0]]);
 const mouthX=1-smooth(65,95,Math.abs(x-594));
 dx-=(x-594)*(p.round||0)*.32*roundY*mouthX;
 // Rounding changes lip width; opening belongs exclusively to the mouth channel.
 // An independent vertical round offset kept surprised/rounded mouths open at mouth=0.
 return [dx,dy];
}
// Authored smile key: lift the lower lid while preserving alert upper lids.
// The same contour correction drives both skin vertices and the iris aperture.
export function smileEyeDelta(x,y,p){
 if(!p.eyeSmile||y<425||y>530)return 0;
 let delta=0;
 for(const [i,e]of eyes.entries())if(x>=e.x0&&x<=e.x1){const [a,b]=eyeBounds(x,e,1),edge=Math.sin(Math.PI*clamp((x-e.x0)/(e.x1-e.x0)));delta+=profile(y,[[425,0],[a,-.6],[b,-4],[530,0]])*edge*clamp(p.eyeSmile)*clamp(p['eye'+i]??1);}
 return delta;
}
export function createSkin(p){
 const root=chestFrame(p);
 const headA=(p.roll||0)*.027+(p.yaw||0)*.013,neckA=(p.yaw||0)*.008;
 const transform=(cx,cy,a,tx=0,ty=0)=>{const c=Math.cos(a),s=Math.sin(a);return (x,y)=>[cx+(x-cx)*c-(y-cy)*s+tx,cy+(x-cx)*s+(y-cy)*c+ty];};
 const bodyTransform=root.point,neckTransform=transform(...BUST_HIERARCHY.neck.pivot,neckA),headTransform=transform(...BUST_HIERARCHY.head.pivot,headA,(p.yaw||0)*3.5,(p.pitch||0)*3);
 return (x,y)=>{
 const headWeight=1-smooth(770,965,y),neckWeight=(1-smooth(875,1000,y))*(1-headWeight);
 const body=bodyTransform(x,y),neck=bodyTransform(...neckTransform(x,y));
 const head=bodyTransform(...neckTransform(...headTransform(x,y)));
 let px=body[0]+neckWeight*(neck[0]-body[0])+headWeight*(head[0]-body[0]);
 let py=body[1]+neckWeight*(neck[1]-body[1])+headWeight*(head[1]-body[1]);
 // Continuous thoracic breathing: shoulders rise, ribcage widens, waist stays put.
 // These fields act on the shared surface, including collar and suit, not separate cutouts.
 const thorax=root.vector(...thoraxOffset(x,y,p));px+=thorax[0];py+=thorax[1];
 const pinned=1-smooth(1190,1402,y);px=x+(px-x)*pinned;py=y+(py-y)*pinned;
 const hairA=root.angle+headA+neckA,[hx,hy]=hairOffset(x,y,p);
 px+=Math.cos(hairA)*hx-Math.sin(hairA)*hy;py+=Math.sin(hairA)*hx+Math.cos(hairA)*hy;
 // The source surface includes the sleeve seam, axilla and chest in one image.
 // A rectangular arm weight rotates torso pixels and stretches that seam.
 // Keep this surface on chest/scapular support; articulated rotation belongs
 // to the independent arm mesh. Breathing and shoulder support above remain.
 return [px,py];
 };
}
export function skin(x,y,p){return createSkin(p)(x,y);}
export function bakeKeys(surface){
 const poses={neutral:{},mouthOpen:{mouth:1},smile:{smile:1},smileOpen:{mouth:1,smile:1},blinkLeft:{eye0:0},blinkRight:{eye1:0},...Object.fromEntries(expressionKeys.map(k=>[k,{[k]:1}]))};
 surface.keys=Object.fromEntries(Object.entries(poses).map(([name,p])=>[name,Array.from(surface.rest,(_,i)=>localShape(surface.rest[i-i%2],surface.rest[i-i%2+1],p)[i%2])]));
 return {version:'hibiki-continuity-keyforms-1',width:WIDTH,height:HEIGHT,bones:boneRig,rest:Array.from(surface.rest),indices:Array.from(surface.indices),uvs:Array.from(surface.uvs),keys:surface.keys,shapeAuthoring:'source-aligned eyelid contours and lip contact boundary; bilinear smile/open corners; no Cubism data'};
}
export function readRig(data){return {...data,rest:new Float32Array(data.rest),indices:new Uint32Array(data.indices),uvs:new Float32Array(data.uvs)};}
export function deformSurface(surface,p){
 const out=new Float32Array(surface.rest.length),keys=surface.keys,weights=expressionWeights(p),m=weights.open,s=weights.smile,bl=1-clamp(p.eye0??1),br=1-clamp(p.eye1??1),project=createSkin(p);
 for(let i=0;i<out.length;i+=2){
  const q=[0,1].map(c=>{const k=i+c;if(!keys)return localShape(surface.rest[i],surface.rest[i+1],p)[c];let v=lerp(lerp(keys.neutral[k],keys.mouthOpen[k],m),lerp(keys.smile[k],keys.smileOpen[k],m),s)+bl*(keys.blinkLeft[k]-keys.neutral[k])+br*(keys.blinkRight[k]-keys.neutral[k]);for(const name of expressionKeys)if(keys[name]&&p[name])v+=(name==='round'?weights.round:name==='frown'?weights.frown:clamp(p[name]))*(keys[name][k]-keys.neutral[k]);return v;});
  q[1]+=smileEyeDelta(surface.rest[i],surface.rest[i+1],p);out.set(project(...q),i);
 }return out;
}
export function aperture(e,open,p){const points=[],smile=clamp(p.eyeSmile||0)*clamp(open);for(let j=0;j<=24;j++){const x=e.x0+(e.x1-e.x0)*j/24,w=Math.sin(Math.PI*j/24);points.push(...skin(x,eyeBounds(x,e,Math.max(.005,open))[0]+2*open-.6*smile*w,p));}for(let j=24;j>=0;j--){const x=e.x0+(e.x1-e.x0)*j/24,w=Math.sin(Math.PI*j/24);points.push(...skin(x,eyeBounds(x,e,Math.max(.005,open))[1]-.5*open-4*smile*w,p));}return points;}
