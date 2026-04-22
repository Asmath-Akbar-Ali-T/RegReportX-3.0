package com.cts.regreportx.service;

import com.cts.regreportx.model.Deposit;
import com.cts.regreportx.model.GeneralLedger;
import com.cts.regreportx.model.Loan;
import com.cts.regreportx.model.TreasuryTrade;
import com.cts.regreportx.repository.DepositRepository;
import com.cts.regreportx.repository.GeneralLedgerRepository;
import com.cts.regreportx.repository.LoanRepository;
import com.cts.regreportx.repository.TreasuryTradeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SourceDataService {

    private final LoanRepository loanRepository;
    private final DepositRepository depositRepository;
    private final TreasuryTradeRepository treasuryTradeRepository;
    private final GeneralLedgerRepository generalLedgerRepository;

    @Autowired
    public SourceDataService(LoanRepository loanRepository,
            DepositRepository depositRepository,
            TreasuryTradeRepository treasuryTradeRepository,
            GeneralLedgerRepository generalLedgerRepository) {
        this.loanRepository = loanRepository;
        this.depositRepository = depositRepository;
        this.treasuryTradeRepository = treasuryTradeRepository;
        this.generalLedgerRepository = generalLedgerRepository;
    }

    public List<Loan> getAllLoans() {
        return loanRepository.findAll();
    }

    public List<Deposit> getAllDeposits() {
        return depositRepository.findAll();
    }

    public List<TreasuryTrade> getAllTreasuryTrades() {
        return treasuryTradeRepository.findAll();
    }

    public List<GeneralLedger> getAllGeneralLedgers() {
        return generalLedgerRepository.findAll();
    }
}
