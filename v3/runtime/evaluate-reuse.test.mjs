import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {compile,evaluate} from './evaluate.mjs';
test('reused source-A outputs match fresh evaluation through changing and neutral poses',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../artwork/split-e/model-approved-a.json',import.meta.url))),c=compile(m),other=compile(structuredClone(m)),saved=evaluate(c),snapshots=new Map([...saved.positions].map(([k,v])=>[k,v.slice()]));let frame=evaluate(c),first=frame.positions.get(m.meshes[0].id);
 for(let i=0;i<12;i++){const pose=i===11?{}:{'arm.r.elbow':Math.sin(i)*1.3,'forearm.r.twist':Math.cos(i)*2,'finger.r.index.mcp':Math.sin(i)*.4,'mouth.open':(i%4)/3,'body.breath':.5},fresh=evaluate(c,pose);frame=evaluate(c,pose,frame);assert.equal(frame.positions.get(m.meshes[0].id),first);for(const key of ['positions','depths'])for(const [id,v]of fresh[key])assert.deepEqual(frame[key].get(id),v);}
 for(const [id,v]of snapshots)assert.deepEqual(saved.positions.get(id),v);assert.throws(()=>evaluate(other,{},frame),/same compiled model/);
});
