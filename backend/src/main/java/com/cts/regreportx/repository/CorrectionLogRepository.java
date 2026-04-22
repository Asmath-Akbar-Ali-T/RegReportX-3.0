package com.cts.regreportx.repository;

import com.cts.regreportx.model.CorrectionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CorrectionLogRepository extends JpaRepository<CorrectionLog, Integer> {
}
