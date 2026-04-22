package com.cts.regreportx.repository;

import com.cts.regreportx.model.ValidationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ValidationRuleRepository extends JpaRepository<ValidationRule, Integer> {
    ValidationRule findByName(String name);
    List<ValidationRule> findByStatus(String status);
}
