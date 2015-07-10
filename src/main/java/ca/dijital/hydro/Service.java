package ca.dijital.hydro;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URL;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.xml.bind.DatatypeConverter;

import ca.dijital.http.rest.HttpMethod;
import ca.dijital.http.rest.RestMethod;
import ca.dijital.http.rest.RestMethodContext;

/**
 * Provides methods for accessing data. Provides REST-enabled methods for
 * interacting with client applications.
 * 
 * @author rob
 */
public class Service {

	/**
	 * Returns a list of the latest readings for a station, grouped by hour,
	 * with the latest result for each hour.
	 */
	private static final String SQL_LATEST_READINGS = "select distinct on (date_trunc('day', readtime)) readings.*, stations.prov from stations inner join readings using(id) where id=? order by date_trunc('day', readtime) desc limit ?";

	/**
	 * Gets the age of the last reading for a station in hours.
	 */
	private static final String SQL_GET_READING_AGE = "select tz, prov, readtime is not null as hasage, extract(epoch from ?::timestamp with time zone - readtime)/3600.0 as age from stations left join readings using(id) where id=? order by readtime desc limit 1";

	/**
	 * Insert a reading.
	 */
	private static final String SQL_INSERT_READING = "insert into readings (id, readtime, level, discharge) values (?, ?, ?, ?)"; // on

	/**
	 * Query the stations list given a polygon.
	 */
	private static final String SQL_STATIONS_GEOM = "select * from stations where st_contains(st_geomfromtext(?, 4326), geom) order by random() limit 100";

	/**
	 * Set the last update time for a station.
	 */
	private static final String SQL_SET_UPTIME = "update stations set lastupdate=current_timestamp where id=?";

	/**
	 * Get the last update time for a station.
	 */
	private static final String SQL_GET_UPTIME = "select lastupdate is not null as hasupdate, extract(epoch from current_timestamp-lastupdate)/3600.0 as age from stations where id=?";

	/**
	 * Query a station by ID.
	 */
	private static final String SQL_STATION = "select * from stations where id=?";

	/**
	 * Returns the ID of a random station.
	 */
	private static final String SQL_RANDOM_STATION = "select id from stations order by random() limit 1";

	/**
	 * Perform a trigram search against the station names.
	 */
	private static final String SQL_SEARCH = "select *, similarity(name, '%s') as s from stations order by s desc limit 100";

	/**
	 * Delete readings for a station.
	 */
	private static final String SQL_DELETE_READINGS = "delete from readings where id=?";

	/**
	 * Data file URL template.
	 */
	private static final String URL_TPL = "http://dd.weather.gc.ca/hydrometric/csv/%s/daily/%s_%s_daily_hydrometric.csv";

	/**
	 * A REST service method. Provides the list of readings.
	 * 
	 * @param ctx
	 * @return
	 * @throws Exception
	 */
	@RestMethod(value = "/readings/{id}/{n}")
	public Object getReadings(RestMethodContext ctx) throws Exception {
		Map<String, String> params = ctx.getPathParameters();
		String id = params.get("id");
		if("random".equals(id))
			id = getRandomStationId();
		int n = 10;
		try {
			n = Integer.parseInt(params.get("n"));
		} catch (Exception e) {
			n = 100;
		}
		return getReadings(id, n);
	}

	/**
	 * A REST service method. Provides the station with the given ID, or the
	 * list of stations within the given bounds, or the list of stations
	 * matching the given search term (searches against the name).
	 * 
	 * @param ctx
	 * @return
	 * @throws Exception
	 */
	@RestMethod(value = "/stations/[id]", methods = { HttpMethod.GET, HttpMethod.POST })
	public List<Station> getStations(RestMethodContext ctx) throws Exception {
		Map<String, String> params = ctx.getPathParameters();
		String id = params.get("id");
		if (id == null || "".equals(id)) {
			Map<String, String> pparams = ctx.getRequest().getParameters();
			if (pparams.containsKey("search")) {
				return searchStations(pparams.get("search"));
			} else if (pparams.containsKey("xmin")) {
				double xmin = Double.parseDouble(pparams.get("xmin"));
				double ymin = Double.parseDouble(pparams.get("ymin"));
				double xmax = Double.parseDouble(pparams.get("xmax"));
				double ymax = Double.parseDouble(pparams.get("ymax"));
				return getStations(xmin, ymin, xmax, ymax);
			}
		} else {
			List<Station> stations = new ArrayList<Station>();
			Station s = getStation(id);
			stations.add(s);
			return stations;
		}
		throw new Exception("Invalid request.");
	}

	/**
	 * Check whether an ID is likely to be valid.
	 * 
	 * @param id
	 */
	private void checkId(String id) {
		String _id = null;
		if (id != null)
			_id = id.replaceAll("[^a-zA-Z0-9]", "");
		if (id == null || "".equals(_id))
			throw new IllegalArgumentException("Invalid ID: " + id);
	}

	/**
	 * Check whether a count is valid.
	 * 
	 * @param n
	 */
	private void checkCount(int n) {
		if (n < 1 || n > 100)
			throw new IllegalArgumentException("Bad count: " + n);
	}

	/**
	 * Query the last update age (hours) for the given station. If no station is
	 * found, return positive infinity.
	 * 
	 * @param id
	 * @param conn
	 * @return
	 * @throws SQLException
	 */
	private float getLastUpdate(String id, Connection conn) throws SQLException {
		PreparedStatement stmt = conn.prepareStatement(SQL_GET_UPTIME);
		stmt.setString(1, id);
		ResultSet rslt = stmt.executeQuery();
		if (rslt.next()) {
			float age = rslt.getFloat("age"); // hours.
			boolean hasUpdate = rslt.getBoolean("hasupdate");
			return hasUpdate ? age : Float.MAX_VALUE;
		} else {
			return Float.MAX_VALUE;
		}
	}

	/**
	 * Save the last update time for the given station.
	 * 
	 * @param id
	 * @param conn
	 * @throws SQLException
	 */
	private void setLastUpdate(String id, Connection conn) throws SQLException {
		PreparedStatement stmt = conn.prepareStatement(SQL_SET_UPTIME);
		stmt.setString(1, id);
		stmt.execute();
	}

	/**
	 * Download the data file for the given station, save to the DB.
	 * 
	 * @param id
	 * @param prov
	 * @param conn
	 * @throws Exception
	 * @throws IOException
	 * @throws SQLException
	 * @throws ParseException
	 */
	private void download(String id, String prov, Connection conn) throws Exception {
		// If the last update was <1 hour ago, don't bother.
		if (getLastUpdate(id, conn) <= 1.0)
			return;

		BufferedReader r;
		try {

			conn.setAutoCommit(false);

			// Delete existing readings to preserve space.
			PreparedStatement stmt = conn.prepareStatement(SQL_DELETE_READINGS);
			stmt.setString(1, id);
			stmt.execute();
			stmt.close();

			stmt = conn.prepareStatement(SQL_INSERT_READING);

			// Download the file.
			URL url = new URL(String.format(URL_TPL, prov, prov, id));
			r = new BufferedReader(new InputStreamReader(url.openStream()));

			String line;
			double level;
			double discharge;
			Timestamp readtime;

			// Discard the header line.
			r.readLine();
			while ((line = r.readLine()) != null) {
				String[] row = line.split(",");
				try {
					level = Double.parseDouble(row[2].trim());
				} catch (Exception e) {
					level = -9999.0;
				}
				try {
					discharge = Double.parseDouble(row[6].trim());
				} catch (Exception e) {
					discharge = -9999.0;
				}
				readtime = new Timestamp(DatatypeConverter.parseDateTime(row[1].trim()).getTime().getTime());

				stmt.setString(1, id);
				stmt.setTimestamp(2, readtime);
				stmt.setDouble(3, level);
				stmt.setDouble(4, discharge);
				stmt.addBatch();
			}
			r.close();

			stmt.executeBatch();
			stmt.close();

			setLastUpdate(id, conn);

			conn.commit();

		} catch (SQLException | IOException e) {
			try {
				conn.rollback();
			} catch (SQLException ex) {
			}
			throw new Exception("Failed to download and save readings.", e);
		} finally {
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {
			}
		}
	}

	/**
	 * Requests an update of the data for a station, which only occurs if the
	 * data is >1 hour old.
	 * 
	 * @param id
	 * @param conn
	 * @throws Exception
	 */
	private void update(String id, Connection conn) throws Exception {
		checkId(id);
		try {
			PreparedStatement stmt = conn.prepareStatement(SQL_GET_READING_AGE);
			stmt.setTimestamp(1, new java.sql.Timestamp(new Date().getTime()));
			stmt.setString(2, id);
			ResultSet rslt = stmt.executeQuery();

			String prov = null;
			float age = 100;
			boolean hasAge = false;
			if (rslt.next()) {
				prov = rslt.getString("prov");
				age = rslt.getFloat("age");
				hasAge = rslt.getBoolean("hasage");
			}

			rslt.close();
			stmt.close();

			if (!hasAge || age > 1.0)
				download(id, prov, conn);

		} catch (SQLException e) {
			throw new Exception("Failed to update readings.", e);
		}
	}

	/**
	 * Gets the latest n readings for the given station. Returns a map with a
	 * "station" item containing the station, and a "readings" property, which
	 * is a list of readings.
	 * 
	 * @param n
	 * @return
	 * @throws Exception
	 */
	public Object getReadings(String id, int n) throws Exception {
		checkId(id);
		checkCount(n);
		Connection conn = DB.getConnection();
		try {
			// Try to update the readings.
			update(id, conn);

			PreparedStatement stmt = conn.prepareStatement(SQL_LATEST_READINGS);
			stmt.setString(1, id);
			stmt.setInt(2, n);
			ResultSet rslt = stmt.executeQuery();
			List<Reading> readings = new ArrayList<Reading>();
			while (rslt.next()) {
				Reading r = Reading.fromResultSet(rslt);
				readings.add(r);
			}

			rslt.close();
			stmt.close();

			Station s = getStation(id, conn);

			Map<String, Object> result = new HashMap<String, Object>();
			result.put("station", s);
			result.put("readings", readings);

			return result;
		} catch (SQLException e) {
			throw new Exception("Failed to load readings.", e);
		} finally {
			try {
				conn.close();
			} catch (Exception e) {
			}
		}
	}

	/**
	 * Returns the stations within the given bounding rectangle.
	 * 
	 * @param xmin
	 * @param ymin
	 * @param xmax
	 * @param ymax
	 * @param conn
	 * @return
	 * @throws Exception
	 */
	public List<Station> getStations(double xmin, double ymin, double xmax, double ymax, Connection conn)
			throws Exception {
		try {
			PreparedStatement stmt = conn.prepareStatement(SQL_STATIONS_GEOM);
			String geom = String.format("POLYGON((%f %f, %f %f, %f %f, %f %f, %f %f))", xmin, ymin, xmax, ymin, xmax,
					ymax, xmin, ymax, xmin, ymin);
			stmt.setString(1, geom);
			ResultSet rslt = stmt.executeQuery();
			List<Station> stations = new ArrayList<Station>();
			while (rslt.next()) {
				Station s = Station.fromResultSet(rslt);
				stations.add(s);
			}
			rslt.close();
			stmt.close();
			return stations;
		} catch (SQLException e) {
			throw new Exception("Failed to load stations.", e);
		}
	}

	/**
	 * Returns the stations within the given bounding rectangle.
	 * 
	 * @param xmin
	 * @param ymin
	 * @param xmax
	 * @param ymax
	 * @return
	 * @throws Exception
	 */
	public List<Station> getStations(double xmin, double ymin, double xmax, double ymax) throws Exception {
		Connection conn = DB.getConnection();
		try {
			return getStations(xmin, ymin, xmax, ymax, conn);
		} finally {
			try {
				conn.close();
			} catch (Exception e) {
			}
		}
	}

	/**
	 * Searches station names using the given term.
	 * 
	 * @param term
	 * @param conn
	 * @return
	 * @throws Exception
	 */
	public List<Station> searchStations(String term, Connection conn) throws Exception {
		try {
			term = term.replaceAll("[^a-zA-Z0-9]", "");
			String query = String.format(SQL_SEARCH, term);
			PreparedStatement stmt = conn.prepareStatement(query);
			ResultSet rslt = stmt.executeQuery();
			List<Station> stations = new ArrayList<Station>();
			while (rslt.next()) {
				Station s = Station.fromResultSet(rslt);
				stations.add(s);
			}
			rslt.close();
			stmt.close();
			return stations;
		} catch (SQLException e) {
			throw new Exception("Failed to search stations.", e);
		}
	}

	/**
	 * Searches station names using the given term.
	 * 
	 * @param term
	 * @return
	 * @throws Exception
	 */
	public List<Station> searchStations(String term) throws Exception {
		Connection conn = DB.getConnection();
		try {
			return searchStations(term, conn);
		} finally {
			try {
				conn.close();
			} catch (Exception e) {
			}
		}
	}

	/**
	 * Gets the station with the given ID.
	 * 
	 * @param id
	 * @return
	 * @throws Exception
	 */
	public Station getStation(String id) throws Exception {
		Connection conn = DB.getConnection();
		try {
			return getStation(id, conn);
		} finally {
			try {
				conn.close();
			} catch (Exception e) {
			}
		}
	}

	/**
	 * Gets the station with the given ID.
	 * 
	 * @param id
	 * @param conn
	 * @return
	 * @throws Exception
	 */
	public Station getStation(String id, Connection conn) throws Exception {
		try {
			PreparedStatement stmt = conn.prepareStatement(SQL_STATION);
			stmt.setString(1, id);
			ResultSet rslt = stmt.executeQuery();
			Station s = null;
			if (rslt.next())
				s = Station.fromResultSet(rslt);
			rslt.close();
			stmt.close();
			return s;
		} catch (SQLException e) {
			throw new Exception("Failed to load stations.", e);
		}
	}

	/**
	 * Gets the ID of a random station.
	 * 
	 * @return
	 * @throws Exception
	 */
	public String getRandomStationId() throws Exception {
		Connection conn = DB.getConnection();
		try {
			PreparedStatement stmt = conn.prepareStatement(SQL_RANDOM_STATION);
			ResultSet rslt = stmt.executeQuery();
			String id = null;
			if (rslt.next())
				id = rslt.getString("id");
			rslt.close();
			stmt.close();
			return id;
		} finally {
			try {
				conn.close();
			} catch (Exception e) {
			}
		}
	}


}
