/*
---
name: ART.Canvas
description: "Canvas implementation for ART"
provides: [ART.Canvas, ART.Canvas.Group, ART.Canvas.Shape, ART.Canvas.Image, ART.Canvas.Text]
requires: [ART, ART.Element, ART.Container, ART.Transform, ART.Path]
...
*/

(function(){

// Canvas Base Class

var genericContext = document.createElement('canvas');
genericContext = genericContext.getContext && genericContext.getContext('2d');

var hitContext = null, currentHitTarget, hitX = 0, hitY = 0;

var fps = 1000 / 60, invalids = [], renderTimer, renderInvalids = function(){
	clearTimeout(renderTimer);
	renderTimer = null;
	var canvases = invalids;
	invalids = [];
	for (var i = 0, l = canvases.length; i < l; i++){
		var c = canvases[i];
		c._valid = true;
		c.render();
	}
};

ART.Canvas = new Class({

	Extends: ART.Element,
	Implements: ART.Container,

	initialize: function(width, height){
		var element = this.element = document.createElement('canvas');
		var context = this.context = element.getContext('2d');
		this.children = [];
		this._valid = true;
		if (width != null && height != null) this.resize(width, height);
		
		if (context.isPointInPath)
			element.addEventListener('mousemove', function(event){
				hitContext = context;
				hitX = event.clientX;
				hitY = event.clientY;
			}, false);
	},

	resize: function(width, height){
		var element = this.element;
		element.setAttribute('width', width);
		element.setAttribute('height', height);
		this.width = width;
		this.height = height;
		return this;
	},
	
	toElement: function(){
		return this.element;
	},
	
	invalidate: function(left, top, width, height){
		if (this._valid){
			this._valid = false;
			invalids.push(this);
			if (!renderTimer){
				if (window.mozRequestAnimationFrame){
					renderTimer = true;
					window.mozRequestAnimationFrame(renderInvalids);
				} else {
					renderTimer = setTimeout(renderInvalids, fps);
				}
			}
		}
	},
	
	render: function(){
		var children = this.children, context = this.context, hitTarget;
		context.clearRect(0, 0, this.width, this.height);
		for (var i = 0, l = children.length; i < l; i++){
			context.save();
			var hit = children[i].renderTo(context);
			if (hit) hitTarget = hit;
			context.restore();
		}
		if (hitContext == context) currentHitTarget = hitTarget;
	}

});

// Canvas Element Class

ART.Canvas.Element = new Class({
	
	Implements: ART.Transform,

	inject: function(container){
		this.eject();
		this.container = container;
		container.children.push(this);
		return this.invalidate();
	},

	eject: function(){
		var container = this.container;
		if (container) container.children.erase(this);
		this.invalidate();
		this.container = null;
		return this;
	},
	
	invalidate: function(){
		if (this.container) this.container.invalidate();
		return this;
	},
	
	// transforms
	
	_transform: function(){
		this.invalidate();
	},
	
	blend: function(opacity){
		return this.invalidate();
	},
	
	// visibility
	
	hide: function(){
		this._invisible = true;
		return this.invalidate();
	},
	
	show: function(){
		this._invisible = false;
		return this.invalidate();
	},
	
	// interaction
	
	indicate: function(cursor, tooltip){
		return this.invalidate();
	}

});

// Canvas Group Class

ART.Canvas.Group = new Class({
	
	Extends: ART.Canvas.Element,
	Implements: ART.Container,
	
	initialize: function(width, height){
		this.width = width;
		this.height = height;
		this.children = [];
	},
	
	// rendering
	
	renderTo: function(context){
		var children = this.children, hitTarget;
		for (var i = 0, l = children.length; i < l; i++){
			context.save();
			context.transform(this.xx, this.yx, this.xy, this.yy, this.x, this.y);
			var hit = children[i].renderTo(context);
			if (hit) hitTarget = hit;
			context.restore();
		}
		return hitTarget;
	}

});

// Canvas Shape Class

ART.Canvas.Base = new Class({
	
	Extends: ART.Canvas.Element,

	initialize: function(){
	},
	
	/* styles */
	
	_addColors: function(gradient, stops){
		// Enumerate stops, assumes offsets are enumerated in order
		// TODO: Sort. Chrome doesn't always enumerate in expected order but requires stops to be specified in order.
		if ('length' in stops) for (var i = 0, l = stops.length - 1; i <= l; i++)
			gradient.addColorStop(i / l, new Color(stops[i]).toString());
		else for (var offset in stops)
			gradient.addColorStop(offset, new Color(stops[offset]).toString());
		return gradient;
	},

	
	fill: function(color){
		if (arguments.length > 1) return this.fillLinear(arguments);
		else this._fill = color ? new Color(color).toString() : null;
		return this.invalidate();
	},

	fillRadial: function(stops, focusX, focusY, radiusX, radiusY, centerX, centerY){
		if (focusX == null) focusX = (this.left || 0) + (this.width || 0) * 0.5;
		if (focusY == null) focusY = (this.top || 0) + (this.height || 0) * 0.5;
		if (radiusY == null) radiusY = radiusX || (this.height * 0.5) || 0;
		if (radiusX == null) radiusX = (this.width || 0) * 0.5;
		if (centerX == null) centerX = focusX;
		if (centerY == null) centerY = focusY;

		centerX += centerX - focusX;
		centerY += centerY - focusY;
		
		if (radiusX == 0) return this.fillLinear(stops);
		var ys = radiusY / radiusX;

		var gradient = genericContext.createRadialGradient(focusX, focusY / ys, 0, centerX, centerY / ys, radiusX * 2);

		// Double fill radius to simulate repeating gradient
		if ('length' in stops) for (var i = 0, l = stops.length - 1; i <= l; i++){
			gradient.addColorStop(i / l / 2, new Color(stops[i]).toString());
			gradient.addColorStop(1 - i / l / 2, new Color(stops[i]).toString());
		} else for (var offset in stops){
			gradient.addColorStop(offset / 2, new Color(stops[offset]).toString());
			gradient.addColorStop(1- offset / 2, new Color(stops[offset]).toString());
		}

		this._fill = gradient;
		this._fillTransform = new ART.Transform(1, 0, 0, ys);
		return this.invalidate();
	},

	fillLinear: function(stops, x1, y1, x2, y2){
		if (arguments.length < 5) return this;
		var gradient = genericContext.createLinearGradient(x1, y1, x2, y2);
		this._addColors(gradient, stops);
		this._fill = gradient;
		this._fillTransform = null;
		return this.invalidate();
	},

	fillImage: function(url, width, height, left, top, color1, color2){
		return this.invalidate();
	},

	stroke: function(color, width, cap, join){
		this._stroke = color ? new Color(color).toString() : null;
		this._strokeWidth = (width != null) ? width : 1;
		this._strokeCap = (cap != null) ? cap : 'round';
		this._strokeJoin = (join != null) ? join : 'round';
		return this.invalidate();
	}

});

// Canvas Shape Class

ART.Canvas.Shape = new Class({
	
	Extends: ART.Canvas.Base,
	
	initialize: function(path, width, height){
		this.parent();
		this.width = width;
		this.height = height;
		if (path != null) this.draw(path);
	},
	
	draw: function(path, width, height){
		if (!(path instanceof ART.Path)) path = new ART.Path(path);
		this.path = path;
		this._commands = path.toCommands();
		if (width != null) this.width = width;
		if (height != null) this.height = height;
		return this.invalidate();
	},
	
	renderTo: function(context){
		if (this._invisible || !this._commands || (!this._fill && !this._stroke)) return;
		context.transform(this.xx, this.yx, this.xy, this.yy, this.x, this.y);
		var commands = this._commands,
			fill = this._fill,
			stroke = this._stroke;

		context.beginPath();
		for (var i = 0, l = commands.length; i < l; i++)
			commands[i](context);

		if (fill){
			context.save();
			var m = this._fillTransform;
			if (m) context.transform(m.xx, m.yx, m.xy, m.yy, m.x, m.y);
			context.fillStyle = fill;
			context.fill();
			context.restore();
		}
		if (stroke){
			context.strokeStyle = stroke;
			context.lineWidth = this._strokeWidth;
			context.lineCap = this._strokeCap;
			context.lineJoin = this._strokeJoin;
			context.stroke();
		}
		return hitContext == context && context.isPointInPath(hitX, hitY) ? this : null;
	}

});

// Canvas Image Class

ART.Canvas.Image = new Class({
	
	Extends: ART.Canvas.Base,
	
	initialize: function(src, width, height){
		this.parent();
		if (arguments.length == 3) this.draw.apply(this, arguments);
	},
	
	draw: function(src, width, height){
		this.width = width;
		this.height = height;
		return this.invalidate();
	},
	
	renderTo: function(){ }
	
});

// Canvas Text Class

var fontAnchors = { middle: 'center' };

ART.Canvas.Text = new Class({

	Extends: ART.Canvas.Base,

	initialize: function(text, font, alignment, path){
		this.parent();
		this.draw.apply(this, arguments);
	},
	
	draw: function(text, font, alignment, path){
		var em;
		if (typeof font == 'string'){
			em = Number(/(\d+)/.exec(font)[0]);
		} else if (font){
			em = parseFloat(font.fontSize || font['font-size'] || '12');
			font = (font.fontStyle || font['font-style'] || '') + ' ' +
				(font.fontVariant || font['font-variant'] || '') + ' ' +
				(font.fontWeight || font['font-weight'] || '') + ' ' +
				em + 'px ' +
				(font.fontFamily || font['font-family'] || 'Arial');
		} else {
			font = this._font;
		}

		var lines = text && text.split(/\r?\n/);
		this._font = font;
		this._fontSize = em;
		this._text = lines;
		this._alignment = fontAnchors[alignment] || alignment || 'left';
		
		var context = genericContext;

		context.font = this._font;
		context.textAlign = this._alignment;
		context.textBaseline = 'middle';
		
		var lines = this._text, l = lines.length, width = 0;
		for (var i = 0; i < l; i++){
			w = context.measureText(lines[i]).width;
			if (w > width) width = w;
		}
		this.width = width;
		this.height = l ? l * 1.1 * em : 0;
		return this.invalidate();
	},

	renderTo: function(context){
		if (this._invisible || !this._text || (!this._fill && !this._stroke)) return null;
		context.transform(this.xx, this.yx, this.xy, this.yy, this.x, this.y);
		var fill = this._fill, stroke = this._stroke, text = this._text;
		
		context.font = this._font;
		context.textAlign = this._alignment;
		context.textBaseline = 'middle';
		
		var em = this._fontSize,
			y = em / 2,
			lineHeight = 1.1 * em,
			lines = this._text,
			l = lines.length;
		
		if (fill){
			context.fillStyle = fill;
			for (var i = 0; i < l; i++)
				context.fillText(lines[i], 0, y + i * lineHeight);
		}
		if (stroke){
			context.strokeStyle = stroke;
			context.lineWidth = this._strokeWidth;
			context.lineCap = this._strokeCap;
			context.lineJoin = this._strokeJoin;
			for (var i = 0; i < l; i++)
				context.strokeText(lines[i], 0, y + i * lineHeight);
		}
		
		return /*hitContext == context && context.isPointInPath(hitX, hitY) ? this :*/ null;
	}

});

// Path Extensions

var path;

function moveTo(sx, sy, x, y){
	path.push(function(context){
		context.moveTo(x, y);
	});
};

function lineTo(sx, sy, x, y){
	path.push(function(context){
		context.lineTo(x, y);
	});
};

function curveTo(sx, sy, cp1x, cp1y, cp2x, cp2y, x, y){
	path.push(function(context){
		context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	});
};

function arcTo(sx, sy, ex, ey, x, y, radius, startAngle, endAngle, anticlockwise){
	path.push(function(context){
		context.arc(x, y, radius, startAngle, endAngle, anticlockwise);
	});
};

function close(){
	path.push(function(context){
		context.closePath();
	});
};

ART.Path.implement({

	toCommands: function(){
		var renderer = this.cache.canvas;
		if (renderer == null){
			path = [];
			this.visit(lineTo, curveTo, arcTo, moveTo, close);
			this.cache.canvas = renderer = path;
		}
		return renderer;
	}

});

})();