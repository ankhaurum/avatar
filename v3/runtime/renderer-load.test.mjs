import test from 'node:test';import assert from 'node:assert/strict';import {loadImages} from './renderer.mjs';

test('remote texture loading overlaps requests, preserves identity order and reuses only matching sources',async()=>{
 const savedFetch=globalThis.fetch,savedImage=globalThis.Image;let active=0,peak=0,calls=0;
 globalThis.Image=class{naturalWidth=2;naturalHeight=3;async decode(){}};
 globalThis.fetch=async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};};
 try{const model={textures:Array.from({length:9},(_,i)=>({id:'t'+i,file:'t'+i+'.png',width:2,height:3}))},base='https://example.test/avatar/v3/model.json',images=await loadImages(model,base);
 assert(peak>1&&peak<=4);assert.equal(calls,9);assert.deepEqual([...images.keys()],model.textures.map(t=>t.id));
 await loadImages(model,base,images);assert.equal(calls,9);await loadImages(model,'https://example.test/other/model.json',images);assert.equal(calls,18);
 await assert.rejects(loadImages({textures:[{id:'broken',file:'broken.png',sha256:'bad'}]},base),/Texture broken: SHA256 mismatch/);
 await assert.rejects(loadImages({textures:[{id:'wrong-size',file:'s.png',width:1}]},base),/Dimensions mismatch/);
 }finally{globalThis.fetch=savedFetch;globalThis.Image=savedImage;}
});
