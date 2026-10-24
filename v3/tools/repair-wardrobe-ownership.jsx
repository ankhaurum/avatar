// Correct material ownership by moving approved pixels; never changes the approved master.
(function(){var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/'),base=root+'/v3/artwork/',saved=app.displayDialogs;app.displayDialogs=DialogModes.NO;try{
var d=app.open(new File(base+'split-e/hibiki-v3-wardrobe-e.psd'));app.activeDocument=d;
// Restore only the five original source groups from the preserved baseline before exact reassignment.
var baseline=app.open(new File(base+'split-d/hibiki-v3-approved-split-d.psd'));
var originalGroups=['10_BODY_identity','20_WARDROBE_jacket','21_WARDROBE_shirt','22_WARDROBE_tie','23_WARDROBE_lower'];
for(var oi=0;oi<originalGroups.length;oi++){app.activeDocument=d;d.layerSets.getByName(originalGroups[oi]).remove();app.activeDocument=baseline;baseline.layerSets.getByName(originalGroups[oi]).duplicate(d,ElementPlacement.PLACEATBEGINNING);}
app.activeDocument=d;var body=d.layerSets.getByName('10_BODY_identity'),jacket=d.layerSets.getByName('20_WARDROBE_jacket'),shirt=d.layerSets.getByName('21_WARDROBE_shirt'),lower=d.layerSets.getByName('23_WARDROBE_lower'),cloth=d.layerSets.getByName('24_SHIRT_photographic_fabric_completion'),waist=d.layerSets.getByName('25_LOWER_waist_underlap');
var source=app.open(new File(base+'hibiki-static-a.png'));
function nativeChannel(name,coeff,level){app.activeDocument=source;var t=source.duplicate(name,false);app.activeDocument=t;t.activeLayer.mixChannels([coeff],true);t.activeLayer.threshold(level);var channel=t.channels[0].duplicate(d);app.activeDocument=t;t.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;channel.name=name;d.activeChannels=[channel];var binary=new ActionDescriptor();binary.putInteger(charIDToTypeID('Lvl '),127);executeAction(charIDToTypeID('Thrs'),binary,DialogModes.NO);var h=channel.histogram;for(var hi=1;hi<255;hi++)if(h[hi]!==0)throw Error('Nonbinary ownership map '+name);d.activeChannels=[d.channels[0],d.channels[1],d.channels[2]];return channel;}
var skin=nativeChannel('ownership_skin_RminusB',[100,0,-100,0],10),blue=nativeChannel('ownership_blue_BminusR',[-100,0,100,0],35),white=nativeChannel('ownership_neutral_fabric',[100,0,-100,20],31);
function choose(mask,invert,poly){d.selection.deselect();if(mask){d.selection.load(mask);if(invert)d.selection.invert();if(poly)d.selection.select(poly,SelectionType.INTERSECT,0,false);}else d.selection.select(poly,SelectionType.REPLACE,0,false);}
function transfer(src,dest,name,mask,invert,poly){app.activeDocument=d;d.activeChannels=[d.channels[0],d.channels[1],d.channels[2]];choose(mask,invert,poly);try{var bb=d.selection.bounds;}catch(e){return 0;}d.activeLayer=src;var copy=src.duplicate();d.activeLayer=copy;d.selection.invert();d.selection.clear();d.selection.invert();d.activeLayer=src;d.selection.clear();d.selection.deselect();var b=copy.bounds;if(b[0].as('px')===b[2].as('px')){copy.remove();return 0;}copy.name=name;copy.move(dest,ElementPlacement.INSIDE);return 1;}
// The bob tips belong to body identity even where the initial cut placed them in the jacket.
var front=jacket.artLayers.getByName('WARDROBE_jacket_front');
transfer(front,body,'BODY_hair_tip_left_recovered',null,false,[[350,430],[407,443],[430,445],[438,451],[430,458],[413,463],[394,459],[372,450]]);
transfer(front,body,'BODY_hair_tip_right_recovered',null,false,[[608,443],[636,442],[676,430],[661,452],[641,463],[624,462],[609,451]]);
var count=0,legacyShirt=shirt.artLayers.getByName('WARDROBE_shirt'),legacyLower=lower.artLayers.getByName('WARDROBE_lower_skirt');
count+=transfer(legacyShirt,jacket,'JACKET_inner_lapel_recovered',white,false,[[400,570],[640,570],[640,905],[400,905]]);
count+=transfer(legacyShirt,jacket,'JACKET_lapel_tip_recovered',null,false,[[502,793],[550,835],[550,879],[501,847]]);
count+=transfer(legacyLower,jacket,'JACKET_blue_hem_recovered',blue,false,[[170,1000],[850,1000],[850,1300],[170,1300]]);
var hem=[[190,1000],[540,1000],[536,1050],[528,1090],[514,1133],[498,1164],[478,1187],[454,1204],[430,1214],[405,1220],[375,1221],[343,1217],[309,1209],[279,1198],[251,1184],[190,1160]];
count+=transfer(legacyLower,jacket,'JACKET_left_hem_underlap_recovered',null,false,hem);
count+=transfer(legacyLower,jacket,'JACKET_right_hem_underlap_recovered',null,false,[[543,1000],[850,1000],[850,1176],[784,1195],[760,1208],[720,1219],[679,1221],[640,1213],[605,1196],[578,1170],[562,1136],[551,1093],[544,1050]]);
count+=transfer(body.artLayers.getByName('BODY_hand_viewer_right'),lower,'LOWER_edge_recovered_from_hand',skin,true,[[790,1315],[821,1315],[821,1378],[790,1378]]);
count+=transfer(body.artLayers.getByName('BODY_legs_visible'),lower,'LOWER_hem_recovered_from_leg',skin,true,[[240,1370],[790,1370],[790,1440],[240,1440]]);
count+=transfer(legacyLower,body,'BODY_leg_edge_recovered',skin,false,[[240,1370],[790,1370],[790,1450],[240,1450]]);
// Remove copied skin from the completed lower garment, using the actual source material separation.
var skirt=waist.artLayers.getByName('LOWER_complete_pleated_fabric');d.activeLayer=skirt;choose(skin,false,[[0,1320],[1024,1320],[1024,1536],[0,1536]]);d.selection.clear();d.selection.deselect();
var fabric=cloth.artLayers.getByName('SHIRT_completed_fabric');d.activeLayer=fabric;choose(skin,false,[[400,400],[640,400],[640,555],[400,555]]);d.selection.clear();d.selection.deselect();
skin.remove();blue.remove();white.remove();d.activeChannels=[d.channels[0],d.channels[1],d.channels[2]];
// Use the exact neutral layer comp, then keep every recovered source layer visible in that group.
for(var gi=0;gi<d.layerSets.length;gi++)d.layerSets[gi].visible=false;body.visible=true;jacket.visible=true;shirt.visible=true;lower.visible=true;d.layerSets.getByName('22_WARDROBE_tie').visible=true;for(var i=0;i<jacket.artLayers.length;i++)jacket.artLayers[i].visible=true;for(var i=0;i<lower.artLayers.length;i++)lower.artLayers[i].visible=true;for(var i=0;i<body.artLayers.length;i++)body.artLayers[i].visible=true;
var opt=new PhotoshopSaveOptions();opt.layers=true;opt.embedColorProfile=true;d.saveAs(new File(base+'split-e/hibiki-v3-wardrobe-e.psd'),opt,false,Extension.LOWERCASE);return 'Approved-pixel ownership repaired in '+count+' transfers';
}finally{app.displayDialogs=saved;}})();
