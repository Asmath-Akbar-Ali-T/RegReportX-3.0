package com.cts.regreportx.repository;

import com.cts.regreportx.model.TreasuryTrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TreasuryTradeRepository extends JpaRepository<TreasuryTrade, String> {
}
