// Final material polish, independent part export and disk round-trip verification.
(function(){var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/'),base=root+'/v3/artwork/',out=base+'split-e/',old=app.displayDialogs;app.displayDialogs=DialogModes.NO;try{
var d=app.open(new File(out+'hibiki-v3-wardrobe-e.psd'));app.activeDocument=d;d.activeChannels=[d.channels[0],d.channels[1],d.channels[2]];
var body=d.layerSets.getByName('10_BODY_identity'),jacket=d.layerSets.getByName('20_WARDROBE_jacket'),shirt=d.layerSets.getByName('21_WARDROBE_shirt'),tie=d.layerSets.getByName('22_WARDROBE_tie'),lower=d.layerSets.getByName('23_WARDROBE_lower'),cloth=d.layerSets.getByName('24_SHIRT_photographic_fabric_completion'),waist=d.layerSets.getByName('25_LOWER_waist_underlap'),ground=d.layerSets.getByName('11_BODY_underclothing_paint');
// Recover the actual approved bob tips from the former jacket ownership, without duplicating pixels.
var front=jacket.artLayers.getByName('WARDROBE_jacket_front');d.activeLayer=front;d.selection.select([[350,430],[407,443],[430,445],[438,451],[430,458],[413,463],[394,459],[372,450]],SelectionType.REPLACE,0,false);d.selection.select([[608,443],[636,442],[676,430],[661,452],[641,463],[624,462],[609,451]],SelectionType.EXTEND,0,false);
var hair=d.selection.bounds;var fringe=front.duplicate();fringe.name='BODY_approved_hair_tip_ownership';d.selection.invert();d.activeLayer=fringe;d.selection.clear();d.selection.invert();d.activeLayer=front;d.selection.clear();d.selection.deselect();fringe.move(body,ElementPlacement.INSIDE);
// Light fabric at the waist, with a restrained textile grain.
waist.visible=true;var band=waist.artLayers.getByName('LOWER_waistband');band.visible=true;d.activeLayer=band;band.adjustBrightnessContrast(15,-10);band.applyAddNoise(.35,NoiseDistribution.GAUSSIAN,true);
cloth.visible=true;var collar=cloth.artLayers.getByName('SHIRT_original_collar_clean');collar.visible=true;d.activeLayer=collar;collar.applyGaussianBlur(.55);
// Remove the abandoned drawing study after its reusable placket/buttons were copied.
d.layerSets.getByName('90_FIRST_PAINT_STUDY_hidden').remove();
// Normalize artist layer names for stable export mapping.
for(var li=0;li<cloth.artLayers.length;li++){var ll=cloth.artLayers[li];if(ll.name.indexOf('SHIRT_center_placket')===0)ll.name='SHIRT_center_placket';if(ll.name.indexOf('SHIRT_button_')===0)ll.name=ll.name.substring(0,14);}
var legacy=shirt.artLayers.getByName('WARDROBE_shirt');
function state(mode){body.visible=true;ground.visible=false;cloth.visible=mode!=='approved';waist.visible=mode==='shirt'||mode==='shirt-tie';lower.visible=mode==='approved'||mode==='no-tie';jacket.visible=mode==='approved'||mode==='no-tie';tie.visible=mode==='approved'||mode==='shirt-tie';shirt.visible=true;legacy.visible=mode==='approved';for(var k=0;k<cloth.artLayers.length;k++)cloth.artLayers[k].visible=true;for(var k=0;k<waist.artLayers.length;k++)waist.artLayers[k].visible=true;}
while(d.layerComps.length)d.layerComps[0].remove();var modes=['approved','shirt-tie','shirt','no-tie'],labels=['01_APPROVED_NEUTRAL_exact','02_SHIRT_WITH_TIE','03_SHIRT_WITHOUT_TIE','04_JACKET_WITHOUT_TIE'];for(var i=0;i<modes.length;i++){state(modes[i]);d.layerComps.add(labels[i],'Authored wardrobe assembly; user acceptance is separate.',true,true,true);}state('approved');
var opts=new PhotoshopSaveOptions();opts.layers=true;opts.embedColorProfile=true;var psd=new File(out+'hibiki-v3-wardrobe-e.psd');d.saveAs(psd,opts,false,Extension.LOWERCASE);
var png=new PNGSaveOptions();png.compression=4;png.interlaced=false;
function save(name){app.activeDocument=d;d.saveAs(new File(out+name+'.png'),png,true,Extension.LOWERCASE);}
function white(name){app.activeDocument=d;var t=d.duplicate('QA '+name,false);app.activeDocument=t;var l=t.artLayers.add();l.move(t.layers[t.layers.length-1],ElementPlacement.PLACEAFTER);t.activeLayer=l;t.selection.selectAll();var c=new SolidColor();c.rgb.red=255;c.rgb.green=255;c.rgb.blue=255;t.selection.fill(c);t.selection.deselect();t.flatten();t.saveAs(new File(out+'review-'+name+'.png'),png,true,Extension.LOWERCASE);t.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=d;}
var filenames=['approved-neutral','shirt-with-tie','shirt-without-tie','jacket-without-tie'];for(var i=0;i<modes.length;i++){state(modes[i]);save(filenames[i]);white(filenames[i]);}
// Export independently replaceable materials, not precomposed costume screenshots.
var folder=new Folder(out+'parts');if(!folder.exists)folder.create();var all=[body,jacket,shirt,tie,lower,cloth,waist,ground];
function off(){for(var i=0;i<all.length;i++)all[i].visible=false;d.layerSets.getByName('00_REFERENCE_hidden').visible=false;}
var groups=[body,jacket,tie,lower,cloth,waist];var ids=['body-visible','jacket-approved','tie-approved','lower-approved-visible','shirt-complete','lower-complete'];
for(var i=0;i<groups.length;i++){off();groups[i].visible=true;for(var j=0;j<groups[i].artLayers.length;j++)groups[i].artLayers[j].visible=true;save('parts/'+ids[i]);}
off();shirt.visible=true;legacy.visible=false;save('parts/shirt-cuffs');
// Actual skin underlaps are individually editable and not shown as exposed-body examples.
for(var i=0;i<ground.artLayers.length;i++){off();ground.visible=true;for(var j=0;j<ground.artLayers.length;j++)ground.artLayers[j].visible=j===i;save('parts/'+ground.artLayers[i].name);}
for(var j=0;j<ground.artLayers.length;j++)ground.artLayers[j].visible=true;
state('approved');d.close(SaveOptions.DONOTSAVECHANGES);d=app.open(psd);app.activeDocument=d;save('reopened-neutral');for(var i=1;i<4;i++){d.layerComps[i].apply();save('reopened-'+filenames[i]);}d.layerComps[0].apply();
return 'Final PSD reopened; 4 states and 11 independent material PNGs exported';
}finally{app.displayDialogs=old;}})();
