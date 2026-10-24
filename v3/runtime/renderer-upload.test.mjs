import test from 'node:test';import assert from 'node:assert/strict';import {Renderer} from './renderer.mjs';
test('render skips hidden geometry but uploads hidden masks and freshly revealed clothing',()=>{
 const calls=[],gl=new Proxy({isContextLost:()=>false,bindBuffer:(_,buffer)=>calls.push(['bind',buffer]),bufferSubData:()=>calls.push(['upload'])},{get:(target,key)=>key in target?target[key]:(()=>{})});
 const meshes=[{id:'body',texture:'t',order:1,masks:['mask'],triangles:[0,1,2]},{id:'mask',texture:'t',order:0,visible:false,maskOnly:true,triangles:[0,1,2]},{id:'coat',texture:'t',order:2,visible:false,triangles:[0,1,2]}];
 const ctx={gl,canvas:{width:10,height:10},model:{width:10,height:10,meshes},resize(){},resources:new Map(meshes.map(mesh=>[mesh.id,{mesh,positions:mesh.id+'.xy',depths:mesh.id+'.z'}])),textures:new Map([['t',{}]])};
 const frame={positions:new Map(meshes.map(m=>[m.id,new Float32Array(6)])),depths:new Map(meshes.map(m=>[m.id,new Float32Array(3)]))};Renderer.prototype.render.call(ctx,frame);
 assert.deepEqual(calls.filter(c=>c[0]==='bind').map(c=>c[1]),['body.xy','body.z','mask.xy','mask.z']);
 meshes[2].visible=true;calls.length=0;Renderer.prototype.render.call(ctx,frame);assert(calls.some(c=>c[1]==='coat.xy'));assert(calls.some(c=>c[1]==='coat.z'));
});
