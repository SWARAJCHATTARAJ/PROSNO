import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

public class TestDB2 {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://db.vppqpdooslzyvcobaqsu.supabase.co:5432/postgres?sslmode=require";
        String user = "postgres";
        String[] passwords = {"SbWvye?PrNVL^", "SbWvye?PrNVL%5e", "SbWvye?PrNVL"};

        for (String p : passwords) {
            try {
                System.out.println("Trying password: " + p);
                Connection conn = DriverManager.getConnection(url, user, p);
                System.out.println("Connection successful with: " + p);
                conn.close();
                return;
            } catch (Exception e) {
                System.out.println("Failed: " + e.getMessage());
            }
        }
    }
}
