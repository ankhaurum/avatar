// Independent thin-plate interpolation of artist-authored landmark pairs.
// It interpolates a specified target silhouette; it does not infer anatomy.
const kernel=(x,y)=>{const r=x*x+y*y;return r===0?0:r*Math.log(r);};
function solve(matrix,rhs){
 const a=matrix.map((row,i)=>[...row,rhs[i]]),n=a.length;
 for(let c=0;c<n;c++){
  let pivot=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;
  if(Math.abs(a[pivot][c])<1e-12)throw Error('Landmarks are duplicate, collinear or ill-conditioned');
  [a[c],a[pivot]]=[a[pivot],a[c]];const divisor=a[c][c];for(let j=c;j<=n;j++)a[c][j]/=divisor;
  for(let r=0;r<n;r++)if(r!==c){const factor=a[r][c];for(let j=c;j<=n;j++)a[r][j]-=factor*a[c][j];}
 }
 return a.map(row=>row[n]);
}
export function landmarkWarp(source,target){
 if(source.length<3||source.length!==target.length||[...source,...target].some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('Invalid paired landmarks');
 const cx=source.reduce((s,p)=>s+p[0],0)/source.length,cy=source.reduce((s,p)=>s+p[1],0)/source.length;
 const scale=Math.sqrt(source.reduce((s,p)=>s+(p[0]-cx)**2+(p[1]-cy)**2,0)/source.length);
 if(!scale)throw Error('Coincident landmarks');
 const points=source.map(([x,y])=>[(x-cx)/scale,(y-cy)/scale]),n=points.length;
 const matrix=Array.from({length:n+3},()=>Array(n+3).fill(0));
 for(let i=0;i<n;i++){for(let j=0;j<n;j++)matrix[i][j]=kernel(points[i][0]-points[j][0],points[i][1]-points[j][1]);matrix[i][n]=matrix[n][i]=1;matrix[i][n+1]=matrix[n+1][i]=points[i][0];matrix[i][n+2]=matrix[n+2][i]=points[i][1];}
 const wx=solve(matrix,[...target.map(p=>(p[0]-cx)/scale),0,0,0]),wy=solve(matrix,[...target.map(p=>(p[1]-cy)/scale),0,0,0]);
 return (x,y)=>{const u=(x-cx)/scale,v=(y-cy)/scale;let tx=wx[n]+wx[n+1]*u+wx[n+2]*v,ty=wy[n]+wy[n+1]*u+wy[n+2]*v;for(let i=0;i<n;i++){const k=kernel(u-points[i][0],v-points[i][1]);tx+=wx[i]*k;ty+=wy[i]*k;}return [tx*scale+cx,ty*scale+cy];};
}
export function inverseSkin(mesh,matrices,vertex,x,y){
 const matrix=mesh.weights?mesh.weights[vertex].reduce((a,w)=>a.map((v,i)=>v+matrices.get(w.node)[i]*w.weight),[0,0,0,0,0,0]):matrices.get(mesh.node);
 const [a,b,c,d,tx,ty]=matrix,det=a*d-b*c;
 if(Math.abs(det)<1e-8)throw Error('Pose cannot be inverted at vertex '+vertex);
 return [(d*(x-tx)-c*(y-ty))/det,(-b*(x-tx)+a*(y-ty))/det];
}
export function invertedTriangles(rest,positions,indices){
 const area=(p,a,b,c)=>(p[b*2]-p[a*2])*(p[c*2+1]-p[a*2+1])-(p[b*2+1]-p[a*2+1])*(p[c*2]-p[a*2]);
 const result=[];for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3);if(area(rest,...tri)*area(positions,...tri)<=0)result.push(i/3);}return result;
}
