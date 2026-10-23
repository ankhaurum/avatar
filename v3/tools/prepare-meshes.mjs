// Starts editable topology from a verified PSD export. This does NOT author
// anatomical motion, corrective shapes or automatic weights.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [manifestArg,outputArg]=process.argv.slice(2);
if(!manifestArg||!outputArg)throw Error('Usage: node prepare-meshes.mjs export/manifest.json model.json');
const manifestPath=path.resolve(manifestArg),output=path.resolve(outputArg),directory=path.dirname(manifestPath),m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(fs.existsSync(output))throw Error('Refusing to overwrite authored mesh data');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(hash(fs.readFileSync(path.resolve(directory,m.source.path)))!==m.source.sha256)throw Error('PSD changed after export');
const model={format:'hibiki-model',version:1,width:m.width,height:m.height,authoringStatus:'初期メッシュ。姿勢キー・接合・可動範囲は制作中。',source:{manifest:path.relative(path.dirname(output),manifestPath).replaceAll('\\','/'),sha256:hash(fs.readFileSync(manifestPath))},parameters:[],nodes:[{id:'canvas',pivot:[0,0]}],textures:[],meshes:[],seams:[]};
for(const [index,l] of m.layers.entries()){
 const file=path.resolve(directory,l.file);if(hash(fs.readFileSync(file))!==l.sha256)throw Error('Texture changed '+l.id);
 model.textures.push({id:l.id,file:path.relative(path.dirname(output),file).replaceAll('\\','/'),width:l.width,height:l.height,sha256:l.sha256});
 const [x0,y0,x1,y1]=l.bounds;
 // Starter density follows image extent. Artists replace/refine rows at joints
 // and contours; this value is not a model-quality or performance requirement.
 const columns=Math.max(2,Math.min(12,Math.ceil(l.width/60))),rows=Math.max(2,Math.min(18,Math.ceil(l.height/60)));
 const rest=[],uv=[],triangles=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){rest.push(x0+(x1-x0)*x/columns,y0+(y1-y0)*y/rows);uv.push(x/columns,y/rows);}
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+1,c=a+columns+1,d=c+1;triangles.push(a,b,c,b,d,c);}
 model.meshes.push({id:l.id,texture:l.id,node:'canvas',rest,uv,triangles,order:m.layers.length-index,visible:l.visible,shapes:[],authoring:{columns,rows,sourceBounds:l.bounds}});
}
fs.writeFileSync(output,JSON.stringify(model,null,2)+'\n');console.log(JSON.stringify({output,meshes:model.meshes.length,poseKeys:0}));
