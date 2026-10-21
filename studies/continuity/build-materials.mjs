// Local, deterministic material authoring. No Adobe installation/settings or AI API.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const args=process.argv.slice(2),value=n=>args[args.indexOf(n)+1];
if(!args.includes('--closed-reference'))throw Error('Usage: node build-materials.mjs --closed-reference <existing authorized closed-eye image> [--url http://127.0.0.1:8794/studies/continuity/]');
const input=path.resolve(value('--closed-reference')),url=new URL(args.includes('--url')?value('--url'):'http://127.0.0.1:8794/studies/continuity/');
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('素材制作にはローカルURLのみ使用できます');url.searchParams.set('author','1');
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright'),out=path.join(import.meta.dirname,'materials');fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),source=fs.readFileSync(input),approved=path.resolve(import.meta.dirname,'../../assets/approved-front.png'),approvedHash=hash(fs.readFileSync(approved));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage();await page.addInitScript(data=>{window.authorClosedReference=data;},'data:image/png;base64,'+source.toString('base64'));
 await page.goto(url.href);await page.waitForFunction(()=>window.study?.ready);
 for(const [filename,key]of [['surface','base'],['iris-left','irises.0'],['iris-right','irises.1'],['mouth-underlay','cavity'],['neutral-composite','neutral'],['closed-left','closedEyes.0'],['closed-right','closedEyes.1']]){
  const b64=await page.evaluate(k=>k.split('.').reduce((o,n)=>o[n],study.materials).toDataURL().split(',')[1],key);fs.writeFileSync(path.join(out,filename+'.png'),Buffer.from(b64,'base64'));
 }
 const data=await page.evaluate(async()=>{const bytes=study.exportPSD();return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob([bytes]));});});fs.writeFileSync(path.join(out,'hibiki-continuity.psd'),Buffer.from(data,'base64'));
 fs.writeFileSync(path.join(out,'rig.json'),JSON.stringify(await page.evaluate(()=>study.exportRig())));
 const manifest={approvedSourceSHA256:approvedHash,closedReferenceSHA256:hash(source),production:'Canvas 2D + ag-psd 31.0.3 + PixiJS 8.22.0 authoring preview',adobeOperation:false,newAIGeneration:false,dimensions:[1122,1402],layers:await page.evaluate(()=>study.materials.layers.map(l=>({name:l.name,hidden:!!l.hidden}))),files:fs.readdirSync(out).filter(n=>n!=='manifest.json').map(name=>({name,sha256:hash(fs.readFileSync(path.join(out,name))),bytes:fs.statSync(path.join(out,name)).size}))};
 if(approvedHash!==hash(fs.readFileSync(approved)))throw Error('承認画像のハッシュ不一致');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({saved:out,files:manifest.files.length,sourceUnchanged:true}));
}finally{await browser.close();}
