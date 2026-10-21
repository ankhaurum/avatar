export const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export class Spring {
 constructor(value=0,frequency=3,damping=1){this.x=value;this.v=0;this.frequency=frequency;this.damping=damping;}
 step(target,dt){dt=clamp(dt,0,.05);const n=Math.max(1,Math.ceil(dt/.008));const h=dt/n,w=2*Math.PI*this.frequency;
 for(let i=0;i<n;i++){this.v+=((target-this.x)*w*w-2*this.damping*w*this.v)*h;this.x+=this.v*h;}return this.x;}
 reset(v=0){this.x=v;this.v=0;}
}
export function bodyPoint(x,y,p){
 const chest=Math.exp(-1*((y-1120)/270)**2),left=Math.exp(-1*((x-270)/230)**2),right=Math.exp(-1*((x-895)/230)**2);
 const shoulderBand=Math.exp(-1*((y-960)/170)**2);
 const dx=p.leanX*5*clamp((y-780)/500,0,1)+(x-583)*p.breath*.003*chest;
 const dy=-p.breath*2.1*chest-(p.shoulderL*left+p.shoulderR*right)*4*shoulderBand;
 return [x+dx,y+dy];
}
export function configurePart(part,keys){return {...part,correction:{yaw:keys?.headYaw?.keys.at(-1).noseX??19,pitchUp:Math.abs(keys?.headPitch?.keys[0].noseY??12),pitchDown:keys?.headPitch?.keys.at(-1).noseY??13,compression:keys?.headYaw?.keys.at(-1).cheekCompression??.055}};}
export function deformPoint(x,y,p,part){
 const kind=part.kind;
 if(kind==='brow'){const side=part.side==='left'?-1:1;x+=side*p.browTilt*1.5;y-=p.brow*7+p.browTilt*(x-part.center[0])*.08;}
 if(kind==='eye'){const cy=part.center[1];y=cy+(y-cy)*(1-p.squint*.2);}
 if(kind==='mouthClosed'||kind==='mouthOpen'){
 const dx=x-596,dy=y-650;
 x=596+dx*(1+.045*p.smile);y-=p.smile*3.8*(Math.abs(dx)/85)**1.7;
 if(kind==='mouthOpen'){const dy=y-656;y-=Math.sign(dy)*(1-p.mouth)*6*smooth(0,14,Math.abs(dy))*(1-smooth(35,65,Math.abs(dy)));}
 }
 let [xx,yy]=bodyPoint(x,y,p);
 const neckWeight=kind==='garment'?0:1-smooth(790,940,y);
 const headWeight=neckWeight;
 const faceW=Math.exp(-1*((x-592)/220)**2-((y-564)/275)**2);
 const c=part.correction||{yaw:19,pitchUp:12,pitchDown:13,compression:.055};
 const yawX=p.yaw*(13+(c.yaw-13)*faceW),pitchY=p.pitch*(6+((p.pitch<0?c.pitchUp:c.pitchDown)-6)*faceW);
 const compression=1-c.compression*Math.abs(p.yaw)*faceW;
 let hx=583+(x-583)*compression+yawX;
 let hy=y+pitchY+p.yaw*(x-583)*.009;
 const angle=p.roll*.045;
 const cx=hx-583,cy=hy-821;
 hx=583+cx*Math.cos(angle)-cy*Math.sin(angle);
 hy=821+cx*Math.sin(angle)+cy*Math.cos(angle);
 hx+=p.leanX*1.4;hy-=p.breath*.35;
 xx=mix(xx,hx,headWeight); yy=mix(yy,hy,headWeight);
 if(kind==='hair'){
 const root=part.id==='hair-fringe'?270:420,weight=smooth(root,865,y);
 xx+=p.hair*weight*(part.id==='hair-fringe'?.35:1);
 yy+=Math.abs(p.hair)*.12*weight;
 }
 return [xx,yy];
}
const VS=`#version 300 es
in vec2 aPosition;in vec2 aUV;out vec2 vUV;
uniform vec2 uSize;
void main(){vUV=aUV;gl_Position=vec4(aPosition.x/uSize.x*2.-1.,1.-aPosition.y/uSize.y*2.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;in vec2 vUV;out vec4 outColor;
uniform sampler2D uImage;uniform float uOpacity;uniform vec2 uGaze;uniform vec2 uEyeCenter;
void main(){
 vec2 uv=vUV;
 // Local gaze displacement: edges stay fixed; only ocular pixels are resampled.
 vec2 d=(uv-uEyeCenter)/vec2(.26,.23);
 float w=exp(-dot(d,d)*2.);
 uv-=uGaze*w;
 vec4 c=texture(uImage,uv);
 outColor=vec4(c.rgb,c.a*uOpacity);
}`;
export class Renderer {
 constructor(canvas,rig){
 this.canvas=canvas;this.rig=rig;this.lost=false;this.frames=0;this.drawMs=0;
 this.gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true});
 if(!this.gl)throw Error('WebGL2を利用できません。静止画像を表示します。');
 const gl=this.gl;
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(this.program);
 if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
 this.aPos=gl.getAttribLocation(this.program,'aPosition');this.aUV=gl.getAttribLocation(this.program,'aUV');
 this.uniforms=Object.fromEntries(['uSize','uImage','uOpacity','uGaze','uEyeCenter'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
 this.resources=[];
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;canvas.dispatchEvent(new CustomEvent('riglost'));});
 canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 async load(){
 const gl=this.gl;
 for(const rawPart of this.rig.parts){
 const part=configurePart(rawPart,this.rig.deformationKeys);
 const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('素材読込失敗: '+part.url));i.src=part.url;});
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
 for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
 const {columns:nx,rows:ny}=part.mesh,[x,y,w,h]=part.rect;
 const rest=[],uv=[],index=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){rest.push(x+w*i/nx,y+h*j/ny);uv.push(i/nx,j/ny);}
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;index.push(a,c,b,b,c,d);}
 const pos=gl.createBuffer(),uvb=gl.createBuffer(),ib=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,uvb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(index),gl.STATIC_DRAW);
 this.resources.push({part,texture,pos,uvb,ib,rest:new Float32Array(rest),live:new Float32Array(rest.length),count:index.length});
 }
 }
 resize(){const {canvas,gl}=this,dpr=Math.min(devicePixelRatio||1,1.6),r=canvas.getBoundingClientRect();const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);}
 render(p){
 if(this.lost)return;
 const started=performance.now(),gl=this.gl;
 this.resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 gl.useProgram(this.program);gl.uniform2f(this.uniforms.uSize,this.rig.width,this.rig.height);gl.uniform1i(this.uniforms.uImage,0);
 const blink=smooth(.1,.9,p.eyeOpen),mouth=smooth(.015,.18,p.mouth);
 for(const r of this.resources){
 const part=r.part;let opacity=1;
 const open=part.side==='left'?p.eyeL:p.eyeR;
 if(part.kind==='eye')opacity=smooth(.12,.92,open);
 if(part.kind==='eyelid')opacity=1-smooth(.12,.92,open);
 if(part.kind==='mouthClosed')opacity=1-mouth;
 if(part.kind==='mouthOpen')opacity=mouth;
 if(opacity<.002)continue;
 for(let i=0;i<r.rest.length;i+=2){const q=deformPoint(r.rest[i],r.rest[i+1],p,part);r.live[i]=q[0];r.live[i+1]=q[1];}
 gl.bindBuffer(gl.ARRAY_BUFFER,r.pos);gl.bufferData(gl.ARRAY_BUFFER,r.live,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(this.aPos);gl.vertexAttribPointer(this.aPos,2,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,r.uvb);gl.enableVertexAttribArray(this.aUV);gl.vertexAttribPointer(this.aUV,2,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,r.ib);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,r.texture);
 gl.uniform1f(this.uniforms.uOpacity,opacity);
 const gaze=part.kind==='eye';
 gl.uniform2f(this.uniforms.uGaze,gaze?p.gazeX*.045:0,gaze?p.gazeY*.025:0);
 gl.uniform2f(this.uniforms.uEyeCenter,part.center?(part.center[0]-part.rect[0])/part.rect[2]:.5,part.center?(part.center[1]-part.rect[1])/part.rect[3]:.5);
 gl.drawElements(gl.TRIANGLES,r.count,gl.UNSIGNED_SHORT,0);
 }
 this.frames++;this.drawMs=performance.now()-started;
 }
 dispose(){const gl=this.gl;for(const r of this.resources){gl.deleteTexture(r.texture);[r.pos,r.uvb,r.ib].forEach(b=>gl.deleteBuffer(b));}gl.deleteProgram(this.program);this.resources=[];}
}
export class AudioDriver {
 constructor(){this.mode='none';this.envelope=0;this.playing=false;this.audio=null;this.ownedUrl=null;this.peakRms=0;this.peakEnvelope=0;}
 async attach(file){this.stop();this.peakRms=0;this.peakEnvelope=0;this.context??=new AudioContext();await this.context.resume();
 this.audio=new Audio();this.audio.preload='auto';this.audio.src=URL.createObjectURL(file);this.ownedUrl=this.audio.src;
 this.source=this.context.createMediaElementSource(this.audio);this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;
 this.samples=new Float32Array(1024);this.source.connect(this.analyser);this.analyser.connect(this.context.destination);
 this.audio.onended=()=>{this.playing=false;this.envelope=0;this.mode='none';};this.audio.onerror=()=>{this.stop();document.querySelector('#audioStatus').textContent='音声を読み込めません';};
 await this.audio.play();this.mode='local-audio';this.playing=true;
 }
 async tone(){
 this.stop();this.peakRms=0;this.peakEnvelope=0;this.context??=new AudioContext();await this.context.resume();
 const n=Math.round(this.context.sampleRate*8),buf=this.context.createBuffer(1,n,this.context.sampleRate),d=buf.getChannelData(0);
 for(let i=0;i<n;i++){const t=i/this.context.sampleRate,a=Math.max(0,Math.sin(t*12))**2*.15;d[i]=(Math.sin(t*2*Math.PI*190)+.3*Math.sin(t*2*Math.PI*380))*a;}
 const src=this.context.createBufferSource();src.buffer=buf;this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.samples=new Float32Array(1024);
 src.connect(this.analyser);this.analyser.connect(this.context.destination);src.onended=()=>{this.playing=false;this.envelope=0;this.mode='none';};this.source=src;src.start();this.playing=true;this.mode='test-tone';
 }
 value(dt){let rms=0;if(this.playing&&this.analyser){this.analyser.getFloatTimeDomainData(this.samples);for(const v of this.samples)rms+=v*v;rms=Math.sqrt(rms/this.samples.length);}
 const target=clamp((rms-.009)*7,0,1),rate=target>this.envelope?30:14;
 this.envelope=mix(this.envelope,target,1-Math.exp(-rate*dt));this.peakRms=Math.max(this.peakRms,rms);this.peakEnvelope=Math.max(this.peakEnvelope,this.envelope);return this.envelope;
 }
 stop(){if(this.audio){this.audio.pause();this.audio.src='';this.audio=null;}if(this.ownedUrl)URL.revokeObjectURL(this.ownedUrl);this.ownedUrl=null;
 try{this.source?.stop?.();}catch{}this.source?.disconnect?.();this.analyser?.disconnect?.();this.playing=false;this.mode='none';this.envelope=0;}
 dispose(){this.stop();this.context?.close();}
}
