const fs=require('fs');const S=process.env.S;const def=JSON.parse(fs.readFileSync(S+'/face/face-def.json'));
const R=p=>p.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]);
// upper bands raised by 2px at the top boundary
const lift=(band,open)=>band.map(p=>open.some(o=>o[0]===p[0]&&o[1]===p[1])?p:[p[0],p[1]-2]);
const mouth=[...def.lipU.poly,...def.lipL.poly];const xs=mouth.map(p=>p[0]),ys=mouth.map(p=>p[1]);
const mx0=Math.min(...xs)-1,mx1=Math.max(...xs)+1,my0=Math.min(...ys)-1,my1=Math.max(...ys)+1,mc=(mx0+mx1)/2;
const steps=[
 {polys:[def.eyeL.open,lift(def.eyeL.upperBand,def.eyeL.open),def.eyeL.lowerBand],exp:3},
 {polys:[def.eyeR.open,lift(def.eyeR.upperBand,def.eyeR.open),def.eyeR.lowerBand],exp:3},
 {polys:[def.lipU.poly,def.lipL.poly],exp:3,clip:[[mx0-4,my0-5],[mc,my0-5],[mc,my1+5],[mx0-4,my1+5]]},
 {polys:[def.lipU.poly,def.lipL.poly],exp:3,clip:[[mc-1,my0-5],[mx1+4,my0-5],[mx1+4,my1+5],[mc-1,my1+5]]},
 {polys:[def.browL.poly],exp:2},{polys:[def.browR.poly],exp:2}];
let js=`#target photoshop
app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
function cT(s){return charIDToTypeID(s)}function sT(s){return stringIDToTypeID(s)}
function caf(){var d=new ActionDescriptor();d.putEnumerated(cT('Usng'),cT('FlCn'),sT('contentAware'));d.putUnitDouble(cT('Opct'),cT('#Prc'),100);d.putEnumerated(cT('Md  '),cT('BlnM'),cT('Nrml'));executeAction(cT('Fl  '),d,DialogModes.NO);}
while(app.documents.length)app.documents[0].close(SaveOptions.DONOTSAVECHANGES);
var doc=app.open(new File('${S}/face/art-a-copy.png'));doc.flatten();
var steps=${JSON.stringify(steps.map(s=>({polys:s.polys.map(R),exp:s.exp,clip:s.clip&&R(s.clip)})))};
for(var i=0;i<steps.length;i++){var s=steps[i];doc.selection.deselect();for(var j=0;j<s.polys.length;j++)doc.selection.select(s.polys[j],j?SelectionType.EXTEND:SelectionType.REPLACE,0,true);doc.selection.expand(s.exp);if(s.clip)doc.selection.select(s.clip,SelectionType.INTERSECT,0,false);caf();caf();}
doc.selection.deselect();var o=new PNGSaveOptions();doc.saveAs(new File('${S}/face/base-filled.png'),o,true,Extension.LOWERCASE);doc.close(SaveOptions.DONOTSAVECHANGES);'done';`;
fs.writeFileSync(S+'/face/fill2.jsx',js);
