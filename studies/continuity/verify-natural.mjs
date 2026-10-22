import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {MotionResponse} from './motion-response.js';import {armChain,ARM} from './arm-rig.js';
const response=(dt)=>{const c={yaw:0,body:0,gazeX:0},m=new MotionResponse();for(let t=0;t<1-.00001;t+=dt)m.step(c,{yaw:1,body:1,gazeX:1},dt);return c;};
const a=response(1/60),b=response(1/30);for(const key of Object.keys(a))assert(Math.abs(a[key]-b[key])<1e-10);
for(let i=0;i<=100;i++){const c=armChain(i/100);assert(Math.abs(Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1])-ARM.forearm)<1e-7);assert(c.upperAngle>1.47&&c.upperAngle<2.03);}
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const root=import.meta.dirname,out=path.join(root,'evidence'),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.VERIFY_URL||'http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
 const frames=[];
 for(const t of [.5,1.05,1.7,2.7,4.9,5.7]){
  const g=await page.evaluate(t=>study.previewGreeting(t,{smile:.5,mouth:.5,breath:.5,yaw:.3,body:.2}),t);
  frames.push({t,joints:g.joints,png:(await page.locator('#stage').screenshot()).toString('base64')});
 }
 const gallery=await browser.newPage({viewport:{width:1170,height:1040}});await gallery.setContent('<style>body{margin:0;background:#edf0f5;font:16px system-ui}.grid{display:grid;grid-template-columns:repeat(3,390px)}figure{margin:6px;background:white}img{display:block;width:378px}figcaption{text-align:center;padding:5px}</style><div class="grid">'+frames.map(x=>'<figure><img src="data:image/png;base64,'+x.png+'"><figcaption>'+x.t+'秒</figcaption></figure>').join('')+'</div>');await gallery.screenshot({path:path.join(out,'natural-greeting.png'),fullPage:true});await gallery.close();
 await page.evaluate(()=>study.previewGreeting(2.7,{yaw:.5,body:.3,mouth:.7,smile:.7,eyeSmile:.6,eye0:.96,eye1:.96,breath:.7}));
 const faceDifference=await page.evaluate(async()=>{const read=()=>{const c=document.createElement('canvas');c.width=1122;c.height=1402;const g=c.getContext('2d');g.drawImage(study.app.canvas,0,0);return g.getImageData(330,280,490,550).data;};const before=read(),p=study.stats().pose;await study.previewGreeting(-1,p);const after=read();let changes=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])changes++;return changes;});assert.equal(faceDifference,0);
 await page.locator('#reset').click();await page.locator('#stage').scrollIntoViewIfNeeded();await page.locator('#demo').click();
 const stream=await page.evaluate(()=>({supported:typeof MediaRecorder!=='undefined'&&typeof study.app.canvas.captureStream==='function'}));
 // Save an actual live sequence, not a sequence whose numeric test substitutes for vision.
 if(stream.supported){
  await page.evaluate(()=>{const stream=study.app.canvas.captureStream(15);window.naturalRecording={stream,chunks:[]};const r=naturalRecording.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:850000});r.ondataavailable=e=>{if(e.data.size)naturalRecording.chunks.push(e.data)};r.start();});
  await page.waitForTimeout(42000);
  const video=await page.evaluate(()=>new Promise(resolve=>{naturalRecording.recorder.onstop=async()=>{const data=new Uint8Array(await new Blob(naturalRecording.chunks).arrayBuffer());naturalRecording.stream.getTracks().forEach(t=>t.stop());resolve(Array.from(data));};naturalRecording.recorder.stop();}));
  fs.writeFileSync(path.join(out,'natural-motion.webm'),Buffer.from(video));
 }
 const speech=await page.evaluate(()=>hibikiV3.snapshot());await page.locator('#demo').click();
 const stats=await page.evaluate(()=>study.stats());assert.equal(stats.rigVersion,'inertia-20261022');assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(path.join(out,'natural-verification.json'),JSON.stringify({responseAtOneSecond:a,frameRateIndependentForConstantTarget:true,unscaledBones:true,faceChangedChannels:faceDifference,poses:frames.map(({png,...f})=>f),liveDemoAfter42Seconds:speech,stats,videoSaved:stream.supported,errors,scope:'Desktop Chrome software WebGL, 390px touch emulation. Live canvas capture is not phone performance. Anatomy and naturalness remain subject to human visual evaluation.'},null,2));
 console.log({faceDifference,video:stream.supported,errors});
}finally{await browser.close();}
