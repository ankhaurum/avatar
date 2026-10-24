// Scapular elevation is an editable authored curve of upper-arm excursion.
// Solve in chest coordinates and re-evaluate the arm after changing clavicle.
import {multiply} from './evaluate.mjs';
import {solveArm} from './arm-solver.mjs';
export function solveArmAndShoulder(arm,target,chest,limits,response){
 if(!response?.length)return {...solveArm(arm,target,chest,limits),lift:0};
 if(response.some((p,i)=>p.length!==2||p.some(v=>!Number.isFinite(v))||(i&&p[0]<=response[i-1][0])))throw Error('Invalid shoulder response');
 const sample=x=>{if(x<=response[0][0])return response[0][1];for(let i=1;i<response.length;i++)if(x<=response[i][0]){const a=response[i-1],b=response[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return response.at(-1)[1];};
 const bounds=limits.lift||[-Infinity,Infinity];let lift=0,result;
 for(let i=0;i<8;i++){result=solveArm(arm,target,multiply(chest,[1,0,0,1,0,lift]),limits);const next=Math.max(bounds[0],Math.min(bounds[1],sample(Math.abs(result.upper))));if(Math.abs(next-lift)<1e-5){lift=next;break;}lift=next;}
 result=solveArm(arm,target,multiply(chest,[1,0,0,1,0,lift]),limits);
 return {...result,lift};
}
