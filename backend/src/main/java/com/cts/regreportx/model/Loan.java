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
@Table(name = "loans")
@Data
@NoArgsConstructor
public class Loan {

    @Id
    @Column(name = "\"LoanID\"")
    private String loanId;

    @Column(name = "\"CustomerID\"")
    private Integer customerId;

    @Column(name = "\"BranchID\"")
    private String branchId;

    @Column(name = "\"LoanType\"")
    private String loanType;

    @Column(name = "\"LoanAmount\"")
    private BigDecimal loanAmount;

    @Column(name = "\"InterestRate\"")
    private BigDecimal interestRate;

    @Column(name = "\"Currency\"")
    private String currency;

    @Column(name = "\"StartDate\"")
    private LocalDate startDate;

    @Column(name = "\"MaturityDate\"")
    private LocalDate maturityDate;

    @Column(name = "\"Status\"")
    private String status;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumn(name = "BatchID")
    @JsonIgnore
    private RawDataBatch rawDataBatch;
}
