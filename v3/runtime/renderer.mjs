// Small WebGL2 renderer shared by the authoring surface and the eventual runtime.
const vertex=`#version 300 es
in vec2 position;in float depth;in vec2 uv;uniform vec2 canvasSize;uniform vec2 canvasOrigin;out vec2 texcoord;
void main(){gl_Position=vec4((position.x-canvasOrigin.x)/canvasSize.x*2.-1.,1.-(position.y-canvasOrigin.y)/canvasSize.y*2.,-depth/2048.,1.);texcoord=uv;}`;
const fragment=`#version 300 es
precision mediump float;uniform sampler2D image;uniform float opacity;uniform bool maskPass;in vec2 texcoord;out vec4 color;
void main(){vec4 p=texture(image,texcoord)*opacity;if(p.a<0.01)discard;color=p;}`;
export class Renderer{
 constructor(canvas,model,images){
  this.canvas=canvas;this.model=model;this.resources=new Map();this.textures=new Map();this.destroyed=false;
  const gl=this.gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,stencil:true,depth:true,antialias:true});
  if(!gl)throw Error('WebGL2 is unavailable; the model has not rendered');
  if(!gl.getContextAttributes().stencil)throw Error('Stencil masks unavailable');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;};
  const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment),program=this.program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  this.origin=gl.getUniformLocation(program,'canvasOrigin');this.size=gl.getUniformLocation(program,'canvasSize');this.opacity=gl.getUniformLocation(program,'opacity');this.maskPass=gl.getUniformLocation(program,'maskPass');
  gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'image'),0);
  for(const [id,image]of images){
   const texture=gl.createTexture();this.textures.set(id,texture);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  for(const mesh of model.meshes){
   if(!this.textures.has(mesh.texture))throw Error('Missing texture '+mesh.texture);
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   const positions=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positions);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.rest),gl.DYNAMIC_DRAW);
   const pa=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pa);gl.vertexAttribPointer(pa,2,gl.FLOAT,false,0,0);
   const uvs=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvs);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.uv),gl.STATIC_DRAW);
   const ua=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(ua);gl.vertexAttribPointer(ua,2,gl.FLOAT,false,0,0);
   const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(mesh.triangles),gl.STATIC_DRAW);
   const depths=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,depths);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.rest.length/2),gl.DYNAMIC_DRAW);
   const da=gl.getAttribLocation(program,'depth');gl.enableVertexAttribArray(da);gl.vertexAttribPointer(da,1,gl.FLOAT,false,0,0);
   this.resources.set(mesh.id,{mesh,vao,positions,depths,uvs,indices});
  }
  gl.bindVertexArray(null);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
 render(frame){
  if(this.destroyed||this.gl.isContextLost())return false;
  const gl=this.gl;this.resize();gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);const view=this.view||[0,0,this.model.width,this.model.height];gl.uniform2f(this.size,view[2],view[3]);gl.uniform2f(this.origin,view[0],view[1]);
  gl.colorMask(true,true,true,true);gl.stencilMask(255);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  // Invisible costume/body layers need no GPU upload; visible stencil consumers
  // still require their hidden mask geometry. Visibility may change every frame.
  const required=new Set();for(const mesh of this.model.meshes)if(mesh.visible!==false){required.add(mesh.id);for(const id of mesh.masks||[])required.add(id);}
  for(const [id,p]of frame.positions){if(!required.has(id))continue;const r=this.resources.get(id);gl.bindBuffer(gl.ARRAY_BUFFER,r.positions);gl.bufferSubData(gl.ARRAY_BUFFER,0,p);gl.bindBuffer(gl.ARRAY_BUFFER,r.depths);gl.bufferSubData(gl.ARRAY_BUFFER,0,frame.depths?.get(id)||new Float32Array(p.length/2));}
  const draw=(mesh,mask=false)=>{const r=this.resources.get(mesh.id);gl.bindVertexArray(r.vao);gl.bindTexture(gl.TEXTURE_2D,this.textures.get(mesh.texture));gl.uniform1f(this.opacity,mask?1:(mesh.opacity??1));gl.uniform1i(this.maskPass,mask?1:0);gl.drawElements(gl.TRIANGLES,mesh.triangles.length,gl.UNSIGNED_INT,0);};
  const meshes=this.model.meshes.map((mesh,i)=>({mesh,i})).sort((a,b)=>a.mesh.order-b.mesh.order||a.i-b.i);
  const renderedGroups=new Set();
  for(const {mesh}of meshes){
   if(mesh.visible===false||mesh.maskOnly)continue;
   if(mesh.surface&&!mesh.surface.projectOnly){const group=mesh.surface.group;if(renderedGroups.has(group))continue;renderedGroups.add(group);gl.disable(gl.STENCIL_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CW);for(const {mesh:part}of meshes)if(part.visible!==false&&part.surface?.group===group&&!part.surface.projectOnly)draw(part);gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);continue;}
   if(mesh.masks?.length){
    gl.enable(gl.STENCIL_TEST);gl.stencilMask(255);gl.clear(gl.STENCIL_BUFFER_BIT);gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);gl.colorMask(false,false,false,false);
    for(const id of mesh.masks)draw(this.resources.get(id).mesh,true);
    gl.colorMask(true,true,true,true);gl.stencilMask(0);gl.stencilFunc(gl.EQUAL,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
   }else gl.disable(gl.STENCIL_TEST);
   draw(mesh);
  }
  gl.bindVertexArray(null);gl.disable(gl.STENCIL_TEST);gl.stencilMask(255);return true;
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;const gl=this.gl;for(const r of this.resources.values()){gl.deleteVertexArray(r.vao);for(const b of [r.positions,r.depths,r.uvs,r.indices])gl.deleteBuffer(b);}for(const t of this.textures.values())gl.deleteTexture(t);gl.deleteProgram(this.program);}
}
export async function loadImages(model,baseURL,previous=new Map()){
 const images=new Map();
 let nextTexture=0;
 const load=async t=>{
  const url=new URL(t.file,baseURL);if(t.sha256)url.searchParams.set('sha256',t.sha256);const key=url.href+'|'+t.sha256;
  if(url.origin!==new URL(baseURL).origin)throw Error('Texture must belong to the authoring origin: '+t.id);
  if(previous.get(t.id)?.sourceKey===key){images.set(t.id,previous.get(t.id));return;}
  let objectURL;
  try{
   const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);
   const bytes=await response.arrayBuffer();
   if(t.sha256){const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==t.sha256)throw Error('SHA256 mismatch');}
   objectURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
   const image=new Image();image.src=objectURL;await image.decode();
   if(t.width&&image.naturalWidth!==t.width||t.height&&image.naturalHeight!==t.height)throw Error('Dimensions mismatch');
   image.sourceKey=key;images.set(t.id,image);
  }catch(e){throw Error('Texture '+t.id+': '+e.message);}
  finally{if(objectURL)URL.revokeObjectURL(objectURL);}
 };
 await Promise.all(Array.from({length:Math.min(4,model.textures.length)},async()=>{while(nextTexture<model.textures.length)await load(model.textures[nextTexture++]);}));
 return new Map(model.textures.map(t=>[t.id,images.get(t.id)]));
}
