package com.cts.regreportx.repository;

import com.cts.regreportx.model.DataQualityIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public interface DataQualityIssueRepository extends JpaRepository<DataQualityIssue, Integer> {
    List<DataQualityIssue> findByStatus(String status);
}
