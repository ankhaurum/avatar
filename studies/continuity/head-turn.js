// Hibiki-authored shallow depth cage. XY turn is separate from screen-plane roll.
// One common mapping is used for skin, eyelids, irises, lips and oral overlays.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
function profile(y){const keys=[[0,0],[140,25],[300,58],[420,80],[490,91],[565,112],[645,93],[735,53],[825,15],[965,0]];for(let i=1;i<keys.length;i++)if(y<=keys[i][0]){const [a,va]=keys[i-1],[b,vb]=keys[i];return va+(vb-va)*clamp((y-a)/(b-a));}return 0;}
export function headTurn(x,y,p){
 const yaw=clamp(p.yaw||0,-1,1)*.32,pitch=clamp(p.pitch||0,-1,1)*.15;
 const weight=1-smooth(780,965,y),dx=x-590,dy=y-540;
 const face=1-smooth(175,380,Math.abs(dx)),depth=profile(y)*(.35+.65*face);
 // A shallow non-flat surface creates near/far compression and central-feature parallax.
 const zx=depth*Math.cos(yaw)-dx*Math.sin(yaw);
 return [x+weight*(dx*(Math.cos(yaw)-1)+depth*Math.sin(yaw)),y+weight*(dy*(Math.cos(pitch)-1)-zx*Math.sin(pitch))];
}
