import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {armChain} from './arm-rig.js';import {armPoint,ARM_MIRROR_X,reflectArmChain} from './arm-space.js';
import {greetingPose} from './greeting.js';import {composeBustIntent} from './bust-rig.js';
for(const t of [0,.2,.5,.8,1]){const r=armChain(t),l=reflectArmChain(r,'left');for(const k of ['shoulder','elbow','wrist']){assert.equal(r[k][0]+l[k][0],ARM_MIRROR_X);assert.equal(r[k][1],l[k][1]);}assert.ok(Math.abs(armPoint(...armPoint(...r.wrist,'left'),'left')[0]-r.wrist[0])<1e-9);}
const r=composeBustIntent({},greetingPose(3,'right')),l=composeBustIntent({},greetingPose(3,'left'));assert.equal(r.shoulderL,l.shoulderR);assert.equal(r.postureX,-l.postureX);
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8794/studies/continuity/');await page.waitForFunction(()=>window.study?.ready);
 const result=await page.evaluate(async()=>{
  const {Application,Container,MeshSimple,Texture,Graphics}=await import('./vendor/pixi.min.mjs'),{RightGreeting}=await import('./greeting.js'),{ARM_MIRROR_X}=await import('./arm-space.js');
  const image=new Image(),sleeveImage=new Image(),handTurnImage=new Image();handTurnImage.src="materials/hand-turn.png";image.src='materials/right-greeting.png';sleeveImage.src='materials/sleeve-cloth.png';await Promise.all([image.decode(),sleeveImage.decode(),handTurnImage.decode()]);
  const pictures=[],sides=[],rigs=[];let checkedPixels=0,minAlpha=255;
  for(const side of ['right','left']){
   const app=new Application();await app.init({width:1122,height:1402,resolution:1,autoStart:false,backgroundAlpha:0,preference:'webgl',preserveDrawingBuffer:true,antialias:true});
   const world=new Container();app.stage.addChild(world);const sf=study.surface;
   const main=new MeshSimple({texture:Texture.from(study.materials.base),vertices:new Float32Array(sf.rest),uvs:new Float32Array(sf.uvs),indices:new Uint32Array(sf.indices)});world.addChild(main);
   const rig=new RightGreeting({MeshSimple,Texture,Graphics,world,main,image,sleeveImage,handTurnImage,side});rigs.push(rig);
   const c=document.createElement('canvas');c.width=1122;c.height=1402;const g=c.getContext('2d',{willReadFrequently:true});
   let samples=0;for(let step=0;step<64;step++){
    rig.preview(step/10);rig.draw({});app.renderer.render(app.stage);g.clearRect(0,0,1122,1402);g.drawImage(app.canvas,0,0);const data=g.getImageData(0,0,1122,1402).data,joins=rig.upperArm.joins;
    for(let row=0;row<joins.length-1;row++)for(const v of [.25,.5,.75])for(const u of [.25,.5,.75]){
     const a=joins[row],b=joins[row+1],q=[0,1].map(k=>(1-v)*((1-u)*a.sleeve[k]+u*a.body[k])+v*((1-u)*b.sleeve[k]+u*b.body[k]));
     const x=Math.round(q[0]),y=Math.round(q[1]);if(x<2||x>1119||y<940||y>1398)continue;const alpha=data[(y*1122+x)*4+3];minAlpha=Math.min(minAlpha,alpha);checkedPixels++;if(alpha<245)throw Error('socket alpha hole '+JSON.stringify({side,step,row,x,y,alpha}));
    }samples++;
   }
   rig.preview(5.4);rig.draw({});app.renderer.render(app.stage);const shot=document.createElement('canvas');shot.width=390;shot.height=488;const sg=shot.getContext('2d');sg.fillStyle='#d622ae';sg.fillRect(0,0,390,488);sg.drawImage(app.canvas,0,0,390,488);pictures.push(shot.toDataURL());
   sides.push({side,samples});
  }
  const a=rigs[0],b=rigs[1];let mirrorError=0;for(const [av,bv] of [[a.handTurn.mesh.vertices,b.handTurn.mesh.vertices],[a.mesh.vertices,b.mesh.vertices],[a.sleeve.meshes[0].vertices,b.sleeve.meshes[0].vertices],[a.upperArm.mesh.vertices,b.upperArm.mesh.vertices],[a.upperArm.lining.vertices,b.upperArm.lining.vertices]])for(let i=0;i<av.length;i+=2)mirrorError=Math.max(mirrorError,Math.abs(av[i]+bv[i]-ARM_MIRROR_X),Math.abs(av[i+1]-bv[i+1]));
  for(const rig of rigs){rig.stop();if(rig.upperArm.main.mask||rig.upperArm.lining.visible)throw Error('stop retained socket');}
  return {checkedPixels,minAlpha,sides,mirrorError,pictures};
 });
 assert(result.mirrorError<.001,JSON.stringify(result));assert.deepEqual(errors,[]);
 await page.setViewportSize({width:780,height:520});await page.setContent('<style>body{margin:0;display:flex;font:16px sans-serif}figure{margin:0}img{display:block;width:390px}</style>'+result.pictures.map((s,i)=>'<figure><figcaption>'+['Character right / deployed','Mirrored control / local verification'][i]+'</figcaption><img src="'+s+'"></figure>').join(''));await page.screenshot({path:new URL('./evidence/arm-socket-mirror.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});delete result.pictures;
 fs.writeFileSync(new URL('./evidence/arm-socket-verification.json',import.meta.url),JSON.stringify({...result,errors,scope:'64 phases per side in PC Chrome WebGL; reflected render verified locally only; no physical phone acceptance'},null,2));console.log(result);
}finally{await browser.close();}
