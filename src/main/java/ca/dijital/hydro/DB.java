package ca.dijital.hydro;

import java.sql.Connection;

import javax.naming.InitialContext;
import javax.sql.DataSource;

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
			DataSource ds = (DataSource) new InitialContext().lookup("java:/comp/env/jdbc/hydro");			
			Connection conn = ds.getConnection();
		    return conn;
		} catch (Exception e) {
			e.printStackTrace();
			return null;
		}
	}
}
