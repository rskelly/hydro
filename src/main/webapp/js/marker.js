(function() {
	
	var util = pkg('ca.dijital.util');
	var anim = pkg('ca.dijital.anim');
	var hydro = pkg('ca.dijital.hydro');
	
	/**
	 * StationMarker is... a marker that represents a station.
	 * Pass in the station object and a reference to the OL3 map.
	 */
	function StationMarker(station, map) {
		util.EvtDisp.prototype.init.call(this);
		this.init(station, map);
	}
	
	/**
	 * The selector for the station marker element.
	 */
	StationMarker.elementSelector = '.station-marker';
	
	/**
	 * The selector for the station name element.
	 */
	StationMarker.nameSelector = '.station-name';
	
	/**
	 * A global reference to the currently-selected marker.
	 */
	StationMarker.selected = null;
	
	StationMarker.selectedToTop = function() {
		if(StationMarker.selected)
			StationMarker.selected.toTop();
	};
	
	StationMarker.prototype = Object.create(util.EvtDisp.prototype, {
	
		/**
		 * Initializes the marker. Creates listeners, animations and the
		 * OL3 marker instance.
		 */
		init : {
			value : function(station, map) {
				this._map = map;
				this._station = station;
				var el = document.querySelector(StationMarker.elementSelector).cloneNode(true);
				el.addEventListener('mouseover', this.show.bind(this));
				//el.addEventListener('mouseout', this.hide.bind(this));
				el.addEventListener('click', this.click.bind(this));
				var txt = el.querySelector(StationMarker.nameSelector);
				txt.textContent = station.name;
				this._el = el;
				this._txt = txt;
				this._anim = new anim.Anim(el);
				this._anim.duration = 333;
				this._txtAnim = new anim.Anim(txt);
				this._txtAnim.duration = 200;
				this._txtAnim.delay = 250;
				this.marker = new ol.Overlay({
				  position: ol.proj.transform([station.lon, station.lat], 'EPSG:4326', 'EPSG:3857'),
				  positioning: 'bottom-left',
				  element: el,
				  stopEvent: false,
				  insertFirst : false
				});
			}
		},
		
		/**
		 * Moves this marker to the top.
		 */
		toTop : {
			value : function() {
				this._map.removeOverlay(this.marker);
				this._map.addOverlay(this.marker);
			}
		},
		
		/**
		 * Update the station data.
		 */
		update : {
			value : function(station) {
				this._station = station;
			}
		},
		
		/**
		 * Get the name of the station.
		 */
		name : {
			get : function() { return this._station.name; }
		},
		
		/**
		 * Get the ID of the station.
		 */
		id : {
			get : function() { return this._station.id; }
		},
		
		/**
		 * Get the province of the station.
		 */
		prov : {
			get : function() { return this._station.prov; }
		},
		
		/**
		 * Get the province of the station.
		 */
		lastUpdate : {
			get : function() { return this._station.lastUpdate; }
		},
		
		/**
		 * Gets the poition of the station as an array of lon, lat.
		 */
		pos : {
			get : function() { return [this._station.lon, this._station.lat]; }
		},
		
		/**
		 * Dispatch a click event.
		 */
		click : {
			value : function() {
				this.send(new util.Evt('click', {station:this}));
			}
		},
		
		/**
		 * Show the station. Expands to show the name, and raises it to the top.
		 */
		show : {
			value : function() {
				if(StationMarker.selected && StationMarker.selected != this)
					StationMarker.selected.hide();
				StationMarker.selected = this;
				this._map.removeOverlay(this.marker);
				this._map.addOverlay(this.marker);
				this._anim.stop();
				this._txtAnim.stop();
				this._anim.start(['style.width', 'style.height'], [this._txt.offsetWidth, this._txt.offsetHeight], ['{}px', '{}px'], [10, 10]);
				this._txtAnim.start(['style.opacity'], [1.0]);
			}
		},
		
		/**
		 * Hide (collapse) the station marker.
		 */
		hide : {
			value : function() {
				StationMarker.selected = null;
				this._anim.stop();
				this._txtAnim.stop();
				this._anim.start(['style.width', 'style.height'], [10, 10], ['{}px', '{}px']);
				this._txt.style.opacity =  '0.0';
			}
		}
	
	});
	
	hydro.StationMarker = StationMarker;
	
}());