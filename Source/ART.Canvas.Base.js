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

var MODE = Canvas() ? ART.Canvas : null;
if (!MODE) return;

ART.Shape = MODE.Shape;
ART.Group = MODE.Group;
ART.Text = MODE.Text;
ART.prototype = MODE.prototype;

})();
