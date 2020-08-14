/*jslint lets: true, plusplus: true, nomen: true */
/*global alert */

(function () {
	
    'use strict';
    
	/**    
	 * Declare a "package" and return a reference to it.
	 */
	function pkg(name) {
		let names = name.split('.'),
		    p = window;
		names.forEach(function (name) {
			if (!p.hasOwnProperty(name)) {
                p[name] = {};
            }
			p = p[name];
		});
		return p;
	}
	window.pkg = pkg;
	
	let util = pkg('ca.dijital.util');
	
	/**
	 * Remove all child nodes of the given node.
	 * @param element A DOM node.
	 */
	util.clear = function(element) {
		if(!element) return;
		while(element.firstChild)
			element.removeChild(element.firstChild);
	}

	/**
	 * Returns a text node containing the given text.
	 * @param text The text.
	 * @param node If given, appends the text node to the given node.
	 */
	util.text = function(text, node) {
		let t = document.createTextNode(text);
		if(node) {
			util.clear(node)
			node.appendChild(t);
		}
		return t;
	}

	/**
	 * Returns the first element that matches the given selector.
	 * @param selector The selector. 
	 * @param node Optional. The parent node, or document if null.
	 */
	util.find = function(selector) {
		return document.querySelector(selector);
	}

	/**
	 * Returns all elements that match the given selector.
	 * @param selector The selector. 
	 * @param node Optional. The parent node, or document if null.
	 */
	util.findAll = function(selector, node) {
		if(!selector) return;
		return (node || document).querySelectorAll(selector);
	}

	/**
	 * Set the given attribute, or remove it if the value is null.
	 * @param node The node to set the attribute on.
	 * @param name The name of the attribute.
	 * @param value The value of the attribute. If null, the attribute is removed.
	 */
	util.setAttr = function(node, name, value) {
		if(!node || !name)return;
		if(value === null) {
			node.removeAttribute(name);
		} else {
			node.setAttribute(name, value);
		}
	}

	util.getAttr = function(node, name) {
		if(node)
			return node.getAttribute(name);
	}

	/**
	 * Create a new node with the given attributes.
	 * @param name The name of the node.
	 * @param attrs An object containing attribute name/value pairs.
	 * @param node Optional. A node. If given, the new node is appended to it.
	 */
	util.create = function(name, attrs, node) {
		let n = document.createElement(name);
		if(n) {
			if(attrs) {
				for(let i in attrs)
					util.setAttr(n, i, attrs[i]);
			}
			if(node)
				node.appendChild(n);
		}
		return n;
	}

	util.loadHtml = function(url, dom, callback) {
		let x = new XMLHttpRequest();
		x.open('GET', url);
		x.responseType = 'document';
		x.addEventListener('readystatechange', function() {
			if(x.readyState == 4) {
				let body = x.responseXML.body;
				let child = body.firstChild;
				while(child) {
					dom.appendChild(document.importNode(child, true));
					child = child.nextSibling;
				}
				if(callback)
					callback(dom);
			}
		});
		x.send();
	}

	util.fillSelect = function(sel, values, prompt, valueField, textField) {
		if(!valueField) valueField = 'value';
		if(!textField) textField = 'text';
		util.clear(sel);
		if(prompt) {
			let o = util.create('option');
			util.text(prompt, o);
			sel.appendChild(o);
		}
		values.forEach(function(value) {
			let o = util.create('option', {value:value[valueField]}, sel);
			util.text(value[textField], o);
		});
	}

	/**
	 * Creates a subclass, given a constructor function, a
	 * superclass and a properties object.
	 * @param fn A constructor function.
	 * @param parent The 
	 */
	util.extend = function(fn, parent, props) {
		fn.prototype = Object.create((parent || Object).prototype, props);
		fn.prototype.constructor = fn;
		return fn;
	}

	util.formToObject = function(form) {
		let obj = {}
		for(let i=0;i<form.elements.length;++i) {
			let el = form.elements[i];
			if(el.name)
				obj[el.name] = el.value;
		}
		return obj;
	}
	
	/**
	 * Simple event for use with EvtDisp.
	 */
	class Evt {
	
		constructor(name, data) {
			this.name = name;
			this.data = data;
		}

		/**
		 * Represent the event as a string.
		 */
		toString () {
			return `[Evt: ${this.name}]`;
		}

	}
	
	util.Evt = Evt;
	
	/**
	 * A base class for objects that can dispatch simple events.
	 * Events must extend the Evt class.
	 */
	class EvtDisp {

		constructor() {
			this._l = {};
			this._active = true;
		}
	
		/**
		 * Add a listener.
		 * @param String The name of the event.
		 * @param Function The callback.
		 * @param The object to which the callback is bound (if any).
		 */
		on(name, callback, binding) {
			let l = this._l[name];
    		if (!l)
                l = this._l[name] = [];
    		for(let i=0;i<l.length;++i) {
        		if(l[i].c === callback && l[i].b === binding)
        			return;
    		}
			l.push({c:callback, b:binding});
		}
	
		/**
		 * Dispatch an event.
		 */
		send(evt) {
			if(this.kill) return;
			if(evt instanceof String || typeof(evt) === 'string')
				evt = new util.Evt(evt);
			if (!evt.hasOwnProperty('name')) {
				throw new Error("Invalid event object: name.");
            }
			let l = this._l[evt.name] || [];
			evt.target = this;
			l.forEach(function (data) {
				data.c.call(data.b, evt);
			});
		}
	
		/**
		 * Remove the listener.
		 * @param The name of the event.
		 * @param The callback.
		 * @param The object to which the callback is bound (if any).
		 */
		remove(name, callback, binding) {
			let l = this._l[name] || [];
	        let i;
			for (i = l.length - 1; i >= 0; --i) {
				if (l[i].c === callback && l[i].b === binding) 
					l.splice(i, 1);
            }
		}

		off(name, callback, binding) {
			this.remove(name, callback, binding);
		}

		set kill(kill) {
			this._active = !active;
		}

		get kill() {
			return !this._active;
		}
		
	}
	
	util.EvtDisp = EvtDisp;
	
	const _sizes = ['B', 'kB', 'MB', 'GB'];
	
    /**
     * Returns a human readable representation of the file
     * size with an appropriate unit.
     * @param size The file size in bytes.
     * @returns A string representing the file size in appropriate units.
     */
	function fileSize(size) {
		let i = 0;
		while (size > 1024) {
			size /= 1024;
			++i;
        }
		return Math.floor(size * 10.0) / 10.0 + _sizes[i];
	}
	
	// TODO: A more extensive file validation regime.
	const _ext = ['las', 'tif', 'tiff', 'bin'];
	
    /**
     * Returns true if the file is a valid type and size.
     * @param file A File object.
     * @returns True if the file is valid.
     */
	function fileIsValid(file) {
		if (file.size === 0) {
			return false;
        }
		let name = file.name;
		let ext = !!name && name.indexOf('.') > -1 ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : null;
		if (!ext || _ext.indexOf(ext) === -1) {
			return false;
        }
		return true;
	}
    
    /**
	 * A default error handler.
	 */
	function handleError(err) {
		if(util.errorHandler) {
			util.errorHandler(err);
		} else {
			alert(err || "Unknown network error.");
		}
	}
	
	util.errorHandler = null;
	
	util.mouseDown = false;
	window.addEventListener('mousedown', function(evt) {
		util.mouseDown = true;
	});
	window.addEventListener('mouseup', function(evt) {
		util.mouseDown = false;
	});
	window.addEventListener('mouseleave', function(evt) {
		util.mouseDown = false;
	});
	
	util.fileSize = fileSize;
	util.fileIsValid = fileIsValid;
    util.handleError = handleError;
    
}());
