import {presencePose,blinkInterval} from './presence.js?v=presence-20261022';
import {BUST_HIERARCHY,composeBustIntent,BustDynamics} from './bust-rig.js?v=presence-20261022';
import {Application,Container,MeshSimple,Texture,Graphics} from './vendor/pixi.min.mjs';
import {authorMaterials,readMaterials,exportPSD,eyes,WIDTH,HEIGHT} from './materials.js';
import {buildSurface,bakeKeys,readRig,deformSurface,skin,aperture,boneRig,clamp,smooth} from './rig.js?v=presence-20261022';
import {PerformanceController,STATES,emotionDemo} from './emotion.js?v=presence-20261022';
import {AudioDriver} from '../../engine.js?v=cage-4a';
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
const cheekCanvas=document.createElement('canvas');cheekCanvas.width=WIDTH;cheekCanvas.height=HEIGHT;
const cheekContext=cheekCanvas.getContext('2d');
for(const [x,y]of [[475,559],[709,550]]){const g=cheekContext.createRadialGradient(x,y,4,x,y,43);g.addColorStop(0,'rgba(210,72,94,.24)');g.addColorStop(.55,'rgba(210,72,94,.12)');g.addColorStop(1,'rgba(210,72,94,0)');cheekContext.fillStyle=g;cheekContext.fillRect(x-44,y-44,88,88);}
const cheekIds=[];for(let j=0;j<surface.indices.length;j+=3){const tri=surface.indices.slice(j,j+3);if([...tri].some(k=>surface.rest[k*2]>410&&surface.rest[k*2]<770&&surface.rest[k*2+1]>505&&surface.rest[k*2+1]<625))cheekIds.push(...tri);}
const cheekMesh=makeMesh(cheekCanvas,surface.rest,surface.uvs,cheekIds,[408,503,364,124]);
const wire=new Graphics();world.addChild(wire);
let greeting=null,greetingLoad=null,greetingError=null,greetingLoading=false,greetingRequest=0,gestureClock=0;
async function loadGreeting(){
 if(greeting)return greeting;
 if(!greetingLoad)greetingLoad=(async()=>{const {RightGreeting}=await import('./greeting.js?v=presence-20261022');const image=new Image();image.src='materials/right-greeting.png';await image.decode();return greeting=new RightGreeting({MeshSimple,Texture,world,image});})().catch(error=>{greetingLoad=null;throw error;});
 return greetingLoad;
}
async function startGreeting(){
 if($('#static').checked||greetingLoading||(greeting&&greeting.started!==null))return false;
 const request=++greetingRequest;fixed=false;greetingLoading=true;$('#greet').disabled=true;$('#greetingStatus').textContent='右手の素材を読み込み中…';
 try{const rig=await loadGreeting();if(request!==greetingRequest||$('#static').checked)return false;greetingError=null;return rig.play(gestureClock);}
 catch(error){if(request!==greetingRequest)return false;greetingError='挨拶素材を読み込めません。顔と身体の動作は継続します。';$('#greetingStatus').textContent=greetingError;$('#greet').disabled=false;return false;}
 finally{if(request===greetingRequest)greetingLoading=false;}
}
function stopGreeting(){greetingRequest++;greetingLoading=false;greeting?.stop();}
function greetingStatus(){
 if(greetingError)return;
 if(greetingLoading)return;
 const g=greeting?.pose;$('#greet').disabled=$('#static').checked||!!(greeting&&greeting.started!==null);
 $('#greetingStatus').textContent=g?.active?({raise:'右手をそっと差し出しています',wave:'右手で小さく挨拶',lower:'右手を元へ戻しています'})[g.phase]:'右手（画面左側）だけの挨拶 · 約6秒';
}
const initial={yaw:0,pitch:0,roll:0,smile:0,mouth:0,eye0:1,eye1:1,eyeSmile:0,gazeX:0,gazeY:0,breath:0,breathGain:1,body:0,hair:0,browRaise:0,browInner:0,browLower:0,cheek:0,frown:0,round:0,blush:0,shoulder:0,shoulderL:0,shoulderR:0,armLift:0,armUpper:0,scapulaL:0,scapulaR:0,postureX:0,postureY:0,postureRoll:0,hairY:0};
const controller=new PerformanceController(),audio=new AudioDriver(),bustDynamics=new BustDynamics();let demoBeat=-1,audioMessage=null;
let current={...initial},target={...initial},time=0,last=performance.now(),demo=false,fixed=false,blinkAt=-99,nextBlink=3.4,blinkCount=0,contactUntil=-1,pointer=null,rendered={...initial},drawCount=0,staticRendered=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');$('#static').checked=reduced.matches;
function blink(t){if(t<0||t>.3)return 0;if(t<.09)return Math.sin(t/.09*Math.PI/2);if(t<.12)return 1;return .5+.5*Math.cos((t-.12)/.18*Math.PI);}
function applyZoom(){const mode=$('#zoom').value,box=({full:[0,0,WIDTH,HEIGHT],neck:[300,625,550,450],face:[375,385,420,370],body:[195,820,740,580]})[mode];const s=Math.min(WIDTH/box[2],HEIGHT/box[3]);world.scale.set(s);world.position.set((WIDTH-box[2]*s)/2-box[0]*s,(HEIGHT-box[3]*s)/2-box[1]*s);}
function draw(p){
 rendered={...p};
 const pos=deformSurface(surface,p);main.vertices.set(pos);main.geometry.getBuffer('aPosition').update();
 cheekMesh.alpha=p.blush||0;cheekMesh.visible=cheekMesh.alpha>.001;if(cheekMesh.visible){cheekMesh.vertices.set(pos);cheekMesh.geometry.getBuffer('aPosition').update();}
 for(let j=0;j<8;j+=2)cavity.vertices.set(skin(cavityRest[j],cavityRest[j+1],p),j);cavity.geometry.getBuffer('aPosition').update();
 for(const [i,r]of irises.entries()){
  r.mesh.visible=p['eye'+i]>.1;
  for(let j=0;j<8;j+=2)r.mesh.vertices.set(skin(r.rest[j]+p.gazeX*5,r.rest[j+1]+p.gazeY*2.8,p),j);
  r.mesh.geometry.getBuffer('aPosition').update();r.mask.clear().poly(aperture(eyes[i],p['eye'+i],p)).fill(0xffffff);
  const corrective=closedCorrectives[i];corrective.alpha=1-smooth(.01,.18,p['eye'+i]);corrective.visible=corrective.alpha>.001;if(corrective.visible){corrective.vertices.set(pos);corrective.geometry.getBuffer('aPosition').update();}
 }
 wire.clear();if($('#wire').checked){for(let j=0;j<surface.indices.length;j+=3){const ids=surface.indices.slice(j,j+3);wire.moveTo(pos[ids[0]*2],pos[ids[0]*2+1]);for(let k=1;k<=3;k++)wire.lineTo(pos[ids[k%3]*2],pos[ids[k%3]*2+1]);}wire.stroke({color:0x2a7699,alpha:.32,width:.6});}
 greeting?.draw(p);
 applyZoom();app.renderer.render(app.stage);drawCount++;
}
function sample(t){
 const beat=emotionDemo(t),c=new PerformanceController(()=>t*1000);c.setEmotion(beat.emotion);c.speech=beat.speaking;
 return presencePose({...initial,...c.sample(t,blink((t%4)-3)),...beat.pose,body:(beat.pose.yaw||0)*.45},t,{demo:true});
}
function frame(now){
 requestAnimationFrame(frame);if(fixed||document.hidden)return;
 const dt=Math.max(0,(now-last)/1000);last=now;controller.tick();$('#state').value=controller.state;$('#phase').textContent=controller.state+' / '+controller.phase;$('#emotion').value=controller.emotion||'auto';if($('#static').checked){if(!staticRendered){current={...initial};draw(initial);}staticRendered=true;return;}staticRendered=false;
 time+=dt;gestureClock+=dt;greeting?.update(gestureClock);greetingStatus();if(time>nextBlink){blinkAt=time;nextBlink=time+blinkInterval(controller.state,blinkCount++);}
 if(demo){const beat=emotionDemo(time);if(beat.index!==demoBeat){demoBeat=beat.index;controller.setEmotion(beat.emotion);controller.speech=beat.speaking;if(beat.index===0)startGreeting();}$('#demoStatus').textContent=beat.label+' · 40秒で一巡';}
 const b=blink(time-blinkAt);let p={...initial,...target,...controller.sample(time,b,audio.value(dt),audio.playing)};
 p.eye0*=1-blink(time-winkAt);
 if(demo){const beat=emotionDemo(time);p={...p,...beat.pose};p.body=(p.yaw||0)*.45;}
 else if(controller.inputs.body===undefined)p.body=(p.yaw||0)*.45;
 if($('#idle').checked||demo)p=presencePose(p,time,{state:controller.state,inputs:controller.inputs,demo});
 p=composeBustIntent(p,greeting?.pose);
 for(const name of Object.keys(initial)){const speed=name==='body'?2.2:name.startsWith('gaze')?14:(name==='eye0'||name==='eye1')?100:6;current[name]+=(p[name]-current[name])*(1-Math.exp(-speed*dt));}

 if(contactUntil>=0&&time>contactUntil){for(const k of ['yaw','pitch','gazeX','gazeY'])delete controller.inputs[k];contactUntil=-1;}
 $('#state').value=controller.state;$('#phase').textContent=controller.state+' / '+controller.phase;
 $('#audioStatus').textContent=audioMessage??(audio.playing?(audio.mode==='test-tone'?'テスト音量で同期中':'端末内の音声で同期中'):'音声なし · 発話状態では疑似口パク');
 draw(bustDynamics.apply(current,dt));
}
function stopDemo(){demo=false;demoBeat=-1;$('#demo').setAttribute('aria-pressed','false');$('#demo').textContent='オートデモ';$('#demoStatus').textContent='感情・発話・身体を組み合わせて再生';}
for(const id of ['yaw','pitch','smile','mouth'])$('#'+id).oninput=e=>{fixed=false;stopDemo();controller.setPose({[id]:Number(e.target.value)});};
$('#demo').onclick=()=>{fixed=false;if(demo){stopDemo();stopGreeting();controller.reset();}else{controller.reset();audio.stop();demo=true;demoBeat=-1;time=0;$('#demo').setAttribute('aria-pressed','true');$('#demo').textContent='オートデモを停止';}};
$('#blink').onclick=()=>{fixed=false;blinkAt=time;};
$('#greet').onclick=()=>startGreeting();
$('#reset').onclick=()=>{fixed=false;stopDemo();controller.reset();audio.stop();stopGreeting();bustDynamics.reset();greetingError=null;target={...initial};for(const id of ['yaw','pitch','smile','mouth'])$('#'+id).value=0;$('#emotion').value='auto';};
$('#dark').onchange=e=>stage.classList.toggle('dark',e.target.checked);
function policy(){fixed=false;staticRendered=false;last=performance.now();if($('#static').checked){audio.stop();stopGreeting();bustDynamics.reset();}for(const id of ['demo','blink','tone','chooseAudio','greet'])$('#'+id).disabled=$('#static').checked;$('#status').textContent=$('#static').checked?'静止表示中':'連続メッシュ · 感情と発話を独立制御';}
$('#static').onchange=policy;reduced.addEventListener('change',e=>{$('#static').checked=e.matches;policy();});
for(const id of ['zoom','wire'])$('#'+id).onchange=()=>draw($('#static').checked?initial:current);
document.addEventListener('visibilitychange',()=>{last=performance.now();bustDynamics.reset();});
stage.addEventListener('pointerdown',e=>{if($('#static').checked)return;pointer=e.pointerId;stage.setPointerCapture(e.pointerId);contact(e);});
stage.addEventListener('pointermove',e=>{if(pointer===e.pointerId)contact(e);});for(const n of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(n,()=>pointer=null);
function contact(e){fixed=false;stopDemo();const r=stage.getBoundingClientRect(),yaw=clamp((e.clientX-r.left)/r.width*2-1,-1,1),pitch=clamp((e.clientY-r.top)/r.height*2-1,-1,1)*.5;controller.setPose({yaw,pitch,gazeX:yaw,gazeY:pitch});contactUntil=time+3.5;}
function activate(){fixed=false;if(demo){controller.setEmotion('auto');controller.speech=null;}stopDemo();last=performance.now();}
$('#state').onchange=e=>{activate();controller.setState(e.target.value,{duration:0,calm:false});};
$('#emotion').onchange=e=>{activate();controller.setEmotion(e.target.value);};
$('#tone').onclick=async()=>{activate();audioMessage=null;try{await audio.tone();}catch(e){audioMessage='音声を開始できません: '+e.message;}};
$('#chooseAudio').onclick=()=>$('#audioFile').click();
$('#audioFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;activate();audioMessage=null;try{await audio.attach(file);}catch(error){audio.stop();audioMessage='音声を開始できません: '+error.message;}e.target.value='';};
$('#stopAudio').onclick=()=>{audio.stop();audioMessage=null;};
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.stop();});
window.addEventListener('pagehide',()=>audio.dispose(),{once:true});
const api={states:[...STATES],setState(state,options){activate();return controller.setState(state,options);},setInputs(input){activate();return controller.setInputs(input);},setPose(input){activate();return controller.setPose(input);},setEmotion(name,intensity){activate();return controller.setEmotion(name,intensity);},setExpression(name){return this.setEmotion(name);},setVolume(value){return controller.setVolume(value);},blink(){fixed=false;blinkAt=time;},wink(){fixed=false;winkAt=time;},async setWardrobe(id){if(id!=='suit')throw Error('共有表面に対応する衣装はsuitのみです');return id;},snapshot(){return {...controller.snapshot(),ready:true,pose:{...rendered},wardrobe:'suit',supportedWardrobes:['suit'],audioMode:audio.mode,audioPlaying:audio.playing,peakEnvelope:audio.peakEnvelope,frames:drawCount,staticMode:$('#static').checked};}};
let winkAt=-99;
window.hibikiV3=api;
api.greet=startGreeting;api.stopGesture=stopGreeting;api.setGesture=name=>name==='right-greeting'?startGreeting():Promise.resolve(false);
const baseSnapshot=api.snapshot;api.snapshot=()=>({...baseSnapshot(),gesture:greeting?.stats()||{loaded:false,active:false,error:greetingError}});
window.addEventListener('aifate:companion-state',e=>api.setState(e.detail?.state,e.detail?.options));
policy();
window.study={ready:true,materials,exportRig:()=>bakeKeys(surface),exportPSD:()=>{if(!author)throw Error('素材制作モードでのみPSDを書き出せます');return exportPSD(materials);},surface,boneRig,hierarchy:BUST_HIERARCHY,app,
 async previewGreeting(seconds,p={}){const rig=await loadGreeting();fixed=true;rig.preview(seconds);current=composeBustIntent({...initial,...p},rig.pose);draw(current);return rig.stats();},
 pose(p={}){fixed=true;current={...initial,...p};draw(current);return {...current};},
 animate(){fixed=false;last=performance.now();},
 demo(t){return this.pose({...sample(t),eye0:1-blink((t%4)-3),eye1:1-blink((t%4)-3)});},
 stats(){return {rigVersion:'presence-20261022',hierarchy:BUST_HIERARCHY,renderer:app.renderer.name,materialSource:author?'local authoring canvases':'saved PNG layers',materialTextureBytes:[main,cavity,cheekMesh,...irises.map(r=>r.mesh),...closedCorrectives].reduce((n,m)=>n+m.texture.width*m.texture.height*4,0)+(greeting?.stats().textureBytes||0),vertices:surface.rest.length/2,triangles:surface.indices.length/3,drawCount,pose:{...rendered},performance:controller.snapshot(),gesture:greeting?.stats()||{active:false,loaded:false,error:greetingError},static:$('#static').checked};}
};draw(initial);requestAnimationFrame(frame);
