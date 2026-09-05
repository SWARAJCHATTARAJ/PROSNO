import java.sql.Connection;
import java.sql.DriverManager;

public class TestDB {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://db.vppqpdooslzyvcobaqsu.supabase.co:5432/postgres?sslmode=require";
        String user = "postgres";
        String password = "SbWvye?PrNVL^";
        
        try {
            Connection conn = DriverManager.getConnection(url, user, password);
            System.out.println("Connection successful!");
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
