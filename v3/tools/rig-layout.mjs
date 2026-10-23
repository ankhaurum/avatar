// Rest landmarks measured on the independently authored PSD canvas.
// R/L refer to the character, not the viewer. Limits here are editable author
// settings for inspection, not additional acceptance requirements.
export const arms={
 r:{shoulder:[535,975],elbow:[515,1305],cuff:[495,1640],wrist:[490,1735],bend:1},
 l:{shoulder:[1345,975],elbow:[1370,1305],cuff:[1380,1640],wrist:[1387.5,1735],bend:-1}
};
export const fingers={thumb:[[555,1798],[570,1840],[584,1864]],index:[[525,1855],[525,1908],[525,1950]],middle:[[490,1858],[490,1910],[490,1960]],ring:[[460,1851],[460,1900],[460,1950]],little:[[432,1823],[432,1872],[432,1914]]};
export function addRig(model){
 const params=model.parameters=[],nodes=model.nodes=[];
 const parameter=(id,min,max,def=0)=>params.push({id,min,max,default:def});
 const node=(id,parent,pivot,bindings={})=>nodes.push({id,parent,pivot,bindings});
 const b=(parameter,factor=1)=>[{parameter,factor}];
 parameter('body.x',-140,140);parameter('body.y',-80,80);parameter('body.lean',-.2,.2);parameter('chest.turn',-.12,.12);parameter('neck.tilt',-.12,.12);parameter('head.tilt',-.25,.25);
 node('root',null,[920,1900],{x:b('body.x'),y:b('body.y'),rotation:b('body.lean')});node('torso','root',[920,1600]);node('chest','torso',[920,1120],{rotation:b('chest.turn')});node('neck','chest',[940,850],{rotation:b('neck.tilt')});node('head','neck',[940,740],{rotation:b('head.tilt')});
 for(const [side,arm]of Object.entries(arms)){
  parameter('shoulder.'+side+'.lift',-35,35);parameter('arm.'+side+'.upper',-1.35,1.35);parameter('arm.'+side+'.elbow',side==='r'?0:-2.2,side==='r'?2.2:0);parameter('wrist.'+side+'.rotation',-.75,.75);
  node('clavicle.'+side,'chest',arm.shoulder,{y:b('shoulder.'+side+'.lift')});node('upper.'+side,'clavicle.'+side,arm.shoulder,{rotation:b('arm.'+side+'.upper')});node('fore.'+side,'upper.'+side,arm.elbow,{rotation:b('arm.'+side+'.elbow')});node('wrist.'+side,'fore.'+side,arm.wrist,{rotation:b('wrist.'+side+'.rotation')});
  for(const [finger,points]of Object.entries(fingers)){
   const pivot=side==='r'?points[0]:[1877.5-points[0][0],points[0][1]],id='finger.'+side+'.'+finger;
   parameter(id+'.spread',-.2,.2);node(id,'wrist.'+side,pivot,{rotation:b(id+'.spread')});
  }
 }
 const clamp=x=>Math.max(0,Math.min(1,x));
 for(const mesh of model.meshes){
  delete mesh.weights;
  if(mesh.id.startsWith('arm.')){
   const [,side,part]=mesh.id.split('.');mesh.node='upper.'+side;
   mesh.weights=Array.from({length:mesh.rest.length/2},(_,i)=>{const y=mesh.rest[i*2+1],t=part==='cuff'?1:clamp((y-(arms[side].elbow[1]-65))/130);return [{node:'upper.'+side,weight:1-t},{node:'fore.'+side,weight:t}];});
  }else if(mesh.id.startsWith('hand.')){
   const [,side,part]=mesh.id.split('.');mesh.node=fingers[part]?'finger.'+side+'.'+part:'wrist.'+side;
  }else if(mesh.id==='body.base'){
   mesh.node='torso';mesh.weights=Array.from({length:mesh.rest.length/2},(_,i)=>{const t=clamp((1800-mesh.rest[i*2+1])/500);return [{node:'torso',weight:1-t},{node:'chest',weight:t}];});
  }else if(mesh.id==='neck')mesh.node='neck';
  else if(/^(shirt|lapel\.|tie\.)/.test(mesh.id))mesh.node='chest';
  else mesh.node='head';
  if(/^eye\.[rl]\.iris$/.test(mesh.id))mesh.masks=[mesh.id.replace('.iris','.white')];
 }
 model.authoringStatus='関節階層の制作確認。補正形状・ひねり・指屈曲・会話統合は未完成。';
 model.rig={arms,fingers};return model;
}
