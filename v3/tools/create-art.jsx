/* Caller supplies HV3_PLAN (absolute paths, traced masks) and HV3_PSD.
 * Creates a new PSD only; does not edit or save source documents.
 */
(function () {
    var output=new File(HV3_PSD);
    if(output.exists)throw Error('Refusing to overwrite existing artwork: '+output.fsName);
    var prior=app.documents.length?app.activeDocument:null, owned=[], cache={}, target=null;
    var units=app.preferences.rulerUnits, dialogs=app.displayDialogs;
    function px(v){return Number(v.as('px'));}
    function source(path){
        if(cache[path])return cache[path];
        var f=new File(path);if(!f.exists)throw Error('Missing source '+path);
        for(var i=0;i<app.documents.length;i++)try{
            if(app.documents[i].fullName.fsName===f.fsName){cache[path]=app.documents[i];return cache[path];}
        }catch(ignore){}
        var d=app.open(f);owned.push(d);cache[path]=d;return d;
    }
    function add(p){
        var src=source(p.source);app.activeDocument=src;
        if(src.layers.length!==1)throw Error('Source must be a single-layer PNG');
        var original=src.layers[0], sb=original.bounds;
        var l=original.duplicate(target,ElementPlacement.PLACEATBEGINNING);
        app.activeDocument=target;target.activeLayer=l;l.name=(p.guide?'guide.':'art.')+p.id;
        l.translate(px(sb[0])-px(l.bounds[0]),px(sb[1])-px(l.bounds[1]));
        if(p.polygon){target.selection.select(p.polygon,SelectionType.REPLACE,p.feather||0,true);target.selection.invert();target.selection.clear();target.selection.deselect();}
        if(p.onlyBlue){
            var blue=new ActionDescriptor();blue.putEnumerated(charIDToTypeID('Clrs'),charIDToTypeID('Clrs'),charIDToTypeID('Bls '));executeAction(charIDToTypeID('ClrR'),blue,DialogModes.NO);
            // Color Range gives fractional selection even inside blue hair.
            // Convert its support to a binary cutout so source opacity is retained.
            var mask=target.channels.add();mask.name='HV3 temporary hair selection';target.selection.store(mask);target.selection.deselect();target.activeChannels=[mask];
            var threshold=new ActionDescriptor();threshold.putInteger(charIDToTypeID('Lvl '),1);executeAction(charIDToTypeID('Thrs'),threshold,DialogModes.NO);
            target.activeChannels=[target.channels[0],target.channels[1],target.channels[2]];target.selection.load(mask);mask.remove();target.selection.expand(1);target.selection.invert();target.selection.clear();target.selection.deselect();
        }
        if(p.cutouts)for(var k=0;k<p.cutouts.length;k++){
            target.selection.select(p.cutouts[k],SelectionType.REPLACE,0,true);target.selection.clear();target.selection.deselect();
        }
        // Original reference interiors use alpha 252/253. Legacy Content-Aware Fill
        // requires opaque sampling pixels. Merge an identical copy on this NEW
        // skin layer only; source PNG and its RGB values remain untouched.
        if(p.heal){var sampling=l.duplicate();l=sampling.merge();l.name='art.'+p.id;target.activeLayer=l;}
        if(p.heal)for(var h=0;h<p.heal.length;h++){
            target.selection.select(p.heal[h],SelectionType.REPLACE,0,true);
            var fill=new ActionDescriptor();fill.putEnumerated(charIDToTypeID('Usng'),charIDToTypeID('FlCn'),stringIDToTypeID('contentAware'));
            fill.putUnitDouble(charIDToTypeID('Opct'),charIDToTypeID('#Prc'),100);fill.putEnumerated(charIDToTypeID('Md  '),charIDToTypeID('BlnM'),charIDToTypeID('Nrml'));
            executeAction(charIDToTypeID('Fl  '),fill,DialogModes.NO);target.selection.deselect();
        }
        var b=l.bounds, bx=px(b[0]),by=px(b[1]),right=px(b[2]),bottom=px(b[3]);
        if(right<=bx||bottom<=by)throw Error('Empty traced part '+p.id);
        var s=p.scale||1;
        if(s!==1)l.resize(s*100,s*100,AnchorPosition.TOPLEFT);
        if(p.turn===180)l.rotate(180,AnchorPosition.MIDDLECENTER);
        if(p.mirror)l.resize(-100,100,AnchorPosition.MIDDLECENTER);
        var left=p.x+(p.turn===180?px(src.width)-right:bx)*s;
        var top=p.y+(p.turn===180?px(src.height)-bottom:by)*s;
        if(p.mirror)left=p.x+(p.turn===180?bx:px(src.width)-right)*s;
        l.translate(left-px(l.bounds[0]),top-px(l.bounds[1]));
        l.visible=p.visible!==false;
        return {id:p.id,bounds:[px(l.bounds[0]),px(l.bounds[1]),px(l.bounds[2]),px(l.bounds[3])],visible:l.visible};
    }
    try{
        app.preferences.rulerUnits=Units.PIXELS;app.displayDialogs=DialogModes.NO;
        target=app.documents.add(HV3_PLAN.width,HV3_PLAN.height,72,'Hibiki V3 original artwork',NewDocumentMode.RGB,DocumentFill.TRANSPARENT);
        var records=[];
        for(var n=0;n<HV3_PLAN.parts.length;n++)records.push(add(HV3_PLAN.parts[n]));
        // Delete only the newly-created empty default layer.
        var empty=target.layers[target.layers.length-1];if(empty.name.indexOf('art.')!==0)empty.remove();
        var opts=new PhotoshopSaveOptions();opts.layers=true;opts.alphaChannels=true;opts.embedColorProfile=true;
        target.saveAs(output,opts,false,Extension.LOWERCASE);
        return JSON.stringify({success:true,path:output.fsName,width:HV3_PLAN.width,height:HV3_PLAN.height,parts:records});
    }catch(error){
        if(target){target.close(SaveOptions.DONOTSAVECHANGES);target=null;}
        throw error;
    }finally{
        for(var j=owned.length-1;j>=0;j--)owned[j].close(SaveOptions.DONOTSAVECHANGES);
        app.preferences.rulerUnits=units;app.displayDialogs=dialogs;
        if(prior)try{app.activeDocument=prior;}catch(ignore){}
        else if(target)app.activeDocument=target;
    }
}());
