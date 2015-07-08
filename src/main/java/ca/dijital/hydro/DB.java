package ca.dijital.hydro;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

/**
 * Simple class for getting a DB connection.
 * 
 * @author rob
 */
public class DB {

	/**
	 * Returns a {@link Connection}.
	 * @return A {@link Connection}.
	 */
	public static Connection getConnection() {
		try {
			Class.forName("org.postgresql.Driver").newInstance();
			
			Properties props = new Properties();
			props.setProperty("user", "rob");
			Connection conn = DriverManager.getConnection(
					"jdbc:postgresql://localhost/hydro", props);
			((org.postgresql.PGConnection)conn).addDataType("geometry", Class.forName("org.postgis.PGgeometry"));
		    ((org.postgresql.PGConnection)conn).addDataType("box3d", Class.forName("org.postgis.PGbox3d"));
		    return conn;
		} catch (Exception e) {
			e.printStackTrace();
			return null;
		}
	}
}
