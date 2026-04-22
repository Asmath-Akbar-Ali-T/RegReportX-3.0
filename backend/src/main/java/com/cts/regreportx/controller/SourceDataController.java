package com.cts.regreportx.controller;

import com.cts.regreportx.dto.DepositDTO;
import com.cts.regreportx.dto.GeneralLedgerDTO;
import com.cts.regreportx.dto.LoanDTO;
import com.cts.regreportx.dto.TreasuryTradeDTO;
import com.cts.regreportx.model.Deposit;
import com.cts.regreportx.model.GeneralLedger;
import com.cts.regreportx.model.Loan;
import com.cts.regreportx.model.TreasuryTrade;
import com.cts.regreportx.service.SourceDataService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAnyRole('REGTECH_ADMIN', 'OPERATIONS_OFFICER','COMPLIANCE_ANALYST')")
public class SourceDataController {

    private final SourceDataService sourceDataService;
    private final ModelMapper modelMapper;

    @Autowired
    public SourceDataController(SourceDataService sourceDataService, ModelMapper modelMapper) {
        this.sourceDataService = sourceDataService;
        this.modelMapper = modelMapper;
    }

    @GetMapping("/loans")
    public ResponseEntity<List<LoanDTO>> getAllLoans() {
        return ResponseEntity.ok(sourceDataService.getAllLoans().stream()
                .map(loan -> modelMapper.map(loan, LoanDTO.class))
                .collect(Collectors.toList()));
    }

    @GetMapping("/deposits")
    public ResponseEntity<List<DepositDTO>> getAllDeposits() {
        return ResponseEntity.ok(sourceDataService.getAllDeposits().stream()
                .map(dep -> modelMapper.map(dep, DepositDTO.class))
                .collect(Collectors.toList()));
    }

    @GetMapping("/treasury")
    public ResponseEntity<List<TreasuryTradeDTO>> getAllTreasuryTrades() {
        return ResponseEntity.ok(sourceDataService.getAllTreasuryTrades().stream()
                .map(trade -> modelMapper.map(trade, TreasuryTradeDTO.class))
                .collect(Collectors.toList()));
    }

    @GetMapping("/gl")
    public ResponseEntity<List<GeneralLedgerDTO>> getAllGeneralLedgers() {
        return ResponseEntity.ok(sourceDataService.getAllGeneralLedgers().stream()
                .map(gl -> modelMapper.map(gl, GeneralLedgerDTO.class))
                .collect(Collectors.toList()));
    }
}
