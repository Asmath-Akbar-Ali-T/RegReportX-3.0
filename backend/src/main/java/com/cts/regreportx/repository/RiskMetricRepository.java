package com.cts.regreportx.repository;

import com.cts.regreportx.model.RiskMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;
@Repository
public interface RiskMetricRepository extends JpaRepository<RiskMetric, Integer> {
    
    @Transactional
    @Modifying
    @Query("DELETE FROM RiskMetric r WHERE r.report.reportId = :reportId")
    void deleteByReport_ReportId(Integer reportId);
    
    List<RiskMetric> findByReport_ReportId(Integer reportId);
    
    Optional<RiskMetric> findByReport_ReportIdAndMetricName(Integer reportId, String metricName);
}
