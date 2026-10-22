// Original sleeve contour keys in Hibiki's source coordinates. Cuff rows pinned.
export const SLEEVE_ROWS=[
 [1220,153,366],[1240,141,364],[1270,123,353],[1300,106,343],
 [1340,79,328],[1380,35,312],[1420,12,285],[1460,25,246],[1490,65,194]
];
// Bent elbow: inner fold compresses; outer contour retains volume. No hand scaling.
const MID=[[0,0,0],[0,0,0],[-2,2,-1],[-4,4,-3],[-7,6,-4],[-8,8,-4],[-5,9,-5],[0,5,-4],[0,0,0]];
const BENT=[[0,0,0],[0,0,0],[-3,3,-2],[-6,6,-4],[-10,9,-7],[-12,11,-7],[-8,12,-6],[-2,8,-5],[0,0,0]];
export function sleevePoint(row,u,bend){
 const k=Math.max(0,Math.min(1,bend)),a=k<.55?null:MID,b=k<.55?MID:BENT,t=k<.55?k/.55:(k-.55)/.45;
 const delta=[0,1,2].map(i=>(a?.[row][i]||0)*(1-t)+b[row][i]*t),[y,left,right]=SLEEVE_ROWS[row];
 return [left+delta[1]+(right+delta[2]-left-delta[1])*u,y+delta[0]];
}
export class Sleeve {
 constructor({MeshSimple,Texture,world,image}){
  const positions=[],uv=[],indices=[],cols=8;
  for(let r=0;r<SLEEVE_ROWS.length;r++)for(let i=0;i<=cols;i++){positions.push(...sleevePoint(r,i/cols,0));uv.push(i/cols,r/(SLEEVE_ROWS.length-1));}
  for(let r=0;r<SLEEVE_ROWS.length-1;r++)for(let i=0;i<cols;i++){const a=r*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const texture=Texture.from(image);this.cols=cols;
  this.meshes=[0,1].map(panel=>{const mesh=new MeshSimple({texture,vertices:new Float32Array(positions),uvs:new Float32Array(uv.map((v,i)=>i%2?v:(v*.49+.005+panel*.5))),indices:new Uint16Array(indices)});mesh.visible=false;world.addChild(mesh);return mesh;});
 }
 draw(active,bend,project){
  for(const m of this.meshes)m.visible=active;if(!active)return;
  this.meshes[0].alpha=1;this.meshes[1].alpha=Math.max(0,Math.min(1,bend));
  const vertices=this.meshes[0].vertices;
  for(let row=0;row<SLEEVE_ROWS.length;row++)for(let i=0;i<=this.cols;i++)vertices.set(project(...sleevePoint(row,i/this.cols,bend)),(row*(this.cols+1)+i)*2);
  for(const m of this.meshes){if(m!==this.meshes[0])m.vertices.set(vertices);m.geometry.getBuffer('aPosition').update();}
 }
}
