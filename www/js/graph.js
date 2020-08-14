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
	class Graph {

		constructor(canvas, container) {
			this._canvas = canvas;
			this._container = container;
			this._box = {				// Padding
				left : 50,
				right : 30,
				bottom : 60,
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

		_mouseMove(evt) {
			if(!this._over || !this._params1) return;
			let params = this._params1;
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
		
		_mouseOver(evt) {
			this._over = true;
		}
		
		_mouseOut(evt) {
			this._over = false;
			if(this._ttShow) {
				this._ttAnim.start(['style.opacity'], [0]);
				this._ttShow = false;
			} 
		}
		
		/**
		 * Render the graph with the data (an array of objects), using the xfield
		 * and yfield to access the axis fields.
		 */
		render(data, xfield1, yfield1, xfield2, yfield2) {
			this._data = data;
			this._xfield1 = xfield1;
			this._yfield1 = yfield1;
			this._xfield2 = xfield2;
			this._yfield2 = yfield2;
			this._render();
		}

		_render() {
			let data = this._data;
			let xfield1 = this._xfield1;
			let yfield1 = this._yfield1;
			let xfield2 = this._xfield2;
			let yfield2 = this._yfield2;
			//data.sort((a, b) => { return a.timestamp - b.timestamp; });
			// Compute the ranges.
			let width = this._container.offsetWidth;
			let height = this._container.offsetHeight;
			this._canvas.width = width;
			this._canvas.height = height;
			let params1 = this._params1 = computeParams(data, xfield1, yfield1);
			let params2 = computeParams(data, xfield2, yfield2);
			let ctx = this._canvas.getContext('2d');
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
			ctx.moveTo(left + 10, height - bottom);
			ctx.lineTo(width - right, height - bottom);
			ctx.moveTo(left + 10, height - bottom);
			ctx.lineTo(left + 10, top);
			// Draw y axis ticks and labels.
			let step;
			if(params1.arangey > 0) {
				step = params1.arangey / 10.0;
			} else {
				step = 0.001;
			}
			for(let i = 0, j = 0; i <= params1.arangey; i += step, ++j ) {
				ctx.moveTo(left + 10, height - bottom - i * (height - top - bottom) / params1.arangey);
				ctx.lineTo(left + 5, height - bottom - i * (height - top - bottom) / params1.arangey);
				ctx.fillText((params1.aminy + j * params1.arangey / 10.0).toFixed(3) + 'm', 0, height - bottom - i * (height - top - bottom) / params1.arangey + 2);
			}
			
			// Draw x axis ticks and labels.
			if(params1.arangex > 0) {
				step = params1.arangex / 5;
			} else {
				step = 0.001;
			}
			for(let i = 0, j = 0;i <= params1.arangex; i += params1.arangex / 5, ++j) {
				ctx.moveTo(left + i * (width - left - right) / params1.arangex, height - bottom);
				ctx.lineTo(left + i * (width - left - right) / params1.arangex, height - bottom + 5);
				let dt = new Date((params1.aminx + j * params1.arangex / 5.0));
				let dtxt = shortDate(dt); 
				let mtxt = ctx.measureText(dtxt);
				ctx.fillText(dtxt, left + i * (width - left - right) / params1.arangex - mtxt.width / 2, height - bottom + 15 + ((j % 2 == 1) ? 10 : 0));
			}
			ctx.stroke();

			// Draw lines.
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			let first = true;
			params1.values.forEach(function(value) {
				let px = left + (value[0] - params1.aminx) / params1.arangex * (width - left - right);
				let py = (height - bottom) - (value[1] - params1.aminy) / params1.arangey * (height - top - bottom);
				if(first) {
					ctx.moveTo(px, py);
					first = false;
				} else {
					ctx.lineTo(px, py);
				}
			});
			ctx.stroke();
			
			// Draw disk.
			if(!params2.values.length || !params2.values[0][1])
				return;
			ctx.globalAlpha = 0.33;
			for(let i = 0; i < params1.values.length; ++i) {
				let value1 = params1.values[i];
				let value2 = params2.values[i];
				let px = left + (value1[0] - params1.aminx) / params1.arangex * (width - left - right);
				let py = (height - bottom) - (value1[1] - params1.aminy) / params1.arangey * (height - top - bottom);
				ctx.beginPath();
				let q = ((value2[1] - params2.aminy) / params2.arangey);
				ctx.arc(px, py, 1 + q * 9, 0.0, 2.0 * Math.PI);
				ctx.closePath();
				ctx.fill();
			}

			let mind = params2.aminy.toFixed(3) + 'm³/s:';
			let maxd = params2.amaxy.toFixed(3) + 'm³/s:';
			ctx.beginPath();
			ctx.globalAlpha = 1;
			ctx.fillText('Discharge:', 0, 237);
			ctx.fillText(mind, 60, 237);
			ctx.fillText(maxd, 150, 237);
			ctx.globalAlpha = 0.33;
			ctx.arc(127, 234, 1, 0.0, 2.0 * Math.PI);
			ctx.arc(220, 234, 10, 0.0, 2.0 * Math.PI);
			ctx.closePath();
			ctx.fill();
		}
		
	}
	
	hydro.Graph = Graph;
	
}());
