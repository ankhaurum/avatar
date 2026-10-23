(function(){var previousDialogs=app.displayDialogs;app.displayDialogs=DialogModes.NO;try{
 var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/'),base=root+'/v3/artwork/',out=base+'split-d/';
 var png=new PNGSaveOptions();
 function board(name,files,bg){
  var doc=app.documents.add(UnitValue(1024*files.length,'px'),UnitValue(1536,'px'),72,name,NewDocumentMode.RGB,DocumentFill.TRANSPARENT);
  app.activeDocument=doc;var ground=doc.activeLayer;var c=new SolidColor();c.rgb.red=bg;c.rgb.green=bg;c.rgb.blue=bg;doc.selection.selectAll();doc.selection.fill(c);doc.selection.deselect();
  for(var i=0;i<files.length;i++){var src=app.open(new File(files[i]));app.activeDocument=src;var l=src.activeLayer.duplicate(doc,ElementPlacement.PLACEATBEGINNING);app.activeDocument=doc;doc.activeLayer=l;l.translate(UnitValue(1024*i,'px'),UnitValue(0,'px'));}
  app.activeDocument=doc;doc.flatten();doc.saveAs(new File(out+name+'.png'),png,true);doc.close(SaveOptions.DONOTSAVECHANGES);
 }
 board('approved-recomposed-white',[base+'hibiki-static-a.png',out+'reopened.png'],255);
 board('approved-recomposed-dark',[base+'hibiki-static-a.png',out+'reopened.png'],32);
 board('body-wardrobe-white',[out+'body-visible.png',out+'wardrobe-visible.png'],255);
 board('parts-white',[out+'parts/BODY_face.png',out+'parts/WARDROBE_shirt.png',out+'parts/WARDROBE_tie.png',out+'parts/WARDROBE_jacket_front.png'],255);
 return 'Comparison boards saved';}finally{app.displayDialogs=previousDialogs;}
})();
