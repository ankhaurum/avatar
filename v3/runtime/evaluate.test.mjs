import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,evaluate} from './evaluate.mjs';
function fixture(){return {format:'hibiki-model',version:1,width:100,height:100,parameters:[{id:'a',min:0,max:Math.PI,default:0},{id:'b',min:0,max:1,default:0}],nodes:[{id:'root',pivot:[0,0],bindings:{rotation:[{parameter:'a',factor:1}]}},{id:'child',parent:'root',pivot:[10,0],bindings:{x:[{parameter:'b',factor:10}]}}],meshes:[{id:'m',node:'child',rest:[10,0,20,0,10,10],uv:[0,0,1,0,0,1],triangles:[0,1,2],order:0}],seams:[]};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('hierarchical rotation preserves shape at intermediate angles and rotates child translation',()=>{
 const c=compile(fixture()),p=evaluate(c,{a:Math.PI/2,b:1}).positions.get('m');
 close(p[0],0);close(p[1],20);close(Math.hypot(p[2]-p[0],p[3]-p[1]),10);
});
test('authored cross-axis key contributes only where its weight applies; compile does not mutate author data',()=>{
 const m=fixture();m.meshes[0].shapes=[{axes:[{parameter:'a',keys:[0,1]},{parameter:'b',keys:[0,1]}],keys:[{at:[0,0],delta:[0,0,0,0,0,0]},{at:[1,0],delta:[0,0,0,0,0,0]},{at:[0,1],delta:[0,0,0,0,0,0]},{at:[1,1],delta:[8,0,0,0,0,0]}]}];m.nodes[0].bindings={};m.nodes[1].bindings={};const before=JSON.stringify(m),c=compile(m);
 close(evaluate(c,{a:.5,b:.5}).positions.get('m')[0],12);assert.equal(JSON.stringify(m),before);
 m.meshes[0].shapes[0].keys.pop();assert.throws(()=>compile(m),/Missing authored key/);
});
test('seams use common evaluated endpoints and reject overlapping conflicting groups',()=>{
 const m=fixture();m.meshes.push({...m.meshes[0],id:'n',node:'root'});m.seams=[{vertices:[{mesh:'m',vertex:0},{mesh:'n',vertex:0}]}];const frame=evaluate(compile(m),{b:1});close(frame.positions.get('m')[0],15);close(frame.positions.get('n')[0],15);
 m.seams.push(m.seams[0]);assert.throws(()=>compile(m),/multiple seam groups/);
});
test('invalid skin weights, hierarchy cycles and non-finite inputs are not silently repaired',()=>{
 const m=fixture();m.meshes[0].weights=Array.from({length:3},()=>[{node:'root',weight:.4}]);assert.throws(()=>compile(m),/sum to one/);delete m.meshes[0].weights;m.nodes[0].parent='child';assert.throws(()=>compile(m),/cycle/);delete m.nodes[0].parent;assert.throws(()=>evaluate(compile(m),{b:NaN}),/Non-finite/);
});

test('editing an initially zero shape key is reflected without reloading author data',()=>{
 const m=fixture();m.nodes[0].bindings={};m.nodes[1].bindings={};const delta=[0,0,0,0,0,0];m.meshes[0].shapes=[{axes:[{parameter:'b',keys:[0,1]}],keys:[{at:[0],delta:[0,0,0,0,0,0]},{at:[1],delta}]}];const c=compile(m);close(evaluate(c,{b:1}).positions.get('m')[0],10);delta[0]=3;close(evaluate(c,{b:1}).positions.get('m')[0],13);delta[0]=0;close(evaluate(c,{b:1}).positions.get('m')[0],10);
});

test('planar rigid skinning retains a joint section and neutral coordinates',()=>{
 const m=fixture();m.nodes=[{id:'root',pivot:[0,0],bindings:{rotation:[{parameter:'a',factor:1}]}},{id:'other',pivot:[0,0],bindings:{rotation:[{parameter:'a',factor:-1}]}}];m.meshes[0].node='root';m.meshes[0].weights=m.meshes[0].rest.filter((_,i)=>i%2===0).map(()=>[{node:'root',weight:.5},{node:'other',weight:.5}]);m.meshes[0].blend='dual-quaternion';const c=compile(m),zero=evaluate(c),turned=evaluate(c,{a:Math.PI/3});for(let i=0;i<m.meshes[0].rest.length;i++){close(zero.positions.get('m')[i],m.meshes[0].rest[i]);close(turned.positions.get('m')[i],m.meshes[0].rest[i]);}
});
