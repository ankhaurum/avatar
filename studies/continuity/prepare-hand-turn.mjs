import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:8794/studies/continuity/');
const result=await page.evaluate(async()=>{
 const sources=await Promise.all(['hand-back-approved.png','hand-side-palm-source.png'].map(async name=>{const i=new Image();i.src='materials/'+name;await i.decode();return i;}));const atlas=document.createElement('canvas');atlas.width=768;atlas.height=448;const ag=atlas.getContext('2d');const info=[];
 for(let part=0;part<3;part++){
  const img=sources[part===0?0:1],cols=part===0?1:2,sourcePart=part===2?1:0;const c=document.createElement('canvas');c.width=Math.floor(img.width/cols);c.height=part===0?1260:930;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,-sourcePart*img.width/cols,0);
  const d=g.getImageData(0,0,c.width,c.height),n=c.width*c.height,seen=new Uint8Array(n),queue=new Int32Array(n);let largest=[];
  for(let i=0;i<n;i++)if(!seen[i]&&d.data[i*4+3]>245){let start=0,end=1;queue[0]=i;seen[i]=1;while(start<end){const k=queue[start++],x=k%c.width;for(const j of [x? k-1:-1,x<c.width-1?k+1:-1,k-c.width,k+c.width])if(j>=0&&j<n&&!seen[j]&&d.data[j*4+3]>245){seen[j]=1;queue[end++]=j;}}if(end>largest.length)largest=Array.from(queue.subarray(0,end));}
  const mask=new Uint8Array(n);let x0=c.width,x1=0,y0=c.height,y1=0;for(const k of largest){mask[k]=1;const x=k%c.width,y=Math.floor(k/c.width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  for(let k=0;k<n;k++)if(!mask[k])d.data[k*4+3]=0;g.putImageData(d,0,0);
  const wristY=y1-8,row=largest.filter(k=>Math.floor(k/c.width)===wristY).map(k=>k%c.width),cx=(Math.min(...row)+Math.max(...row))/2,tip=largest.filter(k=>Math.floor(k/c.width)===y0+12).map(k=>k%c.width),tipX=(Math.min(...tip)+Math.max(...tip))/2,angle=Math.atan((tipX-cx)/(y0-y1)),scale=416/Math.hypot(y1-y0,tipX-cx);
  ag.save();ag.beginPath();ag.rect(part*256,0,256,448);ag.clip();ag.translate(part*256+128,440);ag.scale(scale,scale);ag.rotate(angle);ag.drawImage(c,-cx,-y1);ag.restore();info.push({part,bounds:[x0,y0,x1,y1],wristCenter:cx,scale});
 }
 return {png:atlas.toDataURL(),info};
});fs.writeFileSync(new URL('./materials/hand-turn.png',import.meta.url),Buffer.from(result.png.split(',')[1],'base64'));console.log(result.info);
}finally{await browser.close();}
