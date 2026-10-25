(function(){
var root='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/split-e/';
var target=new File(root+'hibiki-v3-parts-i.psd');if(target.exists)throw Error('Existing I must not be overwritten');
var oldDialogs=app.displayDialogs,oldUnits=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
try{
var d=app.documents.add(1024,1536,72,'hibiki-v3-parts-i',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);var blank=d.activeLayer;
var a=app.open(new File(root+'../hibiki-static-a.png'));var ref=a.activeLayer.duplicate(d,ElementPlacement.PLACEATEND);a.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;ref.name='APPROVED_A_REFERENCE__DO_NOT_EDIT';ref.visible=false;ref.allLocked=true;
var n=app.open(new File('C:/Users/ANKHAURUM/.codex/generated_images/01a16cbf-1efc-7573-9d15-b7294644f30e/exec-ba07eb76-d3e0-414d-9f36-6dfe94cac288.png'));
n.crop([180,155,1061,1107]);n.resizeImage(UnitValue(175,'px'),UnitValue(215,'px'),72,ResampleMethod.BICUBICSHARPER);
var neck=n.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);n.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;neck.name='BODY_neck_complete__CANDIDATE_UNVERIFIED';neck.visible=true;neck.translate(UnitValue(437-neck.bounds[0].as('px'),'px'),UnitValue(350-neck.bounds[1].as('px'),'px'));blank.remove();d.activeLayer=neck;
var opts=new PhotoshopSaveOptions();opts.layers=true;d.saveAs(target,opts,false,Extension.LOWERCASE);
d.saveAs(new File(root+'parts/i-BODY_neck_complete-candidate.png'),new PNGSaveOptions(),true,Extension.LOWERCASE);
return 'Created separate I PSD and full-canvas candidate; no original document saved. Bounds='+neck.bounds;
}finally{app.displayDialogs=oldDialogs;app.preferences.rulerUnits=oldUnits;}
})();
