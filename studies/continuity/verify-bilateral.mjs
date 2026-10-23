import assert from 'node:assert/strict';
import {BilateralArms} from './arms.js';
import {PerformanceController,STATES} from './emotion.js';
globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(0)}),putImageData(){},createLinearGradient:()=>({addColorStop(){}}),fillRect(){}})})};
class Mesh{constructor(o){Object.assign(this,o);this.alpha=1;const buffers={aPosition:{data:o.vertices,update(){}},aUV:{data:o.uvs,update(){}}};this.geometry={getBuffer:k=>buffers[k]};}}
class Graphics{clear(){return this;}poly(p){assert(p.every(Number.isFinite));return this;}fill(){return this;}}
const world={children:[],addChild(o){this.children.push(o);},addChildAt(o,i){this.children.splice(i,0,o);},getChildIndex(o){return this.children.indexOf(o);},setChildIndex(o,i){this.children.splice(this.children.indexOf(o),1);this.children.splice(i,0,o);}};
const main={texture:{width:1122,height:1402},mask:null};world.addChild(main);
const arms=new BilateralArms({MeshSimple:Mesh,Graphics,Texture:{from:()=>({width:768,height:448})},world,main,image:{},sleeveImage:{},handTurnImage:{}});
for(const mode of ['right-greeting','left-greeting','both-hands']){
 for(const t of [0,.2,.8,1.6,2.6,5.2,6.1,6.8]){
  arms.preview(t,mode);arms.draw(arms.intent({yaw:.2,pitch:0,body:.1,breath:.2}));
  for(const a of Object.values(arms.arms))for(const m of [a.upperArm.mesh,a.upperArm.lining,a.handTurn.mesh])assert([...m.vertices].every(Number.isFinite));
  const active=Object.values(arms.arms).filter(a=>a.pose.active).length;
  assert.equal(main.mask!==null,active>0,'inactive sibling must not clear the active torso mask');
  if(active===2)assert.equal(arms.arms.right.upperArm.shared.active.size,2);
 }
 arms.stop();assert.equal(main.mask,null);
}
const c=new PerformanceController(()=>0);for(const state of STATES){c.setState(state,{duration:0,calm:false});c.setPose({mouth:0});assert.equal(c.sample(0).mouth,0,'explicit closed mouth remains authoritative');}
console.log('Bilateral mask ownership, stop/reset, finite geometry and explicit V2 closed-mouth contract checked. Visual quality is not asserted.');
