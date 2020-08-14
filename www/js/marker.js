(function() {
	
	let util = pkg('ca.dijital.util');
	let anim = pkg('ca.dijital.anim');
	let hydro = pkg('ca.dijital.hydro');
	
	let _markerId = 0;
	
	/**
	 * StationMarker is... a marker that represents a station.
	 * Pass in the station object and a reference to the OL3 map.
	 */
	class StationMarker extends util.EvtDisp {

		constructor(station, map) {
			super();
			this._map = map;
			this._station = station;
			let el = document.querySelector(StationMarker.elementSelector).cloneNode(true);
			el.id = 'station-marker-' + ++_markerId;
			el.style.display = 'block';
			el.addEventListener('mouseover', this.show.bind(this));
			//el.addEventListener('mouseout', this.hide.bind(this));
			el.addEventListener('click', this.click.bind(this));
			let txt = el.querySelector(StationMarker.nameSelector);
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

		/**
		 * Moves this marker to the top.
		 */
		toTop() {
			this._map.removeOverlay(this.marker);
			this._map.addOverlay(this.marker);
		}
		
		/**
		 * Update the station data.
		 */
		update(station) {
			this._station = station;
		}
		
		/**
		 * Get the name of the station.
		 */
		get name() { 
			return this._station.name; 
		}
		
		/**
		 * Get the ID of the station.
		 */
		get id() { 
			return this._station.id; 
		}
		
		/**
		 * Get the province of the station.
		 */
		get prov() { 
			return this._station.prov; 
		}
		
		/**
		 * Get the province of the station.
		 */
		get lastUpdate() { 
			return this._station.lastupdate; 
		}
		
		/**
		 * Gets the poition of the station as an array of lon, lat.
		 */
		get pos() { 
			return [this._station.lon, this._station.lat]; 
		}
		
		/**
		 * Dispatch a click event.
		 */
		click() {
			this.send(new util.Evt('click', {station:this}));
		}
		
		/**
		 * Show the station. Expands to show the name, and raises it to the top.
		 */
		show() {
			if(StationMarker.selected && StationMarker.selected != this)
				StationMarker.selected.hide();
			StationMarker.selected = this;
			this.toTop();
			this._anim.stop();
			this._txtAnim.stop();
			this._anim.start(['style.width', 'style.height'], [this._txt.offsetWidth, this._txt.offsetHeight], ['{}px', '{}px'], [10, 10]);
			this._txtAnim.start(['style.opacity'], [1.0]);
		}
		
		/**
		 * Hide (collapse) the station marker.
		 */
		hide() {
			StationMarker.selected = null;
			this._anim.stop();
			this._txtAnim.stop();
			this._txt.style.opacity =  '0.0';
			this._anim.start(['style.width', 'style.height'], [10, 10], ['{}px', '{}px']);
		}
	
	}
	
	/**
	 * The selector for the station marker element.
	 */
	StationMarker.elementSelector = '#station-marker';
	
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

	hydro.StationMarker = StationMarker;
	
}());