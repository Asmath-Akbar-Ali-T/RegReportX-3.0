package com.cts.regreportx.config;

import com.cts.regreportx.model.User;
import com.cts.regreportx.repository.UserRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AppConfig {

    @Bean
    public CommandLineRunner initDatabase(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() == 0) {
                User admin = new User();
                admin.setName("DILIP");
                admin.setUsername("Dilipkumar11");
                admin.setEmail("Dilipkumar11@cognizant.com");
                admin.setPassword(passwordEncoder.encode("1234@"));
                admin.setRole("REGTECH_ADMIN");
                admin.setStatus("ACTIVE");
                admin.setCreatedAt(java.time.LocalDateTime.now());
                userRepository.save(admin);

                User kishore = new User();
                kishore.setName("Kishore");
                kishore.setUsername("Kishore");
                kishore.setEmail("Kishore@cognizant.com");
                kishore.setPassword(passwordEncoder.encode("1234@"));
                kishore.setRole("COMPLIANCE_ANALYST");
                kishore.setStatus("ACTIVE");
                kishore.setCreatedAt(java.time.LocalDateTime.now());
                userRepository.save(kishore);

                User nandhana = new User();
                nandhana.setName("Nandhana");
                nandhana.setUsername("Nandhana");
                nandhana.setEmail("Nandhana@cognizant.com");
                nandhana.setPassword(passwordEncoder.encode("1234@"));
                nandhana.setRole("RISK_ANALYST");
                nandhana.setStatus("ACTIVE");
                nandhana.setCreatedAt(java.time.LocalDateTime.now());
                userRepository.save(nandhana);

                User niranjana = new User();
                niranjana.setName("Niranjana");
                niranjana.setUsername("Niranjana");
                niranjana.setEmail("Niranjana@cognizant.com");
                niranjana.setPassword(passwordEncoder.encode("1234@"));
                niranjana.setRole("REPORTING_OFFICER");
                niranjana.setStatus("ACTIVE");
                niranjana.setCreatedAt(java.time.LocalDateTime.now());
                userRepository.save(niranjana);

                User asmath = new User();
                asmath.setName("Asmath");
                asmath.setUsername("Asmath");
                asmath.setEmail("Asmath@cognizant.com");
                asmath.setPassword(passwordEncoder.encode("1234@"));
                asmath.setRole("OPERATIONS_OFFICER");
                asmath.setStatus("ACTIVE");
                asmath.setCreatedAt(java.time.LocalDateTime.now());
                userRepository.save(asmath);

                System.out.println("Inserted 5 default actors (Dilip, Kishore, Nandhana, Niranjana, Asmath).");
            }
        };
    }
}
