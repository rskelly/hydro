(function() {
	
	let hydro = pkg('ca.dijital.hydro');
	let anim = pkg('ca.dijital.anim');
	
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
		let values = [];
		let minx = Infinity;
		let maxx = -Infinity;
		let miny = Infinity;
		let maxy = -Infinity;
		for(let i=0;i<data.length;++i) {
			let x = data[i][xfield];
			let y = data[i][yfield];
			if(y == -9999.0)continue;
			if(x < minx) minx = x;
			if(y < miny) miny = y;
			if(x > maxx) maxx = x;
			if(y > maxy) maxy = y;
			values.push([x, y]);
		}
		let rangex = maxx - minx;
		let rangey = maxy - miny;
		let aminx = (minx - rangex * 0.1);
		let amaxx = (maxx + rangex * 0.1);
		let aminy = (miny - rangey * 0.1);
		let amaxy = (maxy + rangey * 0.1);
		let arangex = amaxx - aminx;
		let arangey = amaxy - aminy;
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
				let tt = this._tt = document.createElement('div');
				tt.className = 'tooltip';
				let ttAnim = this._ttAnim = new anim.Anim(tt);
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
				let params = this._params;
				let tt = this._tt;
				let box = this._box;
				let canvas = this._canvas;
				let x = Math.max(0, Math.min(1, (evt.offsetX - box.left) / (canvas.width - box.left - box.right)));
				let y = Math.max(0, Math.min(1, 1 - (evt.offsetY - box.top) / (canvas.height - box.bottom - box.top)));
				x = params.aminx + params.arangex * x;
				y = params.aminy + params.arangey * y;
				tt.textContent = shortDate(new Date(x)) + ' - ' + y.toFixed(2) + 'm';
				x = evt.clientX + 10;
				y = evt.clientY + 10;
				if(x + tt.offsetWidth >= document.body.clientWidth)
					x -= (tt.offsetWidth + 20);
				//console.log(x + tt.offsetWidth + ', ' + document.body.clientWidth);
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
				let params = this._params = computeParams(data, xfield, yfield);
				let ctx = this._canvas.getContext('2d');
				let width = this._canvas.width;
				let height = this._canvas.height;
				// Padding
				let left = this._box.left;
				let right = this._box.right;
				let bottom = this._box.bottom;
				let top = this._box.top;
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
				let step;
				if(params.arangey > 0) {
					step = params.arangey / 10.0;
				} else {
					step = 0.001;
				}
				for(let i = 0, j = 0; i <= params.arangey; i += step, ++j ) {
					ctx.moveTo(left, height - bottom - i * (height - top - bottom) / params.arangey);
					ctx.lineTo(left - 5, height - bottom - i * (height - top - bottom) / params.arangey);
					ctx.fillText((params.aminy + j * params.arangey / 10.0).toFixed(3) + 'm', 0, height - bottom - i * (height - top - bottom) / params.arangey + 2);
				}
				
				// Draw x axis ticks and labels.
				if(params.arangex > 0) {
					step = params.arangex / 5;
				} else {
					step = 0.001;
				}
				for(let i = 0, j = 0;i <= params.arangex; i += params.arangex / 5, ++j) {
					ctx.moveTo(left + i * (width - left - right) / params.arangex, height - bottom);
					ctx.lineTo(left + i * (width - left - right) / params.arangex, height - bottom + 5);
					let dt = new Date((params.aminx + j * params.arangex / 5.0));
					let dtxt = shortDate(dt); 
					let mtxt = ctx.measureText(dtxt);
					ctx.fillText(dtxt, left + i * (width - left - right) / params.arangex - mtxt.width / 2, height - bottom + 15 + ((j % 2 == 1) ? 10 : 0));
				}
				
				ctx.stroke();
				// Draw lines.
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				let first = true;
				params.values.forEach(function(value) {
					let px = left + (value[0] - params.aminx) / params.arangex * (width - left - right);
					let py = top + (value[1] - params.aminy) / params.arangey * (height - top - bottom);
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
					let px = left + (value[0] - params.aminx) / params.arangex * (width - left - right);
					let py = top + (value[1] - params.aminy) / params.arangey * (height - top - bottom);
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
