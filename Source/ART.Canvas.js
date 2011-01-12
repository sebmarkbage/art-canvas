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

var genericContext = document.createElement('canvas').getContext('2d');

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

	initialize: function(tag){
	},

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
			context.transform(this.xx, this.yx, this.xy, this.yy, this.tx, this.ty);
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
	
	fill: function(color){
		if (arguments.length > 1) return this.fillLinear(arguments);
		else this._fill = color ? new Color(color).toString() : null;
		return this.invalidate();
	},

	fillRadial: function(stops, focusX, focusY, radiusX, radiusY, centerX, centerY){
		return this.invalidate();
	},

	fillLinear: function(stops, x1, y1, x2, y2){
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
		this._commands = path.toCommands();
		if (width != null) this.width = width;
		if (height != null) this.height = height;
		return this.invalidate();
	},
	
	renderTo: function(context){
		if (this._invisible || !this._commands || (!this._fill && !this._stroke)) return;
		context.transform(this.xx, this.yx, this.xy, this.yy, this.tx, this.ty);
		var commands = this._commands,
			fill = this._fill,
			stroke = this._stroke;

		context.beginPath();
		for (var i = 0, l = commands.length; i < l; i++)
			commands[i](context);

		if (fill){
			context.fillStyle = fill;
			context.fill();
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
		this._alignment = fontAnchors[alignment] || alignment;
		
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
		if (!this._text || (!this._fill && !this._stroke)) return null;
		context.transform(this.xx, this.yx, this.xy, this.yy, this.tx, this.ty);
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

var moveTo = function(x, y){
	return function(context){
		context.moveTo(x, y);
	};
};

var lineTo = function(x, y){
	return function(context){
		context.lineTo(x, y);
	};
};

var curveTo = function(cp1x, cp1y, cp2x, cp2y, x, y){
	return function(context){
		context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	};
};

var arc = function(x, y, radius, startAngle, endAngle, anticlockwise){
	return function(context){
		context.arc(x, y, radius, startAngle, endAngle, anticlockwise);
	};
};

var close = function(context){
	context.closePath();
};

// Port from ART.Path - TODO: Generalize

var circle = Math.PI * 2, north = circle / 2, west = north / 2, east = -west, south = 0;

var calculateArc = function(rx, ry, rotation, large, clockwise, x, y, tX, tY){
	x -= tX; y -= tY;
	
	var cx = x / 2, cy = y / 2,
		rxry = rx * rx * ry * ry,
		rycx = ry * ry * cx * cx,
		rxcy = rx * rx * cy * cy,
		a = rxry - rxcy - rycx;

	if (a < 0){
		a = Math.sqrt(1 - a / rxry);
		rx *= a; ry *= a;
	} else {
		a = Math.sqrt(a / (rxcy + rycx));
		if (large == clockwise) a = -a;
		cx += -a * y / 2 * rx / ry;
		cy +=  a * x / 2 * ry / rx;
	}

	var sa = Math.atan2(cx, -cy), ea = Math.atan2(-x + cx, y - cy);
	if (!+clockwise){ var t = sa; sa = ea; ea = t; }
	if (ea < sa) ea += circle;

	cx += tX; cy += tY;
	
	return {
		start: (!+clockwise ? ea : sa) + west,
		end: (!+clockwise ? sa : ea) + west,
		centerX: cx,
		centerY: cy,
		circle: [cx - rx, cy - ry, cx + rx, cy + ry],
		boundsX: [
			ea > circle + west || (sa < west && ea > west) ? cx - rx : tX,
			ea > circle + east || (sa < east && ea > east) ? cx + rx : tX
		],
		boundsY: [
			ea > north ? cy - ry : tY,
			ea > circle + south || (sa < south && ea > south) ? cy + ry : tY
		]
	};
};

var extrapolate = function(parts){
	
	var boundsX = [], boundsY = [];
	
	var ux = function(x){
		boundsX.push(x); return x;
	}, uy = function(y){
		boundsY.push(y); return y;
	}, np = function(v){
		return v;
	};

	var reflect = function(sx, sy, ex, ey){
		return [ex * 2 - sx, ey * 2 - sy];
	};
	
	var X = 0, Y = 0, px = 0, py = 0, r;
	
	var path = [], inX, inY;
	
	for (i = 0; i < parts.length; i++){
		var v = Array.slice(parts[i]), f = v.shift(), l = f.toLowerCase();
		var refX = l == f ? X : 0, refY = l == f ? Y : 0;
		
		if (l != 'm' && l != 'z' && inX == null){
			inX = X; inY = Y;
		}

		switch (l){
			
			case 'm':
				path.push(moveTo(ux(X = refX + v[0]), uy(Y = refY + v[1])));
			break;
			
			case 'l':
				path.push(lineTo(ux(X = refX + v[0]), uy(Y = refY + v[1])));
			break;
			
			case 'c':
				px = refX + v[2]; py = refY + v[3];
				//path += 'c' + ux(refX + v[0]) + ',' + uy(refY + v[1]) + ',' + ux(px) + ',' + uy(py) + ',' + ux(X = refX + v[4]) + ',' + uy(Y = refY + v[5]);
				path.push(curveTo(ux(refX + v[0]), uy(refY + v[1]), ux(px), uy(py), ux(X = refX + v[4]), uy(Y = refY + v[5])));
			break;

			case 's':
				r = reflect(px, py, X, Y);
				px = refX + v[0]; py = refY + v[1];
				//path += 'c' + ux(r[0]) + ',' + uy(r[1]) + ',' + ux(px) + ',' + uy(py) + ',' + ux(X = refX + v[2]) + ',' + uy(Y = refY + v[3]);
				path.push(curveTo(ux(r[0]), uy(r[1]), ux(px), uy(py), ux(X = refX + v[2]), uy(Y = refY + v[3])));
			break;
			
			case 'q':
				px = (refX + v[0]); py = (refY + v[1]);
				path.push(curveTo(ux((X + px * 2) / 3), uy((Y + py * 2) / 3), ux(((X = refX + v[2]) + px * 2) / 3), uy(((Y = refY + v[3]) + py * 2) / 3), ux(X), uy(Y)));
			break;
			
			case 't':
				r = reflect(px, py, X, Y);
				px = r[0]; py = r[1];
				path.push(curveTo(ux((X + px * 2) / 3), uy((Y + py * 2) / 3), ux(((X = refX + v[0]) + px * 2) / 3), uy(((Y = refY + v[1]) + py * 2) / 3), ux(X), uy(Y)));
			break;

			case 'a':
				px = refX + v[5]; py = refY + v[6];

				if (!+v[0] || !+v[1] || (px == X && py == Y)){
					path.push(lineTo(ux(X = px) + ',' + uy(Y = py)));
					break;
				}
				
				r = calculateArc(v[0], v[0], v[2], v[3], v[4], px, py, X, Y);

				boundsX.push.apply(boundsX, r.boundsX);
				boundsY.push.apply(boundsY, r.boundsY);
				
				path.push(arc(r.centerX, r.centerY, +v[0], r.start, r.end, !+v[4]));
				r.circle.map(np);
				ux(X); uy(Y);
				ux(X = px); uy(Y = py);
				
				// TODO: Elliptical arc as bezier

				//path.push(arcTo(X, Y, ux(X = px), uy(Y = py), v[0]));
				//path += (v[4] == 1 ? 'wa' : 'at') + r.circle.map(np) + ',' + ux(X) + ',' + uy(Y) + ',' + ux(X = px) + ',' + uy(Y = py);
			break;

			case 'h':
				path.push(lineTo(ux(X = refX + v[0]), uy(Y)));
			break;
			
			case 'v':
				path.push(lineTo(ux(X), uy(Y = refY + v[0])));
			break;
			
			case 'z':
				if (inX != null){
					//path.push(lineTo(ux(X = inX), uy(Y = inY)));
					path.push(close);
					//path.push(moveTo(ux(X = inX), uy(Y = inY)));
					X = inX; Y = inY;
					inX = null;
				}
			break;
			
		}
		if (l != 's' && l != 'c' && l != 't' && l != 'q'){
			px = X; py = Y;
		}
	}
	
	if (!boundsX.length) return [path, {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0}];
	
	var right = Math.max.apply(Math, boundsX),
		bottom = Math.max.apply(Math, boundsY),
		left = Math.min.apply(Math, boundsX),
		top = Math.min.apply(Math, boundsY),
		height = bottom - top,
		width = right - left;
	
	return [path, {left: left, top: top, right: right, bottom: bottom, width: width, height: height}];

};

var push = ART.Path.prototype.push;

ART.Path.implement({

	push: function(){ //modifying the current path resets the memoized values.
		this.canvas = null;
		return push.apply(this, arguments);
	},
	
	toCommands: function(){
		var renderer = this.canvas;
		if (renderer == null){
			var data = extrapolate(this.path);
			this.canvas = renderer = data[0];
			this.box = data[1];
		}
		return renderer;
	}

});

})();