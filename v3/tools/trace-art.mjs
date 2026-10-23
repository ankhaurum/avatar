// Artist-traced source regions; this file does not evaluate animation or invent pose keys.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]);
const parts=[];
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function part(id,source,polygon,x=350,y=0,more={}){parts.push({id,source,polygon,x,y,...more});}
const master='../assets/approved-front.png',torso='source/torso-reference.png',sleeves='source/sleeve-reference.png',hand='source/hand-reference.png';
// Garment components overlap at sewn boundaries. Missing hidden cloth is tracked separately.
part('body.base',torso,[[80,270],[430,100],[710,100],[1010,270],[980,600],[900,900],[1000,1300],[560,1370],[145,1320],[240,900],[150,600]],350,650);
part('neck',master,[[420,725],[745,725],[750,880],[700,950],[620,1025],[575,1030],[510,970],[450,900],[415,800]],350,0);
part('shirt',torso,[[430,120],[700,120],[750,460],[660,860],[560,980],[420,740],[370,420]],350,650);
part('lapel.r',torso,[[430,120],[440,320],[490,580],[565,910],[520,960],[350,700],[250,360],[300,260]],350,650);
part('lapel.l',torso,[[695,120],[820,265],[915,370],[775,600],[600,960],[560,910],[670,600],[690,320]],350,650);
part('tie.tail',torso,[[530,430],[610,430],[650,750],[600,900],[555,940],[505,820],[505,620]],350,650);
part('tie.knot',torso,[[505,365],[620,365],[630,410],[610,455],[535,455],[510,410]],350,650);
for(const side of ['r','l']){
 const right=side==='r',shift=right?0:650,x=right?285:1090;
 const upper=right?[[240,130],[405,75],[460,200],[435,380],[408,620],[365,690],[210,670],[205,450],[215,260]]:[[900,75],[1045,125],[1085,260],[1105,490],[1105,650],[950,690],[915,500],[910,370],[850,270],[850,160]];
 const fore=right?[[210,600],[405,590],[415,760],[390,1005],[210,1005],[208,850]]:[[930,590],[1105,590],[1110,800],[1110,1025],[950,1025],[935,800]];
 const cuff=right?[[207,985],[394,985],[380,1090],[370,1145],[210,1145],[200,1085]]:[[945,985],[1115,985],[1120,1090],[1105,1148],[965,1148],[945,1090]];
 part('arm.'+side+'.upper',sleeves,upper,x-shift*.75,820,{scale:.75});
 part('arm.'+side+'.fore',sleeves,fore,x-shift*.75,820,{scale:.75});
 part('arm.'+side+'.cuff',sleeves,cuff,x-shift*.75,820,{scale:.75});
}
// Source fingers are separated along actual gaps, not rectangular crops through neighbours.
const digits={
 thumb:[[20,360],[40,360],[83,385],[115,440],[157,520],[185,585],[140,650],[93,600],[65,510],[35,440]],
 index:[[172,427],[176,200],[186,110],[204,75],[229,70],[246,85],[263,150],[269,310],[275,455],[231,505],[180,485]],
 middle:[[277,445],[275,160],[284,60],[300,25],[325,23],[344,36],[356,80],[360,215],[367,450],[333,495],[284,490]],
 ring:[[368,452],[367,210],[370,110],[386,70],[406,70],[423,87],[433,140],[440,290],[451,470],[422,510],[380,505]],
 little:[[449,480],[450,325],[460,235],[476,202],[497,200],[510,220],[519,280],[523,390],[528,530],[500,565],[457,550]]
};
for(const side of ['r','l']){
 const origin=side==='r'?65:1260,more={scale:.35,turn:180,mirror:side==='l'};
 part('hand.'+side+'.palm',hand,[[150,430],[270,415],[370,425],[450,450],[519,510],[525,650],[490,810],[475,990],[250,1000],[220,850],[170,730],[123,600],[135,510]],origin,1650,more);
 for(const [digit,p]of Object.entries(digits))part('hand.'+side+'.'+digit,hand,p,origin,1650,more);
}
const palmDigits={
 thumb:[[560,360],[580,360],[620,390],[660,445],[704,520],[731,580],[700,630],[652,595],[625,535],[595,465]],
 index:[[733,432],[735,190],[742,105],[756,65],[778,60],[795,80],[809,150],[815,315],[819,440],[790,480],[746,478]],
 middle:[[820,435],[821,145],[833,60],[850,30],[873,25],[890,37],[903,80],[909,230],[915,441],[885,480],[835,475]],
 ring:[[916,445],[919,225],[927,112],[942,65],[964,62],[981,77],[990,124],[995,295],[1004,455],[977,493],[931,482]],
 little:[[1005,462],[1012,308],[1028,222],[1045,188],[1068,185],[1082,204],[1090,250],[1092,380],[1090,510],[1064,550],[1020,540]]
};
for(const side of ['r','l']){
 const origin=side==='r'?185:1142,more={scale:.35,turn:180,mirror:side==='r',visible:false};
 part('hand.'+side+'.volar',hand,[[720,420],[817,420],[916,425],[1000,444],[1088,500],[1100,630],[1030,820],[1010,990],[768,1002],[745,850],[714,735],[655,600],[685,510]],origin,1650,more);
 for(const [digit,p]of Object.entries(palmDigits))part('hand.'+side+'.volar.'+digit,hand,p,origin,1650,more);
}
// Exact official face pixels remain the visible identity. Hidden surfaces are separate work.
const face=[[385,345],[690,325],[760,390],[790,500],[765,620],[720,700],[670,740],[625,762],[590,769],[550,765],[510,747],[470,720],[430,675],[405,650],[370,550],[350,455]];
part('hair.back',master,[[120,0],[1000,0],[1000,830],[870,885],[720,855],[600,780],[460,865],[300,900],[160,820]],350,0,{cutouts:[face],onlyBlue:true});
part('ear.r',master,[[330,447],[357,443],[379,480],[383,535],[368,580],[350,587],[330,553],[321,500]],350,0,{feather:2});
part('face.skin',master,face,350,0,{heal:[rect(425,442,133,70),rect(630,437,130,70),rect(413,388,150,45),rect(611,382,158,50),rect(513,619,165,78)]});
part('mouth.cavity','../studies/continuity/materials/oral-cavity.png',null,850,620,{visible:false});
part('mouth.teeth','../studies/continuity/materials/upper-dental.png',null,868,639,{scale:.5,visible:false});
part('mouth.tongue','../studies/continuity/materials/tongue.png',null,879,665,{scale:.7,visible:false});
const ellipse=(cx,cy,rx,ry)=>Array.from({length:40},(_,i)=>[cx+rx*Math.cos(i*Math.PI/20),cy+ry*Math.sin(i*Math.PI/20)]);
const eyeR=[[438,483],[450,469],[469,459],[491,455],[513,459],[532,470],[545,486],[528,488],[509,492],[487,493],[463,489],[448,487]];
const eyeL=[[644,484],[652,468],[669,456],[690,449],[713,450],[734,457],[746,468],[730,480],[708,486],[684,489],[662,488]];
part('eye.r.white','../assets/rig2/sclera-left.png',eyeR.map(([x,y])=>[x-426,y-452]),776,452);
part('eye.l.white','../assets/rig2/sclera-right.png',eyeL.map(([x,y])=>[x-632,y-446]),982,446);
part('eye.r.iris','../assets/rig2/iris-left.png',ellipse(23,23,19,19),824,451);
part('eye.l.iris','../assets/rig2/iris-right.png',ellipse(23,23,19,19),1007,445);
// Mouth and eye layers are genuine editable selections; hidden skin fill is a later art pass.
part('mouth.lower',master,[[510,646],[550,651],[600,650],[645,638],[680,630],[685,680],[640,710],[575,715],[515,690]],350,0,{feather:3});
part('mouth.upper',master,[[505,612],[550,612],[585,620],[600,618],[630,619],[680,620],[670,645],[625,653],[575,655],[520,651]],350,0,{feather:3});
part('eye.r.upper',master,rect(425,430,135,55),350,0,{cutouts:[eyeR],feather:3});
part('eye.r.lower',master,rect(425,480,135,40),350,0,{cutouts:[eyeR],feather:3});
part('eye.l.upper',master,rect(630,425,135,55),350,0,{cutouts:[eyeL],feather:3});
part('eye.l.lower',master,rect(630,475,135,40),350,0,{cutouts:[eyeL],feather:3});
part('brow.r',master,rect(412,389,150,50),350,0,{feather:3});part('brow.l',master,rect(610,384,160,50),350,0,{feather:3});
part('hair.r',master,[[180,300],[390,300],[406,440],[391,555],[412,680],[485,850],[400,865],[300,840],[205,785],[160,600]],350,0,{onlyBlue:true});
part('hair.l',master,[[800,300],[930,300],[960,600],[910,785],[830,865],[700,865],[750,800],[785,670],[794,530],[770,440]],350,0,{onlyBlue:true});
part('hair.front',master,[[200,0],[950,0],[950,380],[820,430],[744,449],[675,450],[590,449],[520,447],[432,444],[330,455],[200,430]]);
part('sleeve-poses','source/sleeve-poses.png',null,0,1200,{scale:.7,visible:false,guide:true});
const result={format:'hibiki-art-traces',version:1,width:1800,height:2300,identitySource:master,parts,unfinished:['Repaired hidden face skin requires moving-pose inspection; neck edges retain hair','Body base still contains duplicated garment details underneath independent overlays','Bent sleeve guide is included; shoulder and seam correction remain unfinished','Palm layers are hidden candidates; profile and finger hidden surfaces remain unfinished','Mirrored left hand is a registration draft, not accepted left-hand shading']};
fs.writeFileSync(path.join(root,'source','trace-plan.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({parts:parts.length,unfinished:result.unfinished}));
