import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {PerformanceController,STATES,EMOTIONS} from './emotion.js';
import {affectPose,blinkContext} from './affect.js';
assert.equal(blinkContext('idle','thinking',false),'thinking');
assert.equal(blinkContext('sleep','thinking',true),'sleep');
const explicit=affectPose({pitch:.4,shoulder:.2,mouth:.8},.85,{emotion:'surprise',speaking:true,age:2,inputs:{pitch:.4,shoulder:.2}});
assert.equal(explicit.pitch,.4);assert.equal(explicit.shoulder,.2);assert.equal(explicit.mouth,.8);
assert.deepEqual(affectPose({pitch:.4},1,{emotion:'joy',speaking:true,state:'sleep'}),{pitch:.4});
assert(affectPose({browRaise:1},1,{emotion:'surprise',age:2}).browRaise<affectPose({browRaise:1},1,{emotion:'surprise',age:.1}).browRaise);
let now=0;const c=new PerformanceController(()=>now);
assert.equal(c.snapshot().emotion,'smile');assert(c.sample(0).mouth>0);
c.setEmotion('neutral');assert.equal(c.sample(0).mouth,0);c.reset();
c.setState('speaking',{calm:false});c.setEmotion('smile');c.setVolume(0);
assert.equal(c.sample(0).mouth,0);assert(c.sample(0).smile>0);c.reset();
for(const state of STATES){assert(c.setState(state,{duration:0,calm:false}));assert.equal(c.snapshot().state,state);}
assert.equal(c.setState('unknown'),false);assert.equal(c.setState('happy',{duration:NaN}),false);
c.setState('attention');now=919;c.tick();assert.equal(c.state,'attention');now=920;c.tick();assert.equal(c.state,'idle');
now=0;c.setState('speaking');now=1800;c.tick();assert.equal(c.phase,'calm');now=5000;c.tick();assert.equal(c.state,'happy');now=6100;c.tick();assert.equal(c.state,'idle');
c.reset();c.setEmotion('joy');c.setState('speaking',{calm:false});const coexist=c.sample(.12);assert(coexist.smile>.8&&coexist.mouth>0);
c.setState('sleep');assert.equal(c.sample(0).eye0,0);c.setState('wake',{duration:0});assert.equal(c.sample(0).eye0,0);now+=760;assert.equal(c.sample(0).eye0,1);
c.reset();c.setInputs({gazeX:1,gazeY:-1,strength:.34});assert.equal(c.inputs.gazeX,.34);assert.equal(c.inputs.gazeY,-.34);
c.setInputs({gazeX:1});assert.equal(c.inputs.gazeX,1);
c.setEmotion('neutral');c.setVolume(1);assert.equal(c.sample(0).mouth,1);now+=301;assert.equal(c.sample(0).mouth,0);assert.equal(c.setVolume(NaN),false);
now=0;c.reset();c.setState('speaking');now=20000;c.tick();assert.equal(c.state,'idle');
if(process.argv.includes('--contract-only')){console.log('V2 state timing, input validation and independent speech contract verified');process.exit(0);}
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const out=path.join(import.meta.dirname,'evidence'),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
 const geometry=await page.evaluate(async()=>{
  const {deformSurface}=await import('./rig.js?v=mouth-20261023'),{EMOTIONS}=await import('./emotion.js?v=mouth-20261023');
  const s=study.surface,area=(v,a,b,c)=>(v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1])-(v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);let inverted=0;
  for(const e of Object.values(EMOTIONS))for(const closed of [false,true]){
   const v=deformSurface(s,{...e,eye0:closed?0:e.eyeOpen??1,eye1:closed?0:e.eyeOpen??1,mouth:.7,yaw:.8,breath:1,body:.5});
   for(let i=0;i<s.indices.length;i+=3){const ids=s.indices.slice(i,i+3),a=area(s.rest,...ids);if(Math.abs(a)>.001&&area(v,...ids)/a<=0)inverted++;}
  }return {inverted,note:'Geometry guard, not aesthetic acceptance'};
 });assert.equal(geometry.inverted,0);
 // Exercise live compatibility, including repeated V2 input not restarting a transient state.
 assert(await page.evaluate(()=>hibikiV3.setInputs({state:'attention',gazeX:.8,gazeY:0,strength:.5})));
 await page.waitForTimeout(650);await page.evaluate(()=>hibikiV3.setInputs({state:'attention',gazeX:.8,strength:.5}));await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>hibikiV3.snapshot().state),'idle');
 await page.evaluate(()=>{hibikiV3.setEmotion('joy');hibikiV3.setState('speaking',{duration:0,calm:false});});await page.waitForTimeout(1000);
 const joySpeaking=await page.evaluate(()=>hibikiV3.snapshot());assert.equal(joySpeaking.emotion,'joy');assert.equal(joySpeaking.state,'speaking');assert(joySpeaking.pose.smile>.75);
 await page.locator('#stage').scrollIntoViewIfNeeded();await page.locator('#stage').screenshot({path:path.join(out,'joy-speaking.png')});
 await page.evaluate(()=>hibikiV3.setExpression('neutral'));await page.getByText('音量同期（端末内で処理）',{exact:true}).click();await page.locator('#tone').click();await page.waitForTimeout(1800);
 const audio=await page.evaluate(()=>hibikiV3.snapshot());assert.equal(audio.audioMode,'test-tone');assert(audio.peakEnvelope>0);await page.locator('#stopAudio').click();
 assert.equal(await page.evaluate(()=>hibikiV3.snapshot().audioPlaying),false);
 const rate=22050,samples=rate*3,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i/rate*190*Math.PI*2)*Math.max(0,Math.sin(i/rate*12))*.2*32767),44+i*2);
 await page.setInputFiles('#audioFile',{name:'synthetic-audio-check.wav',mimeType:'audio/wav',buffer:wav});await page.waitForTimeout(900);const localAudio=await page.evaluate(()=>hibikiV3.snapshot());assert.equal(localAudio.audioMode,'local-audio');assert(localAudio.peakEnvelope>0);await page.locator('#stopAudio').click();
 assert.equal(await page.evaluate(()=>hibikiV3.setWardrobe('suit')),'suit');assert(await page.evaluate(async()=>{try{await hibikiV3.setWardrobe('unknown');return false;}catch{return true;}}));
 await page.locator('#reset').click();await page.locator('#demo').click();await page.waitForTimeout(700);assert(await page.locator('#demoStatus').textContent());
 await page.locator('#static').check();await page.waitForTimeout(150);const frames=await page.evaluate(()=>study.stats().drawCount);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>study.stats().drawCount),frames);
 await page.locator('#static').uncheck();await page.locator('#reset').click();
 await page.locator('#stage').scrollIntoViewIfNeeded();const box=await page.locator('#stage').boundingBox();await page.touchscreen.tap(box.x+box.width*.85,box.y+box.height*.45);await page.waitForTimeout(1000);const touch=await page.evaluate(()=>hibikiV3.snapshot());assert(touch.pose.yaw>.5&&touch.pose.body>.1);
 // Freeze authored combined poses for close visual inspection of each expression.
 const captures=[];await page.selectOption('#zoom','face');
 for(const [name,label]of [['neutral','中立'],['gentle','微笑み'],['joy','喜び＋発話'],['surprise','驚き'],['concern','困惑'],['sadness','悲しみ'],['thinking','思考'],['shy','照れ'],['smile','笑顔＋発話']]){
  await page.evaluate(async name=>{const {PerformanceController}=await import('./emotion.js?v=mouth-20261023');const c=new PerformanceController(()=>0);c.setEmotion(name);study.pose({...c.sample(0),mouth:['joy','smile','shy'].includes(name)?.55:name==='surprise'?.35:0,breath:.4});},name);
  captures.push({name,label,data:(await page.locator('#stage').screenshot()).toString('base64')});
 }
 const gallery=await browser.newPage({viewport:{width:810,height:1080}});await gallery.setContent('<style>body{margin:0;background:#edf0f5;font:16px system-ui}.grid{display:grid;grid-template-columns:repeat(3,270px)}figure{margin:7px;background:white}img{display:block;width:256px;height:320px}figcaption{text-align:center;padding:4px}</style><div class="grid">'+captures.map(x=>'<figure><img src="data:image/png;base64,'+x.data+'"><figcaption>'+x.label+'</figcaption></figure>').join('')+'</div>');await gallery.screenshot({path:path.join(out,'emotion-gallery.png'),fullPage:true});await gallery.close();
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(path.join(out,'emotion-verification.json'),JSON.stringify({states:STATES,v2Timing:true,independentEmotionAndSpeech:true,geometry,joySpeaking,audio,localAudio,touch,staticDrawStopped:true,suitOnly:true,errors,scope:'Desktop Chrome software WebGL; 390px mobile viewport and touch emulation. Synthetic tone and WAV for local audio. Not a physical phone or aesthetic acceptance.'},null,2));
 console.log(JSON.stringify({geometry,states:STATES.length,audioPeak:audio.peakEnvelope,errors}));
}finally{await browser.close();}
