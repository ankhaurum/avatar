import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BustDynamics} from './bust-rig.js';
import {MotionResponse} from './motion-response.js';
function ramp(dt){const b=new BustDynamics();b.apply({yaw:0},0);let p;for(let t=dt;t<=.25+1e-9;t+=dt)p=b.apply({yaw:t*1.2},dt);return p;}
const fast=ramp(1/60),slow=ramp(.25);
for(const key of ['hair','hairLeft','hairRight'])assert(Math.abs(fast[key]-slow[key])<1e-10,key+' lost elapsed time');
assert(Math.abs(slow.hair)>.01,'a slow frame must retain the response');
const b=new BustDynamics();b.apply({yaw:0},0);b.apply({yaw:.3},.25);
const paused=b.apply({yaw:-1},2);assert.equal(paused.hair,0);
const still=b.apply({yaw:-1},0);assert.equal(still.hair,0);
const a={yaw:0},c={yaw:0},m=new MotionResponse(),n=new MotionResponse();
for(let i=0;i<15;i++)m.step(a,{yaw:1},1/60);n.step(c,{yaw:1},.25);assert(Math.abs(a.yaw-c.yaw)<1e-10);
n.step(c,{yaw:1},NaN);assert(Number.isFinite(c.yaw));
const result={fast,slow,constantVelocityResponseMatches:true,longPauseRebased:true,zeroDtStable:true,headAfterQuarterSecond:a.yaw,scope:'Synthetic elapsed-time regression; not actual device FPS or naturalness acceptance'};
fs.writeFileSync(new URL('./evidence/inertia-verification.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
