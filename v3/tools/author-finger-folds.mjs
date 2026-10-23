// Authored local crease profiles. Values are candidate sculpt data, not anatomy guarantees.
import fs from 'node:fs';import {compile} from '../runtime/evaluate.mjs';import {fingers} from './rig-layout.mjs';
const [input,output]=process.argv.slice(2);if(fs.existsSync(output))throw Error('Revision exists');const m=JSON.parse(fs.readFileSync(input));
for(const mesh of m.meshes){const a=mesh.authoring;if(a?.kind!=='traced-hand-surface'||a.digit==='palm')continue;const side=mesh.id.split('.')[1],digit=a.digit,points=fingers[digit],names=digit==='thumb'?['cmc','mcp','ip']:['mcp','pip','dip'];
 for(let j=0;j<3;j++){const parameter='finger.'+side+'.'+digit+'.'+names[j],pivot=points[j][1],keys=[0,.7,1.4];
  mesh.shapes.push({id:'fold.'+parameter,axes:[{parameter,keys}],keys:keys.map(value=>({at:[value],delta:Array(mesh.rest.length).fill(0),depthDelta:mesh.surface.depth.map((z,i)=>{const d=mesh.rest[2*i+1]-pivot,rad=Math.abs(z),centre=Math.exp(-((d/4)**2)),lobes=Math.exp(-(((Math.abs(d)-7)/5)**2));return value/1.4*(a.face==='volar'?rad*(.16*centre-.08*lobes):rad*.08*centre);})}))});
 }
}
m.authoringStatus+=' 指節の局所厚み補正を制作中。';compile(m);fs.writeFileSync(output,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({output,folds:m.meshes.reduce((n,x)=>n+x.shapes.filter(s=>s.id?.startsWith('fold.')).length,0)}));
