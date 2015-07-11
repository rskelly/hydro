(function() {
	
	var hydro = pkg('ca.dijital.hydro');
	var anim = pkg('ca.dijital.anim');
	
	/**
	 * Format a short date.
	 */
	function shortDate(dt) {
		return pad(dt.getMonth()+1) + '/' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes())
	}
	
	/**
	 * Zero-pads a number and returns it as a string.
	 */
	function pad(val) {
		if(val < 10)
			return '0' + val;
		return '' + val;
	}
	
	/**
	 * Compute the limits and ranges of a 2D data set.
	 */
	function computeParams(data, xfield, yfield) {
		var values = [];
		var minx = Infinity;
		var maxx = -Infinity;
		var miny = Infinity;
		var maxy = -Infinity;
		for(var i=0;i<data.length;++i) {
			var x = data[i][xfield];
			var y = data[i][yfield];
			if(y == -9999.0)continue;
			if(x < minx) minx = x;
			if(y < miny) miny = y;
			if(x > maxx) maxx = x;
			if(y > maxy) maxy = y;
			values.push([x, y]);
		}
		var rangex = maxx - minx;
		var rangey = maxy - miny;
		var aminx = (minx - rangex * 0.1);
		var amaxx = (maxx + rangex * 0.1);
		var aminy = (miny - rangey * 0.1);
		var amaxy = (maxy + rangey * 0.1);
		var arangex = amaxx - aminx;
		var arangey = amaxy - aminy;
		return {
			minx:minx, maxx:maxx, miny:miny, maxy:maxy, 
			aminx:aminx, amaxx:amaxx, aminy:aminy, amaxy:amaxy,
			rangex:rangex, rangey:rangey, 
			arangex:arangex, arangey:arangey,
			values:values
		};
	}
	
	/**
	 * Draws a graph on a canvas.
	 */
	function Graph(canvas) {
		this.init(canvas);
	}
	Graph.prototype = Object.create({}, {
		
		/**
		 * Initialize with a canvas object.
		 */
		init : {
			value : function(canvas) {
				this._canvas = canvas;
				this._box = {				// Padding
					left : 50,
					right : 28,
					bottom : 25,
					top : 20
				};
				var tt = this._tt = document.createElement('div');
				tt.className = 'tooltip';
				var ttAnim = this._ttAnim = new anim.Anim(tt);
				ttAnim.duration = 250;
				this._ttShow = false;
				document.body.appendChild(tt);
				canvas.addEventListener('mousemove', this._mouseMove.bind(this));
				canvas.addEventListener('mouseover', this._mouseOver.bind(this));
				canvas.addEventListener('dragout', this._mouseOut.bind(this));
				canvas.addEventListener('mouseout', this._mouseOut.bind(this));
			}
		},
		
		_mouseMove : {
			value : function(evt) {
				if(!this._over || !this._params) return;
				var params = this._params;
				var tt = this._tt;
				var box = this._box;
				var canvas = this._canvas;
				var x = Math.max(0, Math.min(1, (evt.offsetX - box.left) / (canvas.width - box.left - box.right)));
				var y = Math.max(0, Math.min(1, 1 - (evt.offsetY - box.top) / (canvas.height - box.bottom - box.top)));
				x = params.aminx + params.arangex * x;
				y = params.aminy + params.arangey * y;
				tt.textContent = shortDate(new Date(x)) + ' - ' + y.toFixed(2) + 'm';
				x = evt.clientX + 10;
				y = evt.clientY + 10;
				if(x + tt.offsetWidth >= document.body.clientWidth)
					x -= (tt.offsetWidth + 20);
				console.log(x + tt.offsetWidth + ', ' + document.body.clientWidth);
				tt.style.left = x + 'px';
				tt.style.top = y + 'px';
				if(!this._ttShow) {
					this._ttAnim.start(['style.opacity'], [1]);
					this._ttShow = true;
				} 
			}
		},
		
		_mouseOver : {
			value : function(evt) {
				this._over = true;
			}
		},
		
		_mouseOut : {
			value : function(evt) {
				this._over = false;
				if(this._ttShow) {
					this._ttAnim.start(['style.opacity'], [0]);
					this._ttShow = false;
				} 
			}
		},
		
		/**
		 * Render the graph with the data (an array of objects), using the xfield
		 * and yfield to access the axis fields.
		 */
		render : {
			value : function(data, xfield, yfield) {
				// Sort on time.
				data.sort(function(a, b) { return a.timestamp - b.timestamp; });
				// Compute the ranges.
				var params = this._params = computeParams(data, xfield, yfield);
				var ctx = this._canvas.getContext('2d');
				var width = this._canvas.width;
				var height = this._canvas.height;
				// Padding
				var left = this._box.left;
				var right = this._box.right;
				var bottom = this._box.bottom;
				var top = this._box.top;
				// Clear canvas.
				ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
				// Draw axes.
				ctx.beginPath();
				ctx.fillStyle = '#fff';
				ctx.strokeStyle = '#fff';	
				ctx.moveTo(left, height - bottom);
				ctx.lineTo(width - right, height - bottom);
				ctx.moveTo(left, height - bottom);
				ctx.lineTo(left, top);
				// Draw y axis ticks and labels.
				for(var i = 0, j = 0; i <= params.arangey; i += params.arangey / 10, ++j ) {
					ctx.moveTo(left, height - bottom - i * (height - top - bottom) / params.arangey);
					ctx.lineTo(left - 5, height - bottom - i * (height - top - bottom) / params.arangey);
					ctx.fillText((params.aminy + j * params.arangey / 10.0).toFixed(2) + 'm', 0, height - bottom - i * (height - top - bottom) / params.arangey + 2);
				}
				// Draw x axis ticks and labels.
				for(var i = 0, j = 0;i <= params.arangex; i += params.arangex / 5, ++j) {
					ctx.moveTo(left + i * (width - left - right) / params.arangex, height - bottom);
					ctx.lineTo(left + i * (width - left - right) / params.arangex, height - bottom + 5);
					var dt = new Date((params.aminx + j * params.arangex / 5.0));
					var dtxt = shortDate(dt); 
					var mtxt = ctx.measureText(dtxt);
					ctx.fillText(dtxt, left + i * (width - left - right) / params.arangex - mtxt.width / 2, height - bottom + 15 + ((j % 2 == 1) ? 10 : 0));
				}
				ctx.stroke();
				// Draw lines.
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				var first = true;
				params.values.forEach(function(value) {
					var px = left + (value[0] - params.aminx) / params.arangex * (width - left - right);
					var py = top + (value[1] - params.aminy) / params.arangey * (height - top - bottom);
					if(first) {
						ctx.moveTo(px, py);
						first = false;
					} else {
						ctx.lineTo(px, py);
					}
				});
				ctx.stroke();
				// Draw disks.
				params.values.forEach(function(value) {
					var px = left + (value[0] - params.aminx) / params.arangex * (width - left - right);
					var py = top + (value[1] - params.aminy) / params.arangey * (height - top - bottom);
					ctx.beginPath();
					ctx.moveTo(px, py);
					ctx.arc(px, py, 3, 0, 2*Math.PI);
					ctx.closePath();
					ctx.fill();
					ctx.stroke();
				});
			}
		},
		
		
	});
	
	hydro.Graph = Graph;
	
}());