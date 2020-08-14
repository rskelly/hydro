class Reading {

	constructor(params = null) {
		//this.rid = 0;
		//this.id = null;
		this.readtime = null;
		this.level = Number.NaN;
		this.discharge = Number.NaN;
		//this.prov = null;
		if(params) {
			for(let [k, v] of Object.entries(params))
				this[k] = v;
		}	
	}

	toString() {
		return `[Reading: ${this.id}, ${this.readtime}, ${this.level}, ${this.discharge}]`;
	}
	
	getRid() {
		return rid;
	}
	setRid(rid) {
		this.rid = rid;
	}
	getId() {
		return this.id;
	}
	setId(id) {
		this.id = id;
	}
	getReadTime() {
		return this.readtime;
	}
	setReadTime(readingTime) {
		this.readtime = readingTime;
	}
	getLevel() {
		return this.level;
	}
	setLevel(level) {
		this.level = level;
	}
	getDischarge() {
		return this.discharge;
	}
	setDischarge(discharge) {
		this.discharge = discharge;
	}
	getProvince() {
		return this.prov;
	}
	setProvince(province) {
		this.prov = province;
	}
	
}


module.exports = Reading;
