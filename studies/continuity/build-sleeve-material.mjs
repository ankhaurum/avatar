import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {SLEEVE_ROWS} from './sleeve.js';
const source=process.argv[2];if(!source)throw Error('Generated cloth source required');
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const bytes=fs.readFileSync(source),hand=fs.readFileSync(new URL('materials/right-greeting.png',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();const result=await page.evaluate(async({source,hand,shape})=>{
 const load=async s=>{const i=new Image();i.src=s;await i.decode();return i;},im=await load(source),arm=await load(hand);
 const atlas=document.createElement('canvas');atlas.width=256;atlas.height=256;const a=atlas.getContext('2d');
 // Same registered outline; only fabric appearance changes with bend. No arm opacity change.
 a.drawImage(im,270,180,460,620,0,0,128,256);a.drawImage(im,270,670,460,760,128,0,128,256);
 const c=document.createElement('canvas');c.width=arm.width;c.height=arm.height;const g=c.getContext('2d');g.drawImage(arm,0,0);const data=g.getImageData(0,0,c.width,c.height).data;
 const rows=[1220,1240,1270,1300,1340,1380,1400].map(y=>{const row=Math.min(c.height-1,Math.round((y-740)/662*c.height));let l=c.width,r=0;for(let x=0;x<c.width;x++)if(data[(row*c.width+x)*4+3]>180){l=Math.min(l,x);r=Math.max(r,x);}return [y,l/c.width*430,r/c.width*430];});
 // Retain the actual suit's navy piping and color. The generated cloth supplies
 // fold lighting only, registered to the same sleeve UVs, never a new hand.
 const folds=a.getImageData(128,0,128,256).data,result=a.createImageData(256,256);
 for(let y=0;y<256;y++){
  const row=y/255*(shape.length-1),r=Math.min(shape.length-2,Math.floor(row)),f=row-r;
  const sy=shape[r][0]*(1-f)+shape[r+1][0]*f,sourceY=Math.min(c.height-2,Math.round((sy-740)/662*c.height));
  let left=c.width,right=0;for(let x=0;x<c.width;x++)if(data[(sourceY*c.width+x)*4+3]>180){left=Math.min(left,x);right=Math.max(right,x);}
  for(let x=0;x<128;x++){const sx=Math.round(left+(right-left)*(.012+.976*x/127)),src=(sourceY*c.width+sx)*4,fi=(y*128+x)*4;
   const shade=Math.min(1.035,Math.max(.84,(folds[fi]+folds[fi+1]+folds[fi+2])/3/235));
   for(let panel=0;panel<2;panel++){const i=(y*256+x+panel*128)*4;for(let k=0;k<3;k++)result.data[i+k]=data[src+k]*(panel?shade:1);result.data[i+3]=255;}
  }
 }
 a.putImageData(result,0,0);
 return {png:atlas.toDataURL().split(',')[1],rows,dimensions:[im.width,im.height]};
},{source:'data:image/png;base64,'+bytes.toString('base64'),hand:'data:image/png;base64,'+hand.toString('base64'),shape:SLEEVE_ROWS});
 fs.writeFileSync(new URL('materials/sleeve-cloth.png',import.meta.url),Buffer.from(result.png,'base64'));
 const record={producer:'Built-in image_gen, source-matched cloth only; Canvas registered material atlas',generationPrompt:'sleeve-generation-prompt.txt',sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceDimensions:result.dimensions,atlas:[256,256],rows:result.rows,reference:'assets/approved-front.png and existing right-greeting.png',scope:'No generated face or hand pixels. Independent sleeve shape keys. Original assets preserved.'};
 fs.writeFileSync(new URL('materials/sleeve-cloth.json',import.meta.url),JSON.stringify(record,null,2));console.log(record);
}finally{await browser.close();}
