// Photoshop 2018 / ExtendScript. Source pixels and full-canvas coordinates are immutable.
// Run with app.activeDocument explicitly selected before every document operation.
(function () {
 function encode(x){if(x===null)return 'null';if(typeof x==='string')return '"'+x.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"';if(typeof x==='number'||typeof x==='boolean')return String(x);var a=[];if(x instanceof Array){for(var i=0;i<x.length;i++)a.push(encode(x[i]));return '['+a.join(',')+']';}for(var k in x)if(x.hasOwnProperty(k))a.push(encode(k)+':'+encode(x[k]));return '{'+a.join(',')+'}';}
 var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/');
 var base=root+'/v3/artwork/',out=new Folder(base+'split-d');if(!out.exists)out.create();
 var partsDir=new Folder(out.fsName+'/parts');if(!partsDir.exists)partsDir.create();
 var dst=new File(out.fsName+'/hibiki-v3-approved-split-d.psd');if(dst.exists && $.getenv('HV3_REBUILD')!=='1')throw Error('Refusing to replace existing PSD');
 var oldUnits=app.preferences.rulerUnits;app.preferences.rulerUnits=Units.PIXELS;
 var src=app.open(new File(base+'hibiki-static-a.png'));app.activeDocument=src;
 if(src.width.as('px')!==1024||src.height.as('px')!==1536)throw Error('Unexpected source canvas');
 var doc=src.duplicate('HV3 approved A editable separation D',false);app.activeDocument=doc;
 var rest=doc.activeLayer;rest.name='SOURCE_transparent_fringe_residual';
 var ref=doc.layerSets.add();ref.name='00_REFERENCE_hidden';var master=rest.duplicate();master.move(ref,ElementPlacement.INSIDE);master.name='APPROVED_A_UNMODIFIED';ref.visible=false;
 var body=doc.layerSets.add();body.name='10_BODY_identity';
 var jacket=doc.layerSets.add();jacket.name='20_WARDROBE_jacket';
 var shirt=doc.layerSets.add();shirt.name='21_WARDROBE_shirt';
 var tie=doc.layerSets.add();tie.name='22_WARDROBE_tie';
 var lower=doc.layerSets.add();lower.name='23_WARDROBE_lower';
 var fringe=doc.layerSets.add();fringe.name='09_SOURCE_fringe';rest.move(fringe,ElementPlacement.INSIDE);
 var records=[];
 function select(p){doc.selection.select(p,SelectionType.REPLACE,0,false);}
 function cut(id,p,g){app.activeDocument=doc;doc.activeLayer=rest;doc.selection.deselect();var l=rest.duplicate();l.name=id;select(p);doc.selection.invert();doc.activeLayer=l;doc.selection.clear();select(p);doc.activeLayer=rest;doc.selection.clear();doc.selection.deselect();l.move(g,ElementPlacement.INSIDE);var b=l.bounds;if(b[2].as('px')<=b[0].as('px'))throw Error('Empty part '+id);records.push({id:id,group:g.name,polygon:p});return l;}
 // Face is extracted before the surrounding hair. No repaint, scaling or mirroring.
 cut('BODY_face',[[432,224],[450,232],[479,235],[503,244],[537,246],[572,244],[604,230],[620,218],[629,275],[620,323],[602,357],[578,387],[550,405],[518,413],[489,407],[463,392],[441,371],[423,340],[414,299],[418,260]],body);
 cut('BODY_neck',[[454,374],[480,400],[518,414],[552,404],[579,382],[594,424],[588,447],[577,471],[564,490],[554,508],[541,522],[535,535],[529,549],[522,544],[514,538],[500,519],[486,508],[473,488],[459,470],[450,437]],body);
 cut('BODY_hand_viewer_left',[[139,1289],[211,1297],[202,1355],[210,1382],[216,1425],[213,1456],[199,1473],[161,1475],[125,1453],[119,1402],[127,1357]],body);
 cut('BODY_hand_viewer_right',[[821,1290],[891,1281],[900,1328],[922,1373],[923,1475],[800,1475],[800,1367],[819,1322]],body);
 // Follow the visible skirt hem; skin above this edge stays with the garment only if genuinely occluded.
 cut('BODY_legs_visible',[[265,1385],[300,1400],[341,1408],[388,1415],[438,1419],[484,1422],[536,1423],[591,1420],[641,1416],[687,1408],[735,1398],[776,1380],[780,1536],[250,1536]],body);
 cut('WARDROBE_shirt_cuff_viewer_left',[[131,1270],[217,1279],[211,1297],[130,1289]],shirt);
 cut('WARDROBE_shirt_cuff_viewer_right',[[817,1275],[900,1264],[902,1280],[821,1291]],shirt);
 cut('WARDROBE_tie',[[465,519],[479,512],[500,537],[518,549],[547,548],[565,527],[578,514],[590,533],[569,562],[560,591],[565,630],[572,686],[578,748],[576,780],[553,817],[538,850],[520,820],[499,783],[488,745],[491,689],[496,637],[502,599],[492,568],[478,547]],tie);
 cut('WARDROBE_shirt',[[438,450],[454,446],[458,476],[479,505],[510,540],[527,541],[549,519],[574,481],[581,448],[615,451],[618,506],[617,560],[612,614],[602,668],[588,722],[569,776],[550,819],[536,853],[505,818],[480,774],[461,725],[449,668],[441,610],[438,552]],shirt);
 // Sleeves follow armhole seams; jacket front and sleeve are independently editable.
 cut('WARDROBE_jacket_sleeve_viewer_left',[[0,469],[247,492],[260,520],[276,573],[292,638],[304,701],[315,754],[322,802],[321,847],[309,915],[296,982],[282,1047],[262,1131],[246,1194],[229,1278],[0,1300]],jacket);
 cut('WARDROBE_jacket_sleeve_viewer_right',[[774,486],[1024,470],[1024,1294],[803,1282],[787,1198],[771,1119],[757,1040],[741,958],[725,880],[715,821],[718,765],[733,695],[748,612],[759,541]],jacket);
 cut('WARDROBE_lower_skirt',[[245,1176],[271,1189],[311,1203],[360,1214],[409,1216],[449,1207],[480,1185],[502,1158],[520,1120],[536,1063],[543,1060],[553,1113],[573,1163],[603,1190],[638,1208],[677,1215],[723,1210],[768,1199],[788,1190],[833,1536],[193,1536]],lower);
 cut('BODY_hair',[[0,0],[1024,0],[1024,449],[681,449],[659,456],[641,459],[622,459],[600,457],[578,452],[554,442],[480,441],[454,451],[435,461],[413,463],[391,459],[369,449],[0,449]],body);
 cut('WARDROBE_jacket_front',[[0,449],[1024,449],[1024,1536],[0,1536]],jacket);
 if(rest.bounds[2].as('px')===rest.bounds[0].as('px')){rest.remove();} else {throw Error('Unassigned source pixels remain');}
 var opts=new PhotoshopSaveOptions();opts.layers=true;opts.embedColorProfile=true;doc.saveAs(dst,opts,false,Extension.LOWERCASE);
 var png=new PNGSaveOptions();png.interlaced=false;
 function save(name){app.activeDocument=doc;doc.saveAs(new File(out.fsName+'/'+name+'.png'),png,true,Extension.LOWERCASE);}
 save('recomposed');
 // Export each layer on the unchanged 1024x1536 canvas. Reference is never rendered.
 var groups=[body,jacket,shirt,tie,lower,fringe],all=[];
 for(var g=0;g<groups.length;g++){groups[g].visible=true;for(var k=0;k<groups[g].artLayers.length;k++){var l=groups[g].artLayers[k];l.visible=false;all.push(l);}}
 for(var i=0;i<all.length;i++){all[i].visible=true;save('parts/'+all[i].name);all[i].visible=false;}
 for(var i=0;i<all.length;i++)all[i].visible=true;
 jacket.visible=false;shirt.visible=false;tie.visible=false;lower.visible=false;fringe.visible=false;save('body-visible');
 body.visible=false;jacket.visible=true;shirt.visible=true;tie.visible=true;lower.visible=true;save('wardrobe-visible');
 body.visible=true;fringe.visible=true;
 doc.close(SaveOptions.DONOTSAVECHANGES);
 // Reopen the saved PSD, ensuring the on-disk document is what is verified.
 doc=app.open(dst);app.activeDocument=doc;save('reopened');
 var report={source:'../hibiki-static-a.png',sourceSHA256:'a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf',canvas:[1024,1536],psd:dst.name,parts:records,exportCount:all.length,hiddenSurfaces:'NOT_COMPLETE: visible-pixel separation only; no placeholder painted body accepted',humanAcceptance:false};
 var f=new File(out.fsName+'/layer-map.json');f.encoding='UTF8';f.open('w');f.write(encode(report));f.close();
 app.preferences.rulerUnits=oldUnits;return 'Saved and reopened split D: '+all.length+' exported layers';
})();
