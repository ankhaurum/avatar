import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {armChain,ARM} from './arm-rig.js';
let previous=armChain(0);const elbows=[];
for(let i=0;i<=100;i++){
 const q=armChain(i/100);assert(q.wrist[1]<=previous.wrist[1],'raising must not loop down');
 assert(Math.abs(Math.hypot(q.wrist[0]-q.elbow[0],q.wrist[1]-q.elbow[1])-ARM.forearm)<1e-7);
 assert(Math.abs(Math.hypot(q.elbow[0]-q.shoulder[0],q.elbow[1]-q.shoulder[1])-ARM.upper)<1e-7);
 elbows.push(q.elbow[0]);previous=q;
}
assert(Math.max(...elbows)-Math.min(...elbows)>100,'elbow must participate in the reach');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(import.meta.dirname,'evidence'),baseline='8f0b43d8a4823cf4c5dd515c19f07f2123614217';
const old=new Map();for(const name of fs.readdirSync(import.meta.dirname).filter(x=>x.endsWith('.js'))){try{old.set(name,execFileSync('git',['show',baseline+':studies/continuity/'+name],{cwd:root,stdio:['ignore','pipe','ignore']}).toString());}catch{}}
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright'),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const frames=[],reports=[];
try{for(const before of [true,false]){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(before)await page.route('**/studies/continuity/*.js*',route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);return old.has(name)?route.fulfill({contentType:'text/javascript',body:old.get(name)}):route.continue();});
 await page.goto('http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
 const sequence=await page.evaluate(async before=>{
  const {HairMotion}=await import('./hair-motion.js'),{speechShape}=await import('./presence.js'),hair=new HairMotion(),frames=[];
  for(let i=0;i<=64;i++){const t=i/10,yaw=.22*Math.sin(t*.9),p={smile:.78,cheek:.56,eyeSmile:.48,eye0:.98,eye1:.98,mouth:t>1.8&&t<4.8?speechShape(t).open:.72,round:t>1.8&&t<4.8?speechShape(t).round:0,yaw,body:yaw*.4,breath:.35*Math.sin(t)};
   const q=before?p:hair.apply(p,.1);await study.previewGreeting(t,q);
   const c=document.createElement('canvas');c.width=390;c.height=488;c.getContext('2d').drawImage(study.app.canvas,0,0,390,488);frames.push(c.toDataURL());
  }return frames;
 },before);
 frames.push(sequence);reports.push({before,errors});assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage({viewport:{width:780,height:520}});await page.setContent('<canvas id="comparison" width="780" height="520"></canvas>');
 const outputs=await page.evaluate(async sequences=>{
  const c=document.querySelector('canvas'),g=c.getContext('2d'),images=await Promise.all(sequences.map(async seq=>Promise.all(seq.map(async src=>{const i=new Image();i.src=src;await i.decode();return i;}))));
  const draw=i=>{g.fillStyle='#edf2f7';g.fillRect(0,0,780,520);g.fillStyle='#243045';g.font='18px sans-serif';g.fillText('Before / circular reach',14,24);g.fillText('After / coordinated reach',404,24);g.drawImage(images[0][i],0,32);g.drawImage(images[1][i],390,32);};
  const shots=[];for(const i of [11,13,24,35,51,54]){draw(i);shots.push(c.toDataURL());}
  const stream=c.captureStream(10),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:1100000});recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(r=>recorder.onstop=r);recorder.start();
  for(let i=0;i<images[0].length;i++){draw(i);await new Promise(r=>setTimeout(r,100));}recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
  const data=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});return {shots,video:data};
 },frames);
 fs.writeFileSync(path.join(out,'arm-reach-comparison.webm'),Buffer.from(outputs.video.split(',')[1],'base64'));
 await page.setViewportSize({width:1560,height:1560});await page.setContent('<style>body{margin:0;display:grid;grid-template-columns:repeat(2,780px)}img{width:780px}</style>'+outputs.shots.map(s=>'<img src="'+s+'">').join(''));await page.screenshot({path:path.join(out,'arm-reach-comparison.png'),fullPage:true});
 fs.writeFileSync(path.join(out,'arm-reach.json'),JSON.stringify({baseline,reports,reach:'authored wrist curve with coupled shoulder/elbow inverse kinematics; monotonic lift, fixed segment lengths, no post-solve clamp',video:'Deterministic 10fps comparison rendered by actual WebGL engine, not measured real-time device performance',phone:'UNVERIFIED',newMaterialBytes:fs.statSync(path.join(import.meta.dirname,'materials/sleeve-cloth.png')).size},null,2));console.log({reports,frames:65,videoBytes:fs.statSync(path.join(out,'arm-reach-comparison.webm')).size});
}finally{await browser.close();}
