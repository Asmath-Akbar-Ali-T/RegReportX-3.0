import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class TestDB {
    public static void main(String[] args) {
        try {
            Connection conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/bank", "root", "root");
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SELECT raw_recordid, payloadjson FROM raw_record LIMIT 5;");
            while (rs.next()) {
                System.out.println("ID: " + rs.getInt("raw_recordid"));
                System.out.println("Payload: " + rs.getString("payloadjson"));
                System.out.println("-------------------------");
            }
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
