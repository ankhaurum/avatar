(function(){var stage='start',di=app.displayDialogs,un=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;try{
var out='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/';
var a='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/hibiki-static-a.png';
var src='C:/Users/ANKHAURUM/.codex/generated_images/01a16cbf-1efc-7573-9d15-b7294644f30e/exec-b4d3a899-1e1c-4791-9d55-397ff36befa3.png';
if(new File(out+'hibiki-v3-independent-hair-m.psd').exists)throw new Error('M exists; inspect instead of overwrite');
var d=app.documents.add(1024,1536,72,'hibiki-v3-independent-hair-m',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);
var initial=d.activeLayer;
stage='preserve approved A reference';var ref=app.open(new File(a));var guide=ref.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);ref.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;guide.name='REFERENCE_approved_A_DO_NOT_EDIT';guide.visible=false;guide.allLocked=true;initial.remove();
stage='place independent full side hair';var n=app.open(new File(src));n.trim(TrimType.TRANSPARENT,true,true,true,true);n.resizeImage(UnitValue(148,'px'),UnitValue(385,'px'),72,ResampleMethod.BICUBICSHARPER);n.saveAs(new File(out+'m-HAIR_side_R_complete.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);
var l=n.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);n.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;l.name='M_HAIR_side_R_complete__REVIEW';l.translate(UnitValue(310-l.bounds[0].as('px'),'px'),UnitValue(70-l.bounds[1].as('px'),'px'));
stage='save new independent PSD';var op=new PhotoshopSaveOptions();op.layers=true;d.saveAs(new File(out+'hibiki-v3-independent-hair-m.psd'),op,false,Extension.LOWERCASE);
guide.visible=true;d.saveAs(new File(out+'m-side-R-on-approved-A.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);guide.visible=false;
var proof=d.duplicate('M_EDGE_REVIEW',false);proof.crop([295,55,475,470]);
function bg(v,name){var b=proof.artLayers.add();b.name=name;var col=new SolidColor();col.rgb.red=v;col.rgb.green=v;col.rgb.blue=v;proof.selection.selectAll();proof.selection.fill(col);proof.selection.deselect();b.move(proof.layers[proof.layers.length-1],ElementPlacement.PLACEAFTER);return b;}
var white=bg(255,'white');proof.saveAs(new File(out+'m-side-R-white-review.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);white.visible=false;var dark=bg(25,'dark');proof.saveAs(new File(out+'m-side-R-dark-review.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);proof.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;d.save();
return 'M independent side hair PSD saved; original A hidden and locked; white/dark and A overlay exported; no previous PSD edited';
}catch(e){return 'ERROR '+stage+': '+e+' line '+e.line;}finally{app.displayDialogs=di;app.preferences.rulerUnits=un;}})()
