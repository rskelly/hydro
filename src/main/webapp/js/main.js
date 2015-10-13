(function() {

	var util = pkg('ca.dijital.util');
	var net = pkg('ca.dijital.net');
	var anim = pkg('ca.dijital.anim');
	var hydro = pkg('ca.dijital.hydro');

	var loc = document.location;
	var BASE_URL = loc.protocol == 'file:' 
		? 'http://localhost:8080/hydro'
		: 'http://' + loc.host + '/maps/hydro';
	var REST_URL = BASE_URL + '/rest';
	var STATIONS_URL = REST_URL + '/stations';
	var READINGS_URL = REST_URL + '/readings/{id}/{n}';

	// Station marker instances, indexed by ID.
	var markers = {};
	// Station markers which are results of a search.
	var searchResults = {};
	// Markers currently on the map.
	var markersOnMap = {};
	
	// ol3 map and view.
	var view = null;
	var map = null;
	
	// Graph component.
	var graph = null;
	
	// Network indicator stuff.
	var spinAnim = null;
	var spinOn = false;
	
	// True for the page load. When the map initializes, 
	// loads a random station.
	var firstLoad = true;
	
	// Set to true to trigger recentering on a marker.
	// Reset to false every time.
	var centerOnLoad = false;
	
	/**
	 * Called when a search result item is clicked. Selects and shows a
	 * station's data.
	 */
	function searchResultClicked(evt) {
		centerOnLoad = true;
		net.control.set(evt.target.getAttribute('data-id') );
	}

	/**
	 * Marker click handler. Selects the station.
	 */
	function markerClick(evt) {
		net.control.set(evt.data.station.id);
	}

	/**
	 * Respond to changes from the URL hash. The hash is the
	 * controller for this application.
	 */
	function hashChange(evt) {
		// The value is the station id.
		loadStation(evt.data.value);
	}

	/**
	 * Creates a new StationMarker if there isn't one in the
	 * registry with the same ID. Otherwise updates the existing one. 
	 */
	function initializeStationMarker(data) {
		var sm;
		if (markers.hasOwnProperty(data.id)) {
			sm = markers[data.id]
			sm.update(data);
		} else {
			sm = markers[data.id] = new hydro.StationMarker(data, map);
			sm.on('click', markerClick);
		}
		return sm;
	}
	
	/**
	 * Invoked by the search form. Retrieves the serch results and displays
	 * them.
	 */
	window.searchStations = function(evt) {
		evt.preventDefault();
		var data = new FormData(evt.target);
		net.post(STATIONS_URL, data, function(result) {
			var list = document.querySelector('#search-results');
			util.clear(list);
			searchResults = {};
			result.forEach(function(station) {
				var sm = initializeStationMarker(station);
				searchResults[sm.id] = sm;
				var el = document.createElement('a');
				el.textContent = sm.name;
				el.classList.add('search-result');
				el.setAttribute('data-id', sm.id);
				el.setAttribute('href', 'javascript:void(0);');
				el.addEventListener('click', searchResultClicked);
				list.appendChild(el);
			});
			list.scrollTop = 0;
			var combo = document.querySelector('#search-only');
			if(result.length > 0) {
				combo.removeAttribute('disabled');
				combo.addEventListener('change', searchOnlyToggle);
			} else {
				combo.setAttribute('disabled', 'disabled');
			}
			
			updateMarkers();
		});
		return false;
	};

	/**
	 * Responds to the search-only toggle.
	 */
	function searchOnlyToggle() {
		if(!isSearchOnly()) {
			loadStations();
		} else {
			updateMarkers();
		}
	}

	/**
	 * Returns true if the search-only box is active and checked.
	 */
	function isSearchOnly() {
		var chk = document.querySelector('#search-only');
		return !chk.disabled && chk.checked;
	}
	
	/**
	 * Update the markers on the map.
	 */
	function updateMarkers() {
		var searchOnly = isSearchOnly();
		// Remove all markers.
		for(var i in markersOnMap) {
			map.removeOverlay(markersOnMap[i].marker);
			delete markersOnMap[i];
		}
		// Add needed markers.
		for(var i in markers) {
			if(!searchOnly || (searchOnly && searchResults.hasOwnProperty(i))) {
				map.addOverlay(markers[i].marker);
				markersOnMap[i] = markers[i];
			}
		}
		// Center if necessary.
		if(centerOnLoad) {
			centerOnLoad = false;
			view.setCenter(ol.proj.transform(hydro.StationMarker.selected.pos, 'EPSG:4326',
				'EPSG:3857'));
		}
		// Move selected to top.
		hydro.StationMarker.selectedToTop();
	}
	
	/**
	 * Shows a station by optionally expanding the marker, populating the info
	 * table and loading readings for the graph.
	 */
	function showStation(station, readings) {
		graph.render(readings, 'timestamp', 'level');
		document.querySelector('.station_name').textContent = station.name;
		document.querySelector('.station_id').textContent = station.id;
		document.querySelector('.station_prov').textContent = station.prov;
		document.querySelector('.station_update').textContent = station.lastUpdate;
		document.querySelector('.station_loc').textContent = -station.pos[0] + 'W '
				+ station.pos[1] + 'N';
		station.show();
	}

	/**
	 * Selects the station. Loads its latest records and calls showStation.
	 * Optionally recenters the map on the station.
	 */
	function loadStation(id, center) {
		var url = READINGS_URL.replace('{id}', id ? id : 'random').replace(
				'{n}', 20)
		net.get(url, null, function(result) {
			// Set the timestamp property on each result.
			for (var i = 0; i < result.readings.length; ++i) {
				result.readings[i].timestamp = Date
						.parse(result.readings[i].readTime);
			}
			// Add or update the marker to the registry.
			var sm = initializeStationMarker(result.station);
			if(!id)
				net.control.set(sm.id);
			if(center)
				centerOnLoad = true;
			showStation(sm, result.readings);
			updateMarkers();
		}, function(error) {
			console.log(error);
		});
	}

	/**
	 * Called when the map's view changes. Loads the set of visible stations and
	 * adds any that are not present. Removes stations that are out of view. If
	 * no station is selected, selects a random one. This should only occur on
	 * startup.
	 */
	function viewChange() {
		extent = ol.proj.transformExtent(view.calculateExtent(map.getSize()),
				'EPSG:3857', 'EPSG:4326');
		if(!isSearchOnly())
			loadStations();
	}
	
	/**
	 * Load the stations for the current extent.
	 * Load the linked or random station if this is the first load.
	 */
	function loadStations() {
		net.post(STATIONS_URL, { xmin : extent[0], ymin : extent[1], xmax : extent[2], ymax : extent[3] },
			function(result) {
				var tmp = {};
				result.forEach(function(station) {
					var sm = initializeStationMarker(station);
					tmp[sm.id] = sm;
				});
				for(var i in searchResults) {
					if(!tmp.hasOwnProperty(i)) {
						tmp[i] = searchResults[i];
					}
				}
				markers = tmp;
				updateMarkers();
				if(firstLoad) {
					// Try to load either the station represented by an ID, 
					// or a random one if there is no id.
					firstLoad = false;
					loadStation(net.control.get(), true);
				}

			});
	}

	/**
	 * Handles net status updates. Shows and hides the spinner.
	 */
	function netUpdate(evt) {
		if (evt.data.count == 0) {
			spinAnim.start([ 'style.opacity' ], [ 0.0 ]);
			spinOn = false;
		} else if (!spinOn) {
			spinAnim.start([ 'style.opacity' ], [ 1.0 ]);
			spinOn = true;
		}
	}

	/**
	 * Called on document start. Initializes the view, map, graph, animations
	 * and listeners.
	 */
	window.start = function() {

		view = new ol.View({
			center : ol.proj.transform([ -90, 55 ], 'EPSG:4326',
					'EPSG:3857'),
			zoom : 4
		});

		map = new ol.Map({
			target : 'map',
			layers : [ new ol.layer.Tile({
				source : new ol.source.MapQuest({
					layer : 'sat'
				})
			}) ],
			view : view
		});

		graph = new hydro.Graph(document.querySelector('#canvas'));

		clock = new Clock(document.querySelector('.clock'), 2, '#fff');
		clock.start();
		spinAnim = new anim.Anim(document.querySelector('.clock'));
		spinAnim.duration = 250;

		map.on('moveend', viewChange);
		net.on('start', netUpdate);
		net.on('complete', netUpdate);
		net.control.on('hash', hashChange);

	}

}());