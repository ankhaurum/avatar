// Photoshop CC: content-aware fill of the mouth region on a COPY of art A
// (the lips + 4 px, and the crease beyond each corner), for tools/recut-lips.mjs
// --filled. Generated for one run with the work dir in place of <work dir>;
// Photoshop.exe <this file> runs it and quits. Art A itself is never changed.
#target photoshop
app.displayDialogs=DialogModes.NO;app.preferences.rulerUnits=Units.PIXELS;
function cT(s){return charIDToTypeID(s)}function sT(s){return stringIDToTypeID(s)}
function caf(){var d=new ActionDescriptor();d.putEnumerated(cT('Usng'),cT('FlCn'),sT('contentAware'));d.putUnitDouble(cT('Opct'),cT('#Prc'),100);d.putEnumerated(cT('Md  '),cT('BlnM'),cT('Nrml'));executeAction(cT('Fl  '),d,DialogModes.NO);}
while(app.documents.length)app.documents[0].close(SaveOptions.DONOTSAVECHANGES);
var doc=app.open(new File('<work dir>/art-a-copy.png'));doc.flatten();
var polys=[[[486.7,347.8],[496.7,344.1],[505.6,341.3],[513.3,340],[521.1,338.6],[528.9,339.1],[535.6,338],[542.2,338.2],[551.1,339.1],[560,340.2],[567.8,339.1],[568.9,340.8],[565.6,342.3],[555.6,345.4],[546.7,347.3],[537.8,349],[528.9,351.8],[518.9,350.3],[511.1,351],[502.2,351.2],[494.4,350.1],[488.3,348.8]],[[487.8,348.6],[494.4,349.6],[502.2,350.7],[511.1,350.5],[518.9,349.8],[528.9,351.3],[537.8,348.5],[546.7,346.8],[555.6,344.9],[565.6,341.8],[566.7,341.9],[560,350.2],[552.2,356.9],[542.2,362.4],[530,366.3],[518.9,366.9],[508.9,364.7],[501.1,360.2],[494.4,354.7]]];var strips=[[[477.7,344.3],[488.7,344.3],[488.7,351.3],[477.7,351.3]],[[566.4,336.9],[577.4,336.9],[577.4,343.9],[566.4,343.9]]];
doc.selection.deselect();
for(var j=0;j<polys.length;j++)doc.selection.select(polys[j],j?SelectionType.EXTEND:SelectionType.REPLACE,0,true);
doc.selection.expand(4);
for(var k=0;k<strips.length;k++)doc.selection.select(strips[k],SelectionType.EXTEND,0,true);
caf();doc.selection.deselect();
var o=new PNGSaveOptions();doc.saveAs(new File('<work dir>/art-a-mouth-filled.png'),o,true,Extension.LOWERCASE);doc.close(SaveOptions.DONOTSAVECHANGES);
var f=new File('<work dir>/ps-done.txt');f.open('w');f.write('done');f.close();
executeAction(cT('quit'),undefined,DialogModes.NO);