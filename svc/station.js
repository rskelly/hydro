class Station {


	constructor(params) {
		this.sid = 0;
		this.id = null;
		this.name = null;
		this.prov = null;
		this.lat = Number.NaN;
		this.lon = Number.NaN;
		this.lastupdate = null;
		if(params) {
			for(let [k, v] of Object.entries(params))
				this[k] = v;
		}	
	}	

	getGid() {
		return this.gid;
	}
	setGid(gid) {
		this.gid = gid;
	}
	getId() {
		return this.id;
	}
	setId(id) {
		this.id = id;
	}
	getName() {
		return this.name;
	}
	setName(name) {
		this.name = name;
	}
	getProv() {
		return this.prov;
	}
	setProv(prov) {
		this.prov = prov;
	}
	getLat() {
		return this.lat;
	}
	setLat(lat) {
		this.lat = lat;
	}
	getLon() {
		return this.lon;
	}
	setLon(lon) {
		this.lon = lon;
	}

	getLastUpdate() {
		return this.lastupdate;
	}

	setLastUpdate(lastupdate) {
		this.lastupdate = lastupdate;
	}
	
}

module.exports = Station;