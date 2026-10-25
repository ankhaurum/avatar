(function(){
var root='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/';
var out='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/';app.activeDocument=app.documents.getByName('hibiki-v3-parts-i.psd');var d=app.activeDocument;
if(!d.saved)throw Error('Unsaved I; inspect before editing');
for(var z=0;z<d.layerSets.length;z++)if(d.layerSets[z].name==='40_EYE_R_material_candidate')throw Error('Eye already present');
var dialogs=app.displayDialogs,units=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
try{
var source=app.open(new File(root+'hibiki-static-a.png'));app.activeDocument=d;var eye=d.layerSets.add();eye.name='40_EYE_R_material_candidate';var pos=eye.layerSets.add();pos.name='EYE_R_eyeball_position';
function select(poly,mode){d.selection.select(poly,mode||SelectionType.REPLACE,0,true);}
function circle(x,y,rx,ry){var a=[];for(var k=0;k<64;k++){var t=k*Math.PI/32;a.push([x+rx*Math.cos(t),y+ry*Math.sin(t)]);}return a;}
function outside(){d.selection.invert();d.selection.clear();d.selection.deselect();}
function fromA(name,parent){app.activeDocument=source;var l=source.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);app.activeDocument=d;l.name=name;l.move(parent,ElementPlacement.INSIDE);d.activeLayer=l;return l;}
function imagePart(path,name,crop,target,parent){var n=app.open(new File(path));n.crop(crop);n.resizeImage(UnitValue(target[2]-target[0],'px'),UnitValue(target[3]-target[1],'px'),72,ResampleMethod.BICUBICSHARPER);var l=n.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);n.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;l.name=name;l.translate(UnitValue(target[0]-l.bounds[0].as('px'),'px'),UnitValue(target[1]-l.bounds[1].as('px'),'px'));l.move(parent,ElementPlacement.INSIDE);d.activeLayer=l;return l;}
var opening=[[447,261],[456,256],[466,252],[475,251.5],[483,253],[491,257],[500,264],[492,265],[483,267],[473,267],[461,265],[451,263]];
var irisArea=circle(475,257,10.5,10.5);
var paint=imagePart(root+'split-e/parts/h-EYE_R_iris-source.png','iris_hidden_completion',[165,124,1120,1086],[464.5,246.5,485.5,267.5],pos);
var iris=fromA('iris_original_visible',pos);select(opening);select(irisArea,SelectionType.INTERSECT);outside();select(circle(473,255.7,1.6,1.2));select(circle(478,255.7,1,0.8),SelectionType.EXTEND);d.selection.clear();d.selection.deselect();paint.move(iris,ElementPlacement.PLACEAFTER);d.activeLayer=iris;iris=iris.merge();iris.name='EYE_R_iris_complete_candidate';
var white=imagePart(root+'split-e/parts/i-eye-sclera-source.png','sclera_hidden_completion',[218,72,1955,644],[444,246,503,272],eye);select(opening);outside();
var visibleWhite=fromA('white_original_visible',eye);select(opening);outside();select(irisArea);d.selection.clear();d.selection.deselect();white.move(visibleWhite,ElementPlacement.PLACEAFTER);d.activeLayer=visibleWhite;white=visibleWhite.merge();white.name='EYE_R_sclera_complete_candidate';
var up=fromA('EYE_R_upper_lid_lash_candidate',eye);
select([[442,260],[448,254],[456,249],[465,246],[475,245],[484,247],[492,252],[500,260],[503,265],[500,264],[491,257],[483,253],[475,251.5],[466,252],[456,256],[447,261],[442,264]]);outside();
var low=fromA('EYE_R_lower_lid_candidate',eye);
select([[447,261],[451,263],[461,265],[473,267],[483,267],[492,265],[500,264],[503,265],[500,270],[489,273],[474,274],[460,271],[447,266],[442,264]]);outside();
var h1=fromA('EYE_R_highlight_main',pos);select(circle(473,255.7,1.6,1.2));outside();
var h2=fromA('EYE_R_highlight_secondary',pos);select(circle(478,255.7,1,0.8));outside();
pos.move(white,ElementPlacement.PLACEBEFORE);up.move(pos,ElementPlacement.PLACEBEFORE);low.move(pos,ElementPlacement.PLACEBEFORE);
app.activeDocument=source;source.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;
var parts=[up,low,iris,white,h1,h2],records=[];
for(var j=0;j<parts.length;j++){app.activeDocument=d;var l=parts[j],bb=l.bounds,coords=[];for(var k=0;k<4;k++)coords.push(bb[k].as('px'));var t=app.documents.add(1024,1536,72,'EYE_I_PART_EXPORT',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);app.activeDocument=d;l.duplicate(t,ElementPlacement.PLACEATBEGINNING);app.activeDocument=t;t.crop(bb);t.saveAs(new File(root+'split-e/parts/i-'+l.name+'.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);t.close(SaveOptions.DONOTSAVECHANGES);records.push('{"name":"'+l.name+'","bounds":['+coords.join(',')+']}');}
app.activeDocument=d;var temp=app.documents.add(1024,1536,72,'EYE_I_ASSEMBLY',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);app.activeDocument=d;eye.duplicate(temp,ElementPlacement.PLACEATBEGINNING);app.activeDocument=temp;temp.crop([436,239,510,280]);temp.saveAs(new File(out+'material-i-eye-neutral.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);temp.close(SaveOptions.DONOTSAVECHANGES);
app.activeDocument=d;eye.visible=false;d.save();var f=new File(out+'material-i-eye-exports.json');f.open('w');f.write('{"candidate":true,"source":"approved A","groupHidden":true,"layers":['+records.join(',')+']}');f.close();
return 'Six bounded right-eye candidate layers saved hidden and exported; no face assembly acceptance.';
}finally{app.displayDialogs=dialogs;app.preferences.rulerUnits=units;}
})();
