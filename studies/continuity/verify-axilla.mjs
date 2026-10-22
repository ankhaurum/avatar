import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {skin} from './rig.js';
const base={breath:.4,shoulderL:.2,scapulaL:.5,postureX:-2};
for(const [x,y] of [[85,1000],[130,1110],[165,1200],[180,1320],[210,1390],[260,1150]]){
 for(const armLift of [.1,.3,.5,.7,1])assert.deepEqual(skin(x,y,{...base,armLift}),skin(x,y,base),'arm rotation leaked into torso seam');
}
assert.notDeepEqual(skin(150,1060,base),skin(150,1060,{}),'shoulder and breathing must remain active');
const baseline='63c4c2f1c9fdfe049931e1b293ff6de8e60a57f0',old=new Map();
for(const name of ['rig.js','arm-rig.js'])old.set(name,execFileSync('git',['show',baseline+':studies/continuity/'+name]).toString());
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const pictures=[];
 for(const before of [true,false]){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  if(before)await page.route('**/studies/continuity/*.js*',r=>{const n=new URL(r.request().url()).pathname.split('/').at(-1);return old.has(n)?r.fulfill({contentType:'text/javascript',body:old.get(n)}):r.continue();});
  await page.goto('http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
  const shots=[];for(const t of [.9,1.1,1.3,2.4,5.4])shots.push(await page.evaluate(async t=>{
   await study.previewGreeting(t,{breath:.4});const c=document.createElement('canvas');c.width=420;c.height=480;
   c.getContext('2d').drawImage(study.app.canvas,0,920,420,480,0,0,420,480);return c.toDataURL();
  },t));pictures.push(shots);await page.close();
 }
 const page=await browser.newPage({viewport:{width:840,height:2540}});
 await page.setContent('<style>body{margin:0;display:grid;grid-template-columns:420px 420px;font:18px sans-serif}figure{margin:0}img{display:block}</style>'+pictures[0].map((_,i)=>pictures.map((p,j)=>'<figure><figcaption>'+['Before','After'][j]+' / '+[.9,1.1,1.3,2.4,5.4][i]+'s</figcaption><img src="'+p[i]+'"></figure>').join('')).join(''));
 await page.screenshot({path:new URL('./evidence/axilla-comparison.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 fs.writeFileSync(new URL('./evidence/axilla-verification.json',import.meta.url),JSON.stringify({baseline,armRotationExcludedFromTorso:true,shoulderBreathingRetained:true,poses:[.9,1.1,1.3,2.4,5.4],scope:'PC Chrome 390px touch; physical phone unverified'},null,2));
 console.log('Torso seam binding and retained shoulder support verified; five before/after crops saved.');
}finally{await browser.close();}
