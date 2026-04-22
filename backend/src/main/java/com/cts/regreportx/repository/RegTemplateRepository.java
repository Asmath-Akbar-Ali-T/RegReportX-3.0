package com.cts.regreportx.repository;

import com.cts.regreportx.model.RegTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RegTemplateRepository extends JpaRepository<RegTemplate, Integer> {
}
