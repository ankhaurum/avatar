import {Application,Container,MeshSimple,Texture,Graphics} from './vendor/pixi.min.mjs';
import {authorMaterials,readMaterials,exportPSD,eyes,WIDTH,HEIGHT} from './materials.js';
import {buildSurface,bakeKeys,readRig,deformSurface,skin,aperture,boneRig,clamp,smooth} from './rig.js?v=body-20261022';
const $=s=>document.querySelector(s),stage=$('#stage');
const app=new Application();
await app.init({width:WIDTH,height:HEIGHT,resolution:Math.min(devicePixelRatio||1,1.5),autoDensity:true,antialias:true,backgroundAlpha:0,preference:'webgl',preserveDrawingBuffer:true,autoStart:false});
app.canvas.style.width='100%';app.canvas.style.height='100%';
stage.prepend(app.canvas);app.canvas.setAttribute('aria-label','響V3 連続メッシュの比較試作');
const world=new Container();app.stage.addChild(world);
const author=new URLSearchParams(location.search).has('author'),materials=await (author?authorMaterials():readMaterials()),surface=author?buildSurface():readRig(await fetch('materials/rig.json').then(r=>{if(!r.ok)throw Error('形状素材の読込に失敗しました');return r.json();}));
if(author)await import('./vendor/bundle.js');
if(author)bakeKeys(surface);
function makeMesh(texture,rest,uvs,indices,crop){
 if(crop){const [x,y,w,h]=crop,c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(texture,x,y,w,h,0,0,w,h);texture=c;uvs=uvs.map((v,i)=>(v*(i%2?HEIGHT:WIDTH)-(i%2?y:x))/(i%2?h:w));}
 const mesh=new MeshSimple({texture:Texture.from(texture),vertices:new Float32Array(rest),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)});mesh.autoUpdate=true;world.addChild(mesh);return mesh;
}
const rect=(x,y,w,h)=>[x,y,x+w,y,x+w,y+h,x,y+h],quadIndices=[0,1,2,0,2,3];
const cavityRest=rect(510,620,180,100),cavity=makeMesh(materials.cavity,cavityRest,cavityRest.map((v,i)=>v/(i%2?HEIGHT:WIDTH)),quadIndices,[510,620,180,100]);
const main=makeMesh(materials.base,surface.rest,surface.uvs,surface.indices);
const irises=eyes.map((e,i)=>{const rest=rect(e.cx-24,e.cy-24,48,48),mesh=makeMesh(materials.irises[i],rest,rest.map((v,j)=>v/(j%2?HEIGHT:WIDTH)),quadIndices,i?[657,445,47,47]:[474,451,47,47]),mask=new Graphics();world.addChild(mask);mesh.mask=mask;return {mesh,mask,rest};});
const closedCorrectives=eyes.map((e,i)=>{const ids=[];for(let j=0;j<surface.indices.length;j+=3){const tri=surface.indices.slice(j,j+3);if([...tri].some(k=>surface.rest[k*2]>e.x0-45&&surface.rest[k*2]<e.x1+45&&surface.rest[k*2+1]>410&&surface.rest[k*2+1]<545))ids.push(...tri);}return makeMesh(materials.closedEyes[i],surface.rest,surface.uvs,ids,[e.x0-20,428,e.x1-e.x0+40,93]);});
const wire=new Graphics();world.addChild(wire);
const initial={yaw:0,pitch:0,roll:0,smile:0,mouth:0,eye0:1,eye1:1,gazeX:0,gazeY:0,breath:0,body:0,hair:0};
let current={...initial},target={...initial},time=0,last=performance.now(),demo=false,fixed=false,blinkAt=-99,nextBlink=3.4,contactUntil=-1,pointer=null,velocity=0,oldYaw=0,drawCount=0,staticRendered=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');$('#static').checked=reduced.matches;
function blink(t){if(t<0||t>.3)return 0;if(t<.09)return Math.sin(t/.09*Math.PI/2);if(t<.12)return 1;return .5+.5*Math.cos((t-.12)/.18*Math.PI);}
function applyZoom(){const mode=$('#zoom').value,box=({full:[0,0,WIDTH,HEIGHT],neck:[300,625,550,450],face:[375,385,420,370],body:[195,820,740,580]})[mode];const s=Math.min(WIDTH/box[2],HEIGHT/box[3]);world.scale.set(s);world.position.set((WIDTH-box[2]*s)/2-box[0]*s,(HEIGHT-box[3]*s)/2-box[1]*s);}
function draw(p){
 const pos=deformSurface(surface,p);main.vertices.set(pos);main.geometry.getBuffer('aPosition').update();
 for(let j=0;j<8;j+=2)cavity.vertices.set(skin(cavityRest[j],cavityRest[j+1],p),j);cavity.geometry.getBuffer('aPosition').update();
 for(const [i,r]of irises.entries()){
  r.mesh.visible=p['eye'+i]>.1;
  for(let j=0;j<8;j+=2)r.mesh.vertices.set(skin(r.rest[j]+p.gazeX*5,r.rest[j+1]+p.gazeY*2.8,p),j);
  r.mesh.geometry.getBuffer('aPosition').update();r.mask.clear().poly(aperture(eyes[i],p['eye'+i],p)).fill(0xffffff);
  const corrective=closedCorrectives[i];corrective.alpha=1-smooth(.01,.18,p['eye'+i]);corrective.visible=corrective.alpha>.001;if(corrective.visible){corrective.vertices.set(pos);corrective.geometry.getBuffer('aPosition').update();}
 }
 wire.clear();if($('#wire').checked){for(let j=0;j<surface.indices.length;j+=3){const ids=surface.indices.slice(j,j+3);wire.moveTo(pos[ids[0]*2],pos[ids[0]*2+1]);for(let k=1;k<=3;k++)wire.lineTo(pos[ids[k%3]*2],pos[ids[k%3]*2+1]);}wire.stroke({color:0x2a7699,alpha:.32,width:.6});}
 applyZoom();app.renderer.render(app.stage);drawCount++;
}
function sample(t){
 return {yaw:Math.sin(t*.48)*.65,pitch:Math.sin(t*.32+.5)*.32,roll:Math.sin(t*.35)*.4,gazeX:Math.sin(t*.48+.12)*.6,gazeY:Math.sin(t*.32+.5)*.2,smile:.28+.2*Math.sin(t*.31),mouth:t%18>8&&t%18<14?Math.max(0,Math.sin(t*8))*.65:0,breath:Math.sin(t*1.18),body:Math.sin(t*.48-.32)*.42};
}
function frame(now){
 requestAnimationFrame(frame);if(fixed||document.hidden)return;
 const dt=Math.max(0,(now-last)/1000);last=now;if($('#static').checked){if(!staticRendered)draw(initial);staticRendered=true;return;}staticRendered=false;
 time+=dt;if(time>nextBlink){blinkAt=time;nextBlink=time+3.4+(Math.sin(time*2)+1)*1.3;}
 let p={...target};if(demo)p={...p,...sample(time)};
 if(!demo)p.body=(p.yaw||0)*.45;
 if($('#idle').checked||demo){p.breath=Math.sin(time*1.18);p.roll+=Math.sin(time*.6)*.08;}
 const b=blink(time-blinkAt);p.eye0=p.eye1=1-b;
 for(const name of Object.keys(initial)){const speed=name==='body'?2.2:name.startsWith('gaze')?14:name.startsWith('eye')?100:6;current[name]+=(p[name]-current[name])*(1-Math.exp(-speed*dt));}
 const headVelocity=(current.yaw-oldYaw)/Math.max(.001,dt);oldYaw=current.yaw;velocity+=(headVelocity*.28-velocity)*Math.min(1,dt*7);current.hair+=(velocity-current.hair)*Math.min(1,dt*4);
 if(contactUntil>=0&&time>contactUntil){target.yaw=target.pitch=target.gazeX=target.gazeY=0;contactUntil=-1;}
 draw(current);
}
for(const id of ['yaw','pitch','smile','mouth'])$('#'+id).oninput=e=>{fixed=false;demo=false;$('#demo').setAttribute('aria-pressed','false');target[id]=Number(e.target.value);};
$('#demo').onclick=()=>{fixed=false;demo=!demo;time=0;$('#demo').setAttribute('aria-pressed',String(demo));$('#demo').textContent=demo?'オートデモを停止':'オートデモ';};
$('#blink').onclick=()=>{fixed=false;blinkAt=time;};
$('#reset').onclick=()=>{fixed=false;demo=false;target={...initial};current={...initial};for(const id of ['yaw','pitch','smile','mouth'])$('#'+id).value=0;$('#demo').textContent='オートデモ';$('#demo').setAttribute('aria-pressed','false');};
$('#dark').onchange=e=>stage.classList.toggle('dark',e.target.checked);
function policy(){fixed=false;staticRendered=false;last=performance.now();for(const id of ['demo','blink'])$('#'+id).disabled=$('#static').checked;$('#status').textContent=$('#static').checked?'静止表示中':'連続メッシュで動作中 · 音声なし';}
$('#static').onchange=policy;reduced.addEventListener('change',e=>{$('#static').checked=e.matches;policy();});
for(const id of ['zoom','wire'])$('#'+id).onchange=()=>draw($('#static').checked?initial:current);
document.addEventListener('visibilitychange',()=>last=performance.now());
stage.addEventListener('pointerdown',e=>{if($('#static').checked)return;pointer=e.pointerId;stage.setPointerCapture(e.pointerId);contact(e);});
stage.addEventListener('pointermove',e=>{if(pointer===e.pointerId)contact(e);});for(const n of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(n,()=>pointer=null);
function contact(e){fixed=false;demo=false;$('#demo').setAttribute('aria-pressed','false');const r=stage.getBoundingClientRect();target.yaw=clamp((e.clientX-r.left)/r.width*2-1,-1,1);target.pitch=clamp((e.clientY-r.top)/r.height*2-1,-1,1)*.5;target.gazeX=target.yaw;target.gazeY=target.pitch;contactUntil=time+3.5;}
policy();
window.study={ready:true,materials,exportRig:()=>bakeKeys(surface),exportPSD:()=>{if(!author)throw Error('素材制作モードでのみPSDを書き出せます');return exportPSD(materials);},surface,boneRig,app,
 pose(p={}){fixed=true;current={...initial,...p};draw(current);return {...current};},
 animate(){fixed=false;last=performance.now();},
 demo(t){return this.pose({...sample(t),eye0:1-blink((t%4)-3),eye1:1-blink((t%4)-3)});},
 stats(){return {renderer:app.renderer.name,materialSource:author?'local authoring canvases':'saved PNG layers',materialTextureBytes:[main,cavity,...irises.map(r=>r.mesh),...closedCorrectives].reduce((n,m)=>n+m.texture.width*m.texture.height*4,0),vertices:surface.rest.length/2,triangles:surface.indices.length/3,drawCount,pose:{...current},static:$('#static').checked};}
};draw(initial);requestAnimationFrame(frame);
