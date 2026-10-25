(function(){var un=app.preferences.rulerUnits;app.preferences.rulerUnits=Units.PIXELS;try{var d=app.documents.getByName('hibiki-mouth-material-production.psd');app.activeDocument=d;var seam=[[486,346.5],[489,347],[500,350],[515,351],[530,351],[545,348],[557,344],[565,341],[569,339.5]];
function band(layer,lo,hi,rgb){d.activeLayer=layer;var p=[];for(var j=0;j<seam.length;j++)p.push([seam[j][0],seam[j][1]+lo]);for(var j=seam.length-1;j>=0;j--)p.push([seam[j][0],seam[j][1]+hi]);d.selection.select(p,SelectionType.REPLACE,0,true);var c=new SolidColor();c.rgb.red=rgb[0];c.rgb.green=rgb[1];c.rgb.blue=rgb[2];d.selection.fill(c,ColorBlendMode.NORMAL,100,true);d.selection.deselect();}
var lower=d.artLayers.getByName('LOWER_inner_vermilion__DRAFT');lower.visible=true;
band(lower,-15,-4,[129,39,48]);band(lower,-4,-2,[151,45,53]);band(lower,-2,0,[178,55,62]);band(lower,0,2,[194,65,72]);band(lower,2,15,[205,78,82]);
var upper=d.artLayers.getByName('UPPER_inner_vermilion__DRAFT');upper.visible=true;
band(upper,-15,0,[158,44,50]);band(upper,0,1,[154,42,49]);band(upper,1,2,[139,35,44]);band(upper,2,15,[119,28,38]);
for(var i=0;i<2;i++){var l=i===0?upper:lower;d.activeLayer=l;var locked=l.transparentPixelsLocked;l.transparentPixelsLocked=true;l.applyGaussianBlur(0.6);l.transparentPixelsLocked=locked;}lower.visible=false;upper.visible=false;d.save();return 'Shaded existing inner surfaces along approved closed-mouth contour; no geometry, visible lip or parameter edits';
}catch(e){return 'ERROR '+e+' '+e.line;}finally{app.preferences.rulerUnits=un;}})()
