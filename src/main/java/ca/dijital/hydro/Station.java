package ca.dijital.hydro;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Date;

import org.postgis.PGgeometry;
import org.postgis.Point;

public class Station {

	private long gid;
	private String id;
	private String name;
	private String prov;
	private double lat;
	private double lon;
	private Date lastUpdate;
	
	public static Station fromResultSet(ResultSet rslt) throws SQLException {
		Station s = new Station();
		Point pt = (Point) ((PGgeometry) rslt.getObject("geom")).getGeometry();
		s.setGid(rslt.getLong("gid"));
		s.setId(rslt.getString("id"));
		s.setLat(pt.y);
		s.setLon(pt.x);
		s.setName(rslt.getString("name"));
		s.setProv(rslt.getString("prov"));
		s.setLastUpdate(rslt.getTimestamp("lastupdate"));
		return s;
	}
	
	public long getGid() {
		return gid;
	}
	public void setGid(long gid) {
		this.gid = gid;
	}
	public String getId() {
		return id;
	}
	public void setId(String id) {
		this.id = id;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public String getProv() {
		return prov;
	}
	public void setProv(String prov) {
		this.prov = prov;
	}
	public double getLat() {
		return lat;
	}
	public void setLat(double lat) {
		this.lat = lat;
	}
	public double getLon() {
		return lon;
	}
	public void setLon(double lon) {
		this.lon = lon;
	}

	public Date getLastUpdate() {
		return lastUpdate;
	}

	public void setLastUpdate(Date lastUpdate) {
		this.lastUpdate = lastUpdate;
	}
	
}
