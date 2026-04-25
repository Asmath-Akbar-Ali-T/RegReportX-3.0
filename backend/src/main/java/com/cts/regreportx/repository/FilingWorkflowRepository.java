package com.cts.regreportx.repository;

import com.cts.regreportx.model.FilingWorkflow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FilingWorkflowRepository extends JpaRepository<FilingWorkflow, Integer> {
    List<FilingWorkflow> findByReport_ReportIdOrderByStepDateAsc(Integer reportId);
}
