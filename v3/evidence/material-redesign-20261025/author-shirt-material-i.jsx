(function(){
var root='C:/Users/ANKHAURUM/.codex/visualizations/2026/10/21/01a15c3a-66a4-72d0-b803-60edb76b7d7a/avatar-publication/v3/artwork/split-e/';
app.activeDocument=app.documents.getByName('hibiki-v3-parts-i.psd');var d=app.activeDocument;
for(var j=0;j<d.layerSets.length;j++)if(d.layerSets[j].name==='20_SHIRT_complete')throw Error('Shirt already authored; inspect before editing');
var old=app.displayDialogs,units=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
try{
var back=d.layerSets.add();back.name='19_SHIRT_rear_collar';back.move(d.artLayers.getByName('BODY_neck_complete__CANDIDATE_UNVERIFIED'),ElementPlacement.PLACEAFTER);
var front=d.layerSets.add();front.name='20_SHIRT_complete';
function part(name,file,crop,target,flip,poly,group){var n=app.open(new File(root+'parts/'+file));if(poly){n.selection.select(poly,SelectionType.REPLACE,0,true);n.selection.invert();n.selection.clear();n.selection.deselect();}n.crop(crop);if(flip)n.flipCanvas(Direction.HORIZONTAL);n.resizeImage(UnitValue(target[2]-target[0],'px'),UnitValue(target[3]-target[1],'px'),72,ResampleMethod.BICUBICSHARPER);var sx=n.activeLayer.bounds[0].as('px'),sy=n.activeLayer.bounds[1].as('px');var l=n.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);n.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;l.name=name;l.translate(UnitValue(target[0]+sx-l.bounds[0].as('px'),'px'),UnitValue(target[1]+sy-l.bounds[1].as('px'),'px'));l.move(group,ElementPlacement.INSIDE);return l;}
part('SHIRT_sleeve_viewer_left','i-shirt-sleeve-source.png',[145,34,881,1502],[139,493,341,1285],false,null,front);
part('SHIRT_sleeve_viewer_right','i-shirt-sleeve-source.png',[145,34,881,1502],[683,493,885,1285],true,null,front);
part('SHIRT_cuff_viewer_left','i-shirt-cuff-source.png',[189,212,1039,1051],[132,1264,219,1305],false,null,front);
part('SHIRT_cuff_viewer_right','i-shirt-cuff-source.png',[189,212,1039,1051],[805,1264,892,1305],true,null,front);
part('SHIRT_torso_complete','i-shirt-torso-source.png',[94,162,929,1467],[293,435,734,1110],false,null,front);
var collar=[64,78,1474,939],place=[436,449,616,579];
part('SHIRT_collar_rear_band','i-shirt-collar-source.png',collar,place,false,[[330,0],[1206,0],[1206,430],[330,430]],back);
part('SHIRT_collar_viewer_left','i-shirt-collar-source.png',collar,place,false,[[0,0],[380,0],[380,330],[440,590],[640,760],[0,1024]],front);
part('SHIRT_collar_viewer_right','i-shirt-collar-source.png',collar,place,false,[[1536,0],[1156,0],[1156,330],[1096,590],[896,760],[1536,1024]],front);
d.save();return 'I saved with complete torso, independent mirrored sleeves/cuffs, and three collar layers; assembly verification pending.';
}finally{app.displayDialogs=old;app.preferences.rulerUnits=units;}
})();
