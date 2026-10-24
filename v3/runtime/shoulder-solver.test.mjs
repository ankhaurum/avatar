import test from 'node:test';import assert from 'node:assert/strict';import {solveArmAndShoulder} from './shoulder-solver.mjs';
test('clavicle response contributes to the hand solution without extending either segment',()=>{
 const arm={shoulder:[0,0],elbow:[0,3],wrist:[0,7],bend:1},target=[-5,2],result=solveArmAndShoulder(arm,target,[1,0,0,1,0,0],{lift:[-.5,0],upper:[-2,2],elbow:[0,2.8]},[[0,0],[.5,-.2],[1.5,-.5]]);
 assert.ok(result.lift<0&&result.lift>=-.5);assert.ok(Math.hypot(result.reached[0]-target[0],result.reached[1]-target[1])<1e-5);assert.ok(Math.abs(Math.hypot(...result.elbowPosition.map((x,i)=>x-(i?result.lift:0)))-3)<1e-6);assert.ok(Math.abs(Math.hypot(...result.reached.map((x,i)=>x-result.elbowPosition[i]))-4)<1e-6);
});
