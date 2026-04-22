package com.cts.regreportx.repository;

import com.cts.regreportx.model.RawDataBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RawDataBatchRepository extends JpaRepository<RawDataBatch, Integer> {
}
