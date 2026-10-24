import fs from 'node:fs';import {compile} from '../runtime/evaluate.mjs';
const [input,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Output exists');const m=JSON.parse(fs.readFileSync(input)),clamp=x=>Math.max(0,Math.min(1,x)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
for(const mesh of m.meshes){
 if(/^arm\.[rl]\.upper$/.test(mesh.id)){
  const side=mesh.id.split('.')[1];
  mesh.weights=mesh.weights.map((row,i)=>{const y=mesh.rest[i*2+1],t=smooth((y-925)/220);const result=[{node:'clavicle.'+side,weight:1-t},...row.map(w=>({...w,weight:w.weight*t}))];return result;});
 }else if(mesh.id==='body.base'||mesh.id==='shirt'||mesh.id.startsWith('lapel.')){
  mesh.weights=Array.from({length:mesh.rest.length/2},(_,i)=>{const x=mesh.rest[i*2],y=mesh.rest[i*2+1],r=smooth((780-x)/220)*smooth((1260-y)/330),l=smooth((x-1100)/220)*smooth((1260-y)/330),base=mesh.weights?.[i]||[{node:mesh.node,weight:1}];return [...base.map(w=>({...w,weight:w.weight*(1-r-l)})),{node:'clavicle.r',weight:r},{node:'clavicle.l',weight:l}];});
 }else if(mesh.id==='neck'){
  mesh.weights=Array.from({length:mesh.rest.length/2},(_,i)=>{const t=smooth((930-mesh.rest[i*2+1])/160);return [{node:'neck',weight:1-t},{node:'head',weight:t}];});
 }
}
m.rig.shoulderResponse=[[0,0],[.65,-8],[1.35,-25]];
m.authoringStatus+=' 肩口・胸の共有追従帯を制作中。';
compile(m);fs.writeFileSync(output,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({output}));
