// Continuous Hibiki hand surface. Material orientation changes are restricted
// by the gesture choreography to the portion below the bust crop. A full visible
// dorsal-to-palmar turn is NOT solved by this implementation.
export class HandTurn{
 constructor({MeshSimple,Texture,world,image}){
  this.points=[];this.triangles=[];const uv=[],ids=[],cols=24,rows=40;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){this.points.push([x/cols*256,y/rows*448]);uv.push((512+x/cols*256)/768,y/rows);}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;ids.push(a,b,a+1,a+1,b,b+1);}
  this.triangles=Array(ids.length/3);
  this.mesh=new MeshSimple({texture:Texture.from(image),vertices:new Float32Array(this.points.length*2),uvs:new Float32Array(uv),indices:new Uint16Array(ids)});world.addChild(this.mesh);this.mesh.visible=false;this.parts=[{meshes:[this.mesh]}];this.view=2;
 }
 draw(active,turn,project,curl=0){
  this.mesh.visible=active;if(!active)return;
  const view=turn<.25?0:turn<.75?1:2;
  if(view!==this.view){this.view=view;const uv=this.mesh.geometry.getBuffer('aUV');for(let i=0;i<this.points.length;i++){uv.data[i*2]=(view*256+this.points[i][0])/768;uv.data[i*2+1]=this.points[i][1]/448;}uv.update();}
  for(let i=0;i<this.points.length;i++){
   let [x,y]=this.points[i];const w=Math.max(0,Math.min(1,(250-y)/180)),flex=Math.max(0,Math.min(1,curl));
   // Subtle authored open-hand relaxation, with a fixed metacarpal boundary.
   x+=flex*w*w*(x-128)*.035;y+=flex*w*w*5;
   const underlap=Math.max(0,Math.min(1,(y-390)/58));y+=120*underlap*underlap*(3-2*underlap);
   this.mesh.vertices.set(project(157+x,760+y*408/448),i*2);
  }this.mesh.geometry.getBuffer('aPosition').update();
 }
}
