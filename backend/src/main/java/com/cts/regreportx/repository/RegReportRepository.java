package com.cts.regreportx.repository;

import com.cts.regreportx.model.RegReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RegReportRepository extends JpaRepository<RegReport, Integer> {
}
