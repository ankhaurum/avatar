import {Renderer,Spring,AudioDriver,clamp,mix,smooth} from './engine.js';
const $=s=>document.querySelector(s);
const rig=await fetch('rig.json').then(r=>{if(!r.ok)throw Error('rig read failed');return r.json();});
const commonParts=rig.parts;
const wardrobePacks=await Promise.all(rig.wardrobe.packs.map(async entry=>{const pack=await fetch(entry.url).then(r=>r.json());if(pack.rigVersion!==rig.wardrobe.rigVersion)throw Error('衣装リグ版が一致しません');return pack;}));
rig.parts=[...commonParts,...wardrobePacks.find(p=>p.id===rig.wardrobe.default).parts].sort((a,b)=>a.order-b.order);
const controls=await fetch('controls.json').then(r=>r.json());
rig.deformationKeys=controls;
const audio=new AudioDriver();
const ids=['yaw','pitch','roll','gazeX','gazeY','mouth','shoulderL','shoulderR','intensity'];
const values=Object.fromEntries(ids.map(id=>[id,Number($('#'+id).value)]));
const springs=Object.fromEntries(['yaw','pitch','roll','gazeX','gazeY','brow','browTilt','smile','squint','shoulderL','shoulderR','mouth','leanX'].map(n=>{const k=controls.spring[n.startsWith('gaze')?'gaze':'head'];return [n,new Spring(0,k.frequency,k.damping)];}));
springs.hair=new Spring(0,controls.spring.hair.frequency,controls.spring.hair.damping);
let renderer,ready=false,raf=0,last=performance.now(),time=0,nextBlink=3.2,blinkAt=-100,winkAt=-100,demoAt=null,expression='neutral',state='idle',phase='normal',transition=0,phaseTimer=0,wardrobe='suit',disposed=false;
let pose={},renderError=null,frameTimes=[],lastMetric=0;
let audioMessage=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function staticMode(){return $('#static').checked||reduced.matches||!renderer||renderer.lost;}
function schedule(){if(!raf&&!document.hidden&&!disposed&&!staticMode())raf=requestAnimationFrame(frame);}
function policy(){
 if(document.hidden||staticMode()){cancelAnimationFrame(raf);raf=0;if(document.hidden)audio.stop();}
 $('#poster').hidden=!staticMode();$('#avatar').hidden=staticMode();
 $('#motionStatus').textContent=staticMode()?'静止表示':'独立メッシュ · 動作中';
 last=performance.now();nextBlink=time+2.5;policyLabel();schedule();
}
function policyLabel(){$('#stageLabel').textContent='スーツ · '+(Math.abs(values.yaw)<.15?'正面':values.yaw>0?'画面右向き':'画面左向き');}
function setValue(id,v){const el=$('#'+id);values[id]=clamp(Number(v),Number(el.min),Number(el.max));el.value=values[id];document.querySelector('output[for="'+id+'"]').value=values[id].toFixed(2);policyLabel();}
for(const id of ids)$('#'+id).addEventListener('input',e=>{setValue(id,e.target.value);});
function selectExpression(v){if(!Object.hasOwn(controls.expressions,v))return false;expression=v;$('#expression').value=v;return true;}
$('#expression').addEventListener('change',e=>selectExpression(e.target.value));
function setState(next,options={}){
 if(!Object.hasOwn(controls.compatibility,next))return false;
 clearTimeout(transition);clearTimeout(phaseTimer);state=next;phase=options.phase||'normal';$('#state').value=state;
 selectExpression(controls.compatibility[state]);
 if(state==='wake')blinkAt=time-.28;
 const duration=options.duration??({attention:920,happy:1100,notify:1500,error:2300,wake:760}[state]||0);
 if(duration>0)transition=setTimeout(()=>setState(options.next||'idle'),duration);
 if(state==='speaking'&&options.calm!==false)phaseTimer=setTimeout(()=>{phase='calm';transition=setTimeout(()=>setState('happy'),3200);},1800);
 return true;
}
$('#state').addEventListener('change',e=>setState(e.target.value,{duration:0,calm:false}));
$('#placement').addEventListener('click',e=>{const b=e.target.closest('[data-placement]');if(!b)return;$('#placement').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));setValue('yaw',({left:.65,center:0,right:-.65})[b.dataset.placement]);});
$('#blink').onclick=()=>{blinkAt=time;};
$('#wink').onclick=()=>{winkAt=time;};
$('#demo').onclick=()=>{demoAt=demoAt===null?time:null;$('#demo').textContent=demoAt===null?'複合動作デモ':'デモを停止';};
$('#reset').onclick=()=>{for(const id of ids)if(id!=='intensity')setValue(id,0);demoAt=null;$('#demo').textContent='複合動作デモ';setState('idle');$('#pointer').checked=false;$('#placement').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x.dataset.placement==='center'));};
$('#static').onchange=policy;
$('#background').onchange=e=>$('#stage').classList.toggle('dark',e.target.checked);
$('#avatar').addEventListener('pointermove',e=>{if(!$('#pointer').checked)return;const r=e.target.getBoundingClientRect();setValue('gazeX',((e.clientX-r.left)/r.width-.5)*2);setValue('gazeY',((e.clientY-r.top)/r.height-.5)*2);});
$('#avatar').addEventListener('pointerleave',()=>{if($('#pointer').checked){setValue('gazeX',0);setValue('gazeY',0);}});
$('#tone').onclick=async()=>{audioMessage='音声を準備中';try{await audio.tone();audioMessage=null;}catch(e){audioMessage='音声を開始できません: '+e.message;}};
$('#audioFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;audioMessage='音声を準備中';try{await audio.attach(file);audioMessage=null;}catch(err){audio.stop();audioMessage='音声を開始できません: '+err.message;}e.target.value='';};
$('#chooseAudio').onclick=()=>$('#audioFile').click();
$('#stopAudio').onclick=()=>{audio.stop();audioMessage=null;};
async function setWardrobe(id){
 const pack=wardrobePacks.find(p=>p.id===id);
 if(!pack||pack.rigVersion!==rig.wardrobe.rigVersion)throw Error('対応する衣装パックがありません');
 if(id!==wardrobe){const replacement={...rig,parts:[...commonParts,...pack.parts].sort((a,b)=>a.order-b.order)};const fresh=new Renderer($('#avatar'),replacement);await fresh.load();renderer?.dispose();renderer=fresh;rig.parts=replacement.parts;}
 wardrobe=id;return wardrobe;
}
$('#wardrobe').onchange=e=>setWardrobe(e.target.value).catch(e=>{renderError=e.message;});
function blinkCurve(age){
 if(age<0||age>.33)return 0;
 if(age<.11)return smooth(0,.11,age);
 if(age<.17)return 1;return 1-smooth(.17,.33,age);
}
function frame(now){
 raf=0;if(document.hidden||staticMode()||disposed)return;
 const dt=clamp((now-last)/1000,0,.04);last=now;time+=dt;
 if(time>nextBlink){blinkAt=time;nextBlink=time+3.4+Math.random()*2.8;}
 const d=demoAt===null?null:time-demoAt;
 const settings=controls.expressions[expression]||{};
 const strength=values.intensity;
 const breathe=$('#breathing').checked;
 const breath=breathe?Math.sin(time*Math.PI*2/5.3):0;
 const demoYaw=d===null?0:Math.sin(d*.55)*.55;
 const motion=d===null?0:Math.sin(d*.9);
 const target={
 yaw:clamp(values.yaw+demoYaw),
 pitch:clamp(values.pitch+(d===null?0:Math.sin(d*.73)*.25)),
 roll:clamp(values.roll+(d===null?0:Math.sin(d*.44)*.2)),
 gazeX:clamp(values.gazeX+(d===null?0:Math.sin(d*1.2)*.65)),
 gazeY:clamp(values.gazeY+(d===null?0:Math.cos(d*.8)*.28)),
 brow:(settings.brow||0)*strength,
 browTilt:(expression==='concern'||expression==='sadness'?-.45:expression==='anger'?.35:0)*strength,
 smile:(settings.smile||0)*strength,
 squint:(settings.squint||0)*strength,
 shoulderL:clamp(values.shoulderL+(settings.shoulders||0)*strength+(d===null?0:motion*.25)),
 shoulderR:clamp(values.shoulderR+(settings.shoulders||0)*strength+(d===null?0:Math.sin(d*.9-.4)*.23)),
 leanX:breathe?Math.sin(time*.55)*.14:0,
 mouth:Math.max(values.mouth,audio.value(dt),(state==='speaking'||d!==null)&&!audio.playing?Math.max(0,Math.sin(time*10))*.45:0)
 };
 for(const [id,t]of Object.entries(target))pose[id]=springs[id].step(t,dt);
 const hairTarget=$('#hair').checked?(-springs.yaw.v*2.2-springs.roll.v*3+(breathe?Math.sin(time*1.8)*.38:0)):0;
 pose.hair=springs.hair.step(clamp(hairTarget,-5,5),dt);
 pose.breath=breath;
 const blink=blinkCurve(time-blinkAt),wink=blinkCurve(time-winkAt);
 pose.eyeL=state==='sleep'?.03:clamp(1-blink-wink,0,1);
 pose.eyeR=state==='sleep'?.03:clamp(1-blink,0,1);
 pose.eyeOpen=1-blink;
 try{if(!Object.values(pose).every(Number.isFinite))throw Error('姿勢に不正な値を検出');renderer.render(pose);}catch(e){renderError=e.message;$('#error').hidden=false;$('#error').textContent=e.message;$('#static').checked=true;policy();return;}
 frameTimes.push(dt);if(frameTimes.length>90)frameTimes.shift();
 if(now-lastMetric>500){
 const fps=1/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length);
 $('#metrics').textContent=fps.toFixed(0)+' fps · CPU '+renderer.drawMs.toFixed(1)+' ms';
 $('#audioStatus').textContent=audioMessage??(audio.playing?(audio.mode==='test-tone'?'テスト音量で同期中（音声ではありません）':'端末内の音声で同期中'):state==='speaking'||d!==null?'音声なし · 疑似発話':'音声なし · 手動開口');
 $('#audioStatus').dataset.audioContext=audio.context?.state||'not-created';
 $('#audioStatus').dataset.audioMode=audio.mode;
 $('#audioStatus').dataset.peakRms=String(audio.peakRms);
 $('#audioStatus').dataset.peakEnvelope=String(audio.peakEnvelope);
 lastMetric=now;
 $('#avatar').dataset.frames=String(renderer.frames);
 $('#avatar').dataset.pose=JSON.stringify({yaw:pose.yaw,pitch:pose.pitch,gazeX:pose.gazeX,gazeY:pose.gazeY,mouth:pose.mouth,eyeL:pose.eyeL,eyeR:pose.eyeR,hair:pose.hair});
 }
 schedule();
}
document.addEventListener('visibilitychange',policy);
reduced.addEventListener('change',policy);
$('#avatar').addEventListener('riglost',policy);
window.addEventListener('resize',()=>{renderer?.resize();});
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);clearTimeout(transition);clearTimeout(phaseTimer);audio.dispose();renderer?.dispose();},{once:true});
window.hibikiV3={
 setState,setWardrobe,
 setPose(input){for(const [k,v]of Object.entries(input))if(ids.includes(k)&&Number.isFinite(Number(v)))setValue(k,v);},
 setExpression:selectExpression,
 blink(){blinkAt=time;},wink(){winkAt=time;},
 snapshot(){return {ready,state,phase,expression,wardrobe,pose:{...pose},partCount:rig.parts.length,wardrobeParts:rig.parts.filter(x=>x.kind==='garment').length,
 frames:renderer?.frames||0,rafActive:!!raf,staticMode:staticMode(),error:renderError,audioMode:audio.mode,audioPlaying:audio.playing,
 gpuTextureBytes:rig.parts.reduce((a,p)=>a+p.rect[2]*p.rect[3]*4,0),
 triangles:renderer?.resources.reduce((a,r)=>a+r.count/3,0)||0,headVertex:renderer?renderer.resources.find(r=>r.part.id==='face')?.live.slice(0,2):null};},
 debugRig:rig,
 exportPose(){return JSON.stringify({rig:rig.version,state,expression,wardrobe,pose},null,2);}
};
try{
 if(new URLSearchParams(location.search).has('fallback'))throw Error('静止fallbackの確認モード');
 renderer=new Renderer($('#avatar'),rig);await renderer.load();ready=true;
 $('#error').hidden=true;policy();
}catch(e){renderError=e.message;ready=true;$('#error').hidden=false;$('#error').textContent=e.message;policy();}
