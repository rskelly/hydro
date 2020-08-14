/*jslint vars: true, plusplus: true, nomen: true */
/*global pkg, Map, FormData, alert, console */

//boo
(function () {
	
    'use strict';
    
	var net = pkg('ca.dijital.net');
	var util = pkg('ca.dijital.util');

	net.usePostForPut = true;
	net.sendAsJSON = false;
	
	var _evt = new util.EvtDisp();
	var _netCount = 0;

	/**
	 * Send a PUT request.
	 */
	net.put = function(url, params, callback, error) {
		if(net.usePostForPut) {
			if(params instanceof FormData) {
				params.append('_method', 'PUT');
			} else if(params) {
				params['_method'] = 'PUT';
			}
			net.req('POST', url, params, callback, error);
		} else {
			net.req('PUT', url, params, callback, error);
		}
	};
	
	/**
	 * Send a DELETE request.
	 */
	net.del = function(url, params, callback, error) {
		net.req('DELETE', url, params, callback, error);
	};
	
	/**
	 * Send a GET request.
	 */
	net.get = function (url, params, callback, error) {
		net.req('GET', url, params, callback, error);
	};
	
	/**
	 * Send a POST request.
	 */
	net.post = function (url, params, callback, error) {
		net.req('POST', url, params, callback, error);
	};
	
	net.req = function (type, url, params, callback, error) {
		if(net.sendAsJSON) {
			params = JSON.stringify(params);
		} else {
			if (!(params instanceof FormData)) {
				var data = new FormData();
				for (var i in params) {
					data.append(i, params[i]);
	            }
				params = data;
			}
		}
		var x = new XMLHttpRequest();
		x.open(type, url);
		x.addEventListener('readystatechange', function (evt) {
			switch (x.readyState) {
			case 4:
				_evt.send(new util.Evt('complete', {count:--_netCount}));
				try {
					var result = JSON.parse(x.responseText) || {};
					if (result.hasOwnProperty('result')) {
						if (callback)
							callback(result.result);
					} else if (result.hasOwnProperty('error')) {
						(error||util.handleError)(result.error);
					} else {
						throw new Error('Unknown error.');
					}
				} catch (err) {
					(error||util.handleError)('Failed to parse response: ' + err);
				}
                break;
			}
		});
		x.send(params);
		_evt.send(new util.Evt('start', {count:++_netCount}));
	};

	net.on = function(name, callback, binding) {
		return _evt.on(name, callback, binding);
	};

	net.remove = function(name, callback, binding) {
		return _evt.remove(name, callback, binding);
	};
	
	net.off = net.remove;

	class Controller extends util.EvtDisp {

		constructor() {
			super();
			this._delimiter = '&';
			this._assigner = '=';
			this._hashProps = {};
			this._processHash();
			window.addEventListener('hashchange', this._processHash.bind(this));
		}

		_processHash() {
			var hash = document.location.hash;
			if(!hash) return;
			hash = hash.substring(1);
			var props = {};
			var ass = this._assigner;
			hash.split(this._delimiter).forEach(function(part) {
				var nv = part.split(ass);
				if(nv.length == 1) {
					props['__x__'] = nv[0].trim();
				} else if(nv.length > 1) {
					props[nv[0].trim()] = nv[1].trim();
				}
			});
			this._hashProps = props;
			for(var k in this._hashProps)
				this.send(new util.Evt('hash', {name:k == '__x__' ? null : k, value:this._hashProps[k], action:'update'}));
		}

		_updateHash() {
			if(this._hashProps.hasOwnProperty('__x__')) {
				document.location.hash = '#' + this._hashProps['__x__'];
			} else {
				var hash = [];
				for(var i in this._hashProps)
					hash.push(i + (this._hashProps[i] ? this._assigner + this._hashProps[i] : ''));
				document.location.hash = '#' + hash.join(this._delimiter);
			}
		}

		set(name, value, noBump) {
			// If value is undefined, use the value as the only 
			// hash string
			if(!name)
				throw new Error("A name is required.");
			if(!value) {
				value = name;
				name = '__x__';
			}
			if(!this._hashProps.hasOwnProperty(name) || this._hashProps[name] != value) {
				this._hashProps[name] = value;
				this._updateHash();
			}
		}

		get(name) {
			if(name == null) 
				name = '__x__';
			try {
				return this._hashProps[name];
			} catch(e) {
				return null;
			}
		}

		clear() {
			this._hashProps = {};
			this._updateHash();
		}

	}

	net.control = new Controller();
	
}());
