import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,evaluate} from './evaluate.mjs';
test('closing surfaces meet after head rotation even when their rest depths differ',()=>{
 const m={format:'hibiki-model',version:1,width:100,height:100,parameters:[{id:'blink',min:0,max:1,default:1},{id:'yaw',min:-1,max:1,default:.6}],nodes:[{id:'root',pivot:[0,0]}],surfaceNodes:[{id:'head',pivot:[0,0,0],bindings:{y:[{parameter:'yaw',factor:1}]}}],projectionFields:[{id:'face',bounds:[0,0,100,100],columns:1,rows:1,depth:[0,0,50,50]}],meshes:[],seams:[]};
 for(const [id,y,z]of [['upper',20,10],['lower',40,20]])m.meshes.push({id,node:'root',order:0,rest:[0,y,10,y,0,y+10],uv:[0,0,1,0,0,1],triangles:[0,1,2],shapes:[{axes:[{parameter:'blink',keys:[0,1]}],keys:[{at:[0],delta:[0,0,0,0,0,0]},{at:[1],delta:[0,30-y,0,30-y,0,30-y]}]}],surface:{group:'head',projectOnly:true,depthField:'face',depth:[z,z,z+5],weights:Array.from({length:3},()=>[{node:'head',weight:1}])}});
 const c=compile(m);for(const yaw of [-.6,0,.6]){const f=evaluate(c,{yaw,blink:1});assert.deepEqual(f.positions.get('upper'),f.positions.get('lower'));}
 m.meshes[0].surface.depthField='missing';assert.throws(()=>compile(m),/projection field/);
});
