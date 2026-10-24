import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {compile,evaluate} from './evaluate.mjs';
test('approved jaw and upper neck share motion through compound head, speech and chest poses',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../artwork/split-e/model-approved-a.json',import.meta.url))),c=compile(m),face=m.meshes.find(m=>m.id==='BODY_face'),neck=m.meshes.find(m=>m.id==='BODY_neck');
 const faceVertices=new Map(face.rest.flatMap((_,i)=>i%2?[]:[[face.rest[i]+','+face.rest[i+1],i]]));let compared=0;
 for(const sign of [-1,1]){const f=evaluate(c,{'head.yaw':sign*.2,'head.pitch':sign*.3,'head.tilt':sign*.13,'chest.turn':-sign,'body.breath':1,'mouth.open':1,'mouth.smile':1});
  for(let i=0;i<neck.rest.length;i+=2){const j=faceVertices.get(neck.rest[i]+','+neck.rest[i+1]);if(j===undefined||neck.rest[i+1]>413)continue;for(let k=0;k<2;k++)assert(Math.abs(f.positions.get(neck.id)[i+k]-f.positions.get(face.id)[j+k])<.0001);compared++;}}
 assert(compared>100);const zero=evaluate(c);for(const mesh of [neck,m.meshes.find(m=>m.id==='BODY_neck_collar_underlap')])for(let i=0;i<mesh.rest.length;i++)assert(Math.abs(zero.positions.get(mesh.id)[i]-mesh.rest[i])<.0001);
});
