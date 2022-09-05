
const http = require('https');
const fs = require('fs');
const rl = require('readline');
const multer = require('multer');

const Station = require('./station.js');
const Reading = require('./reading.js');


	/**
	 * Returns a list of the latest readings for a station, grouped by hour,
	 * with the latest result for each hour.
	 */
const SQL_LATEST_READINGS = "select * from ("
			+ "select distinct on (date_trunc('hour', readtime)) readings.readtime, readings.level, readings.discharge " 
			+ "from stations inner join readings using(id) "
			+ "where id=$1 "
			+ "order by date_trunc('hour', readtime) desc, readtime desc "
			+ "limit $2"
		+ ") t order by readtime";

	/**
	 * Gets the age of the last reading for a station in hours.
	 */
const SQL_GET_READING_AGE = "select timezone, prov, lastupdate is not null as hasage, extract(epoch from current_timestamp - lastupdate)/3600.0 as age "
		+ "from stations "
		+ "where id=$1";

	/**
	 * Insert a reading.
	 */
const SQL_INSERT_READING = "insert into readings (id, readtime, level, discharge) values ($1, to_timestamp($2), $3, $4)"; // on

const SQL_INSERT_STATION = "insert into stations (id, name, prov, timezone, geom) values ($1, $2, $3, $4, st_geomfromtext($5, 4326))";
	/**
	 * Query the stations list given a polygon.
	 */
const SQL_STATIONS_GEOM = "select *, st_x(geom) as lon, st_y(geom) as lat "
		+ "from stations "
		+ "where st_contains(st_geomfromtext($1, 4326), geom) ";
		//+ "order by random() "
		//+ "limit 100";

	/**
	 * Set the last update time for a station.
	 */
const SQL_SET_UPTIME = "update stations set lastupdate=current_timestamp where id=$1";

	/**
	 * Get the last update time for a station.
	 */
const SQL_GET_UPTIME = "select lastupdate is not null as hasupdate, extract(epoch from current_timestamp-lastupdate)/3600.0 as age "
	+ "from stations where id=$1";

	/**
	 * Query a station by ID.
	 */
const SQL_STATION = "select s.*, st_x(s.geom) as lon, st_y(s.geom) as lat "
		//+ "min(r.level) as minlevel, max(r.level) as maxlevel, "
		//+ "min(r.discharge) as mindischarge, max(r.discharge) as maxdischarge "
	+ "from stations s "//" inner join readings r using(id) "
	+ "where s.id=$1";

	/**
	 * Returns the ID of a random station.
	 */
const SQL_RANDOM_STATION = "select *, st_x(geom) as lon, st_y(geom) as lat from stations order by random() limit 1";

	/**
	 * Perform a trigram search against the station names.
	 */
const SQL_SEARCH = "select *, similarity(name, $1) as s, st_x(geom) as lon, st_y(geom) as lat from stations order by s desc limit 100";

	/**
	 * Delete readings for a station.
	 */
const SQL_DELETE_READINGS = "delete from readings where id=$1";

	/**
	 * DDL Statements.
	 */
const SQL_CREATE_DB = [
		"create table if not exists readings (rid serial primary key, id text, readtime timestamp, level float, discharge float)",
		"create table if not exists stations (sid serial primary key, id text, name text, prov text, timezone float, lastupdate timestamp, geom geometry('point', 4326))",
		"create index if not exists readings_id_idx on readings(id)",
		"create index if not exists stations_id_idx on stations(id)",
		"create index if not exists stations_geom_idx on stations using gist(geom)",
		"delete from stations cascade",
		"create index trgm_stations_name on stations using gist(name gist_trgm_ops)"
	];

	/**
	 * Data file URL template.
	 */
const URL_TPL = 'https://dd.weather.gc.ca/hydrometric/csv/{prov}/hourly/{prov}_{id}_hourly_hydrometric.csv';

const URL_STATIONS = "https://dd.weather.gc.ca/hydrometric/doc/hydrometric_StationList.csv";


/**
 * Provides methods for accessing data. Provides REST-enabled methods for
 * interacting with client applications.
 * 
 * @author rob
 */
class Service {

	constructor(conn) {
		this.conn = conn;
	}

	// Get the data at the URL by GET.
	httpsGet(url) {
		return new Promise((resolve, reject) => {
			let data = '';
			http.get(url, res => {
				// Read each chunk of the data list.
				res.on('data', chunk => {
					data += chunk;
				});
				// When lis tis loaded...
				res.on('end', res => {
					resolve(data);
				});

				res.on('error', err => {
					reject(err);
				});
			});
		});
	}

	/**
	*/
	async createDB() {

		function toTitleCase(str) {
	 		let lw = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'as', 'at', 
	  			'by', 'for', 'from', 'in', 'into', 'near', 'of', 'on', 'onto', 'to', 'with']);
	        str = str.replace(
	            /\w\S*/g,
	            txt => {
	            	txt = txt.toLowerCase();
	            	if(!lw.has(txt))
						txt = txt.charAt(0).toUpperCase() + txt.substr(1);
	           		return txt;
	            }
	        );
	        str = str.charAt(0).toUpperCase() + str.substr(1);
	        return str;
	    }
		
		function stripQuotes(str) {
			str = str.trim();
			while(str.charAt(0) == '"')
				str = str.substr(1);
			while(str.charAt(str.length - 1) == '"')
				str = str.substr(0, str.length - 1);
			return str;
		}

		const client = await this.conn.connect();

		try {
			// Create the database if needed.
			await client.query('BEGIN');

			SQL_CREATE_DB.forEach(async(ddl) => { 
				await client.query(ddl);
			});
				
			await client.query('COMMIT');

			// Acquire the station list.
			let data = await this.httpsGet(URL_STATIONS);

			// Split up the lines.
			data = data.split('\n').slice(1); // skip header.

			await client.query('BEGIN');

			// Iterate over the lines splitting each into rows.
			for(let i = 0; i < data.length; ++i) {
				let row = data[i].split(',');
				let x = parseFloat(row[3]);
				let y = parseFloat(row[2]);
				if(isNaN(x) || isNaN(y)) {
					console.log('Invalid coordinates.');
					continue;
				}
				let geom = `POINT(${x} ${y})`;
				let tz = row[5].substr(3).split(':');
				let id = row[0];
				let name = stripQuotes(toTitleCase(row[1]));
				let prov = row[4];
				
				tz = parseFloat(tz[0]) + parseFloat(tz[1]) / 60.0;

				// Create and insert the stations.
				try {
					await client.query(SQL_INSERT_STATION, [id, name, prov, tz, geom]);
				} catch(err) {
					console.log(err);
				}
			}

			await client.query('COMMIT');

		} catch(err) {
			await client.query('ROLLBACK');
			throw e;
		} finally {
			client.release();
		}
	}

	configureApp(app, prefix) {

		function getN(q) {
			let n = 100;
			if(q.n)
				n = parseInt(q.n);
			if(isNaN(n))
				n = 100;
			return n;
		}

		function getBounds(q) {
			let xmin = parseFloat(q.xmin);
			let ymin = parseFloat(q.ymin);
			let xmax = parseFloat(q.xmax);
			let ymax = parseFloat(q.ymax);
			return [
				isNaN(xmin) ? -180.0 : xmin,
				isNaN(ymin) ? -90.0 : ymin,
				isNaN(xmax) ? 180.0 : xmax,
				isNaN(ymax) ? 90.0 : ymax
			];
		}

		this.mult = multer();

		/**
		 * A REST service method. Provides the list of readings.
		 */
		app.get(prefix + "/readings/:id/:n?", (req, res) => {
			let id = req.params.id;
			let n = getN(req.params);
			this.getReadings(id, n).then(result => {
				res.send({result: result});
			}).catch(err => {
				res.send({error: err.toString()});
			});
		});

		/**
		 * A REST service method. Provides the station with the given ID, or the
		 * list of stations within the given bounds, or the list of stations
		 * matching the given search term (searches against the name).
		 */
		app.get(prefix + "/stations/:id", (req, res) => {
			let id = req.params.id;
			let result = null;
			let error = null;
			if (!id) {
				if (req.query.search) {
					this.searchStations(req.query.search).then(stations => {
						res.send({result: stations});
					}).catch(err => {
						res.send({error: err.toString()});
					});
				} else if (req.query.xmin) {
					this.getStations.apply(this, getBounds(req.query)).then(stations => {
						res.send({result: stations});
					}).catch(err => {
						res.send({error: err.toString()});
					});
				}
			} else {
				this.getStation(id).then(station => {
					res.send({result: [station]});
				}).catch(err => {
					res.send({error: err.toString()});
				});
			}
		});

		app.post(prefix + "/stations", this.mult.none(), (req, res) => {
			let result = null;
			let error = null;
			if (req.body.search) {
				console.log(req.body.search);
				this.searchStations(req.body.search).then(stations => {
					res.send({result: stations});
				}).catch(err => {
					res.send({error: err.toString()});
				});
			} else if (req.body.xmin) {
				this.getStations.apply(this, getBounds(req.body)).then(stations => {
					res.send({result: stations});
				}).catch(err => {
					console.log('err', err);
					res.send({error: err.toString()});
				});
			}
		});
	}

	/**
	 * Check whether an ID is likely to be valid.
	 * 
	 * @param id
	 */
	checkId(id) {
		let _id = null;
		if (id != null)
			_id = id.replace(/[^a-zA-Z0-9]/g, "");
		if (id == null || _id == '')
			throw new Error("Invalid ID: " + id);
	}

	/**
	 * Check whether a count is valid.
	 * 
	 * @param n
	 */
	checkCount(n) {
		if (n < 1 || n > 100)
			throw new Error("Bad count: " + n);
	}

	/**
	 * Query the last update age (hours) for the given station. If no station is
	 * found, return positive infinity.
	 * 
	 * @param id
	 * @return
	 * @throws SQLException
	 */
	async getLastUpdate(id, _client = null) {
		let client = _client || await this.conn.connect();
		try {
			let ret = Number.MAX_VALUE;
			let res = await client.query(SQL_GET_UPTIME, [id]);
			if(res.rows.length > 0)
				ret = res.rows[0].hasUpdate ? res.rows[0].age : Number.MAX_VALUE;
			return ret;
		} catch(err) {
			console.log(err);
			return Number.MAX_VALUE;
		} finally {
			if(!_client)
				client.release();
		}
	}

	/**
	 * Save the last update time for the given station.
	 * 
	 * @param id
	 */
	async setLastUpdate(id, _client = null) {
		let client = _client || await this.conn.connect();
		try {		
			await client.query(SQL_SET_UPTIME, [id]);
		} catch(err) {
			console.log(err);
		} finally {
			if(!_client)
				client.release();
		}
	}

	/**
	 * Download the data file for the given station, save to the DB.
	 * 
	 * @param id
	 * @param prov
	 */
	async download(id, prov, _client = null) {

		let client = _client || await this.conn.connect();

		try {
	
			// If the last update was <1 hour ago, don't bother.
			if (this.getLastUpdate(id, client) <= 1.0)
				return;

			await client.query('BEGIN');

			// Delete existing readings to preserve space.
			///await client.query(SQL_DELETE_READINGS, [id]);

			// Download the file.
			let url = URL_TPL.replace(/{prov}/g, prov).replace(/{id}/g, id);
			let data = await this.httpsGet(url);
				
			data = data.split('\r\n').slice(1); // skip header.

			for(let i = 0; i < data.length; ++i) {
				let row = data[i].split(",");
				if(row.length < 9)
					continue;
				let level = -9999.0;
				let discharge = -9999.0;
				let readtime = 0;
				try {
					level = parseFloat(row[2].trim());
				} catch (err) {
					console.log(err);
				}
				try {
					discharge = parseFloat(row[6].trim());
				} catch (err) {
					console.log(err);
				}
				try {
					//2020-07-20T00:00:00-08:00
					readtime = Date.parse(row[1].trim()) / 1000.0;
				} catch (err) {
					console.log(err);
				}
				
				await client.query(SQL_INSERT_READING, [id, readtime, level, discharge]);
				await client.query(SQL_SET_UPTIME, [id]);
			}

			await client.query('COMMIT');

		} catch(err) {
			client.query('ROLLBACK');
			console.log(err);
		} finally {
			if(!_client)
				client.release();
		}
	}

	/**
	 * Requests an update of the data for a station, which only occurs if the
	 * data is >1 hour old.
	 * 
	 * @param id
	 */
	async update(id, _client = null) {
		this.checkId(id);
		let client = _client || await this.conn.connect();
		try {
			// Check to see if it needs an update.
			let res = await client.query(SQL_GET_READING_AGE, [id]);
			let prov = null;
			let age = Number.MAX_VALUE;
			let hasAge = false;
			res.rows.forEach(row => {
				prov = row.prov;
				age = row.age;
				hasAge = row.hasAge;
			});
			// If it needs an update, download it.
			if (!hasAge || age > 1.0)
				await this.download(id, prov, client);
		} catch(err) {
			throw new Error('Failed to update station: ' + err.toString());
		} finally {
			if(!_client)
				client.release();
		}
	}

	/**
	 * Gets the latest n readings for the given station. Returns a map with a
	 * "station" item containing the station, and a "readings" property, which
	 * is a list of readings.
	 * 
	 * @param n
	 */
	async getReadings(id, n, _client = null) {
		this.checkId(id);
		this.checkCount(n);
		let client = _client || await this.conn.connect();
		try {
			// Try to update the readings.
			await this.update(id, client)
			let result = {station: null, readings: []};
			let res = await client.query(SQL_LATEST_READINGS, [id, n]);
			res.rows.forEach(row => {
				result.readings.push(new Reading(row));
			});
			result.station = new Station(await this.getStation(id, client));
			return result;
		} catch(err) {
			throw new Error('Failed to get readings: ' + err.toString());
		} finally {
			if(!_client)
				client.release();
		}		
	}

	/**
	 * Returns the stations within the given bounding rectangle.
	 * 
	 * @param xmin
	 * @param ymin
	 * @param xmax
	 * @param ymax
	 */
	async getStations(xmin, ymin, xmax, ymax, _client = null) {
		let client = _client || await this.conn.connect();
		try {
			let geom = `POLYGON((${xmin} ${ymin}, ${xmax} ${ymin}, ${xmax} ${ymax}, ${xmin} ${ymax}, ${xmin} ${ymin}))`;
			let res = await client.query(SQL_STATIONS_GEOM, [geom]);
			let stations = [];
			res.rows.forEach(row => {  
				stations.push(new Station(row));
			});
			return stations;
		} catch(err) {
			throw new Error('Failed to load stations: ' + err.toString());
		} finally {
			if(!_client)
				client.release();
		}
	}

	/**
	 * Searches station names using the given term.
	 * 
	 * @param term
	 */
	async searchStations(term, _client = null) {
		let client = _client || await this.conn.connect();
		try {
			term = term.replace(/[^a-zA-Z0-9]/g, "");
			const res = await client.query(SQL_SEARCH, [term]);
			let stations = [];
			res.rows.forEach(row => {
				let s = new Station(row);
				stations.push(s);
			});
			return stations;
		} catch (err) {
			throw new Error("Failed to search stations: " + err.toString());
		} finally {
			if(!_client)
				client.release();
		}
	}

	/**
	 * Gets the station with the given ID.
	 * 
	 * @param id
	 */
	async getStation(id, _client = null) {
		let client = _client || await this.conn.connect();
		try {
			let res;
			if(id == 'random') {
				res = await client.query(SQL_RANDOM_STATION);
			} else {
				res = await client.query(SQL_STATION, [id]);
			}
			if(res.rows.length > 0)
				return new Station(res.rows[0]);
			return null;
		} catch (err) {
			throw new Error("Failed to load stations: " + err.toString());
		} finally {
			if(!_client)
				client.release();
		}
	}

}


module.exports = Service;
