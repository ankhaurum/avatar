import {applyApprovedAppearance} from './runtime/approved-appearance.mjs?approvedA=13';
import {MODEL_PATH,MOTION_PATH} from './model-source.mjs?approvedA=1';
import {compile,evaluate,point} from './runtime/evaluate.mjs?approvedA=7';
import {Renderer,loadImages} from './runtime/renderer.mjs?approvedA=3';
import {MotionController} from './runtime/motion-controller.mjs?approvedA=2';
import {AudioInput} from './runtime/audio-input.mjs';
import {solveArmAndShoulder} from './runtime/shoulder-solver.mjs';
const $=id=>document.getElementById(id),canvas=$('avatar'),overlay=$('interaction'),ctx=overlay.getContext('2d'),view=[-470,-40,1964,1610],audio=new AudioInput();
for(const element of document.querySelectorAll('aside input,aside select,aside button'))element.disabled=true;
let loadedModelSHA='',loadedMotionSHA='';
let camera='full',speechIntent='none',speechEvidence={frames:0,minMouth:1,maxMouth:0};
const resetSpeech=mode=>{speechIntent=mode;speechEvidence={frames:0,minMouth:1,maxMouth:0};};
function fitView(){const b=canvas.getBoundingClientRect(),ratio=b.width/b.height,box=camera==='face'?[290,0,470,540]:camera==='bust'?[-470,-20,1964,1280]:[-470,-40,1964,1610],w=Math.max(box[2],box[3]*ratio),h=w/ratio;view.splice(0,4,box[0]+(box[2]-w)/2,box[1]+(box[3]-h)/2,w,h);}
function cameraView(mode){camera=mode;document.querySelector('.stage').style.aspectRatio=mode==='bust'?'1964/1280':'2300/2200';}
$('fullView').onclick=()=>cameraView('full');$('bustView').onclick=()=>cameraView('bust');$('faceView').onclick=()=>cameraView('face');
let model,compiled,images,renderer,motion,controller,frame,last=0,raf=0,drag=null,disposed=false,ready=false,work=[],count=0;
const fail=e=>{$('error').textContent=e.message||String(e);if(!ready)$('status').textContent='制作素材の読込みを完了できませんでした。';console.error(e);};
audio.onError=message=>fail(new Error(message));
async function json(file){const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error('読込み失敗: '+file+' / '+r.status);const bytes=await r.arrayBuffer(),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(file===MODEL_PATH)loadedModelSHA=sha;if(file===MOTION_PATH)loadedMotionSHA=sha;return JSON.parse(new TextDecoder().decode(bytes));}
function overlayDraw(){if(overlay.width!==canvas.width)overlay.width=canvas.width;if(overlay.height!==canvas.height)overlay.height=canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,overlay.width,overlay.height);if(!$('hands').checked)return;ctx.setTransform(overlay.width/view[2],0,0,overlay.height/view[3],-view[0]*overlay.width/view[2],-view[1]*overlay.height/view[3]);ctx.lineWidth=7;ctx.strokeStyle='#a46213';ctx.fillStyle='#fff2cd';
 for(const [side,arm]of Object.entries(model.rig.arms)){const p=point(frame.matrices.get('wrist.'+side),...arm.wrist);ctx.beginPath();ctx.arc(p[0],p[1],23,0,Math.PI*2);ctx.fill();ctx.stroke();}}
function metrics(){const sorted=[...work].sort((a,b)=>a-b);return {model:MODEL_PATH,loadedModelSHA256:loadedModelSHA,loadedMotionSHA256:loadedMotionSHA,sourceManifest:model?.source.manifest,sourceManifestSha256:model?.source.sha256,frames:count,samples:work.length,meanWorkMs:work.reduce((a,b)=>a+b,0)/Math.max(1,work.length),p95WorkMs:sorted[Math.floor((sorted.length-1)*.95)]??0,canvas:[canvas.width,canvas.height],textures:images?.size??0,estimatedDecodedTextureBytes:model?.textures.reduce((n,t)=>n+t.width*t.height*4,0)??0,wardrobe:$('wardrobe').value,parameters:frame?.state,sourceArtwork:'d8e3a9c / hibiki-static-a.png',audioMode:audio.mode,peakMeasuredRms:audio.peak,speechIntent,speechEvidence,note:'CPU evaluation plus WebGL submission; not GPU completion or production performance. Decoded texture size is an estimate, not measured heap.'};}
function tick(now){raf=0;if(disposed||!ready||document.hidden)return;const start=performance.now(),dt=last?Math.min(.1,(now-last)/1000):1/60;last=now;
 try{const pose=controller.step(dt,{mode:audio.mode!=='none'?audio.mode:['local-audio','test-tone','silent'].includes(speechIntent)?'silent':'none',value:audio.value(dt)},$('animate').checked);frame=evaluate(compiled,pose,frame);wardrobe();if(audio.mode!=='none'){speechEvidence.frames++;speechEvidence.minMouth=Math.min(speechEvidence.minMouth,frame.state['mouth.open']);speechEvidence.maxMouth=Math.max(speechEvidence.maxMouth,frame.state['mouth.open']);}fitView();renderer.render(frame);overlayDraw();count++;work.push(performance.now()-start);if(work.length>240)work.shift();
 if(count%20===0){const labels={'silent':'音声停止・終了（無音）','none':'音声なし','synthetic':'疑似発話（音声なし）','local-audio':'ローカル音声の音量同期','test-tone':'合成テスト音の実測同期'};$('status').textContent=motion.states[controller.state].label+' / '+labels[controller.speechMode]+(Object.keys(controller.manual).length?' / 手動姿勢を保持':'');$('metrics').textContent=JSON.stringify(metrics(),null,2);}
 }catch(e){ready=false;fail(e);return;}
 raf=requestAnimationFrame(tick);
}
function start(){last=0;if(ready&&!raf&&!document.hidden)raf=requestAnimationFrame(tick);}
function coords(e){const b=overlay.getBoundingClientRect();return [view[0]+(e.clientX-b.left)/b.width*view[2],view[1]+(e.clientY-b.top)/b.height*view[3]];}
overlay.addEventListener('pointerdown',e=>{if(!$('hands').checked||!frame)return;const [x,y]=coords(e);for(const [side,arm]of Object.entries(model.rig.arms)){const p=point(frame.matrices.get('wrist.'+side),...arm.wrist);if(Math.hypot(p[0]-x,p[1]-y)<65){const elbow=frame.state['arm.'+side+'.elbow'];drag={side,bend:Math.abs(elbow)>.05?Math.sign(elbow):arm.bend};overlay.setPointerCapture(e.pointerId);return;}}});
overlay.addEventListener('pointermove',e=>{if(!drag)return;const side=drag.side,u='arm.'+side+'.upper',f='arm.'+side+'.elbow',s='shoulder.'+side+'.lift',a=compiled.params.get(u),b=compiled.params.get(f),c=compiled.params.get(s);const solved=solveArmAndShoulder({...model.rig.arms[side],bend:drag.bend},coords(e),frame.matrices.get('chest'),{upper:[a.min,a.max],elbow:[b.min,b.max],lift:[c.min,c.max],previousUpper:frame.state[u]},model.rig.shoulderResponse);controller.hold({[u]:solved.upper,[f]:solved.elbow,[s]:solved.lift});});
for(const event of ['pointerup','pointercancel','lostpointercapture'])overlay.addEventListener(event,()=>{drag=null;});
$('release').onclick=()=>controller.release();$('expression').onchange=e=>controller.setExpression(e.target.value);
$('audio').onchange=async e=>{const file=e.target.files[0];if(file)try{resetSpeech('local-audio');await audio.attach(file);$('error').textContent='';}catch(err){fail(err);}finally{e.target.value='';}};
$('tone').onclick=async()=>{try{resetSpeech('test-tone');await audio.tone();$('error').textContent='';}catch(e){fail(e);}};$('stopAudio').onclick=()=>{speechIntent='silent';audio.stop();};
$('saveMetrics').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(metrics(),null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='hibiki-v3-render-metrics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;audio.stop();}else start();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;cancelAnimationFrame(raf);raf=0;$('status').textContent='描画を復旧しています…';});
canvas.addEventListener('webglcontextrestored',()=>{try{renderer?.destroy();renderer=new Renderer(canvas,model,images);renderer.view=view;ready=true;start();}catch(e){fail(e);}});
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);renderer?.destroy();audio.dispose();});
try{[model,motion]=await Promise.all([json(MODEL_PATH),json(MOTION_PATH)]);compiled=compile(model);controller=new MotionController(model,motion);images=await loadImages(model,new URL(MODEL_PATH,location.href));renderer=new Renderer(canvas,model,images);renderer.view=view;
 for(const [id,state]of Object.entries(motion.states)){const button=document.createElement('button');button.textContent=state.label;button.setAttribute('aria-pressed',String(id==='idle'));button.onclick=()=>{controller.setState(id);if(id==='speaking'&&audio.mode==='none')speechIntent='synthetic';for(const b of $('states').children)b.setAttribute('aria-pressed',String(b===button));};$('states').append(button);}ready=true;start();
}catch(e){fail(e);}

// Wardrobe visibility uses independently exported PSD layers in the same rig.
function wardrobe(){applyApprovedAppearance(model,frame?.state,$('wardrobe').value);}
if(ready){
$('wardrobe').onchange=()=>wardrobe();
$('neutral').onclick=()=>{controller.resetToRest();$('expression').value='auto';$('animate').checked=false;for(const b of $('states').children)b.setAttribute('aria-pressed',String(b.textContent==='待機'));speechIntent='silent';audio.stop();};
$('parameter').replaceChildren(...model.parameters.map(p=>new Option(p.id,p.id)));
function parameter(){const p=compiled.params.get($('parameter').value);$('poseValue').min=p.min;$('poseValue').max=p.max;$('poseValue').step=.001;$('poseValue').value=frame?.state[p.id]??p.default;}
$('parameter').onchange=parameter;parameter();
$('poseValue').oninput=()=>{const id=$('parameter').value,p=compiled.params.get(id),v=Number($('poseValue').value);if(Number.isFinite(v))controller.hold({[id]:Math.max(p.min,Math.min(p.max,v))});};
$('saveFrame').onclick=()=>{renderer.render(frame);const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='hibiki-approved-a-'+controller.state+'-'+camera+'.png';link.click();};

for(const element of document.querySelectorAll('aside input,aside select,aside button'))element.disabled=false;$('status').textContent='待機 / 原画Aの素材を読込み済み';
}
