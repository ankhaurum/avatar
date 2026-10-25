(function(){var un=app.preferences.rulerUnits,dm=app.displayDialogs;app.preferences.rulerUnits=Units.PIXELS;app.displayDialogs=DialogModes.NO;var stage='guard';try{
var src=app.documents.getByName('hibiki-approved-a-lips-curved-study.psd'),f=new File('C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/hibiki-mouth-material-production.psd');if(f.exists)throw Error('Existing production must be inspected');
app.activeDocument=src;var d=src.duplicate('hibiki-mouth-material-production',false);app.activeDocument=d;
var g=d.layerSets.add();g.name='MOUTH_INTERNALS_material_edit__REVIEW';g.move(d.layers[d.layers.length-1],ElementPlacement.PLACEAFTER);
g.visible=true;
var specs=[
['MOUTH_cavity_continuous_painted',[[487,345],[490,340],[502,337],[524,336],[548,336],[564,337],[570,341],[572,350],[570,361],[564,370],[555,376],[541,380],[524,381],[510,378],[499,373],[491,365],[487,354]],[43,12,21],[77,22,30],0.45],
['MOUTH_inner_wall_L_painted',[[487,345],[490,342],[494,342],[498,347],[501,353],[503,361],[502,370],[498,375],[493,370],[489,362],[487,353]],[128,40,46],[68,19,27],0.7],
['MOUTH_inner_wall_R_painted',[[560,341],[564,338],[568,338],[571,342],[572,350],[569,360],[565,368],[559,375],[554,375],[554,366],[554,357],[556,349]],[128,40,46],[68,19,27],0.7]];
for(var i=0;i<specs.length;i++){var z=specs[i],l=g.artLayers.getByName(z[0]);d.activeLayer=l;d.selection.selectAll();d.selection.clear();d.selection.deselect();d.selection.select(z[1],SelectionType.REPLACE,0,true);var c=new SolidColor();c.rgb.red=z[2][0];c.rgb.green=z[2][1];c.rgb.blue=z[2][2];d.selection.fill(c);d.selection.deselect();for(var y=336;y<384;y+=3){var t=(y-336)/48;c.rgb.red=z[2][0]+(z[3][0]-z[2][0])*t;c.rgb.green=z[2][1]+(z[3][1]-z[2][1])*t;c.rgb.blue=z[2][2]+(z[3][2]-z[2][2])*t;d.selection.select([[480,y],[580,y],[580,y+3],[480,y+3]],SelectionType.REPLACE,0,false);d.selection.fill(c,ColorBlendMode.NORMAL,100,true);}d.selection.deselect();l.applyGaussianBlur(z[4]);}

stage='reuse assessed candidates';
var old=d.layerSets.getByName('MOUTH_internal_materials__DRAFT');
var tongue=old.artLayers.getByName('MOUTH_tongue_complete_candidate').duplicate(g,ElementPlacement.PLACEATBEGINNING);tongue.name='MOUTH_tongue_J_source__REVIEW';tongue.visible=true;
var teeth=old.artLayers.getByName('MOUTH_upper_teeth_complete_candidate').duplicate(g,ElementPlacement.PLACEATBEGINNING);teeth.name='MOUTH_upper_teeth_J_source__REVIEW';teeth.visible=true;
stage='proof';g.visible=true;d.artLayers.getByName('UPPER_original_A_visible').visible=false;d.artLayers.getByName('LOWER_original_A_visible').visible=false;
var p=d.duplicate('material-only-proof-owned',false);app.activeDocument=p;var bg=p.artLayers.add();bg.move(p.layers[p.layers.length-1],ElementPlacement.PLACEAFTER);p.activeLayer=bg;var c=new SolidColor();c.rgb.red=224;c.rgb.green=224;c.rgb.blue=224;p.selection.selectAll();p.selection.fill(c);p.selection.deselect();p.flatten();p.crop([480,330,580,390]);p.resizeImage(UnitValue(800,'px'),null,null,ResampleMethod.NEARESTNEIGHBOR);p.saveAs(new File('C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/mouth-materials-depth-review.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);p.close(SaveOptions.DONOTSAVECHANGES);
app.activeDocument=d;g.visible=false;d.artLayers.getByName('UPPER_original_A_visible').visible=true;d.artLayers.getByName('LOWER_original_A_visible').visible=true;
stage='save neutral';var ps=new PhotoshopSaveOptions();ps.layers=true;d.saveAs(f,ps,false,Extension.LOWERCASE);return JSON.stringify({path:f.fsName,sourceSaved:src.saved,neutral:'original lips only',newPaint:['cavity','left wall','right wall'],reusedCandidates:['J tongue','J upper teeth'],deformation:false});
}catch(e){return 'ERROR '+stage+' '+e+' line '+e.line;}finally{app.preferences.rulerUnits=un;app.displayDialogs=dm;}})()
