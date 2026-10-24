import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {compile,evaluate} from './evaluate.mjs';import {applyApprovedAppearance} from './approved-appearance.mjs';
test('painted oral tissues remain hidden at rest and lie inside the authored opening',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../artwork/split-e/model-approved-a.json',import.meta.url))),c=compile(m),ids=['FACE_mouth_teeth_upper','FACE_mouth_tongue'];
 applyApprovedAppearance(m,{},'approved-neutral');for(const id of ids)assert.equal(m.meshes.find(x=>x.id===id).visible,false);
 for(const open of [.1,.5,1]){const f=evaluate(c,{'mouth.open':open});applyApprovedAppearance(m,f.state);for(const id of ids){const mesh=m.meshes.find(x=>x.id===id);assert.equal(mesh.visible,true);const p=f.positions.get(id);for(let i=0;i<p.length;i+=2){const x=mesh.rest[i],factor=Math.max(0,1-((x-526)/44)**2)**2;assert(p[i+1]>=348-3*factor*open-1e-4);assert(p[i+1]<=348+8*factor*open+1e-4);}}}
});
