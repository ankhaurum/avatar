// Reproducible original Canvas artwork; never modifies the approved portrait.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8794/studies/continuity/');
 const artwork=await page.evaluate(async()=>{
  const {authorOralMaterials}=await import('./mouth.js?v=smile-20261022'),materials=authorOralMaterials();
  await import('./vendor/bundle.js');
  const psd=document.createElement('canvas');psd.width=288;psd.height=100;const g=psd.getContext('2d');g.drawImage(materials.cavity,54,0);g.drawImage(materials.tongue,56,50);g.drawImage(materials.teeth,0,28);
  const children=Object.entries(materials).map(([name,canvas])=>({name,canvas,left:name==='cavity'?54:name==='tongue'?56:0,top:name==='tongue'?50:name==='teeth'?28:0}));
  return {pngs:Object.fromEntries(Object.entries(materials).map(([name,c])=>[name,c.toDataURL('image/png').split(',')[1]])),psd:Array.from(agPsd.writePsdUint8Array({width:288,height:100,canvas:psd,children:children.reverse()},{generateThumbnail:false}))};
 });
 const mapping={cavity:'oral-cavity',teeth:'upper-dental',tongue:'tongue'},root=path.join(import.meta.dirname,'materials'),files=[];
 for(const [key,name]of Object.entries(mapping)){const data=Buffer.from(artwork.pngs[key],'base64');fs.writeFileSync(path.join(root,name+'.png'),data);files.push({name:name+'.png',bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}
 const psd=Buffer.from(artwork.psd);fs.writeFileSync(path.join(root,'oral-tissues.psd'),psd);
 fs.writeFileSync(path.join(root,'oral-tissues.json'),JSON.stringify({producer:'Canvas2D; original dental arch and oral tissue artwork, no external source',files,psd:{name:'oral-tissues.psd',bytes:psd.length,sha256:crypto.createHash('sha256').update(psd).digest('hex')},scope:'Small interior structures only. Approved facial bitmap unchanged. Stylized tissue studies, not a newly approved portrait.'},null,2));
 console.log(files);
}finally{await browser.close();}
