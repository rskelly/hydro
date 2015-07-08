package ca.dijital.hydro;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Date;

public class Reading {

	private long rid;
	private String id;
	private Date readTime;
	private double level;
	private double discharge;
	private String province;
	
	public static Reading fromResultSet(ResultSet rslt) throws SQLException {
		Reading r = new Reading();
		r.setRid(rslt.getLong("rid"));
		r.setDischarge(rslt.getDouble("discharge"));
		r.setId(rslt.getString("id"));
		r.setLevel(rslt.getDouble("level"));
		r.setProvince(rslt.getString("prov"));
		r.setReadTime(rslt.getTimestamp("readtime"));
		return r;
	}
	
	public String toString() {
		return String.format("[Reading: %s, %s, %f, %f]", getId(), getReadTime().toString(), getLevel(), getDischarge());
	}
	
	public long getRid() {
		return rid;
	}
	public void setRid(long rid) {
		this.rid = rid;
	}
	public String getId() {
		return id;
	}
	public void setId(String id) {
		this.id = id;
	}
	public Date getReadTime() {
		return readTime;
	}
	public void setReadTime(Date readingTime) {
		this.readTime = readingTime;
	}
	public double getLevel() {
		return level;
	}
	public void setLevel(double level) {
		this.level = level;
	}
	public double getDischarge() {
		return discharge;
	}
	public void setDischarge(double discharge) {
		this.discharge = discharge;
	}
	public String getProvince() {
		return province;
	}
	public void setProvince(String province) {
		this.province = province;
	}
	
}
