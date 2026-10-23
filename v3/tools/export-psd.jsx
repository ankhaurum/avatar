/* Photoshop CC ExtendScript. Caller sets HV3_SOURCE and HV3_OUTPUT.
 * Source PSD is opened separately and never saved by this exporter.
 * Only artwork layers named art.<stable-id> are exported.
 */
(function () {
    if (typeof HV3_SOURCE === 'undefined' || typeof HV3_OUTPUT === 'undefined') throw Error('Source and output required');
    var source = new File(HV3_SOURCE), out = new Folder(HV3_OUTPUT);
    if (!source.exists) throw Error('Missing source PSD');
    if (out.exists) throw Error('Export directory already exists; use a new revision');
    if (!out.create()) throw Error('Cannot create output directory');
    var prior = app.documents.length ? app.activeDocument : null;
    var units = app.preferences.rulerUnits, dialogs = app.displayDialogs;
    var doc = null, isolated = null, records = [], seen = {};
    function px(n) { return Number(n.as('px')); }
    function visit(layers, path, found) {
        for (var i = 0; i < layers.length; i++) {
            var l = layers[i], next = path.concat([l.name]);
            if (l.typename === 'LayerSet') visit(l.layers, next, found);
            else if (l.name.indexOf('art.') === 0) {
                var id = l.name.substring(4);
                if (!/^[a-z][a-z0-9_.-]*$/.test(id) || seen[id]) throw Error('Invalid or duplicate ID: ' + id);
                seen[id] = true;
                var b = l.bounds, box = [px(b[0]),px(b[1]),px(b[2]),px(b[3])];
                if (box[2] <= box[0] || box[3] <= box[1]) throw Error('Empty art: ' + id);
                found.push({layer:l,id:id,path:next,bounds:box,visible:l.visible});
            }
        }
    }
    try {
        app.preferences.rulerUnits = Units.PIXELS; app.displayDialogs = DialogModes.NO;
        // Opening an already-open PSD could return the user's document. Use a duplicate.
        var opened = null, wasOpen = false;
        for (var d = 0; d < app.documents.length; d++) {
            try { if (app.documents[d].fullName.fsName === source.fsName) {opened=app.documents[d];wasOpen=true;break;} } catch(ignore) {}
        }
        if (!opened) opened = app.open(source);
        if (wasOpen && !opened.saved) throw Error('Source PSD has unsaved edits; save the owned artwork before exporting');
        app.activeDocument = opened;
        var expectedLayers=opened.layers.length;
        doc = opened.duplicate('HV3 export working copy');
        if(doc.layers.length!==expectedLayers)throw Error('Duplicated document does not match selected PSD');
        if (!wasOpen) opened.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = doc;
        var entries=[]; visit(doc.layers, [], entries);
        if (!entries.length) throw Error('No art layers');
        var width=px(doc.width), height=px(doc.height);
        // Incremental export is opt-in only for an author-tracked edit with an
        // explicit complete changed-ID list. Unknown/manual edits use full export.
        var priorLayers={},changed=null;
        if(typeof HV3_CHANGED!=='undefined'){
            if(typeof HV3_PREVIOUS==='undefined')throw Error('Previous export required');
            var previousFile=new File(HV3_PREVIOUS+'/layers.json');previousFile.open('r');
            var previous=eval('('+previousFile.read()+')');previousFile.close();
            if(previous.width!==width||previous.height!==height)throw Error('Incremental export canvas changed');
            for(var p=0;p<previous.layers.length;p++)if(!seen[previous.layers[p].id])throw Error('Incremental export cannot remove existing layers');
            for(var p=0;p<previous.layers.length;p++)priorLayers[previous.layers[p].id]=previous.layers[p];
            changed={};for(var c=0;c<HV3_CHANGED.length;c++)changed[HV3_CHANGED[c]]=true;
        }
        for (var j=0;j<entries.length;j++) {
            var e=entries[j], b=e.bounds;
            if(changed&&!changed[e.id]){
                var old=priorLayers[e.id];
                if(!old||old.bounds.join(',')!==b.join(',')||old.visible!==e.visible)throw Error('Undeclared changed layer '+e.id);
                var oldFile=new File(HV3_PREVIOUS+'/'+old.file);
                if(!oldFile.exists||!oldFile.copy(out.fsName+'/'+e.id+'.png'))throw Error('Cannot reuse '+e.id);
                records.push({id:e.id,path:e.path,bounds:b,visible:e.visible,file:e.id+'.png'});continue;
            }
            isolated=app.documents.add(width,height,doc.resolution,'HV3 isolated '+e.id,NewDocumentMode.RGB,DocumentFill.TRANSPARENT);
            app.activeDocument=doc;
            var layer=e.layer.duplicate(isolated,ElementPlacement.PLACEATBEGINNING);
            app.activeDocument=isolated; layer.visible=true;
            isolated.crop([UnitValue(b[0],'px'),UnitValue(b[1],'px'),UnitValue(b[2],'px'),UnitValue(b[3],'px')]);
            var options=new PNGSaveOptions();options.interlaced=false;
            isolated.saveAs(new File(out.fsName+'/'+e.id+'.png'),options,true,Extension.LOWERCASE);
            isolated.close(SaveOptions.DONOTSAVECHANGES);isolated=null;
            records.push({id:e.id,path:e.path,bounds:b,visible:e.visible,file:e.id+'.png'});
        }
        var manifest={format:'hibiki-art-export',version:1,width:width,height:height,sourceName:source.name,layers:records};
        if(changed)manifest.incremental={previous:new Folder(HV3_PREVIOUS).name,changed:HV3_CHANGED,authority:'explicit author-tracked layer edits; not inferred from unchanged bounds'};
        var file=new File(out.fsName+'/layers.json');file.encoding='UTF8';
        if(!file.open('w'))throw Error('Cannot write manifest');file.write(JSON.stringify(manifest));file.close();
        return JSON.stringify({success:true,output:out.fsName,layers:records.length,width:width,height:height});
    } finally {
        if(isolated)isolated.close(SaveOptions.DONOTSAVECHANGES);
        if(doc)doc.close(SaveOptions.DONOTSAVECHANGES);
        app.preferences.rulerUnits=units;app.displayDialogs=dialogs;
        if(prior)try{app.activeDocument=prior;}catch(ignore){}
    }
}());
