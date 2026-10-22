// Bake independent keyforms without regenerating or altering approved image materials.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
 const data=await page.evaluate(()=>study.exportRig()),root=path.join(import.meta.dirname,'materials');
 fs.writeFileSync(path.join(root,'rig.json'),JSON.stringify(data));
 const file=path.join(root,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));
 const bytes=fs.readFileSync(path.join(root,'rig.json')),entry=manifest.files.find(f=>f.name==='rig.json');
 Object.assign(entry,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 manifest.shapeAuthoring='Source-aligned local brow, cheek, lip-corner and lip-rounding keyforms; same shared surface and approved bitmap materials';
 fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log({keys:Object.keys(data.keys),imageMaterialsChanged:false});
}finally{await browser.close();}
