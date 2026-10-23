// Three Hibiki-specific views: dorsal, edge, palm. No negative scale or flat flip.
// Align silhouettes before interpolating surface appearance; keep the wrist attached.
export class HandTurn {
 constructor({MeshSimple,Texture,world,image}){
  this.views=[];this.bounds=[];this.last=-1;
  for(let k=0;k<3;k++){
   const c=document.createElement('canvas');c.width=256;c.height=448;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,-k*256,0);this.views.push(c);
   const d=g.getImageData(0,0,256,448).data,rows=[];
   for(let y=0;y<448;y+=2){let left=256,right=-1;for(let yy=y;yy<y+2;yy++)for(let x=0;x<256;x++)if(d[(yy*256+x)*4+3]>80){left=Math.min(left,x);right=Math.max(right,x);}rows.push(right<left?[124,132]:[Math.max(0,left-1),Math.min(256,right+2)]);}this.bounds.push(rows);
  }
  this.canvas=document.createElement('canvas');this.canvas.width=256;this.canvas.height=448;this.g=this.canvas.getContext('2d');
  const rest=[],uv=[],ids=[],cols=8,rows=28;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){rest.push(157+i*32,760+j*(408/28));uv.push(i/cols,j/rows);}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;ids.push(a,b,a+1,a+1,b,b+1);}
  this.rest=rest;this.texture=Texture.from(this.canvas);this.mesh=new MeshSimple({texture:this.texture,vertices:new Float32Array(rest),uvs:new Float32Array(uv),indices:new Uint16Array(ids)});world.addChild(this.mesh);this.mesh.visible=false;this.paint(1);
 }
 paint(turn){
  const t=Math.round(Math.max(0,Math.min(1,turn))*90)/90;if(t===this.last)return;this.last=t;
  const a=Math.min(1,Math.floor(t*2)),b=a+1,w=t*2-a,g=this.g;
  // Cross visible surface appearance only near the edge-on silhouette. A broad
  // crossfade produces doubled nails/fingers although the outer contour matches.
  const s=Math.max(0,Math.min(1,a===0?(w-.8)/.2:w/.2)),appearance=s*s*(3-2*s);
  g.clearRect(0,0,256,448);g.globalCompositeOperation='lighter';
  for(let row=0;row<224;row++){
   const ra=this.bounds[a][row],rb=this.bounds[b][row],left=ra[0]*(1-w)+rb[0]*w,right=ra[1]*(1-w)+rb[1]*w;
   for(const [k,weight]of [[a,1-appearance],[b,appearance]])if(weight>0){const r=this.bounds[k][row];g.globalAlpha=weight;g.drawImage(this.views[k],r[0],row*2,r[1]-r[0],2,left,row*2,right-left,2);}
  }g.globalAlpha=1;g.globalCompositeOperation='source-over';this.texture.source.update();
 }
 draw(active,turn,project){this.mesh.visible=active;if(!active)return;this.paint(turn);const v=this.mesh.vertices;for(let i=0;i<this.rest.length;i+=2)v.set(project(this.rest[i],this.rest[i+1]),i);this.mesh.geometry.getBuffer('aPosition').update();}
}
