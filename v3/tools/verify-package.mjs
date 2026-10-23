// Verify the deliverable uses assets present in the Git index, not local-only candidates.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=process.cwd(),preview=fs.readFileSync('v3/preview.mjs','utf8'),author=fs.readFileSync('v3/author.mjs','utf8');
const name=/const MODEL_PATH='([^']+)'/.exec(preview)?.[1];if(!name||!preview.includes('json(MODEL_PATH)')||!preview.includes('new URL(MODEL_PATH,location.href)'))throw Error('Preview must load one declared model');
const authorName=/baseURL=new URL\('([^']+)'/.exec(author)?.[1];if(authorName!==name)throw Error('Author and preview models differ');
const modelPath=path.resolve('v3',name),m=JSON.parse(fs.readFileSync(modelPath)),manifestPath=path.resolve(path.dirname(modelPath),m.source.manifest),manifest=JSON.parse(fs.readFileSync(manifestPath)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),files=[modelPath,manifestPath,path.resolve(path.dirname(manifestPath),manifest.source.path)];
if(sha(manifestPath)!==m.source.sha256||sha(files[2])!==manifest.source.sha256)throw Error('Source identity mismatch');
for(const t of m.textures){const file=path.resolve(path.dirname(modelPath),t.file);if(sha(file)!==t.sha256)throw Error('Texture identity mismatch '+t.id);files.push(file);}
const relative=files.map(p=>path.relative(root,p).replaceAll('\\','/'));if(relative.some(p=>p.startsWith('../')))throw Error('Asset outside repository');
execFileSync('git',['ls-files','--error-unmatch','--',...relative],{stdio:'pipe'});
console.log(JSON.stringify({model:name,manifest:m.source.manifest,indexedAssets:files.length,sourceSHA256:manifest.source.sha256,scope:'Source, manifest and texture closure in Git index; not a visual quality verdict'}));
