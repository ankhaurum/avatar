// Small WebGL2 renderer shared by the authoring surface and the eventual runtime.
const vertex=`#version 300 es
in vec2 position;in vec2 uv;uniform vec2 canvasSize;uniform vec2 canvasOrigin;out vec2 texcoord;
void main(){gl_Position=vec4((position.x-canvasOrigin.x)/canvasSize.x*2.-1.,1.-(position.y-canvasOrigin.y)/canvasSize.y*2.,0.,1.);texcoord=uv;}`;
const fragment=`#version 300 es
precision mediump float;uniform sampler2D image;uniform float opacity;uniform bool maskPass;in vec2 texcoord;out vec4 color;
void main(){vec4 p=texture(image,texcoord)*opacity;if(maskPass&&p.a<0.01)discard;color=p;}`;
export class Renderer{
 constructor(canvas,model,images){
  this.canvas=canvas;this.model=model;this.resources=new Map();this.textures=new Map();this.destroyed=false;
  const gl=this.gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,stencil:true,antialias:true});
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
   this.resources.set(mesh.id,{mesh,vao,positions,uvs,indices});
  }
  gl.bindVertexArray(null);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
 render(frame){
  if(this.destroyed||this.gl.isContextLost())return false;
  const gl=this.gl;this.resize();gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);const view=this.view||[0,0,this.model.width,this.model.height];gl.uniform2f(this.size,view[2],view[3]);gl.uniform2f(this.origin,view[0],view[1]);
  gl.colorMask(true,true,true,true);gl.stencilMask(255);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  for(const [id,p]of frame.positions){const r=this.resources.get(id);gl.bindBuffer(gl.ARRAY_BUFFER,r.positions);gl.bufferSubData(gl.ARRAY_BUFFER,0,p);}
  const draw=(mesh,mask=false)=>{const r=this.resources.get(mesh.id);gl.bindVertexArray(r.vao);gl.bindTexture(gl.TEXTURE_2D,this.textures.get(mesh.texture));gl.uniform1f(this.opacity,mask?1:(mesh.opacity??1));gl.uniform1i(this.maskPass,mask?1:0);gl.drawElements(gl.TRIANGLES,mesh.triangles.length,gl.UNSIGNED_INT,0);};
  const meshes=this.model.meshes.map((mesh,i)=>({mesh,i})).sort((a,b)=>a.mesh.order-b.mesh.order||a.i-b.i);
  for(const {mesh}of meshes){
   if(mesh.visible===false||mesh.maskOnly)continue;
   if(mesh.masks?.length){
    gl.enable(gl.STENCIL_TEST);gl.stencilMask(255);gl.clear(gl.STENCIL_BUFFER_BIT);gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);gl.colorMask(false,false,false,false);
    for(const id of mesh.masks)draw(this.resources.get(id).mesh,true);
    gl.colorMask(true,true,true,true);gl.stencilMask(0);gl.stencilFunc(gl.EQUAL,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
   }else gl.disable(gl.STENCIL_TEST);
   draw(mesh);
  }
  gl.bindVertexArray(null);gl.disable(gl.STENCIL_TEST);gl.stencilMask(255);return true;
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;const gl=this.gl;for(const r of this.resources.values()){gl.deleteVertexArray(r.vao);for(const b of [r.positions,r.uvs,r.indices])gl.deleteBuffer(b);}for(const t of this.textures.values())gl.deleteTexture(t);gl.deleteProgram(this.program);}
}
export async function loadImages(model,baseURL){
 const images=new Map();await Promise.all(model.textures.map(async t=>{const image=new Image();image.src=new URL(t.file,baseURL);await image.decode();if(t.width&&image.naturalWidth!==t.width||t.height&&image.naturalHeight!==t.height)throw Error('Texture size mismatch '+t.id);images.set(t.id,image);}));return images;
}
