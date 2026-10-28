// Cut Hibiki's face parts from approved art A (pixels kept as-is) and build the filled base.
const sharp=require('sharp');const fs=require('fs');const S=process.env.S,A=process.env.A;
const def=JSON.parse(fs.readFileSync(S+'/face/face-def.json'));const W=1024,H=1536;
const raw=async f=>{const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});return data;};
const svgMask=async(shapes,blur=0)=>{let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/>`;
 for(const sh of shapes){if(sh.circle)s+=`<circle cx="${sh.circle[0]}" cy="${sh.circle[1]}" r="${sh.circle[2]}" fill="white"/>`;else s+=`<polygon points="${sh.map(p=>p.join(',')).join(' ')}" fill="white"/>`;}
 s+='</svg>';let im=sharp(Buffer.from(s));if(blur)im=im.blur(blur);const {data}=await im.greyscale().raw().toBuffer({resolveWithObject:true});const m=new Float32Array(W*H);for(let i=0;i<W*H;i++)m[i]=data[i]/255;return m;};
const minus=(a,b)=>a.map((v,i)=>Math.max(0,v-b[i]));
(async()=>{
 const O=await raw(A+'/v3/artwork/hibiki-static-a.png');const B=await raw(S+'/face/base-filled.png');
 // mouth base: harmonic (Laplace) fill over the lips, boundary = original skin
 const mm=await svgMask([def.lipU.poly,def.lipL.poly]);const hole=new Uint8Array(W*H);
 {const d=new Uint8Array(W*H);for(let i=0;i<W*H;i++)d[i]=mm[i]>0.01?1:0;for(let r=0;r<3;r++){const n=d.slice();for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(d[i-1]||d[i+1]||d[i-W]||d[i+W])n[i]=1;}d.set(n);}hole.set(d);}
 const F=new Float32Array(W*H*3);for(let i=0;i<W*H;i++)for(let c=0;c<3;c++)F[i*3+c]=O[i*4+c];
 const idx=[];for(let i=0;i<W*H;i++)if(hole[i])idx.push(i);
 // initialise with row interpolation then relax
 for(let it=0;it<3000;it++)for(const i of idx)for(let c=0;c<3;c++)F[i*3+c]=(F[(i-1)*3+c]+F[(i+1)*3+c]+F[(i-W)*3+c]+F[(i+W)*3+c])/4;
 const base=Buffer.from(B);for(const i of idx)for(let c=0;c<3;c++)base[i*4+c]=Math.round(F[i*3+c]);
 for(let i=0;i<W*H;i++)base[i*4+3]=O[i*4+3];// keep art alpha

 const out={};const put=(name,rgba)=>{out[name]=rgba;};
 const zone=new Uint8Array(W*H);for(let i=0;i<W*H;i++){let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(base[i*4+c]-O[i*4+c]));if(d>4||hole[i])zone[i]=1;else for(let c=0;c<3;c++)base[i*4+c]=O[i*4+c];}
 const blurM=async(sh,sig)=>svgMask(sh,sig);
 // U = what lies under the stroke layers at rest (base, then white of eye, then iris clipped by it)
 const U=Float32Array.from(base);const comp=(L,maskOf)=>{for(let i=0;i<W*H;i++){let a=L[i*4+3]/255;if(maskOf)a*=maskOf[i*4+3]/255;if(!a)continue;for(let c=0;c<3;c++)U[i*4+c]=L[i*4+c]*a+U[i*4+c]*(1-a);}};
 const exact=(sel,core,dark)=>{const L=Buffer.alloc(W*H*4);for(let i=0;i<W*H;i++){if(!sel[i])continue;let a=core?core[i]:0;for(let c=0;c<3;c++){const b=U[i*4+c],o=O[i*4+c];if(o<b)a=Math.max(a,(b-o)/Math.max(1,b-dark[c]));else if(o>b)a=Math.max(a,(o-b)/Math.max(1,255-b));}a=Math.min(1,a);if(a<0.004)continue;for(let c=0;c<3;c++)L[i*4+c]=Math.max(0,Math.min(255,Math.round((O[i*4+c]-(1-a)*U[i*4+c])/a)));L[i*4+3]=Math.min(255,Math.round(a*255+0.49));}return L;};
 const group={};const gm={eyeL:await blurM([def.eyeL.open,def.eyeL.upperBand,def.eyeL.lowerBand],4),eyeR:await blurM([def.eyeR.open,def.eyeR.upperBand,def.eyeR.lowerBand],4),browL:await blurM([def.browL.poly],4),browR:await blurM([def.browR.poly],4),lips:await blurM([def.lipU.poly,def.lipL.poly],4)};
 const label=new Int8Array(W*H).fill(-1);const names=Object.keys(gm);for(let i=0;i<W*H;i++)if(zone[i]){let best=-1,bv=0;names.forEach((n,k)=>{if(gm[n][i]>bv){bv=gm[n][i];best=k;}});label[i]=best;}
 const sel=k=>{const m=new Uint8Array(W*H);for(let i=0;i<W*H;i++)if(label[i]===k)m[i]=1;return m;};
 for(const side of ['L','R']){const e=def['eye'+side];const open=await svgMask([e.open]);const iris=await svgMask([{circle:e.iris}]);const [cx,cy,r]=e.iris;
  const Sc=Buffer.from(O);
  // white of the eye behind the iris: harmonic fill from the surrounding white and lid edge
  {const hole=[];for(let y=Math.floor(cy-r-2);y<=Math.ceil(cy+r+2);y++)for(let x=Math.floor(cx-r-2);x<=Math.ceil(cx+r+2);x++){const i=y*W+x;if(Math.hypot(x+.5-cx,y+.5-cy)<=r+1.2)hole.push(i);}
   const F=new Float32Array(W*H*3);for(const i of hole)for(let c=0;c<3;c++)F[i*3+c]=200;const inH=new Uint8Array(W*H);for(const i of hole)inH[i]=1;
   const val=(j,c)=>inH[j]?F[j*3+c]:O[j*4+c];
   const ok=j=>inH[j]||open[j]>0.97;for(let it=0;it<2500;it++)for(const i of hole)for(let c=0;c<3;c++){let t=0,n=0;for(const j of [i-1,i+1,i-W,i+W])if(ok(j)){t+=val(j,c);n++;}if(n)F[i*3+c]=t/n;}
   for(const i of hole)for(let c=0;c<3;c++)Sc[i*4+c]=Math.round(F[i*3+c]);}
  const white=Buffer.alloc(W*H*4);for(let i=0;i<W*H;i++){if(open[i]<=0.004)continue;for(let c=0;c<3;c++)white[i*4+c]=Sc[i*4+c];white[i*4+3]=Math.round(open[i]*255);}
  const Ir=Buffer.alloc(W*H*4);const visAt=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y);return open[yi*W+xi]>0.97;};
  for(let y=Math.floor(cy-r-1);y<=Math.ceil(cy+r+1);y++)for(let x=Math.floor(cx-r-1);x<=Math.ceil(cx+r+1);x++){const i=y*W+x;if(iris[i]<=0)continue;const ia=iris[i];
   let src=null;if(open[i]>0.97)src=i;else{const dx=x+.5-cx,dy=y+.5-cy,rr=Math.min(Math.hypot(dx,dy),r-0.8),th=Math.atan2(dy,dx);
    for(let k=1;k<180&&src===null;k++)for(const sg of [1,-1]){const t=th+sg*k*Math.PI/180;const px=cx+rr*Math.cos(t),py=cy+rr*Math.sin(t);if(visAt(px,py)&&Math.hypot(Math.floor(px)+.5-cx,Math.floor(py)+.5-cy)<=r-0.5){src=Math.floor(py)*W+Math.floor(px);break;}}}
   if(src===null)src=Math.round(cy)*W+Math.round(cx);
   for(let c=0;c<3;c++){let v=O[src*4+c];if(src===i&&ia<1)v=(O[i*4+c]-(1-ia)*Sc[i*4+c])/ia;Ir[i*4+c]=Math.max(0,Math.min(255,Math.round(v)));}Ir[i*4+3]=Math.round(ia*255);}
  put('eye_white_'+side,white);put('eye_iris_'+side,Ir);comp(white);comp(Ir,white);
  const k=names.indexOf('eye'+side);const ub=await blurM([e.upperBand],1.5),lb=await blurM([e.lowerBand],1.5);
  const su=new Uint8Array(W*H),sl=new Uint8Array(W*H);for(let i=0;i<W*H;i++){const inZone=label[i]===k||(open[i]>0&&open[i]<1);if(!inZone)continue;if(ub[i]>=lb[i])su[i]=1;else sl[i]=1;}
  put('eye_lash_lower_'+side,exact(sl,null,[70,40,40]));comp(out['eye_lash_lower_'+side]);
  put('eye_lash_upper_'+side,exact(su,null,[38,22,22]));comp(out['eye_lash_upper_'+side]);
 }
 for(const side of ['L','R']){put('brow_'+side,exact(sel(names.indexOf('brow'+side)),null,[95,72,70]));comp(out['brow_'+side]);}
 {const k=names.indexOf('lips');const s0=sel(k);const ml=def.mouthLine;const lineY=x=>{for(let j=0;j<ml.length-1;j++)if(x>=ml[j][0]&&x<=ml[j+1][0])return ml[j][1]+(ml[j+1][1]-ml[j][1])*(x-ml[j][0])/(ml[j+1][0]-ml[j][0]);return x<ml[0][0]?ml[0][1]:ml[ml.length-1][1];};
  const up=new Uint8Array(W*H),lo=new Uint8Array(W*H);for(let i=0;i<W*H;i++)if(s0[i]){const x=i%W,y=(i-x)/W;if(y+0.5<lineY(x+0.5)+0.8)up[i]=1;else lo[i]=1;}
  const cu=await svgMask([def.lipU.poly]),cl=await svgMask([def.lipL.poly]);
  put('lip_lower',exact(lo,cl,[60,20,30]));comp(out.lip_lower);put('lip_upper',exact(up,cu,[60,20,30]));comp(out.lip_upper);}
 fs.mkdirSync(S+'/face/parts',{recursive:true});
 await sharp(base,{raw:{width:W,height:H,channels:4}}).png().toFile(S+'/face/parts/face_base_full.png');
 const meta={};for(const [n,buf] of Object.entries(out)){let x0=W,y0=H,x1=0,y1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(buf[(y*W+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);x1=Math.min(W-1,x1+2);y1=Math.min(H-1,y1+2);
  await sharp(buf,{raw:{width:W,height:H,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toFile(S+'/face/parts/'+n+'.png');meta[n]={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
 fs.writeFileSync(S+'/face/parts/meta.json',JSON.stringify(meta,null,1));
 // recomposition check: base + parts in rig order
 const C=U;
 let max=0,sum=0,n=0;for(let y=200;y<380;y++)for(let x=420;x<640;x++){const i=y*W+x;for(let c=0;c<3;c++){const d=Math.abs(C[i*4+c]-O[i*4+c]);max=Math.max(max,d);sum+=d;n++;}}
 console.log('recompose face region: max',max.toFixed(1),'mean',(sum/n).toFixed(3));
 await sharp(Buffer.from(C.map(v=>Math.round(v))),{raw:{width:W,height:H,channels:4}}).png().toFile(S+'/face/recomposed.png');
})();
