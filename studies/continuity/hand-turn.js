// Independent local-depth hand cage; no source-model geometry.
// Corresponding named fingers retain lengths during forearm rotation.
// Extend edge colours only in the runtime texture. The cage owns the silhouette;
// sampling transparent source margins must not punch holes through its side.
function paddedTexture(image){
 const c=document.createElement('canvas');c.width=768;c.height=448;const g=c.getContext('2d');g.drawImage(image,0,0);
 for(const col of [0,2]){const d=g.getImageData(col*256,0,256,448),n=256*448,seen=new Uint8Array(n),q=new Int32Array(n);let a=0,b=0;
  for(let k=0;k<n;k++)if(d.data[k*4+3]>220){seen[k]=1;q[b++]=k;d.data[k*4+3]=255;}
  while(a<b){const k=q[a++],x=k%256;for(const j of [x?k-1:-1,x<255?k+1:-1,k-256,k+256])if(j>=0&&j<n&&!seen[j]){seen[j]=1;q[b++]=j;for(let ch=0;ch<3;ch++)d.data[j*4+ch]=d.data[k*4+ch];d.data[j*4+3]=255;}}
  g.putImageData(d,col*256,0);
 }return c;
}
const parts=[
 {name:'palm',rings:[[155,132,1,0,128,155,1],[175,132,35,5,128,175,35],[200,132,64,14,128,202,58],[235,133,78,23,128,233,76],[285,132,85,25,128,280,78],[335,130,74,23,128,330,68],[390,128,57,18,128,388,55],[440,128,58,16,128,440,55]]},
 {name:'index',rings:[[46,94,1,1,160,47,1],[55,94,10,7,160,55,10],[76,92,16,11,160,76,16],[120,89,17,12,163,120,17],[170,85,17,12,166,167,17],[222,83,18,12,168,218,18],[260,86,20,12,167,257,20]]},
 {name:'middle',rings:[[25,127,1,1,130,25,1],[33,127,10,7,130,33,10],[54,126,16,11,130,54,16],[110,124,18,12,131,110,17],[166,123,18,12,132,166,18],[223,124,20,13,133,220,20],[263,125,22,13,132,260,22]]},
 {name:'ring',rings:[[47,156,1,1,99,45,1],[55,156,10,7,99,54,10],[78,157,15,11,98,77,15],[128,160,17,12,98,126,16],[179,161,18,12,97,177,17],[231,163,19,13,96,230,19],[270,164,21,13,98,267,21]]},
 {name:'little',rings:[[113,191,1,1,69,100,1],[121,192,10,7,69,108,10],[145,194,15,10,67,130,14],[182,197,15,11,65,173,15],[220,199,16,11,64,213,16],[259,199,18,12,65,252,18],[292,193,21,13,72,287,21]]},
 {name:'thumb',rings:[[178,18,1,1,243,175,1],[187,23,10,7,236,187,10],[208,28,15,11,232,206,14],[242,33,16,12,226,240,16],[277,45,20,14,216,275,20],[310,66,29,16,197,310,28],[333,83,33,18,179,331,31]]}
];
export class HandTurn {
 constructor({MeshSimple,Texture,world,image}){
  this.points=[];this.triangles=[];const uv=[],indices=[],step=4,cols=65,rows=113,grid=[],faces=[];
  const source=document.createElement('canvas');source.width=256;source.height=448;const ctx=source.getContext('2d');ctx.drawImage(image,0,0);const alpha=ctx.getImageData(0,0,256,448).data;
  const inside=(x,y)=>x>=0&&x<256&&y>=0&&y<448&&alpha[(Math.round(y)*256+Math.round(x))*4+3]>180;
  const depth=(x,y)=>{let z=1.5;for(const {rings}of parts)for(let j=1;j<rings.length;j++){const a=rings[j-1],b=rings[j];if(y<a[0]||y>b[0])continue;const t=(y-a[0])/(b[0]-a[0]),cx=a[1]+t*(b[1]-a[1]),rx=a[2]+t*(b[2]-a[2]),rz=a[3]+t*(b[3]-a[3]),u=(x-cx)/rx;if(Math.abs(u)<1)z=Math.max(z,rz*Math.sqrt(1-u*u));}return z;};
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)grid.push({x:i*step,y:j*step});
  // A shared triangulated surface preserves the original image across every
  // finger root. Named anatomical regions shape depth, never split the texture.
  for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){const a=j*cols+i,b=a+cols;for(const tri of [[a,b,a+1],[a+1,b,b+1]]){const x=tri.reduce((s,k)=>s+grid[k].x,0)/3,y=tri.reduce((s,k)=>s+grid[k].y,0)/3;if(inside(x,y)||tri.some(k=>inside(grid[k].x,grid[k].y)))faces.push(tri);}}
  const edges=new Map(),used=[...new Set(faces.flat())],remap=new Map(used.map((k,i)=>[k,i]));
  for(const tri of faces)for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');edges.set(key,edges.has(key)?null:[a,b]);}
  const boundary=new Set([...edges.values()].filter(Boolean).flat());
  for(const back of [true,false])for(const k of used){const p=grid[k],z=boundary.has(k)?0:depth(p.x,p.y);this.points.push({...p,z:back?z:-z});const pinky=Math.max(0,Math.min(1,(p.x-172)/20))*Math.max(0,Math.min(1,(240-p.y)/100));uv.push((back?p.x:768-p.x)/768,(back?p.y:p.y-13*pinky)/448);}
  const n=used.length;
  for(const tri of faces){this.triangles.push(tri.map(k=>remap.get(k)),tri.map(k=>remap.get(k)+n));}
  for(const edge of edges.values())if(edge){const [a,b]=edge.map(k=>remap.get(k));this.triangles.push([a,b,a+n],[b,b+n,a+n]);}
  for(const tri of this.triangles)indices.push(...tri);
  this.rest=this.points.flatMap(p=>[157+p.x,760+p.y*(408/448)]);
  this.image=image;this.padding=paddedTexture(image);this.canvas=document.createElement('canvas');this.canvas.width=768;this.canvas.height=448;this.ctx=this.canvas.getContext('2d');this.ctx.drawImage(image,0,0);this.lastTone=-1;
  this.texture=Texture.from(this.canvas);this.mesh=new MeshSimple({texture:this.texture,vertices:new Float32Array(this.rest),uvs:new Float32Array(uv),indices:new Uint16Array(indices)});
  this.sorted=new Uint16Array(indices.length);this.depth=new Float32Array(this.points.length);this.order=this.triangles.map((tri,i)=>({tri,i,z:0}));this.lastOrder=-1;world.addChild(this.mesh);this.mesh.visible=false;
 }
 draw(active,turn,project){
  this.mesh.visible=active;if(!active)return;
  const angle=Math.max(0,Math.min(1,turn))*Math.PI,v=this.mesh.vertices;
  // Near profile, opaque edge colours close the two-sided material. End views
  // keep the approved source alpha. This never changes whole-hand opacity.
  const tone=Math.round(Math.sin(angle)**4*90)/90;if(tone!==this.lastTone){this.lastTone=tone;const g=this.ctx;g.clearRect(0,0,768,448);g.drawImage(this.image,0,0);g.globalAlpha=tone;g.drawImage(this.padding,0,0);g.globalAlpha=1;this.texture.source.update();}
  for(let i=0;i<this.points.length;i++){
   const p=this.points[i],dx=p.x-128,a=angle;
   const x=128+dx*Math.cos(a)+p.z*Math.sin(a);this.depth[i]=-dx*Math.sin(a)+p.z*Math.cos(a);
   v.set(project(157+x,760+p.y*(408/448)),i*2);
  }
  const orderKey=Math.round(angle*180/Math.PI);if(orderKey!==this.lastOrder){this.lastOrder=orderKey;for(const t of this.order)t.z=(this.depth[t.tri[0]]+this.depth[t.tri[1]]+this.depth[t.tri[2]])/3;this.order.sort((a,b)=>a.z-b.z||a.i-b.i);this.order.forEach((t,i)=>this.sorted.set(t.tri,i*3));this.mesh.geometry.indexBuffer.data.set(this.sorted);this.mesh.geometry.indexBuffer.update();}
  this.mesh.geometry.getBuffer('aPosition').update();
 }
}
