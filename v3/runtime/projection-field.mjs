// Shared authored facial surface, sampled AFTER expression deformation.
export function compileFields(model){
 const fields=new Map();
 for(const f of model.projectionFields||[]){
  if(!f.id||fields.has(f.id)||!Number.isInteger(f.columns)||!Number.isInteger(f.rows)||f.columns<1||f.rows<1||!Array.isArray(f.bounds)||f.bounds.length!==4||!f.bounds.every(Number.isFinite)||f.bounds[2]<=f.bounds[0]||f.bounds[3]<=f.bounds[1]||f.depth?.length!==(f.columns+1)*(f.rows+1)||!f.depth.every(Number.isFinite))throw Error('Invalid projection field');
  fields.set(f.id,f);
 }
 for(const m of model.meshes)if(m.surface?.depthField&&(!m.surface.projectOnly||!fields.has(m.surface.depthField)))throw Error('Missing or incompatible projection field');
 return fields;
}
export function sampleField(f,x,y){
 const [x0,y0,x1,y1]=f.bounds,u=Math.max(0,Math.min(f.columns,(x-x0)/(x1-x0)*f.columns)),v=Math.max(0,Math.min(f.rows,(y-y0)/(y1-y0)*f.rows)),i=Math.min(f.columns-1,Math.floor(u)),j=Math.min(f.rows-1,Math.floor(v)),a=u-i,b=v-j,k=j*(f.columns+1)+i,n=f.columns+1;
 return (f.depth[k]*(1-a)+f.depth[k+1]*a)*(1-b)+(f.depth[k+n]*(1-a)+f.depth[k+n+1]*a)*b;
}
