// Pending execution reconciliation: MCP timed out; COM reports application busy.
// Never repeat while previous native execution state is unknown.
if(typeof HV3_SIDE_STATE_RECONCILED==='undefined'||!HV3_SIDE_STATE_RECONCILED)throw Error('Reconcile pending native Photoshop execution before running');
// Paint only existing opaque side atlases, never original hand/front/palm alpha.
(function(){var root=File($.fileName).parent.parent.parent.fsName.replace(/\\/g,'/'),base=root+'/v3/artwork/split-e/',old=app.displayDialogs;app.displayDialogs=DialogModes.NO;try{var d=app.open(new File(base+'hibiki-v3-motion-f.psd'));app.activeDocument=d;var marker='HV3_DIGIT_SIDE_CREASES_1';if((d.info.instructions||'').indexOf(marker)>=0)throw Error('Already painted; inspect before repeating');
var f=new File(base+'rig-finger-landmarks.json');f.encoding='UTF8';f.open('r');var fingers=eval('('+f.read()+')');f.close();var g=d.layerSets.getByName('34_HAND_side_skin');
function rgb(a){var c=new SolidColor();c.rgb.red=a[0];c.rgb.green=a[1];c.rgb.blue=a[2];return c;}
function layer(name,g){var l=d.artLayers.add();l.name=name;l.move(g,ElementPlacement.INSIDE);d.activeLayer=l;return l;}
// Smooth authored outline using cubic anchors with explicit Bezier handles.
function path(points){var sub=new SubPathInfo();sub.closed=true;sub.operation=ShapeOperation.SHAPEADD;var a=[];for(var i=0;i<points.length;i++){var p=new PathPointInfo(),q=points[i];p.kind=PointKind.CORNERPOINT;p.anchor=[q[0],q[1]];p.leftDirection=q.length>2?[q[2],q[3]]:p.anchor;p.rightDirection=q.length>4?[q[4],q[5]]:p.anchor;a.push(p);}sub.entireSubPath=a;return d.pathItems.add('paint-outline',[sub]);}
function select(points){var p=path(points);p.makeSelection(0,true,SelectionType.REPLACE);p.remove();}

function stroke(a,b,width,color,opacity){var dx=b[0]-a[0],dy=b[1]-a[1],n=Math.sqrt(dx*dx+dy*dy),nx=-dy/n*width/2,ny=dx/n*width/2;select([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]);d.selection.feather(.35);d.selection.fill(rgb(color),ColorBlendMode.NORMAL,opacity,true);d.selection.deselect();}
for(var si=0;si<2;si++){var side=si===0?'r':'l',layer=g.artLayers.getByName('HAND_side_skin_viewer_'+(si===0?'left':'right'));d.activeLayer=layer;
 for(var finger in fingers.sides[side]){var points=fingers.sides[side][finger];for(var j=0;j<3;j++){var p=points[j],q=points[j+1],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.sqrt(dx*dx+dy*dy),ux=-dy/length,uy=dx/length,r=finger==='thumb'?10:7,a=[p[0]-ux*r,p[1]-uy*r],b=[p[0]+ux*r,p[1]+uy*r];
 stroke(a,b,j===0?1.4:1.0,[146,96,82],j===0?8:12);stroke([a[0]+dx/length*.9,a[1]+dy/length*.9],[b[0]+dx/length*.9,b[1]+dy/length*.9],.8,[249,216,197],7);
 }}}
g.visible=false;d.info.instructions=(d.info.instructions||'')+' '+marker;var opts=new PhotoshopSaveOptions();opts.layers=true;opts.embedColorProfile=true;d.saveAs(new File(base+'hibiki-v3-motion-f.psd'),opts,false,Extension.LOWERCASE);return 'Painted subtle 30-joint crease shadows/highlights only into side skin atlases; original front/palm pixels and alpha untouched';}finally{app.displayDialogs=old;}})();
