/*
---
name: ART.Canvas.Base
description: "Implements ART, ART.Shape and ART.Group based on the current browser."
provides: [ART.Base, ART.Group, ART.Shape, ART.Text]
requires: [ART.Canvas]
...
*/

(function(){
	
var Canvas = function(){

	var canvas = document.createElement('canvas');
	return canvas && !!canvas.getContext;

};

var MODE = Canvas() ? 'Canvas' : null;
if (!MODE) return;

ART.Shape = new Class({Extends: ART[MODE].Shape});
ART.Group = new Class({Extends: ART[MODE].Group});
ART.Text = new Class({Extends: ART[MODE].Text});
ART.implement({Extends: ART[MODE]});

})();
