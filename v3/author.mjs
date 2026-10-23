import {compile,evaluate,point} from './runtime/evaluate.mjs?surface=4';
import {solveArm} from './runtime/arm-solver.mjs?limits=2';
import {solveArmAndShoulder} from './runtime/shoulder-solver.mjs';
import {inverseSkin} from './tools/landmark-warp.mjs';
import {Renderer,loadImages} from './runtime/renderer.mjs?surface=5';
const $=id=>document.getElementById(id),canvas=$('render'),overlay=$('overlay'),g=overlay.getContext('2d');
let model,compiled,renderer,frame,drag=null,history=[],state={},baseURL=new URL('model-head-r33.json',location.href),generation=0,assetImages=new Map();
const view=[-400,-100,2600,2500];
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const boxes={all:[-400,-100,2600,2500],r:[330,1570,340,500],l:[1200,1570,340,500],face:[590,240,650,650]};view.splice(0,4,...boxes[button.dataset.view]);const stage=document.querySelector('.stage');stage.style.aspectRatio=view[2]+'/'+view[3];stage.style.width=`min(100%,calc((100vh - 145px)*${view[2]}/${view[3]}))`;redraw();}));
const error=e=>{$('error').textContent=e.message;console.error(e);};
function selected(){return model.meshes.find(m=>m.id===$('part').value);}
function modelPoint(e){const r=overlay.getBoundingClientRect();return [view[0]+(e.clientX-r.left)/r.width*view[2],view[1]+(e.clientY-r.top)/r.height*view[3]];}
function redraw(){
 if(!renderer)return;
 try{
  frame=evaluate(compiled,state);const visible=model.meshes.map(m=>m.visible);
  if($('solo').checked)for(const m of model.meshes)m.visible=m.id===$('part').value;
  try{renderer.render(frame);}finally{model.meshes.forEach((m,i)=>m.visible=visible[i]);}
  overlay.width=canvas.width;overlay.height=canvas.height;g.clearRect(0,0,overlay.width,overlay.height);
  g.setTransform(overlay.width/view[2],0,0,overlay.height/view[3],-view[0]*overlay.width/view[2],-view[1]*overlay.height/view[3]);
  const mesh=selected(),p=frame.positions.get(mesh.id),scale=view[2]/overlay.width;
  if($('wire').checked){g.lineWidth=scale;g.strokeStyle='#127fbd99';g.beginPath();for(let i=0;i<mesh.triangles.length;i+=3){const [a,b,c]=mesh.triangles.slice(i,i+3).map(v=>v*2);g.moveTo(p[a],p[a+1]);g.lineTo(p[b],p[b+1]);g.lineTo(p[c],p[c+1]);g.closePath();}g.stroke();g.fillStyle='#004cff';for(let i=0;i<p.length;i+=2){g.beginPath();g.arc(p[i],p[i+1],2.8*scale,0,Math.PI*2);g.fill();}}
  if($('hands').checked&&model.rig){g.strokeStyle='#be640d';g.fillStyle='#fff4d6';g.lineWidth=2*scale;for(const [side,arm]of Object.entries(model.rig.arms)){const p=point(frame.matrices.get('wrist.'+side),...arm.wrist);g.beginPath();g.arc(p[0],p[1],8*scale,0,Math.PI*2);g.fill();g.stroke();}}
  $('status').textContent=`${mesh.id}\n${p.length/2} 頂点 / ${mesh.triangles.length/3} 三角形\n${mesh.shapes?.length||0} 形状キー群\n${model.authoringStatus||''}`;
 }catch(e){error(e);}
}
async function install(next){
 $('status').textContent='制作素材を読み込み・検証しています…';
 const token=++generation,candidate=compile(next),images=await loadImages(next,baseURL,assetImages);
 if(token!==generation)return;
 renderer?.destroy();model=next;compiled=candidate;renderer=new Renderer(canvas,model,images);assetImages=images;renderer.view=view;state={};history=[];
 $('part').replaceChildren(...model.meshes.map(m=>new Option(m.id,m.id)));
 $('part').value=model.meshes.find(m=>m.visible!==false)?.id||model.meshes[0].id;
 $('parameter').replaceChildren(new Option('基準形',''),...model.parameters.map(p=>new Option(p.id,p.id)));
 $('hands').disabled=!model.rig;$('hands').checked=!!model.rig;
 $('error').textContent='';parameterChanged();redraw();
}
function parameterChanged(){const p=model.parameters.find(p=>p.id===$('parameter').value);$('value').disabled=!p;$('exactValue').disabled=!p;if(p){$('value').min=p.min;$('value').max=p.max;$('value').step=(p.max-p.min)/1000||.001;$('value').value=state[p.id]??p.default;$('exactValue').value=state[p.id]??p.default;$('valueText').textContent=Number($('value').value).toFixed(3);}else{$('valueText').textContent='';$('exactValue').value='';state={};}keyButtons();redraw();}
function setParameter(value){const p=compiled.params.get($('parameter').value);if(!p||!Number.isFinite(value))return;state[p.id]=Math.max(p.min,Math.min(p.max,value));$('value').value=state[p.id];$('exactValue').value=state[p.id];$('valueText').textContent=state[p.id].toFixed(3);redraw();}
function keyButtons(){const id=$('parameter').value,keys=new Set();for(const s of selected().shapes||[])for(const a of s.axes)if(a.parameter===id)for(const v of a.keys)keys.add(v);$('keys').replaceChildren(...[...keys].sort((a,b)=>a-b).map(v=>{const b=document.createElement('button');b.textContent='キー '+v.toFixed(3);b.addEventListener('click',()=>setParameter(v));return b;}));}
overlay.addEventListener('pointerdown',e=>{
 if(!model)return;
 if($('hands').checked&&model.rig){const [x,y]=modelPoint(e),radius=22*view[2]/overlay.getBoundingClientRect().width;for(const [side,arm]of Object.entries(model.rig.arms)){const p=point(frame.matrices.get('wrist.'+side),...arm.wrist);if(Math.hypot(p[0]-x,p[1]-y)<radius){const elbow=frame.state['arm.'+side+'.elbow'];drag={side,kind:'hand',bend:Math.abs(elbow)>.05?Math.sign(elbow):arm.bend};overlay.setPointerCapture(e.pointerId);return;}}}
 if(!$('wire').checked)return;
 if(selected().surface&&compiled.surfaceOrder.some(n=>Object.values(n.bindings||{}).some(terms=>terms.some(t=>Math.abs(frame.state[t.parameter]*t.factor)>1e-8)))){$('editMode').textContent='ひねり・指節の立体姿勢は現在表示専用です。局所立体の入力を基準値へ戻してから編集してください。';return;}
 let key=null;
 if($('keyEdit').checked){const candidates=(selected().shapes||[]).filter(s=>s.axes.some(a=>a.parameter===$('parameter').value));if(candidates.length!==1){$('editMode').textContent='編集する形状キー群が一意に決まりません。パーツとパラメータを選んでください。';return;}key=candidates[0].keys.find(k=>k.at.every((v,i)=>Math.abs(v-frame.state[candidates[0].axes[i].parameter])<1e-8));if(!key){$('editMode').textContent='途中姿勢は表示専用です。キーのボタンから編集する姿勢を選んでください。';return;}}
 else if(Object.keys(state).some(id=>state[id]!==compiled.params.get(id).default)){$('editMode').textContent='現在は姿勢確認中です。基準形へ戻すか、形状キー編集を選んでください。';return;}
 const mesh=selected(),[x,y]=modelPoint(e),p=frame.positions.get(mesh.id),r=overlay.getBoundingClientRect(),threshold=12*view[2]/r.width;let vertex=-1,distance=threshold;
 for(let i=0;i<p.length;i+=2){const d=Math.hypot(p[i]-x,p[i+1]-y);if(d<distance){distance=d;vertex=i;}}
 if(vertex<0)return;
 // Rest edits are defined in author canvas coordinates. Do not guess an inverse
 // for skinned/deformed vertices; pose-key editing is a separate operation.
 const local=inverseSkin(mesh,frame.matrices,vertex/2,p[vertex],p[vertex+1]);
 const array=key?key.delta:mesh.rest;history.push({array,before:[...array]});drag={mesh,vertex,key,local,start:[array[vertex],array[vertex+1]]};overlay.setPointerCapture(e.pointerId);
});
overlay.addEventListener('pointermove',e=>{
 if(!drag)return;const [x,y]=modelPoint(e);
 if(drag.kind==='hand'){
  const side=drag.side,u='arm.'+side+'.upper',f='arm.'+side+'.elbow',s='shoulder.'+side+'.lift',pu=compiled.params.get(u),pf=compiled.params.get(f),ps=compiled.params.get(s);
  const limits={upper:[pu.min,pu.max],elbow:[pf.min,pf.max],lift:[ps.min,ps.max],previousUpper:state[u]??pu.default};
  const arm={...model.rig.arms[side],bend:drag.bend};
  const solution=model.rig.shoulderResponse?solveArmAndShoulder(arm,[x,y],frame.matrices.get('chest'),limits,model.rig.shoulderResponse):solveArm(arm,[x,y],frame.matrices.get('clavicle.'+side),limits);
  state[u]=solution.upper;state[f]=solution.elbow;if(solution.lift!==undefined)state[s]=solution.lift;
  const id=$('parameter').value;if(id){const value=state[id]??compiled.params.get(id).default;$('value').value=value;$('exactValue').value=value;$('valueText').textContent=value.toFixed(3);}
 }else{const local=inverseSkin(drag.mesh,frame.matrices,drag.vertex/2,x,y),array=drag.key?drag.key.delta:drag.mesh.rest;array[drag.vertex]=drag.start[0]+local[0]-drag.local[0];array[drag.vertex+1]=drag.start[1]+local[1]-drag.local[1];}
 redraw();
});
overlay.addEventListener('pointerup',()=>{drag=null;});overlay.addEventListener('pointercancel',()=>{drag=null;});
$('part').addEventListener('change',()=>{keyButtons();redraw();});$('wire').addEventListener('change',redraw);$('solo').addEventListener('change',redraw);$('parameter').addEventListener('change',parameterChanged);
$('hands').addEventListener('change',redraw);
$('value').addEventListener('input',()=>setParameter(Number($('value').value)));
$('undo').addEventListener('click',()=>{const previous=history.pop();if(previous){previous.array.splice(0,previous.array.length,...previous.before);redraw();}});
$('save').addEventListener('click',()=>{try{compile(model);const blob=new Blob([JSON.stringify(model,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hibiki-v3-model.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error(e);}});
$('load').addEventListener('change',async e=>{try{const file=e.target.files[0];if(file)await install(JSON.parse(await file.text()));}catch(err){error(err);}});
new ResizeObserver(redraw).observe(canvas);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('error').textContent='描画コンテキストが失われました。制作JSONを保存してから再読み込みしてください。';});
window.addEventListener('pagehide',()=>renderer?.destroy());
try{const response=await fetch(baseURL);if(!response.ok)throw Error('制作データの読込みに失敗: '+response.status);await install(await response.json());}catch(e){error(e);}



$('exactValue').addEventListener('input',()=>setParameter(Number($('exactValue').value)));
