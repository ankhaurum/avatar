// Hand-authored hidden garment/body surfaces in Photoshop. No generated imagery.
(function(){
var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/'),base=root+'/v3/artwork/',out=new Folder(base+'split-e');if(!out.exists)out.create();
var target=new File(out.fsName+'/hibiki-v3-wardrobe-e.psd');if(target.exists)throw Error('Existing output: use a deliberate revision');
var savedDialogs=app.displayDialogs,savedUnits=app.preferences.rulerUnits;app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
try{
var source=app.open(new File(base+'split-d/hibiki-v3-approved-split-d.psd'));app.activeDocument=source;var d=source.duplicate('HV3 wardrobe hidden surface painting E',false);app.activeDocument=d;
var body=d.layerSets.getByName('10_BODY_identity'),jacket=d.layerSets.getByName('20_WARDROBE_jacket'),shirt=d.layerSets.getByName('21_WARDROBE_shirt'),tie=d.layerSets.getByName('22_WARDROBE_tie'),lower=d.layerSets.getByName('23_WARDROBE_lower');
var ground=d.layerSets.add();ground.name='11_BODY_underclothing_paint';ground.move(body,ElementPlacement.PLACEAFTER);
var cloth=d.layerSets.add();cloth.name='24_SHIRT_complete_hidden_surfaces';cloth.move(shirt,ElementPlacement.PLACEAFTER);
var waist=d.layerSets.add();waist.name='25_LOWER_waist_underlap';waist.move(lower,ElementPlacement.PLACEAFTER);
function rgb(a){var c=new SolidColor();c.rgb.red=a[0];c.rgb.green=a[1];c.rgb.blue=a[2];return c;}
function layer(name,g){var l=d.artLayers.add();l.name=name;l.move(g,ElementPlacement.INSIDE);d.activeLayer=l;return l;}
// Smooth authored outline using cubic anchors with explicit Bezier handles.
function path(points){var sub=new SubPathInfo();sub.closed=true;sub.operation=ShapeOperation.SHAPEADD;var a=[];for(var i=0;i<points.length;i++){var p=new PathPointInfo(),q=points[i];p.kind=PointKind.CORNERPOINT;p.anchor=[q[0],q[1]];p.leftDirection=q.length>2?[q[2],q[3]]:p.anchor;p.rightDirection=q.length>4?[q[4],q[5]]:p.anchor;a.push(p);}sub.entireSubPath=a;return d.pathItems.add('paint-outline',[sub]);}
function select(points){var p=path(points);p.makeSelection(0,true,SelectionType.REPLACE);p.remove();}
function fill(name,points,color,g,opacity){var l=layer(name,g);select(points);d.selection.fill(rgb(color),ColorBlendMode.NORMAL,opacity===undefined?100:opacity,false);d.selection.deselect();return l;}
function gradient(name,points,stops,from,to,g){var l=layer(name,g);select(points);var desc=new ActionDescriptor();function pt(key,a){var q=new ActionDescriptor();q.putUnitDouble(charIDToTypeID('Hrzn'),charIDToTypeID('#Pxl'),a[0]);q.putUnitDouble(charIDToTypeID('Vrtc'),charIDToTypeID('#Pxl'),a[1]);desc.putObject(charIDToTypeID(key),charIDToTypeID('Pnt '),q);}pt('From',from);pt('T   ',to);desc.putEnumerated(charIDToTypeID('Type'),charIDToTypeID('GrdT'),charIDToTypeID('Lnr '));desc.putBoolean(charIDToTypeID('Dthr'),true);desc.putBoolean(charIDToTypeID('UsMs'),true);var gr=new ActionDescriptor();gr.putString(charIDToTypeID('Nm  '),name);gr.putEnumerated(charIDToTypeID('GrdF'),charIDToTypeID('GrdF'),charIDToTypeID('CstS'));gr.putDouble(charIDToTypeID('Intr'),4096);var colors=new ActionList();for(var i=0;i<stops.length;i++){var s=stops[i],entry=new ActionDescriptor(),c=new ActionDescriptor();c.putDouble(charIDToTypeID('Rd  '),s[1][0]);c.putDouble(charIDToTypeID('Grn '),s[1][1]);c.putDouble(charIDToTypeID('Bl  '),s[1][2]);entry.putObject(charIDToTypeID('Clr '),charIDToTypeID('RGBC'),c);entry.putEnumerated(charIDToTypeID('Type'),charIDToTypeID('Clry'),charIDToTypeID('UsrS'));entry.putInteger(charIDToTypeID('Lctn'),Math.round(s[0]*4096));entry.putInteger(charIDToTypeID('Mdpn'),50);colors.putObject(charIDToTypeID('Clrt'),entry);}gr.putList(charIDToTypeID('Clrs'),colors);var tr=new ActionList();for(var j=0;j<2;j++){var t=new ActionDescriptor();t.putUnitDouble(charIDToTypeID('Opct'),charIDToTypeID('#Prc'),100);t.putInteger(charIDToTypeID('Lctn'),j*4096);t.putInteger(charIDToTypeID('Mdpn'),50);tr.putObject(charIDToTypeID('TrnS'),t);}gr.putList(charIDToTypeID('Trns'),tr);desc.putObject(charIDToTypeID('Grad'),charIDToTypeID('Grdn'),gr);executeAction(charIDToTypeID('Grdn'),desc,DialogModes.NO);d.selection.deselect();return l;}
var torso=[[434,449,434,449,399,454],[298,509,342,475,270,540],[296,682,281,598,311,741],[337,915,323,826,341,965],[328,1113,340,1019,320,1160],[296,1242,307,1196,345,1261],[734,1242,683,1264,712,1178],[701,1111,704,1168,690,1027],[690,916,690,977,707,810],[731,675,717,739,741,586],[725,510,744,551,672,483],[600,449,638,457,600,449],[578,476],[557,511],[530,550],[506,525],[476,493],[453,451]];
var larm=[[292,524,292,524,251,544],[239,653,238,592,225,720],[221,829,219,756,212,866],[202,928,208,888,185,1016],[149,1248,166,1130,141,1281],[139,1311],[207,1312],[214,1244,207,1278,229,1172],[269,1068,250,1130,286,972],[297,907,290,952,312,845],[326,704,321,774,340,642],[341,568,341,594,327,541]];
var rarm=[[729,524,729,524,772,544],[784,653,783,592,799,720],[803,829,805,756,812,866],[822,928,816,888,839,1016],[875,1248,858,1130,883,1281],[885,1311],[817,1312],[810,1244,817,1278,795,1172],[755,1068,774,1130,738,972],[727,907,734,952,712,845],[698,704,703,774,684,642],[683,568,683,594,697,541]];
// Body surfaces are non-explicit material under clothing; no new exposed-body render.
gradient('BODY_torso_hidden_surface',torso,[[0,[206,160,144]],[.24,[232,193,175]],[.52,[242,208,190]],[.76,[230,189,172]],[1,[204,157,141]]],[300,800],[735,800],ground);
gradient('BODY_arm_viewer_left_hidden',larm,[[0,[194,144,130]],[.32,[224,180,162]],[.64,[237,202,184]],[1,[210,164,147]]],[140,900],[330,900],ground);
gradient('BODY_arm_viewer_right_hidden',rarm,[[0,[215,171,153]],[.35,[239,205,187]],[.68,[225,183,165]],[1,[194,144,130]]],[690,900],[885,900],ground);
var neck=[[457,407],[581,407],[587,445,589,421,598,468],[612,504],[583,549],[529,565],[477,541],[437,506],[450,462]];
gradient('BODY_neck_collar_underlap',neck,[[0,[207,161,146]],[.43,[240,203,184]],[.72,[234,195,178]],[1,[209,165,151]]],[440,480],[613,480],ground);
// Shirt has its own continuous cloth surfaces: front, sleeves, placket and seams.
gradient('SHIRT_front_fabric',torso,[[0,[104,132,172]],[.12,[144,170,208]],[.32,[182,203,232]],[.55,[199,215,239]],[.73,[179,199,228]],[.92,[133,160,198]],[1,[105,135,173]]],[295,810],[735,810],cloth);
gradient('SHIRT_sleeve_viewer_left',larm,[[0,[115,143,183]],[.28,[168,192,224]],[.55,[198,215,239]],[.80,[171,194,225]],[1,[113,143,182]]],[160,900],[330,900],cloth);
gradient('SHIRT_sleeve_viewer_right',rarm,[[0,[119,148,186]],[.28,[176,198,227]],[.60,[201,217,240]],[.85,[164,188,220]],[1,[113,142,180]]],[690,900],[875,900],cloth);
// Photographic fabric colour and local shading follow the approved pale-blue shirt.
var placket=[[520,548],[533,549],[535,697],[538,859],[540,1040],[541,1237],[527,1237],[526,1040],[524,855],[522,695]];
gradient('SHIRT_center_placket',placket,[[0,[143,170,207]],[.28,[201,217,239]],[.72,[194,211,235]],[1,[145,171,205]]],[520,850],[541,850],cloth);
function seam(name,p,c,opacity,blur){var l=fill(name,p,c,cloth,opacity);if(blur)l.applyGaussianBlur(blur);return l;}
seam('SHIRT_left_side_seam',[[337,699],[342,710],[365,920],[353,1114],[347,1178],[344,1113],[357,920]],[102,132,170],45,1.3);
seam('SHIRT_right_side_seam',[[689,699],[684,710],[662,920],[674,1114],[680,1178],[683,1113],[670,920]],[102,132,170],45,1.3);
seam('SHIRT_shoulder_yoke_left',[[300,519],[363,493],[424,476],[423,479],[364,497],[301,522]],[117,146,184],48,.8);
seam('SHIRT_shoulder_yoke_right',[[600,476],[660,493],[724,519],[723,522],[660,497],[601,479]],[117,146,184],48,.8);
// Folds are tapered painted shapes, not transformed pose meshes or copied cloth patches.
var folds=[[[343,587],[363,625],[377,691],[371,682],[358,626]],[[695,585],[675,627],[662,690],[667,681],[680,625]],[[362,828],[388,877],[416,914],[405,906],[381,875]],[[671,830],[644,881],[617,915],[625,905],[650,876]],[[352,1069],[410,1107],[462,1124],[447,1123],[403,1112]],[[680,1065],[619,1109],[577,1124],[591,1123],[626,1111]],[[215,825],[235,851],[274,874],[265,873],[230,855]],[[296,895],[267,922],[219,943],[233,932],[268,916]],[[810,824],[787,850],[749,873],[760,871],[792,854]],[[728,896],[759,922],[805,944],[791,933],[757,916]],[[165,1171],[187,1183],[220,1190],[211,1192],[181,1186]],[[858,1172],[835,1184],[803,1190],[814,1192],[842,1186]]];
for(var i=0;i<folds.length;i++)seam('SHIRT_fold_shadow_'+(i+1),folds[i],[101,131,171],25,2.2);
for(var i=0;i<6;i++){var y=625+i*99;var points=[];for(var k=0;k<16;k++){var a=k*Math.PI/8;points.push([530+3.1*Math.cos(a),y+3.7*Math.sin(a)]);}var b=fill('SHIRT_button_'+(i+1),points,[220,231,246],cloth);b.applyGaussianBlur(.35);}
// Underlap above the original skirt remains under the shirt hem; authored waistband.
var skirtTop=[[326,1083],[698,1083],[741,1240],[291,1240]];
gradient('LOWER_hidden_upper_fabric',skirtTop,[[0,[168,174,190]],[.2,[222,225,233]],[.44,[247,247,250]],[.7,[222,225,233]],[1,[173,179,196]]],[296,1170],[735,1170],waist);
gradient('LOWER_waistband',[[325,1082],[698,1082],[705,1110],[319,1110]],[[0,[194,200,214]],[.5,[241,242,248]],[1,[194,200,214]]],[320,1094],[705,1094],waist);
// Keep original neutral pixels as their exact authored state. Alternate layer comps activate the hidden paint.
function state(mode){ground.visible=mode!=='approved';cloth.visible=mode!=='approved';waist.visible=mode!=='approved';body.visible=true;shirt.visible=true;lower.visible=true;jacket.visible=mode==='approved'||mode==='no-tie';tie.visible=mode==='approved'||mode==='shirt-tie';}
state('approved');d.layerComps.add('01_APPROVED_NEUTRAL_exact', 'Unmodified approved visible pixels; hidden paint is stored separately.',true,true,true);
state('shirt-tie');d.layerComps.add('02_SHIRT_WITH_TIE','Jacket removed; continuous original pale-blue shirt and sleeves.',true,true,true);
state('shirt');d.layerComps.add('03_SHIRT_WITHOUT_TIE','Jacket and tie removed; complete front placket and fabric.',true,true,true);
state('no-tie');d.layerComps.add('04_JACKET_WITHOUT_TIE','Original jacket with completed shirt below tie.',true,true,true);
state('approved');var opt=new PhotoshopSaveOptions();opt.layers=true;opt.embedColorProfile=true;d.saveAs(target,opt,false,Extension.LOWERCASE);
var png=new PNGSaveOptions();png.compression=9;png.interlaced=false;
function save(name){d.saveAs(new File(out.fsName+'/'+name+'.png'),png,true,Extension.LOWERCASE);}
state('approved');save('approved-neutral');state('shirt-tie');save('shirt-with-tie');state('shirt');save('shirt-without-tie');state('no-tie');save('jacket-without-tie');state('approved');
d.close(SaveOptions.DONOTSAVECHANGES);d=app.open(target);app.activeDocument=d;save('reopened-neutral');
return 'Saved wardrobe E PSD, four clothing states and reopened neutral';
}finally{app.displayDialogs=savedDialogs;app.preferences.rulerUnits=savedUnits;}
})();
