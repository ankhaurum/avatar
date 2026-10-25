(function(){
var root='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/';
var out='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/';app.activeDocument=app.documents.getByName('hibiki-v3-parts-i.psd');var d=app.activeDocument;
if(!d.saved)throw Error('Unsaved I; inspect before editing');
for(var z=0;z<d.layerSets.length;z++)if(d.layerSets[z].name==='41_EYE_L_material_candidate')throw Error('Left eye already present');
var dialogs=app.displayDialogs,units=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
try{
var source=app.open(new File(root+'hibiki-static-a.png'));app.activeDocument=d;var eye=d.layerSets.add();eye.name='41_EYE_L_material_candidate';var pos=eye.layerSets.add();pos.name='EYE_L_eyeball_position';
function select(poly,mode){d.selection.select(poly,mode||SelectionType.REPLACE,0,true);}
function circle(x,y,rx,ry){var a=[];for(var k=0;k<64;k++){var t=k*Math.PI/32;a.push([x+rx*Math.cos(t),y+ry*Math.sin(t)]);}return a;}
function outside(){d.selection.invert();d.selection.clear();d.selection.deselect();}
function fromA(name,parent){app.activeDocument=source;var l=source.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);app.activeDocument=d;l.name=name;l.move(parent,ElementPlacement.INSIDE);d.activeLayer=l;return l;}
function imagePart(path,name,crop,target,parent){var n=app.open(new File(path));n.crop(crop);if(name==='sclera_hidden_completion')n.flipCanvas(Direction.HORIZONTAL);n.resizeImage(UnitValue(target[2]-target[0],'px'),UnitValue(target[3]-target[1],'px'),72,ResampleMethod.BICUBICSHARPER);var l=n.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);n.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;l.name=name;l.translate(UnitValue(target[0]-l.bounds[0].as('px'),'px'),UnitValue(target[1]-l.bounds[1].as('px'),'px'));l.move(parent,ElementPlacement.INSIDE);d.activeLayer=l;return l;}
var opening=[[554,260],[557,254],[561,250],[567,247],[574,245],[581,244.5],[588,247],[594,250],[599,253],[591,255],[583,258],[574,259],[565,259],[558,259]];
var irisArea=circle(572.5,249,10.5,10.5);
var paint=imagePart(root+'split-e/parts/h-EYE_R_iris-source.png','iris_hidden_completion',[165,124,1120,1086],[562,238.5,583,259.5],pos);
var iris=fromA('iris_original_visible',pos);select(opening);select(irisArea,SelectionType.INTERSECT);outside();select(circle(569.5,249.5,2,1.5));select(circle(573.5,249.5,1.8,1.2),SelectionType.EXTEND);d.selection.clear();d.selection.deselect();paint.move(iris,ElementPlacement.PLACEAFTER);d.activeLayer=iris;iris=iris.merge();iris.name='EYE_L_iris_complete_candidate';
var white=imagePart(root+'split-e/parts/i-eye-sclera-source.png','sclera_hidden_completion',[218,72,1955,644],[551,240,602,265],eye);select(opening);outside();
white.adjustBrightnessContrast(-20,0);white.name='EYE_L_sclera_complete_candidate';
var up=fromA('EYE_L_upper_lid_lash_candidate',eye);
select([[552,258],[556,248],[565,241],[574,238],[585,237],[593,241],[600,246],[606,251],[601,255],[599,253],[594,250],[588,247],[581,244.5],[574,245],[567,247],[561,250],[557,254],[554,260]]);outside();
var low=fromA('EYE_L_lower_lid_candidate',eye);
select([[554,260],[558,259],[565,259],[574,259],[583,258],[591,255],[599,253],[604,255],[602,258],[596,262],[583,265],[571,266],[558,264],[552,262]]);outside();
var h1=fromA('EYE_L_highlight_main',pos);select(circle(569.5,249.5,2,1.5));outside();
var h2=fromA('EYE_L_highlight_secondary',pos);select(circle(573.5,249.5,1.8,1.2));outside();
pos.move(white,ElementPlacement.PLACEBEFORE);up.move(pos,ElementPlacement.PLACEBEFORE);low.move(pos,ElementPlacement.PLACEBEFORE);
app.activeDocument=source;source.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;
var parts=[up,low,iris,white,h1,h2],records=[];
for(var j=0;j<parts.length;j++){app.activeDocument=d;var l=parts[j],bb=l.bounds,coords=[];for(var k=0;k<4;k++)coords.push(bb[k].as('px'));var t=app.documents.add(1024,1536,72,'EYE_I_PART_EXPORT',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);app.activeDocument=d;l.duplicate(t,ElementPlacement.PLACEATBEGINNING);app.activeDocument=t;t.crop(bb);t.saveAs(new File(root+'split-e/parts/i-'+l.name+'.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);t.close(SaveOptions.DONOTSAVECHANGES);records.push('{"name":"'+l.name+'","bounds":['+coords.join(',')+']}');}
app.activeDocument=d;var temp=app.documents.add(1024,1536,72,'EYE_I_ASSEMBLY',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);app.activeDocument=d;eye.duplicate(temp,ElementPlacement.PLACEATBEGINNING);app.activeDocument=temp;temp.crop([545,230,610,275]);temp.saveAs(new File(out+'material-i-eye-left-neutral.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);temp.close(SaveOptions.DONOTSAVECHANGES);
app.activeDocument=d;eye.visible=false;d.save();var f=new File(out+'material-i-eye-left-exports.json');f.open('w');f.write('{"candidate":true,"source":"approved A","groupHidden":true,"layers":['+records.join(',')+']}');f.close();
return 'Six bounded left-eye candidate layers saved hidden and exported; no face assembly acceptance.';
}finally{app.displayDialogs=dialogs;app.preferences.rulerUnits=units;}
})();
