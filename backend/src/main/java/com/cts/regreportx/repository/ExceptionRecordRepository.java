package com.cts.regreportx.repository;

import com.cts.regreportx.model.ExceptionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExceptionRecordRepository extends JpaRepository<ExceptionRecord, Integer> {
    List<ExceptionRecord> findByStatus(String status);
}
