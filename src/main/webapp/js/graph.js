(function() {
	
	var hydro = pkg('ca.dijital.hydro');
	
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
		var aminx = Math.floor(minx);
		var amaxx = Math.ceil(maxx);
		if(aminx == amaxx) amaxx++;
		var aminy = Math.floor(miny);
		var amaxy = Math.ceil(maxy);
		if(aminy == amaxy) amaxy++;
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
				var params = computeParams(data, xfield, yfield);
				var ctx = this._canvas.getContext('2d');
				var width = this._canvas.width;
				var height = this._canvas.height;
				// Padding
				var left = 40;
				var right = 30;
				var bottom = 25;
				var top = 20;
				// Clear canvas.
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
				// Draw axes.
				ctx.fillStyle = '#000';
				ctx.beginPath();
				ctx.moveTo(left, height - bottom);
				ctx.lineTo(width - right, height - bottom);
				ctx.moveTo(left, height - bottom);
				ctx.lineTo(left, top);
				// Draw y axis ticks and labels.
				for(var i = 0, j = 0; i <= params.arangey; i += params.arangey / 10, ++j ) {
					ctx.moveTo(left, height - bottom - i * (height - top - bottom) / params.arangey);
					ctx.lineTo(left - 5, height - bottom - i * (height - top - bottom) / params.arangey);
					ctx.fillText((params.aminy + j * params.arangey / 10.0).toFixed(2) + 'm', 5, height - bottom - i * (height - top - bottom) / params.arangey + 2);
				}
				// Draw x axis ticks and labels.
				for(var i = 0, j = 0;i <= params.arangex; i += params.arangex / 5, ++j) {
					ctx.moveTo(left + i * (width - left - right) / params.arangex, height - bottom);
					ctx.lineTo(left + i * (width - left - right) / params.arangex, height - bottom + 5);
					var dt = new Date((params.aminx + j * params.arangex / 5.0));
					var dtxt = pad(dt.getMonth()+1) + '/' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()); 
					var mtxt = ctx.measureText(dtxt);
					ctx.fillText(dtxt, left + i * (width - left - right) / params.arangex - mtxt.width / 2, height - bottom + 15 + ((j % 2 == 1) ? 10 : 0));
				}
				ctx.stroke();
				// Draw lines.
				ctx.fillStyle = '#f00';
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