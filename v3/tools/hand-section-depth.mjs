// Authored cross sections preserve source-A XY, topology, artwork and finger gaps.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function handSectionDepth(topology,profile,landmarks){
 return topology.depth.map((d,i)=>{
  const x=topology.rest[2*i],y=topology.rest[2*i+1],edgeDistance=Math.max(0,(d-1.5)/.6);
  const bulge=Math.exp(-(((x-profile.center[0])/profile.radius[0])**2+((y-profile.center[1])/profile.radius[1])**2));
  let radius=profile.section.palmRadius+(profile.section.palmBulge*bulge),influence=0,weighted=0;
  for(const [finger,points]of Object.entries(landmarks)){
   let nearest=Infinity,along=0;for(let j=0;j<3;j++){const a=points[j],b=points[j+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))),distance=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(distance<nearest){nearest=distance;along=j+t;}}
   const r=profile.section.digitRadii[finger],w=Math.exp(-((nearest/(r*1.3))**2))*smooth(-.15,.55,along)*smooth(points[0][1]-10,points[0][1]+18,y);
   weighted+=r*(1-.22*smooth(1.5,3,along))*w;influence+=w;
  }
  if(influence>0){const weight=Math.min(1,influence);radius=radius*(1-weight)+(weighted/influence)*weight;}
  const t=Math.min(1,edgeDistance/radius),rounded=profile.section.edgeRadius+radius*Math.sqrt(Math.max(0,2*t-t*t));
  const old=1.5+(d-1.5)*(1+profile.palmGain*bulge*smooth(...profile.wristBlend,y));
  const blend=smooth(...profile.wristBlend,y);return old*(1-blend)+rounded*blend;
 });
}
