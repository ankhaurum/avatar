// Measure vertex motion of official samples through the public Cubism Core API.
const {createRequire}=require('module');const req=createRequire('C:/Users/ANKHAURUM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {chromium}=req('playwright');const fs=require('fs');
const D='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/desktop-analysis';
const models=process.argv.slice(2);
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage();
await p.route('http://m/**',r=>{const f=D+'/'+decodeURIComponent(r.request().url().slice(9));if(!fs.existsSync(f))return r.fulfill({status:200,contentType:'text/html',body:'<html></html>'});r.fulfill({body:fs.readFileSync(f),headers:{'access-control-allow-origin':'*'}});});
await p.goto('http://m/x.html').catch(()=>{});
await p.addScriptTag({content:fs.readFileSync(D+'/official-live2dcubismcore-5.3.min.js','utf8')});
const out={};
for(const name of models){
 const r=await p.evaluate(async(name)=>{
  const buf=await (await fetch('http://m/inputs/'+name+'.moc3')).arrayBuffer();
  const moc=Live2DCubismCore.Moc.fromArrayBuffer(buf);const model=Live2DCubismCore.Model.fromMoc(moc);
  const P=model.parameters,Dr=model.drawables;const pid=id=>P.ids.indexOf(id);
  const reset=()=>{for(let i=0;i<P.count;i++)P.values[i]=P.defaultValues[i];};
  const snap=()=>{model.update();return Array.from({length:Dr.count},(_,i)=>Float32Array.from(Dr.vertexPositions[i]));};
  const bbox=v=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<v.length;i+=2){x0=Math.min(x0,v[i]);x1=Math.max(x1,v[i]);y0=Math.min(y0,v[i+1]);y1=Math.max(y1,v[i+1]);}return [x0,y0,x1,y1];};
  const res={canvas:[model.canvasinfo.CanvasWidth,model.canvasinfo.CanvasHeight,model.canvasinfo.PixelsPerUnit]};
  // which drawables move with a parameter, and how (max displacement per value step)
  const sweep=(param,vals)=>{const i=pid(param);if(i<0)return null;reset();const base=snap();const per=[];
   for(const v of vals){reset();P.values[i]=v;const s=snap();per.push(s.map((d,k)=>{let m=0,sum=0;for(let j=0;j<d.length;j+=2){const dd=Math.hypot(d[j]-base[k][j],d[j+1]-base[k][j+1]);m=Math.max(m,dd);sum+=dd;}return {max:m,mean:sum/(d.length/2)};}));}
   const k=per[0].map((_,d)=>d).sort((a,b)=>per[0][b].max-per[0][a].max).slice(0,5);
   return {param,vals,top:k.map(d=>({id:Dr.ids[d],restBox:bbox(base[d]).map(v=>+v.toFixed(4)),maxBy:per.map(q=>+q[d].max.toFixed(4)),meanBy:per.map(q=>+q[d].mean.toFixed(4))}))};};
  res.eyeL=sweep('ParamEyeLOpen',[0,0.25,0.5,0.75]);
  res.mouth=sweep('ParamMouthOpenY',[1,0.5]);
  res.angleX=sweep('ParamAngleX',[30,15]);
  res.angleY=sweep('ParamAngleY',[30]);
  res.bodyX=sweep('ParamBodyAngleX',[10]);
  // face-turn parallax: mean x shift at AngleX=30 for every drawable, with its rest centre
  {const i=pid('ParamAngleX');reset();const base=snap();P.values[i]=30;const s=snap();
   res.parallax=base.map((d,k)=>{const bb=bbox(d);let sx=0;for(let j=0;j<d.length;j+=2)sx+=s[k][j]-d[j];return {id:Dr.ids[k],cx:+((bb[0]+bb[2])/2).toFixed(3),cy:+((bb[1]+bb[3])/2).toFixed(3),w:+(bb[2]-bb[0]).toFixed(3),dx:+(sx/(d.length/2)).toFixed(4)};}).filter(r=>Math.abs(r.dx)>1e-4).sort((a,b)=>b.dx-a.dx);}
  res.params=P.ids.length;return res;},name);
 out[name]=r;}
fs.writeFileSync(process.env.S+'/measure/result.json',JSON.stringify(out,null,1));await b.close();console.log('ok');})();
