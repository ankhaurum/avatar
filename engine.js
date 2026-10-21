export const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export class Spring{
 constructor(x=0,frequency=3,damping=1){Object.assign(this,{x,v:0,frequency,damping});}
 // Exact damped oscillator over a frame; no discarded elapsed simulation time.
 step(target,dt){
 if(dt<=0)return this.x;
 const w=2*Math.PI*this.frequency,z=this.damping,e=this.x-target,v=this.v;
 if(Math.abs(z-1)<.0001){const k=v+w*e,d=Math.exp(-w*dt);this.x=target+(e+k*dt)*d;this.v=(v-w*k*dt)*d;}
 else if(z<1){const wd=w*Math.sqrt(1-z*z),d=Math.exp(-z*w*dt),c=Math.cos(wd*dt),s=Math.sin(wd*dt);
 this.x=target+d*(e*c+(v+z*w*e)/wd*s);this.v=d*(v*c-(w*w*e+z*w*v)/wd*s);}
 else{const q=Math.sqrt(z*z-1),r1=-w*(z-q),r2=-w*(z+q),a=(v-r2*e)/(r1-r2),b=e-a,d1=Math.exp(r1*dt),d2=Math.exp(r2*dt);
 this.x=target+a*d1+b*d2;this.v=a*r1*d1+b*r2*d2;}
 return this.x;
 }
 reset(x=0){this.x=x;this.v=0;}
}
export function contactTarget(x,y,width,height){
 const nx=clamp((x/width-.5)*2),ny=clamp((y/height-.42)*2);
 return {gazeX:nx,gazeY:ny,yaw:nx*.88,pitch:ny*.42,roll:-nx*.09};
}
// CPU reference of the common GPU field, for attachment/continuity diagnostics.
export function projectPoint(x,y,p){
 const h=1-smooth(740,970,y),dx=x-583,dy=y-560;
 const z=18+110*Math.sqrt(Math.max(0,1-(dx/250)**2-(dy/330)**2))+42*Math.exp(-1*((x-594)/48)**2-((y-562)/78)**2);
 const a=p.yaw*.27,b=p.pitch*.16,r=p.roll*.07;
 const hx=583+dx*Math.cos(a)+z*Math.sin(a),hy=560+dy*Math.cos(b)+(z*Math.cos(a)-dx*Math.sin(a))*Math.sin(b);
 const rx=583+(hx-583)*Math.cos(r)-(hy-821)*Math.sin(r),ry=821+(hx-583)*Math.sin(r)+(hy-821)*Math.cos(r);
 const bt=p.bodyTurn||0,cv=p.chest||0,lean=p.bodyLean||0;
 let px=mix(x,rx,h)+p.leanX*(8+5*(1-h))+bt*5+(1-h)*((x-583)*(Math.cos(bt*.35)-1)+Math.sin(bt*.35)*18);
 let py=mix(y,ry,h)+(1-h)*(x-583)*bt*.012;
 const cw=Math.exp(-1*((y-1090)/250)**2),sw=Math.exp(-1*((y-960)/155)**2);
 px+=(x-583)*cv*.012*cw;
 py-=cv*7*cw+9*sw*((p.shoulderL||0)*Math.exp(-1*((x-270)/230)**2)+(p.shoulderR||0)*Math.exp(-1*((x-895)/230)**2));
 const ta=lean*.035,tx=px-583,ty=py-1402;
 return [583+tx*Math.cos(ta)-ty*Math.sin(ta),1402+tx*Math.sin(ta)+ty*Math.cos(ta)-cv*5*(1-smooth(1240,1480,y))];
}
const VERT=`#version 300 es
precision highp float;precision highp int;
in vec2 aRest;in vec2 aUV;out vec2 vUV;out vec2 vLocal;
uniform vec2 uSize;uniform vec4 uProjection;uniform vec4 uPose;uniform vec4 uFace;uniform vec4 uBody;uniform vec4 uHair;
uniform vec4 uTorso;uniform vec2 uGaze;uniform vec2 uOpen;uniform float uBrowTilt;
uniform int uKind;uniform int uEye;uniform int uHairGroup;
uniform vec4 uEyeCurve[2];uniform vec4 uEyeShape[2];
float sm(float a,float b,float v){return smoothstep(a,b,v);}
float gauss(vec2 p,vec2 c,vec2 s){vec2 d=(p-c)/s;return exp(-dot(d,d));}
vec3 eyeShape(float x,int i){
 vec4 e=uEyeCurve[i],s=uEyeShape[i];float t=clamp((x-e.x)/(e.z-e.x),0.,1.),wave=sin(t*3.14159265);
 float mid=mix(e.y,e.w,t);return vec3(mid-s.x*wave,mid+s.y*wave,t);
}
float seam(float x){float t=clamp((x-522.)/144.,0.,1.);return 646.-8.*t+7.*sin(t*3.14159265);}
vec2 localFeature(vec2 q){
 if(uKind==5){q+=uGaze*vec2(10.,6.);}
 if(uKind==6||uKind==7){vec3 e=eyeShape(q.x,uEye);float closed=1.-uOpen[uEye];
 if(uKind==6)q.y+=closed*(e.y-3.-e.x)*sm(e.x-32.,e.x+1.,q.y);
 else q.y-=closed*3.*(1.-sm(e.y,e.y+22.,q.y));}
 if(uKind==9||uKind==10){float s=seam(q.x),t=clamp((q.x-522.)/144.,0.,1.),w=pow(max(0.,sin(t*3.14159265)),.8);
 if(uKind==9)q.y-=uFace.x*6.*w*sm(615.,s,q.y);
 else q.y+=uFace.x*28.*w*(1.-sm(s,702.,q.y));}
 if(uKind==11||uKind==12){float s=seam(q.x);q.y=s+((q.y-649.)*(34./30.)-6.)*max(.015,uFace.x);}
 return q;
}
vec2 expressionWarp(vec2 q){
 float mouth=gauss(q,vec2(594.,650.),vec2(130.,95.));
 float corners=exp(-pow((abs(q.x-594.)-67.)/27.,2.)-pow((q.y-647.)/40.,2.));
 q.y-=uFace.y*12.*corners;q.x+=(q.x-594.)*uFace.y*.045*mouth;
 float browL=gauss(q,vec2(497.,420.),vec2(76.,31.)),browR=gauss(q,vec2(680.,416.),vec2(76.,31.));
 float inner=1.-clamp(abs(q.x-590.)/120.,0.,1.);
 q.y-=uFace.z*5.*(browL+browR)+uBrowTilt*5.*inner*(browL+browR);
 q.y-=uFace.y*4.*(gauss(q,vec2(498.,538.),vec2(66.,60.))+gauss(q,vec2(680.,534.),vec2(66.,60.)));
 q.y+=uFace.x*6.5*sm(665.,755.,q.y)*(1.-sm(790.,850.,q.y))*exp(-pow((q.x-594.)/165.,2.));
 return q;
}
vec2 project(vec2 q){
 float h=1.-sm(uProjection.z,uProjection.w,q.y),dx=q.x-583.,dy=q.y-560.;
 float z=18.+110.*sqrt(max(0.,1.-pow(dx/250.,2.)-pow(dy/330.,2.)))+42.*gauss(q,vec2(594.,562.),vec2(48.,78.));
 float a=uPose.x*uProjection.x,b=uPose.y*uProjection.y,r=uPose.z*.07;
 vec2 hp=vec2(583.+dx*cos(a)+z*sin(a),560.+dy*cos(b)+(z*cos(a)-dx*sin(a))*sin(b));
 vec2 d=hp-vec2(583.,821.);hp=vec2(583.,821.)+mat2(cos(r),sin(r),-sin(r),cos(r))*d;
 vec2 p=mix(q,hp,h);p.x+=uPose.w*(8.+5.*(1.-h))+uBody.w*5.;
 p.x+=(1.-h)*((q.x-583.)*(cos(uBody.w*.35)-1.)+sin(uBody.w*.35)*18.);
 p.y+=(1.-h)*(q.x-583.)*uBody.w*.012;
 float chest=exp(-pow((q.y-1090.)/250.,2.));
 float shoulders=exp(-pow((q.y-960.)/155.,2.));
 p.x+=(q.x-583.)*uTorso.y*.012*chest;
 p.y-=uTorso.y*7.*chest+9.*shoulders*(uBody.y*exp(-pow((q.x-270.)/230.,2.))+uBody.z*exp(-pow((q.x-895.)/230.,2.)));
 // Shared parent torso rotation/lift applies to skin, head and every garment.
 float torsoAngle=uTorso.x*.035;vec2 td=p-vec2(583.,1402.);
 p=vec2(583.,1402.)+mat2(cos(torsoAngle),sin(torsoAngle),-sin(torsoAngle),cos(torsoAngle))*td;
 p.y-=uTorso.y*5.*(1.-sm(1240.,1480.,q.y));
 if(uKind==3){
 // All adjoining hair textures sample the same continuous lag field.
 float side=mix(uHair.z,uHair.w,sm(570.,590.,q.x));
 float lag=mix(uHair.y,side,sm(420.,500.,q.y));lag=mix(lag,uHair.x,sm(740.,820.,q.y));
 float w=sm(300.,850.,q.y);p.x+=lag*w;p.y+=lag*w*(q.x-583.)*.0008;
 }
 return p;
}
void main(){vUV=aUV;vLocal=localFeature(aRest);vec2 p=project(expressionWarp(vLocal));gl_Position=vec4(p.x/uSize.x*2.-1.,1.-p.y/uSize.y*2.,0.,1.);}
`;
const FRAG=`#version 300 es
precision highp float;precision highp int;in vec2 vUV;in vec2 vLocal;out vec4 outColor;
uniform sampler2D uImage;uniform int uKind;uniform int uEye;
uniform vec2 uOpen;uniform float uMouth;uniform vec4 uEyeInfo[2];uniform vec4 uEyeShapeInfo[2];
void main(){
 vec4 c=texture(uImage,vUV);float coverage=1.;
 if(uKind==4||uKind==5){
 vec4 e=uEyeInfo[uEye],s=uEyeShapeInfo[uEye];float open=uOpen[uEye];
 float t=clamp((vLocal.x-e.x)/(e.z-e.x),0.,1.),wave=sin(t*3.14159265),base=mix(e.y,e.w,t);
 float top=base-s.x*wave,bot=base+s.y*wave;top=mix(top,bot-3.,1.-open);bot-=3.*(1.-open);
 coverage=smoothstep(top-.6,top+.6,vLocal.y)*(1.-smoothstep(bot-.6,bot+.6,vLocal.y));
 coverage*=smoothstep(e.x-1.,e.x+1.,vLocal.x)*(1.-smoothstep(e.z-1.,e.z+1.,vLocal.x))*smoothstep(0.,.07,open);
 }
 if(uKind==11||uKind==12){
 float t=clamp((vLocal.x-522.)/144.,0.,1.),w=pow(max(0.,sin(t*3.14159265)),.8),s=646.-8.*t+7.*sin(t*3.14159265);
 float top=s-uMouth*6.*w,bot=s+uMouth*28.*w;
 coverage=smoothstep(top-.5,top+.5,vLocal.y)*(1.-smoothstep(bot-.5,bot+.5,vLocal.y))*smoothstep(0.,.035,uMouth);
 }
 outColor=vec4(c.rgb,c.a*coverage);
}`;
const KINDS={face:0,garment:1,neck:2,hair:3,sclera:4,iris:5,lidUpper:6,lidLower:7,brow:8,lipUpper:9,lipLower:10,mouthCavity:11,teeth:12};
export class Renderer{
 constructor(canvas,rig){
 Object.assign(this,{canvas,rig,frames:0,drawMs:0,lost:false,resources:[]});
 const gl=this.gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true});
 if(!gl)throw Error('WebGL2を利用できません。静止画像を表示します。');
 const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,VERT));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(this.program);
 if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
 this.loc=Object.fromEntries(['uSize','uProjection','uPose','uFace','uBody','uHair','uTorso','uGaze','uOpen','uBrowTilt','uKind','uEye','uHairGroup','uEyeCurve[0]','uEyeShape[0]','uEyeInfo[0]','uEyeShapeInfo[0]','uMouth','uImage'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
 this.aRest=gl.getAttribLocation(this.program,'aRest');this.aUV=gl.getAttribLocation(this.program,'aUV');
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;canvas.dispatchEvent(new CustomEvent('riglost'));});
 canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 async load(){
 const gl=this.gl;
 for(const part of this.rig.parts){
 const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('素材読込失敗: '+part.url));i.src=part.url;});
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
 for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
 const {columns:nx,rows:ny}=part.mesh,[x,y,w,h]=part.rect,verts=[],indices=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)verts.push(x+w*i/nx,y+h*j/ny,i/nx,j/ny);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const vb=gl.createBuffer(),ib=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(this.aRest);gl.vertexAttribPointer(this.aRest,2,gl.FLOAT,false,16,0);
 gl.enableVertexAttribArray(this.aUV);gl.vertexAttribPointer(this.aUV,2,gl.FLOAT,false,16,8);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
 this.resources.push({part,texture,vao,vb,ib,count:indices.length,vertices:verts.length/4});
 }
 gl.bindVertexArray(null);
 }
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.7),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
 if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);}
 render(p){
 if(this.lost)return;
 const begin=performance.now(),gl=this.gl,L=this.loc;
 this.resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.program);
 gl.uniform2f(L.uSize,this.rig.width,this.rig.height);const pr=this.rig.projection;gl.uniform4f(L.uProjection,pr.yawRadians,pr.pitchRadians,...pr.neckTransition);gl.uniform4f(L.uPose,p.yaw,p.pitch,p.roll,p.leanX);gl.uniform4f(L.uFace,p.mouth,p.smile,p.brow,p.squint);
 gl.uniform4f(L.uBody,p.breath,p.shoulderL,p.shoulderR,p.bodyTurn||0);gl.uniform4f(L.uHair,p.hairBack||0,p.hairFringe||0,p.hairLeft||0,p.hairRight||0);
 gl.uniform4f(L.uTorso,p.bodyLean||0,p.chest||0,0,0);gl.uniform2f(L.uGaze,p.gazeX,p.gazeY);gl.uniform2f(L.uOpen,p.eyeL,p.eyeR);gl.uniform1f(L.uMouth,p.mouth);gl.uniform1f(L.uBrowTilt,p.browTilt);
 const endpoints=this.rig.eyes.flatMap(e=>[e.x0,e.y0,e.x1,e.y1]),shape=this.rig.eyes.flatMap(e=>[e.up,e.down,e.cx,e.cy]);
 for(const n of ['uEyeCurve[0]','uEyeInfo[0]'])gl.uniform4fv(L[n],endpoints);
 for(const n of ['uEyeShape[0]','uEyeShapeInfo[0]'])gl.uniform4fv(L[n],shape);
 gl.uniform1i(L.uImage,0);
 for(const r of this.resources){const k=KINDS[r.part.kind]??0;gl.uniform1i(L.uKind,k);gl.uniform1i(L.uEye,r.part.eye??0);gl.uniform1i(L.uHairGroup,r.part.hairGroup??0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,r.texture);gl.bindVertexArray(r.vao);gl.drawElements(gl.TRIANGLES,r.count,gl.UNSIGNED_SHORT,0);}
 gl.bindVertexArray(null);this.frames++;this.drawMs=performance.now()-begin;
 }
 dispose(){const g=this.gl;for(const r of this.resources){g.deleteTexture(r.texture);g.deleteVertexArray(r.vao);g.deleteBuffer(r.vb);g.deleteBuffer(r.ib);}g.deleteProgram(this.program);this.resources=[];}
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
