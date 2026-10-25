(function(){
var root='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/split-e/';
app.activeDocument=app.documents.getByName('hibiki-v3-parts-i.psd');var d=app.activeDocument;
if(!d.saved)throw Error('Preserve unsaved document before changing collar');
for(var j=0;j<d.layerSets.length;j++)if(d.layerSets[j].name==='98_COLLAR_previous_split_hidden')throw Error('Collar split already replaced');
var dialogs=app.displayDialogs,units=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
try{
var front=d.layerSets.getByName('20_SHIRT_complete');var archive=d.layerSets.add();archive.name='98_COLLAR_previous_split_hidden';archive.visible=false;
function replace(name,poly){
var n=app.open(new File(root+'parts/i-shirt-collar-source.png'));n.selection.select(poly,SelectionType.REPLACE,0,true);n.selection.invert();n.selection.clear();n.selection.deselect();n.crop([64,78,1474,939]);n.resizeImage(UnitValue(180,'px'),UnitValue(130,'px'),72,ResampleMethod.BICUBICSHARPER);var sx=n.activeLayer.bounds[0].as('px'),sy=n.activeLayer.bounds[1].as('px');var l=n.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);n.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;front.artLayers.getByName(name).move(archive,ElementPlacement.INSIDE);l.name=name;l.translate(UnitValue(436+sx-l.bounds[0].as('px'),'px'),UnitValue(449+sy-l.bounds[1].as('px'),'px'));l.move(front,ElementPlacement.INSIDE);
}
replace('SHIRT_collar_viewer_left',[[0,345],[370,345],[388,410],[410,490],[440,590],[640,760],[0,1024]]);
replace('SHIRT_collar_viewer_right',[[1536,345],[1166,345],[1148,410],[1126,490],[1096,590],[896,760],[1536,1024]]);
archive.visible=false;d.save();return 'Front collar split follows lower fold; prior split retained hidden; assembly still requires verification.';
}finally{app.displayDialogs=dialogs;app.preferences.rulerUnits=units;}
})();
