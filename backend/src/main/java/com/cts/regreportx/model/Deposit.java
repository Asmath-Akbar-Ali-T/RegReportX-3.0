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
@Table(name = "deposits")
@Data
@NoArgsConstructor
public class Deposit {

    @Id
    @Column(name = "\"DepositID\"")
    private String depositId;

    @Column(name = "\"CustomerID\"")
    private Integer customerId;

    @Column(name = "\"BranchID\"")
    private String branchId;

    @Column(name = "\"DepositType\"")
    private String depositType;

    @Column(name = "\"Amount\"")
    private BigDecimal amount;

    @Column(name = "\"InterestRate\"")
    private BigDecimal interestRate;

    @Column(name = "\"Currency\"")
    private String currency;

    @Column(name = "\"OpenDate\"")
    private LocalDate openDate;

    @Column(name = "\"MaturityDate\"")
    private LocalDate maturityDate;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumn(name = "BatchID")
    @JsonIgnore
    private RawDataBatch rawDataBatch;
}
