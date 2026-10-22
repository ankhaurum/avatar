import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.AVATAR_URL||'http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
const initial=await page.evaluate(()=>hibikiV3.snapshot());assert.equal(initial.emotion,'smile');assert(initial.pose.mouth>.6);assert(!initial.speaking);
await page.evaluate(()=>hibikiV3.setEmotion('neutral'));await page.waitForTimeout(750);assert((await page.evaluate(()=>hibikiV3.snapshot())).pose.mouth<.01);
await page.locator('#reset').click();await page.waitForTimeout(750);const reset=await page.evaluate(()=>hibikiV3.snapshot());assert.equal(reset.emotion,'smile');assert(reset.pose.mouth>.6);
await page.locator('#static').check();await page.waitForTimeout(200);const stat=await page.evaluate(()=>hibikiV3.snapshot());assert(stat.pose.smile>.7&&stat.pose.mouth>.6);await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>hibikiV3.snapshot())).frames,stat.frames);
await page.locator('#stage').screenshot({path:new URL('./evidence/default-smile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});assert.equal(errors.length,0);
const report={url:page.url(),version:await page.evaluate(()=>study.stats().rigVersion),initialSmile:true,explicitNeutral:true,resetSmile:true,staticSmile:true,errors,scope:'PC Chrome 390px touch emulation, not physical smartphone or aesthetic acceptance'};
fs.writeFileSync(new URL('./evidence/default-smile-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}