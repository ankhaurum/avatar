// Generate a Photoshop script that cuts the arm layers of each pose image along
// the outlines in pose-def.json (anti-aliased, slightly feathered) and saves
// them as transparent PNGs. Usage: node make-cut-jsx.cjs <pose dir> <out dir> <jsx>
const fs = require('fs');
const [src, out, jsx] = process.argv.slice(2);
const defs = JSON.parse(fs.readFileSync(__dirname + '/pose-def.json'));
let js = `#target photoshop
app.displayDialogs = DialogModes.NO; app.preferences.rulerUnits = Units.PIXELS;
while (app.documents.length) app.documents[0].close(SaveOptions.DONOTSAVECHANGES);
function cut(file, polys, outFile) {
  // keep pixel positions: clear everything outside the outline on the image itself
  var doc = app.open(new File(file));
  doc.activeLayer.isBackgroundLayer = false;
  doc.selection.deselect();
  for (var i = 0; i < polys.length; i++) doc.selection.select(polys[i], i ? SelectionType.EXTEND : SelectionType.REPLACE, 0.6, true);
  doc.selection.invert();
  doc.selection.clear();
  doc.selection.deselect();
  var o = new PNGSaveOptions(); doc.saveAs(new File(outFile), o, true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
}
`;
for (const [name, d] of Object.entries(defs)) for (const layer of ['upper', 'lower'])
  js += `cut('${src}/${d.file}', ${JSON.stringify(d[layer])}, '${out}/${name}_${layer}_cut.png');\n`;
js += `'done';`;
fs.writeFileSync(jsx, js);
