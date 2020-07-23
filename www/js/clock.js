(function() {
	
	function Clock(el, lineWidth, color) {
		this.el = el;
		this.lineWidth = lineWidth;
		this.color = color;
	}
	Clock.prototype = {
		start:function() {
			this.angle = 0.0;
			while(this.el.firstChild)
				this.el.removeChild(this.el.firstChild);
			var canv = this.canv = document.createElement('canvas');
			canv.width = parseFloat(this.el.style.width);
			canv.height = parseFloat(this.el.style.height);
			this.el.appendChild(canv);
			var ctx = this.canv.getContext('2d');
			ctx.strokeStyle = this.color || 'black';
			ctx.lineWidth = this.lineWidth || 2;
			ctx.lineCap = 'round';
			this.render = this._render.bind(this);
			requestAnimationFrame(this.render);
		},
		_render:function() {
			var ctx = this.canv.getContext('2d');
			var lw = parseFloat(ctx.lineWidth); 
			var x = lw + 1;
			var y = lw + 1;
			var width = this.canv.width - lw * 2 - 2;
			var height = this.canv.height - lw * 2 - 2;
			var hw = width / 2, hh = height / 2;
			var cx = x + hw, cy = y + hh;
			var tw = (width - 4) / 2, th = (height - 4) / 2;
			ctx.beginPath();
			ctx.clearRect(0, 0, this.canv.width, this.canv.height);
			ctx.arc(cx, cy, hw, 0, 360);
			ctx.moveTo(cx, y);
			for(var i = 0.0; i<2 * Math.PI; i += Math.PI / 6.0) {
				ctx.moveTo(cx + Math.cos(i) * hw, cy + Math.sin(i) * hh);
				ctx.lineTo(cx + Math.cos(i) * tw, cy + Math.sin(i) * th);
			}
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + Math.cos(this.angle) * (tw - 4), cy + Math.sin(this.angle) * (th - 4));
			this.angle += 0.1;
			ctx.stroke();
			requestAnimationFrame(this.render);
		}
	}

	window.Clock = Clock;
	
}());