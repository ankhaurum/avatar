import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {MotionResponse,composeEyeClosure,crossedBlinkContact} from './motion-response.js';
assert(crossedBlinkContact(.25,.25));assert(!crossedBlinkContact(2,2));
const p={eye0:.86,eye1:.92,eyeSmile:.8,mouth:0,smile:.4};
assert.equal(composeEyeClosure(p,1).eye0,0);assert.equal(composeEyeClosure(p,1).eye1,0);
assert.equal(composeEyeClosure(p,0,1).eye1,p.eye1);assert.equal(composeEyeClosure(p,0,1).eye0,0);
assert.deepEqual(composeEyeClosure(p),p);
const motion=new MotionResponse(),current={eye0:1,eye1:1,eyeSmile:0};
motion.step(current,{eye0:.85,eye1:.85,eyeSmile:1},1/60);
assert(current.eye0>.97&&current.eye0<1,'emotional eyelids must not snap');
assert(Math.abs((1-current.eye0)/.15-current.eyeSmile)<1e-10,'same expression response');
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],shots=[],reports=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.AVATAR_URL||'http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready,{},{timeout:60000});await page.selectOption('#zoom','face');
 for(const emotion of ['smile','concern','shy','surprise']){
  await page.locator('#reset').click();await page.evaluate(e=>hibikiV3.setEmotion(e),emotion);await page.waitForTimeout(700);
  const samples=await page.evaluate(async()=>{const samples=[];hibikiV3.blink();const start=performance.now();await new Promise(resolve=>{function frame(){samples.push(hibikiV3.snapshot().pose);if(performance.now()-start>1600)resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)});return samples});
  const closed=samples.find(p=>p.eye0<.08);assert(closed,emotion+' must blink');assert(Math.max(...samples.slice(samples.indexOf(closed)+1).map(p=>p.eye0))>.75,emotion+' reopens '+JSON.stringify(samples.map(p=>p.eye0)));
  reports.push({emotion,minEye:closed.eye0,endEye:samples.at(-1).eye0,mouth:closed.mouth});
  await page.evaluate(p=>study.pose(p),closed);shots.push({name:emotion+' during blink',png:(await page.locator('#stage').screenshot()).toString('base64')});await page.evaluate(()=>study.animate());
 }
 await page.evaluate(()=>hibikiV3.setState('sleep'));await page.waitForTimeout(150);assert.equal((await page.evaluate(()=>hibikiV3.snapshot())).pose.eye0,0);
 const g=await browser.newPage({viewport:{width:1464,height:500}});await g.setContent('<style>body{margin:0;display:flex}figure{margin:0;width:366px}img{width:366px}</style>'+shots.map(s=>'<figure><img src="data:image/png;base64,'+s.png+'"><figcaption>'+s.name+'</figcaption></figure>').join(''));await g.screenshot({path:new URL('evidence/eye-composition.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 assert.deepEqual(errors,[]);fs.writeFileSync(new URL('evidence/eye-composition.json',import.meta.url),JSON.stringify({reports,errors,scope:'PC Chrome 390px touch emulation; images freeze sampled live blink poses, not physical phone'},null,2));console.log({reports,errors});
}finally{await browser.close()}
