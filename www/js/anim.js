(function() {
	
	let anim = pkg('ca.dijital.anim');
	let util = pkg('ca.dijital.util');

	/**
	 * Returns a value between 0 and 1 indicating
	 * the progress of the animation. The prog argument,
	 * will usually be a linear progression, also from 
	 * 0 to 1, but the output will be non-linear.
	 * From Penner's equations: https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
	 */
	anim.easeInOut = function(prog) {
		prog = prog > 1 ? 1 : (prog < 0 ? 0 : prog);
		return -0.5 * (Math.cos(Math.PI*prog) - 1);
	}

	/**
	 * Returns the named property from the object. If this is a 
	 * nested property, pass in a dot-delimited name, and the 
	 * method will find the nested value and return it.
	 * @param obj The object.
	 * @param name The property name, or dot-delimited path.
	 */
	function getProp(obj, name) {
		let names = name.split('.');
		let i = 0;
		for(;i<names.length-1;++i) {
			name = names[i];
			obj = obj[name];
		}
		return {target:obj, name:names[i]};
	}

	class AnimWrapper {

		/**
	     * Wraps an object so that properties that are not numeric can be treated as such.
		 * This for style properties.
		 * @param obj An object.
		 * @param prop The name of the property.
		 * @param format The format string for the property. Usually this will be "{}px" where
		 * 	        the "{}" is replaced with the value.
		 */
		constructor(obj, prop, format) {
			let p = getProp(obj, prop);
			this.obj = p.target;
			this.prop = p.name;
			this.format = format;
		}

		get value() {
			if(!this.obj.hasOwnProperty(this.prop))
				return 0.0;
			let r = parseFloat(this.obj[this.prop]);
			if(isNaN(r))
				return 0.0;
			return r;
		}

		set value(val) {
			this.obj[this.prop] = this.format.replace('{}', val);
		}

	}

	anim.AnimWrapper = AnimWrapper;

	/**
	 * Creates an animation object for the given target object.
	 */
	class Anim extends util.EvtDisp {

		constructor(target) {
			super();
			this.target = target;
			this._id = -1;
			this._time = -1;
			this._props = {};
			this._startProps = {};
			this._propsDelta = {};
			this.method = anim.easeInOut;
			this.duration = 1000;
			this.delay = 0;
		}

		/*
		* @param propNames The names of the properties.
		* @param propValues The ending values of the properties.
		* @param propFormats A list of string formats for values (e.g. "{}px") where the "{}" is replaced by the value. Null if not required.
		* @param initValues Initial values for properties if the current value is null or nan.
		*/
		start(propNames, propValues, propFormats, initValues) {
			this.stop();
			if(propNames.length != propValues.length)
				throw new Error('Prop names and prop values must be the same length.');
			if(propFormats == null) propFormats = [];
			if(initValues == null) initValues = [];
			for(let i=propFormats.length;i<propNames.length;++i)
				propFormats.push(null);
			for(let i=propFormats.length;i<initValues.length;++i)
				initValues.push(NaN);
			for(let i=0;i<propNames.length;++i) {
				let p = this._props[propNames[i]] = getProp(this.target, propNames[i]);
				p.format = propFormats[i];
				let v = this._startProps[propNames[i]] = parseFloat(p.target[p.name]);
				if(isNaN(v) || v == undefined) 
					v = isNaN(initValues[i]) ? propValues[i] : initValues[i];
				this._startProps[propNames[i]] = v;
				this._propsDelta[propNames[i]] = propValues[i] - v;
			}
			clearTimeout(this._id);
			this._id = setTimeout(this._start.bind(this), this.delay);
		}

		_start() {
			this._run = true;
			requestAnimationFrame(this._update.bind(this));
		}

		_update(time) {
			if(!this._run) return;
			if(this._time < 0)
				this._time = time;
			let prog = this.method((time - this._time) / this.duration);
			if(prog > 1)
				prog = 1;
			for(let p in this._props) {
				let prop = this._props[p];
				let val = parseFloat(this._startProps[p] + prog * this._propsDelta[p]);
				if(isNaN(val) || val == undefined) continue;
				if(prop.format)
					val = prop.format.replace('{}', val);
				prop.target[prop.name] = val;
				if(prog == 1) 
					this.send(new util.Evt('complete', {prop:prop.name}));
			}
			if(prog == 1) {
				this.stop();
			} else if(this._run) {
				requestAnimationFrame(this._update.bind(this));
			}
		}

		stop() {
			clearTimeout(this._id);
			this._run = false;
			this._time = -1;
		}

	}

	anim.Anim = Anim;

}());
