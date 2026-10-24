// Extend only the existing hidden jaw contact margin with source-A neck pixels.
// Original face/neck layers and other PSD documents are untouched.
(function(){var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/'),file=new File(root+'/v3/artwork/split-e/hibiki-v3-motion-f.psd'),d=app.activeDocument,marker='HV3_JAW_MARGIN_1',old=app.displayDialogs;
if(d.fullName.fsName!==file.fsName)throw Error('Expected current motion F document');if((d.info.instructions||'').indexOf(marker)>=0)throw Error('Jaw margin already added');
function find(g,name){for(var i=0;i<g.layers.length;i++){var l=g.layers[i];if(l.name===name)return l;if(l.typename==='LayerSet'){var r=find(l,name);if(r)return r;}}}
var source=find(d,'BODY_neck'),target=find(d,'BODY_neck_collar_underlap');if(!source||!target)throw Error('Missing source or existing underlap');var temporary=null;app.displayDialogs=DialogModes.NO;
try{temporary=app.documents.add(1024,1536,72,'HV3 jaw contact margin',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);app.activeDocument=d;var copy=source.duplicate(temporary,ElementPlacement.PLACEATBEGINNING);app.activeDocument=temporary;copy.visible=true;temporary.activeLayer=copy;
temporary.selection.select([[445,380],[600,380],[600,420],[445,420]]);temporary.selection.invert();temporary.selection.clear();temporary.selection.deselect();copy.translate(0,-1);
var left=copy.duplicate();left.translate(-1,0);var right=copy.duplicate();right.translate(1,0);temporary.mergeVisibleLayers();var patch=temporary.activeLayer.duplicate(d,ElementPlacement.PLACEATBEGINNING);temporary.close(SaveOptions.DONOTSAVECHANGES);temporary=null;
app.activeDocument=d;var name=target.name,wasVisible=target.visible;patch.move(target,ElementPlacement.PLACEBEFORE);d.activeLayer=patch;patch.merge();d.activeLayer.name=name;d.activeLayer.visible=wasVisible;
d.info.instructions=(d.info.instructions||'')+' '+marker;d.save();return 'Saved narrow original-pixel jaw underlap; original face and neck unchanged';
}finally{if(temporary){app.activeDocument=temporary;temporary.close(SaveOptions.DONOTSAVECHANGES);}app.activeDocument=d;app.displayDialogs=old;}})();
