// Resize/pack an authorized generated sprite without changing pose or retouching identity.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const source=process.argv[2];if(!source)throw Error('Usage: node build-greeting-texture.mjs <authorized transparent PNG>');
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright'),bytes=fs.readFileSync(source);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const result=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();if(img.width!==1122||img.height!==1402)throw Error('Pose reference coordinates do not match');const canvas=document.createElement('canvas');canvas.width=256;canvas.height=400;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,740,430,662,0,0,256,400);return {width:img.width,height:img.height,data:canvas.toDataURL('image/png').split(',')[1]};},'data:image/png;base64,'+bytes.toString('base64'));
 const out=path.join(import.meta.dirname,'materials'),packed=Buffer.from(result.data,'base64');fs.writeFileSync(path.join(out,'right-greeting.png'),packed);
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const record={producer:'built-in image_gen: connected full-body pose reference, then isolated forearm cutout; Canvas texture packing',sourceSHA256:sha(bytes),sourceDimensions:[result.width,result.height],crop:[0,740,430,662],dimensions:[256,400],sha256:sha(packed),bytes:packed.length,gpuRGBABytes:256*400*4,reference:'../../../assets/approved-front.png',referenceSHA256:sha(fs.readFileSync(path.join(import.meta.dirname,'../../assets/approved-front.png'))),scope:'Relaxed character right hand, cuff and forearm only. Generated head/body pixels are NOT used. Approved face/body source unchanged.',generated:true,externalCLIorAPI:false};
 fs.writeFileSync(path.join(out,'right-greeting.json'),JSON.stringify(record,null,2));console.log(record);
}finally{await browser.close();}
