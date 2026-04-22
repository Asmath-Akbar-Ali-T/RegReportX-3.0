package com.cts.regreportx.repository;

import com.cts.regreportx.model.GeneralLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GeneralLedgerRepository extends JpaRepository<GeneralLedger, String> {
}
