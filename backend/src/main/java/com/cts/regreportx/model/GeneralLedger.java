package com.cts.regreportx.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "general_ledger")
@Data
@NoArgsConstructor
public class GeneralLedger {

    @Id
    @Column(name = "\"GLID\"")
    private String glId;

    @Column(name = "\"AccountNumber\"")
    private Long accountNumber;

    @Column(name = "\"BranchID\"")
    private String branchId;

    @Column(name = "\"AccountType\"")
    private String accountType;

    @Column(name = "\"Debit\"")
    private BigDecimal debit;

    @Column(name = "\"Credit\"")
    private BigDecimal credit;

    @Column(name = "\"Currency\"")
    private String currency;

    @Column(name = "\"TransactionDate\"")
    private LocalDate transactionDate;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumn(name = "BatchID")
    @JsonIgnore
    private RawDataBatch rawDataBatch;
}
