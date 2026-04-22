package com.cts.regreportx.repository;

import com.cts.regreportx.model.RawRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RawRecordRepository extends JpaRepository<RawRecord, Integer> {
    List<RawRecord> findByBatch_BatchId(Integer batchId);
}
