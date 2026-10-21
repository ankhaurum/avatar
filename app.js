import {sampleAutoDemo} from './motion.js?v=autodemo-3';
import {Renderer,Spring,AudioDriver,clamp,mix,smooth,contactTarget} from './engine.js?v=autodemo-3b';
const $=s=>document.querySelector(s);
const rig=await fetch('rig.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('rig read failed');return r.json();});
const commonParts=rig.parts;
const wardrobePacks=await Promise.all(rig.wardrobe.packs.map(async entry=>{const pack=await fetch(entry.url,{cache:'no-store'}).then(r=>r.json());if(pack.rigVersion!==rig.wardrobe.rigVersion)throw Error('衣装リグ版が一致しません');return pack;}));
rig.parts=[...commonParts,...wardrobePacks.find(p=>p.id===rig.wardrobe.default).parts].sort((a,b)=>a.order-b.order);
const controls=await fetch('controls.json',{cache:'no-store'}).then(r=>r.json());
rig.controls=controls;
const audio=new AudioDriver();
const ids=['yaw','pitch','roll','gazeX','gazeY','mouth','shoulderL','shoulderR','intensity'];
const values=Object.fromEntries(ids.map(id=>[id,Number($('#'+id).value)]));
const springs=Object.fromEntries(['yaw','pitch','roll','gazeX','gazeY','brow','browTilt','smile','squint','shoulderL','shoulderR','mouth','leanX'].map(n=>{const k=controls.spring[n.startsWith('gaze')?'gaze':'head'];return [n,new Spring(0,k.frequency,k.damping)];}));
springs.bodyTurn=new Spring(0,controls.spring.body.frequency,controls.spring.body.damping);
for(const [n,f] of Object.entries({hairBack:2,hairFringe:3.2,hairLeft:2.5,hairRight:2.3}))springs[n]=new Spring(0,f,.67);
springs.mouth=new Spring(0,controls.spring.mouth.frequency,controls.spring.mouth.damping);
for(const n of ['bodyLean','chest'])springs[n]=new Spring(0,n==='chest'?1.5:1.8,1);
let contact=null,contactUntil=0,contactCount=0,activePointer=null;
let renderer,ready=false,raf=0,last=performance.now(),time=0,nextBlink=3.2,blinkAt=-100,winkAt=-100,demoAt=null,expression='neutral',state='idle',phase='normal',transition=0,phaseTimer=0,wardrobe='suit',disposed=false;
let pose={},renderError=null,frameTimes=[],lastMetric=0;
let audioMessage=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function staticMode(){return $('#static').checked||reduced.matches||!renderer||renderer.lost;}
function schedule(){if(!raf&&!document.hidden&&!disposed&&!staticMode())raf=requestAnimationFrame(frame);}
function policy(){
 if(document.hidden||staticMode()){cancelAnimationFrame(raf);raf=0;if(document.hidden)audio.stop();}
 $('#poster').hidden=!staticMode();$('#avatar').hidden=staticMode();
 $('.touch-hint').textContent=staticMode()?'静止表示中です。動作の操作は休止しています。':'左右をタップ。横になぞると、眼・頭・首が追いかけます。';
 if(staticMode())$('#metrics').textContent='静止中';
 for(const id of ['demo','blink','wink'])$('#'+id).disabled=staticMode();
 $('#motionStatus').textContent=staticMode()?'静止表示':'独立メッシュ · 動作中';
 last=performance.now();nextBlink=time+2.5;policyLabel();schedule();
}
function policyLabel(yaw=values.yaw){$('#stageLabel').textContent='スーツ · '+(Math.abs(yaw)<.15?'正面':yaw>0?'画面右向き':'画面左向き');}
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
function toggleDemo(){
 demoAt=demoAt===null?time:null;contact=null;contactUntil=0;
 if(demoAt!==null){audio.stop();audioMessage=null;blinkAt=-100;}
 $('#demo').textContent=demoAt===null?'オートデモ':'オートデモを停止';
 $('#demo').setAttribute('aria-pressed',String(demoAt!==null));
 $('#demoStatus').textContent=demoAt===null?'音声なし・24秒で一巡、繰り返し再生':'オートデモを開始';
}
$('#demo').onclick=toggleDemo;
$('#reset').onclick=()=>{contact=null;activePointer=null;contactUntil=0;for(const id of ids)if(id!=='intensity')setValue(id,0);demoAt=null;$('#demo').textContent='オートデモ';$('#demo').setAttribute('aria-pressed','false');$('#demoStatus').textContent='音声なし・24秒で一巡、繰り返し再生';setState('idle');$('#pointer').checked=false;$('#placement').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x.dataset.placement==='center'));};
$('#static').onchange=policy;
$('#background').onchange=e=>$('#stage').classList.toggle('dark',e.target.checked);
function contactInput(e){
 if(staticMode())return;
 const r=$('#avatar').getBoundingClientRect();contact=contactTarget(e.clientX-r.left,e.clientY-r.top,r.width,r.height);contactUntil=time+3.5;
 $('#avatar').dataset.input=e.pointerType||'pointer';$('#avatar').dataset.contactCount=String(contactCount);
 $('#avatar').dataset.target=JSON.stringify(contact);
}
$('#avatar').addEventListener('pointerdown',e=>{if(e.button!==0)return;activePointer=e.pointerId;contactCount++;contactInput(e);e.target.setPointerCapture(e.pointerId);});
$('#avatar').addEventListener('pointermove',e=>{if(activePointer===e.pointerId||($('#pointer').checked&&e.pointerType==='mouse'))contactInput(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('#avatar').addEventListener(name,e=>{if(activePointer===e.pointerId)activePointer=null;});
$('#avatar').addEventListener('pointerleave',()=>{if(activePointer===null&&$('#pointer').checked)contactUntil=time;});
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
 if(age<.09)return smooth(0,.09,age);
 if(age<.13)return 1;return 1-smooth(.13,.33,age);
}
function frame(now){
 raf=0;if(document.hidden||staticMode()||disposed)return;
 const elapsed=Math.max(0,(now-last)/1000),dt=elapsed;last=now;time+=elapsed;
 if(demoAt===null&&time>nextBlink){blinkAt=time;nextBlink=time+3.4+Math.random()*2.8;}
 const d=demoAt===null?null:time-demoAt;
 const auto=d===null?null:sampleAutoDemo(d);
 const settings=controls.expressions[expression]||{};
 const strength=values.intensity;
 const breathe=$('#breathing').checked||auto!==null;
 const breath=breathe?Math.sin(time*Math.PI*2/5.3):0;
 const interacting=contact&&time<contactUntil;
 const idleYaw=breathe?Math.sin(time*.43)*.055+Math.sin(time*.19)*.025:0;
 const headYaw=interacting?contact.yaw:clamp(auto?auto.yaw:values.yaw+idleYaw);
 const bodyTarget=headYaw*.45;
 const target={
 yaw:headYaw,
 bodyTurn:bodyTarget,
 bodyLean:(auto?.bodyLean||0)-headYaw*.16+(breathe?Math.sin(time*.55)*.14:0),
 chest:breathe||auto?(.5+.5*breath):0,
 pitch:interacting?contact.pitch:(auto?auto.pitch:clamp(values.pitch+(breathe?Math.sin(time*.57)*.025:0))),
 roll:interacting?contact.roll:(auto?auto.roll:values.roll),
 gazeX:interacting?contact.gazeX:(auto?auto.gazeX:clamp(values.gazeX+(breathe?Math.sin(time*.43)*.09:0))),
 gazeY:interacting?contact.gazeY:(auto?auto.gazeY:values.gazeY),
 brow:auto?auto.smile*.15:(settings.brow||0)*strength,
 browTilt:auto?0:(expression==='concern'||expression==='sadness'?-.45:expression==='anger'?.35:0)*strength,
 smile:auto?auto.smile:(settings.smile||0)*strength,
 squint:auto?auto.smile*.16:(settings.squint||0)*strength,
 shoulderL:clamp(auto?auto.shoulderL+bodyTarget*.22:values.shoulderL+(settings.shoulders||0)*strength),
 shoulderR:clamp(auto?auto.shoulderR-bodyTarget*.22:values.shoulderR+(settings.shoulders||0)*strength),
 leanX:breathe?Math.sin(time*.55)*.14:0,
 mouth:auto?Math.max(auto.mouth,audio.value(dt)):Math.max(values.mouth,audio.value(dt),state==='speaking'&&!audio.playing?Math.max(0,Math.sin(time*10))*.85:0)
 };
 for(const [id,t]of Object.entries(target))pose[id]=springs[id].step(t,dt);
 const hairTarget=($('#hair').checked||auto)?clamp(-springs.yaw.v*4-springs.roll.v*4-springs.bodyTurn.v*2-springs.bodyLean.v*5,-10,10):0;
 for(const [n,k]of Object.entries({hairBack:.85,hairFringe:.45,hairLeft:1,hairRight:.9}))pose[n]=springs[n].step(hairTarget*k,dt);
 pose.hair=pose.hairLeft;
 pose.breath=breath;
 const blink=Math.max(blinkCurve(time-blinkAt),auto?.blink||0),wink=blinkCurve(time-winkAt);
 pose.eyeL=state==='sleep'&&!auto?0:clamp((1-blink-wink)*(1-pose.squint),0,1.12);
 pose.eyeR=state==='sleep'&&!auto?0:clamp((1-blink)*(1-pose.squint),0,1.12);
 pose.eyeOpen=1-blink;
 try{if(!Object.values(pose).every(Number.isFinite))throw Error('姿勢に不正な値を検出');renderer.render(pose);}catch(e){renderError=e.message;$('#error').hidden=false;$('#error').textContent=e.message;$('#static').checked=true;policy();return;}
 if(dt>.001)frameTimes.push(elapsed);if(frameTimes.length>90)frameTimes.shift();
 if(now-lastMetric>500){
 const fps=1/Math.max(.001,frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length);
 $('#metrics').textContent=(frameTimes.length<5?'計測中':fps.toFixed(0)+' fps')+' · CPU '+renderer.drawMs.toFixed(1)+' ms';
 $('#audioStatus').textContent=audioMessage??(audio.playing?(audio.mode==='test-tone'?'テスト音量で同期中（音声ではありません）':'端末内の音声で同期中'):state==='speaking'||d!==null?'音声なし · 疑似発話':'音声なし · 手動開口');
 $('#audioStatus').dataset.audioContext=audio.context?.state||'not-created';
 $('#audioStatus').dataset.audioMode=audio.mode;
 $('#audioStatus').dataset.peakRms=String(audio.peakRms);
 $('#audioStatus').dataset.peakEnvelope=String(audio.peakEnvelope);
 lastMetric=now;policyLabel(pose.yaw);
 if(auto){$('#demoStatus').textContent=auto.phase+' · '+Math.floor(d%24)+' / 24秒';$('#demoStatus').dataset.cycle=String(auto.cycle);$('#demoStatus').dataset.phase=auto.phase;}
 $('#avatar').dataset.frames=String(renderer.frames);
 $('#avatar').dataset.pose=JSON.stringify({yaw:pose.yaw,pitch:pose.pitch,gazeX:pose.gazeX,gazeY:pose.gazeY,mouth:pose.mouth,eyeL:pose.eyeL,eyeR:pose.eyeR,hair:pose.hair,bodyTurn:pose.bodyTurn,bodyLean:pose.bodyLean,chest:pose.chest,smile:pose.smile,shoulderL:pose.shoulderL,shoulderR:pose.shoulderR,demoTime:d,contactCount});
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
 triangles:renderer?.resources.reduce((a,r)=>a+r.count/3,0)||0,contactCount,contactTarget:contact,bodyTurn:pose.bodyTurn};},
 debugRig:rig,
 exportPose(){return JSON.stringify({rig:rig.version,state,expression,wardrobe,pose},null,2);}
};
try{
 if(new URLSearchParams(location.search).has('fallback'))throw Error('静止fallbackの確認モード');
 renderer=new Renderer($('#avatar'),rig);await renderer.load();ready=true;
 $('#error').hidden=true;policy();
}catch(e){renderError=e.message;ready=true;$('#error').hidden=false;$('#error').textContent=e.message;policy();}
