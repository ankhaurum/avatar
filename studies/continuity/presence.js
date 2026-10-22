const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const ease=x=>{const t=clamp(x);return t*t*t*(t*(6*t-15)+10);};
export function track(points,t){
 if(t<=points[0][0])return points[0][1];
 for(let i=1;i<points.length;i++)if(t<=points[i][0]){const a=points[i-1],b=points[i],w=ease((t-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*w;}
 return points.at(-1)[1];
}
// Short utterances with consonant closures and phrase pauses, independent of emotion.
const syllables=[[0,.35,.09,.20],[.30,.62,.07,.18],[.66,.42,.08,.22],[1.09,.5,.07,.16],[1.42,.25,.06,.18],[1.94,.58,.09,.21],[2.34,.38,.07,.17],[2.73,.32,.08,.23]];
export function speechShape(t){
 const phase=((t%3.7)+3.7)%3.7;let open=0,round=0;
 for(const [i,[start,height,rise,fall]]of syllables.entries()){const age=phase-start;if(age>=0&&age<rise+fall){const w=age<rise?ease(age/rise):1-ease((age-rise)/fall);open=Math.max(open,w*height);round=Math.max(round,w*([.02,.17,.04,.1][i%4]));}}
 return {open,round};
}
export function blinkInterval(state,index){
 const base=({thinking:2.6,attention:6,speaking:4.5,sleep:12})[state]||4.5;
 return base*[.92,1.23,.81,1.08,1.35,.86][index%6];
}
export function presencePose(p,t,{state='idle',inputs={},demo=false}={}){
 const out={...p},phase=((t%5.6)+5.6)%5.6/5.6;
 if(!Object.hasOwn(inputs,'breath'))out.breath=(phase<.42?-1+2*ease(phase/.42):1-2*ease((phase-.42)/.58))*(out.breathGain??1);
 if(state==='sleep'||state==='wake')return out;
 const cycle=((t%17)+17)%17;
 const glance=track([[0,0],[2.9,0],[3.08,-.1],[4.6,-.1],[4.82,0],[9.2,0],[9.36,.08],[10.7,.08],[10.95,0],[17,0]],cycle);
 if(!demo&&!Object.hasOwn(inputs,'gazeX'))out.gazeX=(out.gazeX||0)+glance;
 if(!Object.hasOwn(inputs,'roll'))out.roll=(out.roll||0)+track([[0,0],[4,.035],[7,.035],[11,-.025],[14,-.025],[17,0]],cycle);
 out.postureX=(out.postureX||0)+track([[0,0],[5,.9],[8,.9],[12,-.7],[15,-.7],[17,0]],cycle);
 return out;
}
