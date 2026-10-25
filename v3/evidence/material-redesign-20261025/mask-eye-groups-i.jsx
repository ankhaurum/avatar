(function(){app.activeDocument=app.documents.getByName('hibiki-v3-parts-i.psd');var d=app.activeDocument,old=app.displayDialogs;app.displayDialogs=DialogModes.NO;
function cid(s){return charIDToTypeID(s);}
function show(g){g.visible=true;for(var k=0;k<g.layers.length;k++){g.layers[k].visible=true;if(g.layers[k].typename==='LayerSet')show(g.layers[k]);}}
try{
var configs=[['40_EYE_R_material_candidate','EYE_R_eyeball_position','EYE_R_sclera_complete_candidate',[436,239,510,280],'material-i-eye-neutral.png'],['41_EYE_L_material_candidate','EYE_L_eyeball_position','EYE_L_sclera_complete_candidate',[545,230,610,275],'material-i-eye-left-neutral.png']];
for(var i=0;i<configs.length;i++){
var c=configs[i],e=d.layerSets.getByName(c[0]),p=e.layerSets.getByName(c[1]);show(e);d.activeLayer=e.artLayers.getByName(c[2]);
var a=new ActionDescriptor(),r=new ActionReference();r.putProperty(cid('Chnl'),cid('fsel'));a.putReference(cid('null'),r);var t=new ActionReference();t.putEnumerated(cid('Chnl'),cid('Chnl'),cid('Trsp'));a.putReference(cid('T   '),t);executeAction(cid('setd'),a,DialogModes.NO);
d.activeLayer=p;a=new ActionDescriptor();a.putClass(cid('Nw  '),cid('Chnl'));r=new ActionReference();r.putEnumerated(cid('Chnl'),cid('Chnl'),cid('Msk '));a.putReference(cid('At  '),r);a.putEnumerated(cid('Usng'),cid('UsrM'),cid('RvlS'));executeAction(cid('Mk  '),a,DialogModes.NO);d.selection.deselect();
var tmp=app.documents.add(1024,1536,72,'EYE_MASK_VERIFICATION',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);app.activeDocument=d;e.duplicate(tmp,ElementPlacement.PLACEATBEGINNING);app.activeDocument=tmp;tmp.crop(c[3]);tmp.saveAs(new File('C:/Users/ANKHAURUM/.codex/visualizations/2026/10/24/01a16cbf-1efc-7573-9d15-b7294644f30e/'+c[4]),new PNGSaveOptions(),true,Extension.LOWERCASE);tmp.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;e.visible=false;
}d.save();return 'Both eyeball groups have nondestructive masks from their own sclera alpha; native render saved';
}finally{app.displayDialogs=old;}})();
