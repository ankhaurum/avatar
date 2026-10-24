import {test} from 'node:test';import assert from 'node:assert/strict';
import {surfaceMatrices,transform} from './surface.mjs';import {rigidBlendPoint} from './rigid-blend.mjs';
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7));
test('rigid blending preserves knuckle section radius where linear blending collapses it',()=>{
 const m=surfaceMatrices([{id:'a',pivot:[0,0,0],bindings:{}},{id:'b',pivot:[0,0,0],bindings:{y:[{parameter:'turn',factor:1}]}}],{turn:Math.PI});
 const p=rigidBlendPoint([{node:'a',weight:.5},{node:'b',weight:.5}],m,1,0,0);assert.ok(Math.abs(Math.hypot(...p)-1)<1e-7);
 const a=transform(m.get('a'),1,0,0),b=transform(m.get('b'),1,0,0);assert.ok(Math.hypot(...a.map((v,i)=>(v+b[i])/2))<1e-7);
});
test('single-joint rigid blending agrees with hierarchical matrices across rotations and translations',()=>{
 for(const angle of [-3.14,-1,0,1,3.14]){const m=surfaceMatrices([{id:'a',pivot:[12,30,4],bindings:{y:[{parameter:'a',factor:1}]}},{id:'b',parent:'a',pivot:[18,55,-2],bindings:{x:[{parameter:'a',factor:.4}]}}],{a:angle});near(rigidBlendPoint([{node:'b',weight:1}],m,21,62,8),transform(m.get('b'),21,62,8));}
});
test('adjacent rotations crossing the quaternion sign boundary blend continuously',()=>{
 const nodes=[{id:'a',pivot:[0,0,0],bindings:{y:[{parameter:'a',factor:1}]}},{id:'b',pivot:[0,0,0],bindings:{y:[{parameter:'b',factor:1}]}}],m=surfaceMatrices(nodes,{a:Math.PI-.01,b:Math.PI+.01});near(rigidBlendPoint([{node:'a',weight:.5},{node:'b',weight:.5}],m,1,0,0),[-1,0,0]);
});
